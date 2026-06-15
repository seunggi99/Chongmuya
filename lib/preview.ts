/**
 * 일지 미리보기/출력 단일 소스.
 *  - renderPreviewBody(data): 엑셀 양식을 재현한 HTML 문자열(시맨틱 클래스)
 *  - PREVIEW_CSS: 위 HTML 용 스타일 (#preview-target 스코프)
 * 화면(SessionPreview), PDF·JPG(둘 다 puppeteer 실제 크롬 렌더)가 동일 마크업을 공유.
 * (server-only 아님 — 클라이언트/서버 양쪽에서 사용)
 *
 * 셀 내용은 flex 래퍼(.pv-c)로 감싸 수직 가운데 정렬한다(내부 span 으로 멀티라인 허용).
 */
import { formatDateRange, formatKRW, formatWon } from "@/lib/format";
import type { PreviewEntryView, SessionDetailView } from "@/types";

/** HTML 이스케이프 (DB 값이 마크업을 깨지 않도록) */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 셀 내용 flex 래퍼 — align: l(왼쪽)/r(오른쪽)/c(가운데). 내부 span 으로 멀티라인 지원 */
function wrap(html: string, align: "l" | "r" | "c" = "l"): string {
  return `<div class="pv-c pv-c-${align}"><span>${html}</span></div>`;
}

const sum = (entries: PreviewEntryView[]) =>
  entries.reduce((acc, e) => acc + e.amount, 0);

/**
 * 분류 옆 괄호 표기.
 *  - 회원연동 분류(당일회비/찬조/연회비)는 상세=회원명단이므로 괄호 생략
 *  - 일반 분류는 상세항목 라벨(식당명 등) 유지
 */
function parenText(e: PreviewEntryView): string {
  if (e.special) return "";
  return e.details
    .map((d) => d.label)
    .filter(Boolean)
    .join("·");
}

function entryRow(e: PreviewEntryView): string {
  const paren = parenText(e);
  const parenHtml = paren
    ? ` <span class="pv-paren">(${esc(paren)})</span>`
    : "";

  // 교차항목: [선입금/선지급] · 원래 분류명 (→대상회차). 분류명 자체는 그대로 유지.
  let label: string;
  if (e.crossSessionLabel) {
    const kindLabel = e.kind === "income" ? "선입금" : "선지급";
    label = `<span class="pv-cross">${kindLabel} ·</span> ${esc(e.categoryName)} <span class="pv-cross">(→${esc(e.crossSessionLabel)})</span>`;
  } else {
    label = esc(e.categoryName);
  }

  return `<tr><td class="pv-cat">${wrap(`${label}${parenHtml}`)}</td><td class="pv-amt">${wrap(formatWon(e.amount), "r")}</td></tr>`;
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
    hasCross ? row("선입금 (다른 회차)", b.crossIncome) : "",
    hasCross ? row("선지급 (다른 회차)", b.crossExpense) : "",
    row("이월금", b.carryOver),
    row("총 잔액", b.total, "pv-total"),
  ].join("");
}

/** 상단 표 — 장소/일자 · 참석자 · 당일회비 · 찬조 · 물품찬조 (원본 엑셀 양식) */
function topTable(data: SessionDetailView): string {
  const { session: s, attendees, goods } = data;
  const dateStr = formatDateRange(s.date_start, s.date_end);

  const members = attendees.filter((a) => a.type === "member");
  const generals = attendees.filter((a) => a.type === "general");
  // 원본 740차 방식: 명단 끝에 "/ N명" 통합 (별도 인원 칸 제거)
  const attLine = (names: string[]) =>
    names.length > 0
      ? `${esc(names.join(" · "))} <span class="pv-cnt-inline">/ ${names.length}명</span>`
      : "—";

  const attendeeCount = attendees.length;
  const fee = s.fee_per_person;
  const prepaid = data.prepaidDailyFeeNames;
  const prepaidCount = prepaid.length;

  // 당일회비 행 (단가>0일 때만): 합계 = 단가×참가, 계산식 = 실제 입금액(선납 차감)
  let dailyFeeRow = "";
  if (fee > 0 && attendeeCount > 0) {
    const fullDaily = fee * attendeeCount;
    const actualCount = Math.max(0, attendeeCount - prepaidCount);
    const actualAmount = fee * actualCount;
    const formula =
      prepaidCount === 0
        ? `${formatKRW(fee)} × ${attendeeCount}명 = ${formatKRW(fullDaily)}`
        : `${formatKRW(fee)} × (${attendeeCount} - ${prepaidCount})명 = ${formatKRW(actualAmount)} <span class="pv-prepaid">(${esc(prepaid.join("·"))} 선입금)</span>`;
    dailyFeeRow = `<tr>
      <th class="pv-lbl" colspan="2">${wrap(`당일회비<br><span class="pv-sub">1인 ${formatWon(fee)}</span>`, "c")}</th>
      <td class="pv-amt">${wrap(formatWon(fullDaily), "r")}</td>
      <th class="pv-lbl">${wrap("합계", "c")}</th>
      <td>${wrap(formula)}</td>
    </tr>`;
  }

  // 찬조: 현금(special=donation) + 물품
  const cashDonations = data.entries.filter(
    (e) => e.kind === "income" && e.special === "donation",
  );
  const cashStr = cashDonations
    .map(
      (e) =>
        `${esc(e.memberNames.join("·") || e.categoryName)} ${formatWon(e.amount)}`,
    )
    .join(" / ");
  const goodsStr = goods
    .map((g) => `${g.donorName ? esc(g.donorName) + " — " : ""}${esc(g.item)}`)
    .join(" / ");

  // 5열 구조(A:참석자라벨 · B:회원/일반회원 라벨 · C:값 시작 · D,E:일자/명단 확장)
  // 장소·당일회비·찬조 라벨은 A+B(colspan2)로 좌측 라벨영역을 채우고,
  // 명단은 장소 값과 같은 C 열에서 시작하도록 정렬한다.
  return `<table class="pv-top">
    <colgroup>
      <col style="width:10%"><col style="width:13%"><col style="width:27%"><col style="width:12%"><col style="width:38%">
    </colgroup>
    <tr>
      <th class="pv-lbl" colspan="2">${wrap("장소")}</th>
      <td>${wrap(esc(s.location))}</td>
      <th class="pv-lbl">${wrap("일자")}</th>
      <td>${wrap(esc(dateStr))}</td>
    </tr>
    <tr>
      <th class="pv-lbl pv-att" rowspan="2">${wrap(`참석자<br><span class="pv-sub">총 ${attendeeCount}명</span>`, "c")}</th>
      <th class="pv-lbl pv-sublbl">${wrap("회원", "c")}</th>
      <td colspan="3">${wrap(attLine(members.map((m) => m.name)))}</td>
    </tr>
    <tr>
      <th class="pv-lbl pv-sublbl">${wrap("일반회원", "c")}</th>
      <td colspan="3">${wrap(attLine(generals.map((m) => m.name)))}</td>
    </tr>
    ${dailyFeeRow}
    ${cashStr ? `<tr><th class="pv-lbl" colspan="2">${wrap("찬조")}</th><td colspan="3">${wrap(cashStr)}</td></tr>` : ""}
    ${goodsStr ? `<tr><th class="pv-lbl" colspan="2">${wrap("물품 찬조")}</th><td colspan="3">${wrap(goodsStr)}</td></tr>` : ""}
  </table>`;
}

export function renderPreviewBody(data: SessionDetailView): string {
  const { session: s, entries, balance } = data;

  const title = data.title;
  const income = entries.filter((e) => e.kind === "income");
  const expense = entries.filter((e) => e.kind === "expense");

  // 영수증 첨부
  const receipts = entries.flatMap((e) =>
    e.details
      .filter((d) => d.receipt_url)
      .map((d) => ({
        label: d.label || e.categoryName,
        url: d.receipt_url as string,
      })),
  );

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

    ${topTable(data)}

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
#preview-target td, #preview-target th { vertical-align:middle; }
/* 셀 내용 수직 가운데(내부 span 으로 멀티라인 허용) */
#preview-target .pv-c { display:flex; align-items:center; min-height:1.6em; }
#preview-target .pv-c > span { display:inline-block; max-width:100%; line-height:1.35; }
#preview-target .pv-c-l { justify-content:flex-start; }
#preview-target .pv-c-l > span { text-align:left; }
#preview-target .pv-c-r { justify-content:flex-end; }
#preview-target .pv-c-r > span { text-align:right; }
#preview-target .pv-c-c { justify-content:center; }
#preview-target .pv-c-c > span { text-align:center; }
/* 상단 표 — colgroup 폭(50/50 분할)을 강제하려 table-layout:fixed */
#preview-target .pv-top { table-layout:fixed; }
#preview-target .pv-top td, #preview-target .pv-top th { border:1px solid #e5e7eb; padding:5px 10px; word-break:break-word; }
#preview-target .pv-lbl { background:#f1f5f0; color:#374151; font-weight:600; white-space:nowrap; width:1%; }
#preview-target .pv-sublbl { font-weight:500; color:#4b5563; }
#preview-target .pv-att { text-align:center; }
#preview-target .pv-cnt { white-space:nowrap; width:1%; }
#preview-target .pv-cnt-inline { color:#6b7280; font-size:11px; white-space:nowrap; }
#preview-target .pv-sub { font-weight:400; font-size:11px; color:#6b7280; }
#preview-target .pv-prepaid { color:#D97706; font-size:11px; margin-left:4px; }
#preview-target .pv-two { display:flex; gap:12px; align-items:flex-start; margin-bottom:12px; }
#preview-target .pv-col { flex:1; min-width:0; }
#preview-target .pv-col-h { font-weight:700; padding:6px 10px; border:1px solid #e5e7eb; border-bottom:none; }
#preview-target .pv-income { color:#16A34A; background:#f0fdf4; }
#preview-target .pv-expense { color:#DC2626; background:#fef2f2; }
#preview-target .pv-tbl td { padding:6px 10px; border:1px solid #e5e7eb; }
#preview-target .pv-cat { word-break:break-word; }
#preview-target .pv-paren { color:#6b7280; font-size:12px; }
#preview-target .pv-cross { color:#D97706; font-size:11px; font-weight:600; white-space:nowrap; }
#preview-target .pv-amt { text-align:right; white-space:nowrap; font-variant-numeric:tabular-nums; }
#preview-target .pv-empty { color:#9ca3af; }
#preview-target .pv-sum td { font-weight:700; background:#f9fafb; }
#preview-target .pv-balance td { padding:6px 12px; border:1px solid #e5e7eb; }
#preview-target .pv-balance td:first-child { color:#374151; }
#preview-target .pv-balance .pv-mid td { font-weight:600; background:#f9fafb; }
#preview-target .pv-balance .pv-total td { font-weight:700; font-size:15px; color:#2563EB; background:#eff6ff; }
/* 결제란: 우측 하단 작은 박스 (3열x2행, '결제' 세로병합) */
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
