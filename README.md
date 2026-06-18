# 총무야 (chongmuya)

> 등산·취미 모임의 경비를 관리하는 웹 서비스. 회차별 경비 일지를 작성하면 수입/지출과 잔액증명을 자동 계산하고 PDF/JPG로 출력한다.

**데모**: https://chongmuya-demo.vercel.app

![Next.js](https://img.shields.io/badge/Next.js_16-000000?style=flat-square&logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?style=flat-square&logo=supabase&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white)
![Built with Claude Code](https://img.shields.io/badge/Built_with-Claude_Code-D97757?style=flat-square&logo=anthropic&logoColor=white)

<table>
  <tr>
    <td align="center"><b>일지 작성 (6단계)</b><br><img src="https://github.com/user-attachments/assets/a5247301-6175-4ab1-b700-4ddcd23bb5bf" width="320" /></td>
    <td align="center"><b>결산 + 차트</b><br><img src="https://github.com/user-attachments/assets/224363e7-dcda-4a29-a532-85643badf79e" width="320" /></td>
    <td align="center"><b>PDF/JPG 출력</b><br><img src="https://github.com/user-attachments/assets/1cc0f3bf-395c-4112-a3fe-15970547f1d7" width="320" /></td>
  </tr>
</table>

---

## 개요

**AI 페어 프로그래밍(Claude Code)으로 기획부터 배포까지 약 8시간 만에 단독으로 완성한 프로젝트입니다.**   
구현 속도는 AI로 끌어올리되, 설계 결정과 핵심 회계 로직, 막힌 디버깅처럼 사람이 판단해야 할 지점은 직접 파고들었습니다. 그 덕에 2일이라는 짧은 기간에도 실제로 쓸 수 있는 완성도까지 끌어올렸습니다.

| 판단·개입한 지점 | AI로 구현한 부분 |
| --- | --- |
| 데이터 모델·아키텍처 결정, 회계 로직(통장/결산 이중 집계) 설계, **막힌 버그 원인 규명·배포 트러블슈팅** | UI 구현, 컴포넌트·폼·스타일 마크업, 단순 CRUD 와이어링, 보일러플레이트 |

> **핵심 설계 난제.** 회차를 넘나드는 선입금/선지급을 *통장 잔액*과 *회차 결산* 두 관점에서 동시에 정합하게 집계하는 도메인 모델링.

---

## 핵심 요약

- **무엇.** 엑셀로 손계산하던 모임 경비 장부를 웹으로 옮긴, 실사용 목적의 프로젝트
- **왜 어려운가.** 단순 가계부가 아니라 **"통장 잔액 증명"과 "회차별 결산"을 동시에** 맞춰야 함
- **결과.** 은행 거래내역을 올려 체크만 하면 통장 잔액이 안 틀어지고, 일지·연간 결산이 자동 산출

실제 산악회가 엑셀로 수동 관리하던 경비 일지를 분석해 도메인 요구사항을 도출했다(이월금 옮겨 적기, 잔액 손계산, 은행내역 타이핑, 교차 회차 수기 분리 같은 반복·오류 지점을 자동화).

#### 통장 뷰 vs 결산 뷰 — 같은 항목, 다른 집계

| 항목 (예) | 통장 뷰 *(발생 회차)* | 결산 뷰 *(귀속 회차)* |
| --- | --- | --- |
| 선입금 회비 `+100,000` | 받은 회차 통장에 `+100,000` | **대상 회차** 수입으로 집계 |
| 선지급 숙박 `−200,000` | 낸 회차 통장에서 `−200,000` | **대상 회차** 지출로 집계 |

통장 합계(잔액증명)와 결산 합계(정산)는 의도대로 달라지면서도, 두 값이 항상 정합하게 유지된다.

---

## AI 협업 방식

**워크플로우**
- **설계 먼저, 구현은 위임.** `claude.md`를 단일 진실 공급원으로 두고 스키마·로직·컨벤션을 문서화한 뒤 그 명세대로 구현
- **작게 쪼개 관리.** 빌드·타입체크·ESLint를 통과할 때만 커밋해 산출물 품질을 일정하게 유지

**직접 판단·설계한 핵심**
- **교차 회차 이중 집계** *(이 프로젝트의 핵심 난제)* — 선입금/선지급을 별도 테이블이 아니라 `entries.cross_session_id`로 모델링해, 같은 항목을 통장 뷰엔 *발생 회차*로 / 결산 뷰엔 *귀속 회차*로 집계. 잔액 공식을 `lib/balance.ts` 한 곳에 모아 두 관점의 정합성을 보장
- **데이터 정합성.** 저장 시 서버에서 재검증하고(`상세 합 = entry.amount`, `분할 합 = 원본`), 다중 행 저장이 실패하면 보상 롤백(`lib/sessionsSave.ts`)으로 부분 저장을 방지
- **확장성.** 분류·행사 유형·직책·연회비 규칙을 코드 상수가 아니라 DB/설정으로 일반화(다른 모임에도 코드 수정 없이 제공)

**막혔을 때 직접 추적해 해결한 사례**
- **결산 잔액 버그.** `bigint` 문자열 직렬화(`0 + "5000" = "05000"`)가 원인임을 추적해, 숫자 변환을 `lib/balance.ts` 한 곳으로 모아 처방
- **Vercel PDF 실패.** 1차 외부화로 안 풀리자 추측을 멈추고 빌드 산출물의 파일 트레이스(`.nft.json`)를 직접 분석해, chromium 바이너리(`bin/*.br`) 누락을 확정하고 `outputFileTracingIncludes`로 해결
- **잠긴 엑셀 복호화.** "비밀번호가 맞는데도 실패"하는 증상을 포착하고 SheetJS 내장 복호화의 한계를 확인해, `officecrypto-tool` 선복호화로 전환
- **JPG 한글 정렬 깨짐.** `html2canvas`의 한글 베이스라인 어긋남을 발견하고 서버 puppeteer 렌더로 전환해 PDF와 결과를 일치

---

## 기술 스택

| 영역 | 사용 기술 |
| --- | --- |
| 프레임워크 | Next.js 16 (App Router · Server Components / Server Actions) |
| 언어 | TypeScript (strict) |
| 스타일 | Tailwind CSS |
| DB / 인증 / 저장 | Supabase (PostgreSQL · Auth · Storage) |
| 차트 | Recharts |
| PDF·JPG 출력 | puppeteer-core + @sparticuz/chromium (서버 렌더) |
| 은행내역 파싱 | SheetJS(xlsx) · unpdf(PDF) · officecrypto-tool(암호 파일) |
| 배포 | Vercel (프론트 + API Routes) + Supabase |

---

## 핵심 기능

- **회차별 경비 일지 작성.** 6단계 폼(기본정보 → 참석자 → 수입 → 지출 → 선입금/선지급 → 확인). 당일회비·찬조·연회비는 회원 연동
- **일지(통장 뷰) vs 결산(귀속 뷰) 분리** *(이 프로젝트의 핵심)* — 선입금/선지급을 대상 회차로 귀속
- **은행 거래내역 자동 파싱.** 엑셀·CSV·PDF를 업로드하면 은행을 자동 인식. 다중 은행 파서, 컬럼 매핑 UI, 암호 파일 복호화
- **이월금 자동 연쇄 재계산.** 한 회차를 고치면 이후 회차의 이월금·총잔액이 시간순으로 자동 갱신
- **회원·연회비·찬조 관리.** 납부 현황(갱신월 기준 연도 라벨 자동), 현금/물품 찬조
- **연간 결산 + 출력.** 요약, 회차별 결산, 분류별 지출 차트, 연회비 현황, 누적 찬조를 PDF/JPG로
- **행사 사전 등록 + 달력.** 미래 행사를 미리 등록해 선입금/선지급 대상 회차로 연결
- **설정 기반 커스터마이즈.** 분류·행사 유형·직책명·연회비 규칙을 하드코딩 대신 DB/설정으로

---

## 데이터 모델 (요약)

```
sessions ──< session_attendees ─ members
   │
   ├──< entries ──< entry_details
   │       │     └──< entry_members ─ members     (당일회비·찬조·연회비)
   │       └─ cross_session_id → sessions          (선입금/선지급 귀속)
   │
   ├──< goods_donations                             (물품 찬조)
   └─  carry_over                                   (이월금, 연쇄 재계산)

categories / session_types / club_settings           (설정 기반 커스텀)
annual_dues · bank_transactions
```

- 금액은 정수(원) `bigint`로 저장하고 표시할 때만 `toLocaleString`
- DB 접근은 `/lib` 함수로만, 타입은 `/types`에서 중앙 관리

---

## 로컬 실행

```bash
# 1) 환경변수 (.env.local)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# 2) 의존성 설치 + DB 마이그레이션 적용 (supabase/migrations/*.sql)
npm install

# 3) 개발 서버
npm run dev        # http://localhost:3000
```

## 프로젝트 구조

```
app/          # App Router 페이지 + API Routes (일지·결산·회원·연회비·설정·export)
components/   # 화면 단위 컴포넌트 (session 6단계 폼, bank 업로더, 공통 UI)
lib/          # 비즈니스 로직 (balance·sessions·settlement·bankParsers·exportRender 등)
types/        # 중앙 타입 정의
supabase/     # 마이그레이션 SQL
```
