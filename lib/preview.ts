/**
 * 일지 미리보기/출력 단일 소스.
 *  - renderPreviewBody(data): 엑셀 양식을 재현한 HTML 문자열(시맨틱 클래스)
 *  - PREVIEW_CSS: 위 HTML 용 스타일 (#preview-target 스코프)
 * 화면(SessionPreview, JPG html2canvas)과 PDF(puppeteer)가 동일 마크업을 공유한다.
 * (server-only 아님 — 클라이언트/서버 양쪽에서 사용)
 *
 * ※ JPG(html2canvas)는 vertical-align:middle 을 제대로 못 읽어 글자가 셀 하단으로
 *   쏠린다. 그래서 모든 셀 내용을 flex 래퍼(.pv-c: display:flex; align-items:center)
 *   로 감싸 수직 중앙을 강제한다. 가로 정렬은 pv-c-l/r/c 로 제어.
 */
import { SESSION_TYPE_LABEL } from "@/types";
import { formatDateRange, formatWon } from "@/lib/format";
import type { PreviewEntryView, SessionDetailView } from "@/types";

/** HTML 이스케이프 (DB 값이 마크업을 깨지 않도록) */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 셀 내용 flex 래퍼 — align: l(왼쪽)/r(오른쪽)/c(가운데) */
function wrap(html: string, align: "l" | "r" | "c" = "l"): string {
  return `<div class="pv-c pv-c-${align}">${html}</div>`;
}

const sum = (entries: PreviewEntryView[]) =>
  entries.reduce((acc, e) => acc + e.amount, 0);

/**
 * 분류 옆 괄호 표기.
 *  - 회원연동 분류(당일회비/찬조/연회비)는 상세=회원명단이므로 괄호 생략
 *    (참석자/찬조는 상단 명단에서 확인, 줄이 너무 길어짐 방지)
 *  - 일반 분류는 상세항목 라벨(식당명 등) 유지
 */
function parenText(e: PreviewEntryView): string {
  if (e.special) return ""; // daily_fee | donation | annual_dues
  return e.details
    .map((d) => d.label)
    .filter(Boolean)
    .join("·");
}

function entryRow(e: PreviewEntryView): string {
  const paren = parenText(e);
  const cross =
    e.crossSessionNumber != null
      ? `<span class="pv-cross">→${e.crossSessionNumber}차</span>`
      : "";
  const parenHtml = paren
    ? ` <span class="pv-paren">(${esc(paren)})</span>`
    : "";
  return `<tr><td class="pv-cat">${wrap(`${esc(e.categoryName)}${cross}${parenHtml}`)}</td><td class="pv-amt">${wrap(formatWon(e.amount), "r")}</td></tr>`;
}

function colTable(
  title: string,
  entries: PreviewEntryView[],
  toneClass: string,
): string {
  const rows =
    entries.length > 0
      ? entries.map(entryRow).join("")
      : `<tr><td class="pv-empty" colspan="2">${wrap("내역 없음", "c")}</td></tr>`;
  return `<div class="pv-col">
    <div class="pv-col-h ${toneClass}">${title}</div>
    <table class="pv-tbl">${rows}
      <tr class="pv-sum"><td>${wrap("합계")}</td><td class="pv-amt">${wrap(formatWon(sum(entries)), "r")}</td></tr>
    </table>
  </div>`;
}

function balanceRows(b: SessionDetailView["balance"]): string {
  const row = (label: string, value: number, cls = "") =>
    `<tr class="${cls}"><td>${wrap(label)}</td><td class="pv-amt">${wrap(formatWon(value), "r")}</td></tr>`;
  const hasCross = b.crossIncome !== 0 || b.crossExpense !== 0;
  return [
    row("당일 수입", b.dailyIncome),
    row("당일 지출", b.dailyExpense),
    row("당일 잔액", b.dailyBalance, "pv-mid"),
    hasCross ? row("교차 수입 (선입금)", b.crossIncome) : "",
    hasCross ? row("교차 지출 (선지급)", b.crossExpense) : "",
    row("이월금", b.carryOver),
    row("총 잔액", b.total, "pv-total"),
  ].join("");
}

export function renderPreviewBody(data: SessionDetailView): string {
  const { session: s, attendees, entries, goods, balance } = data;

  const title = `제${s.number}차 ${SESSION_TYPE_LABEL[s.type]}`;
  const dateStr = formatDateRange(s.date_start, s.date_end);
  // formatWon 이 이미 "원"을 붙이므로 추가로 붙이지 않는다
  const feeStr =
    s.fee_per_person > 0 ? `1인 ${formatWon(s.fee_per_person)}` : "—";

  const members = attendees.filter((a) => a.type === "member");
  const generals = attendees.filter((a) => a.type === "general");
  const nameList = (names: string[]) =>
    names.length > 0 ? esc(names.join(" · ")) : "—";

  const income = entries.filter((e) => e.kind === "income");
  const expense = entries.filter((e) => e.kind === "expense");

  // 찬조: 현금(분류 special=donation) + 물품
  const cashDonations = income.filter((e) => e.special === "donation");
  const cashStr = cashDonations
    .map(
      (e) =>
        `${esc(e.memberNames.join("·") || e.categoryName)} ${formatWon(e.amount)}`,
    )
    .join(" / ");
  const goodsStr = goods
    .map((g) => `${g.donorName ? esc(g.donorName) + " — " : ""}${esc(g.item)}`)
    .join(" / ");

  // 영수증 첨부
  const receipts = entries.flatMap((e) =>
    e.details
      .filter((d) => d.receipt_url)
      .map((d) => ({
        label: d.label || e.categoryName,
        url: d.receipt_url as string,
      })),
  );

  const donationBlock =
    cashStr || goodsStr
      ? `<table class="pv-info">
          ${cashStr ? `<tr><th>${wrap("현금 찬조")}</th><td>${wrap(cashStr)}</td></tr>` : ""}
          ${goodsStr ? `<tr><th>${wrap("물품 찬조")}</th><td>${wrap(goodsStr)}</td></tr>` : ""}
        </table>`
      : "";

  const receiptBlock =
    receipts.length > 0
      ? `<div class="pv-receipts">
          <div class="pv-receipts-h">영수증 첨부 (${receipts.length})</div>
          <div class="pv-receipts-list">
            ${receipts
              .map(
                (r) =>
                  `<figure class="pv-receipt"><img src="${esc(r.url)}" alt="${esc(r.label)}" crossorigin="anonymous"/><figcaption>${esc(r.label)}</figcaption></figure>`,
              )
              .join("")}
          </div>
        </div>`
      : "";

  return `<div class="pv">
    <div class="pv-title">${esc(title)}</div>

    <table class="pv-info">
      <tr>
        <th>${wrap("장소")}</th><td>${wrap(esc(s.location))}</td>
        <th>${wrap("일자")}</th><td>${wrap(esc(dateStr))}</td>
        <th>${wrap("당일회비")}</th><td>${wrap(esc(feeStr))}</td>
      </tr>
    </table>

    <table class="pv-info">
      <tr><th>${wrap(`회원 (${members.length})`)}</th><td>${wrap(nameList(members.map((m) => m.name)))}</td></tr>
      <tr><th>${wrap(`일반회원 (${generals.length})`)}</th><td>${wrap(nameList(generals.map((m) => m.name)))}</td></tr>
      <tr><th>${wrap("참석 합계")}</th><td>${wrap(`총 ${attendees.length}명`)}</td></tr>
    </table>

    ${donationBlock}

    <div class="pv-two">
      ${colTable("수입", income, "pv-income")}
      ${colTable("지출", expense, "pv-expense")}
    </div>

    <table class="pv-balance">${balanceRows(balance)}</table>

    <table class="pv-sign">
      <tr>
        <td class="pv-sign-label" rowspan="2">${wrap("결제", "c")}</td>
        <td class="pv-sign-head">${wrap("총무", "c")}</td>
        <td class="pv-sign-head">${wrap("회장", "c")}</td>
      </tr>
      <tr>
        <td class="pv-sign-name">${wrap(esc(s.treasurer ?? ""), "c")}</td>
        <td class="pv-sign-name">${wrap(esc(s.chairperson ?? ""), "c")}</td>
      </tr>
    </table>

    ${receiptBlock}
    ${s.note ? `<div class="pv-note">${esc(s.note)}</div>` : ""}
  </div>`;
}

/** 미리보기 스타일 (#preview-target 스코프) */
export const PREVIEW_CSS = `
#preview-target { background:#fff; color:#111827; font-size:13px; }
#preview-target .pv { padding:24px; max-width:780px; margin:0 auto; }
#preview-target .pv-title { text-align:center; font-size:22px; font-weight:700; margin-bottom:16px; letter-spacing:-0.02em; }
#preview-target table { width:100%; border-collapse:collapse; margin-bottom:12px; }
/* JPG(html2canvas) 수직 쏠림 방지: 셀 내용을 flex 로 수직 가운데 */
#preview-target .pv-c { display:flex; align-items:center; min-height:1.4em; line-height:1.3; }
#preview-target .pv-c-l { justify-content:flex-start; }
#preview-target .pv-c-r { justify-content:flex-end; }
#preview-target .pv-c-c { justify-content:center; }
#preview-target .pv-info th { background:#f9fafb; text-align:left; font-weight:600; color:#374151; white-space:nowrap; width:1%; padding:6px 10px; border:1px solid #e5e7eb; }
#preview-target .pv-info td { padding:6px 10px; border:1px solid #e5e7eb; }
#preview-target .pv-two { display:flex; gap:12px; align-items:flex-start; margin-bottom:12px; }
#preview-target .pv-col { flex:1; min-width:0; }
#preview-target .pv-col-h { font-weight:700; padding:6px 10px; border:1px solid #e5e7eb; border-bottom:none; }
#preview-target .pv-income { color:#16A34A; background:#f0fdf4; }
#preview-target .pv-expense { color:#DC2626; background:#fef2f2; }
#preview-target .pv-tbl td { padding:6px 10px; border:1px solid #e5e7eb; }
#preview-target .pv-cat { word-break:break-word; }
#preview-target .pv-paren { color:#6b7280; font-size:12px; }
#preview-target .pv-cross { color:#D97706; font-size:11px; margin-left:4px; }
#preview-target .pv-amt { text-align:right; white-space:nowrap; font-variant-numeric:tabular-nums; }
#preview-target .pv-empty { color:#9ca3af; }
#preview-target .pv-sum td { font-weight:700; background:#f9fafb; }
#preview-target .pv-balance td { padding:6px 12px; border:1px solid #e5e7eb; }
#preview-target .pv-balance td:first-child { color:#374151; }
#preview-target .pv-balance .pv-mid td { font-weight:600; background:#f9fafb; }
#preview-target .pv-balance .pv-total td { font-weight:700; font-size:15px; color:#2563EB; background:#eff6ff; }
/* 결제란: 원본 양식대로 우측 하단 작은 박스 (3열x2행, '결제' 세로병합) */
#preview-target .pv-sign { width:34%; margin:6px 0 4px auto; border-collapse:collapse; }
#preview-target .pv-sign td { border:1px solid #d1d5db; padding:5px 8px; font-size:12px; }
#preview-target .pv-sign-label { background:#f9fafb; font-weight:600; color:#374151; width:26%; }
#preview-target .pv-sign-head { background:#f9fafb; color:#6b7280; }
#preview-target .pv-sign-name { color:#111827; font-weight:600; }
#preview-target .pv-sign-name .pv-c { min-height:26px; }
#preview-target .pv-receipts-h { font-weight:600; color:#374151; margin:8px 0; }
#preview-target .pv-receipts-list { display:flex; flex-wrap:wrap; gap:10px; }
#preview-target .pv-receipt { margin:0; width:120px; }
#preview-target .pv-receipt img { width:120px; height:90px; object-fit:cover; border:1px solid #e5e7eb; border-radius:6px; display:block; }
#preview-target .pv-receipt figcaption { font-size:11px; color:#6b7280; margin-top:3px; text-align:center; word-break:break-word; }
#preview-target .pv-note { margin-top:10px; padding:8px 10px; border:1px solid #e5e7eb; border-radius:6px; color:#6b7280; font-size:12px; white-space:pre-wrap; }
`;
