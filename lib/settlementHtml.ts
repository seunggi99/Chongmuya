/**
 * 연간 결산 PDF 용 완성 HTML (puppeteer 로 렌더). 5개 섹션 포함.
 * 차트는 자체 HTML 막대로 그린다(recharts 미사용 — 서버 자립 HTML).
 */
import { formatWon, formatDateRange, formatDate } from "@/lib/format";
import type { SessionSettlementView, SettlementData } from "@/types";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderSettlementHtml(data: SettlementData): string {
  const { summary } = data;

  const summaryCards = `
    <div class="cards">
      <div class="card"><div class="card-l">총수입</div><div class="card-v income">${formatWon(summary.totalIncome)}</div></div>
      <div class="card"><div class="card-l">총지출</div><div class="card-v expense">${formatWon(summary.totalExpense)}</div></div>
      <div class="card"><div class="card-l">총잔액</div><div class="card-v balance">${formatWon(summary.totalBalance)}</div></div>
      <div class="card"><div class="card-l">회차수</div><div class="card-v">${summary.sessionCount}회</div></div>
    </div>`;

  const sessionRows =
    data.sessions.length > 0
      ? data.sessions
          .map(
            (s) => `<tr>
        <td>${esc(s.shortLabel)}</td>
        <td>${esc(s.location)}</td>
        <td>${esc(formatDateRange(s.date_start, s.date_end))}</td>
        <td class="num income">${formatWon(s.income)}</td>
        <td class="num expense">${formatWon(s.expense)}</td>
        <td class="num strong">${formatWon(s.balance)}</td>
      </tr>`,
          )
          .join("")
      : `<tr><td colspan="6" class="empty">작성된 일지가 없습니다.</td></tr>`;

  const maxExp = Math.max(1, ...data.expenseByCategory.map((c) => c.amount));
  const expBars =
    data.expenseByCategory.length > 0
      ? data.expenseByCategory
          .map(
            (c) => `<div class="bar-row">
        <div class="bar-name">${esc(c.name)}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.round((c.amount / maxExp) * 100)}%"></div></div>
        <div class="bar-val">${formatWon(c.amount)}</div>
      </div>`,
          )
          .join("")
      : `<div class="empty">지출 내역이 없습니다.</div>`;

  const duesRows =
    data.dues.length > 0
      ? data.dues
          .map(
            (d) =>
              `<tr><td>${esc(d.member.name)}</td><td class="num">${
                d.paid
                  ? `<span class="paid">완납${d.paidAt ? " · " + esc(formatDate(d.paidAt)) : ""}</span>`
                  : `<span class="unpaid">미납</span>`
              }</td></tr>`,
          )
          .join("")
      : `<tr><td colspan="2" class="empty">회원이 없습니다.</td></tr>`;

  const cashRows =
    data.donations.length > 0
      ? data.donations
          .map(
            (d) =>
              `<tr><td>${esc(d.name)}</td><td class="num income">${formatWon(d.amount)}</td></tr>`,
          )
          .join("")
      : `<tr><td colspan="2" class="empty">내역 없음</td></tr>`;

  const goodsList =
    data.goods.length > 0
      ? `<ul class="goods">${data.goods
          .map(
            (g) =>
              `<li>${g.donorName ? esc(g.donorName) + " — " : ""}${esc(g.item)}</li>`,
          )
          .join("")}</ul>`
      : `<div class="empty">내역 없음</div>`;

  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"/>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css"/>
<style>
  * { box-sizing: border-box; }
  html, body { margin:0; padding:0; background:#fff; }
  body { font-family: Pretendard, system-ui, sans-serif; color:#111827; font-size:12px; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .wrap { padding:24px; max-width:780px; margin:0 auto; }
  h1 { text-align:center; font-size:20px; font-weight:700; margin:0 0 18px; }
  h2 { font-size:14px; font-weight:700; margin:18px 0 8px; }
  .income { color:#16A34A; } .expense { color:#DC2626; } .balance { color:#2563EB; }
  .cards { display:flex; gap:8px; }
  .card { flex:1; border:1px solid #e5e7eb; border-radius:8px; padding:8px 10px; }
  .card-l { font-size:11px; color:#6b7280; }
  .card-v { font-size:15px; font-weight:700; margin-top:2px; }
  table { width:100%; border-collapse:collapse; }
  th, td { border:1px solid #e5e7eb; padding:5px 8px; text-align:left; }
  th { background:#f9fafb; color:#6b7280; font-weight:600; font-size:11px; }
  .num { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
  .strong { font-weight:700; }
  .empty { color:#9ca3af; text-align:center; padding:10px; }
  .bar-row { display:flex; align-items:center; gap:8px; margin:4px 0; }
  .bar-name { width:90px; flex-shrink:0; color:#374151; }
  .bar-track { flex:1; height:14px; background:#f3f4f6; border-radius:4px; overflow:hidden; }
  .bar-fill { height:100%; background:#DC2626; border-radius:4px; }
  .bar-val { width:90px; text-align:right; white-space:nowrap; font-variant-numeric:tabular-nums; }
  .paid { color:#16A34A; font-weight:600; }
  .unpaid { color:#9ca3af; }
  .two { display:flex; gap:12px; }
  .two > div { flex:1; }
  .goods { margin:0; padding-left:18px; }
  .goods li { margin:2px 0; }
</style></head>
<body><div class="wrap">
  <h1>${data.year}년 연간 결산</h1>
  ${summaryCards}

  <h2>회차별 결산</h2>
  <table>
    <thead><tr><th>회차</th><th>장소</th><th>일자</th><th class="num">수입</th><th class="num">지출</th><th class="num">잔액</th></tr></thead>
    <tbody>${sessionRows}</tbody>
  </table>

  <h2>분류별 지출</h2>
  <div>${expBars}</div>

  <h2>연회비 납부 현황 (${esc(data.duesYearLabel)})</h2>
  <table><tbody>${duesRows}</tbody></table>

  <h2>찬조 현황</h2>
  <div class="two">
    <div>
      <table><thead><tr><th>현금 찬조</th><th class="num">금액</th></tr></thead><tbody>${cashRows}</tbody></table>
    </div>
    <div>
      <div style="font-weight:600;color:#374151;margin-bottom:6px;">물품 찬조</div>
      ${goodsList}
    </div>
  </div>
</div></body></html>`;
}

/** 회차별 정산서 PDF HTML (결산 뷰, 귀속 기준) */
export function renderSessionSettlementHtml(data: SessionSettlementView): string {
  const s = data.session;
  const rowsHtml = (rows: { name: string; amount: number }[]) =>
    rows.length > 0
      ? rows
          .map(
            (r) =>
              `<tr><td>${esc(r.name)}</td><td class="num">${formatWon(r.amount)}</td></tr>`,
          )
          .join("")
      : `<tr><td colspan="2" class="empty">내역 없음</td></tr>`;

  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"/>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css"/>
<style>
  * { box-sizing: border-box; }
  html, body { margin:0; padding:0; background:#fff; }
  body { font-family: Pretendard, system-ui, sans-serif; color:#111827; font-size:12px; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .wrap { padding:24px; max-width:680px; margin:0 auto; }
  h1 { text-align:center; font-size:20px; font-weight:700; margin:0 0 4px; }
  .sub { text-align:center; color:#6b7280; margin:0 0 4px; }
  .note { color:#92400e; background:#fffbeb; border:1px solid #fde68a; border-radius:6px; padding:6px 10px; font-size:11px; margin:12px 0; }
  .two { display:flex; gap:12px; }
  .two > div { flex:1; }
  .h { font-weight:700; margin:0 0 6px; }
  .income { color:#16A34A; } .expense { color:#DC2626; } .balance { color:#2563EB; }
  table { width:100%; border-collapse:collapse; }
  th, td { border:1px solid #e5e7eb; padding:5px 8px; text-align:left; }
  .num { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
  tfoot td { font-weight:700; background:#f9fafb; }
  .empty { color:#9ca3af; text-align:center; }
  .total { display:flex; justify-content:space-between; align-items:center; border:1px solid #e5e7eb; border-radius:8px; background:#eff6ff; padding:12px 16px; margin-top:14px; }
  .total b { font-size:16px; }
</style></head>
<body><div class="wrap">
  <h1>${esc(s.shortLabel)} 정산서</h1>
  <p class="sub">${esc(s.typeName)} · ${esc(s.location)} · ${esc(formatDateRange(s.date_start, s.date_end))}</p>
  <div class="note">결산 뷰: 이 회차에 귀속된 수입·지출만 (선입금/선지급은 귀속회차로 집계). 통장 잔액과 다를 수 있습니다.</div>

  <div class="two">
    <div>
      <div class="h income">수입</div>
      <table><tbody>${rowsHtml(data.income)}</tbody>
        <tfoot><tr><td>합계</td><td class="num income">${formatWon(data.totalIncome)}</td></tr></tfoot>
      </table>
    </div>
    <div>
      <div class="h expense">지출</div>
      <table><tbody>${rowsHtml(data.expense)}</tbody>
        <tfoot><tr><td>합계</td><td class="num expense">${formatWon(data.totalExpense)}</td></tr></tfoot>
      </table>
    </div>
  </div>

  <div class="total"><span>결산 잔액 (수입 − 지출)</span><b class="balance">${formatWon(data.balance)}</b></div>
</div></body></html>`;
}
