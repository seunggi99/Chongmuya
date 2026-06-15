# 총무야 — claude.md

> 이 파일은 프로젝트의 단일 진실 공급원(source of truth)입니다.
> 코드를 작성하기 전에 항상 이 문서를 먼저 참고하세요.

## 프로젝트 개요
"총무야"는 등산·취미 모임의 경비를 관리하는 웹 서비스입니다.
총무가 회차별 일지를 작성하고, 회원들에게 수입/지출 내역과 잔액증명을 PDF/JPG로 제공합니다.
기존에 엑셀로 수동 관리하던 작업을 웹에서 쉽게 처리하는 것이 목표입니다.

### 핵심 가치
- 총무의 반복 작업(이월금 옮겨적기, 잔액 계산, 숫자 타이핑)을 자동화
- 은행 거래내역 업로드 → 체크만으로 입력 → 통장 잔액이 절대 안 틀어짐
- 회차별 일지와 연간 결산을 명확히 분리
- 선입금/선지급 같은 교차 회차 항목을 깔끔하게 처리

---

## 기술 스택

| 역할 | 기술 |
|------|------|
| 프레임워크 | Next.js 14 (App Router) |
| 언어 | TypeScript (strict) |
| 스타일 | Tailwind CSS |
| DB | Supabase (PostgreSQL) |
| 파일 저장 | Supabase Storage (영수증 이미지) |
| 인증 | Supabase Auth (이메일/패스워드) |
| 엑셀 파싱 | SheetJS (xlsx) |
| PDF 출력 | puppeteer-core + @sparticuz/chromium |
| 이미지 출력 | html2canvas |
| 아이콘 | lucide-react |
| 폰트 | Pretendard |
| 차트 | recharts |
| 배포 | Vercel (프론트 + API Routes) + Supabase |

### 폴더 구조
```
/app
  layout.tsx               # 글로벌 레이아웃 + 사이드바
  page.tsx                 # 홈 대시보드
  /sessions
    page.tsx               # 회차 목록
    /new/page.tsx          # 새 일지 작성 (6단계 폼)
    /[id]/page.tsx         # 일지 상세 + 미리보기
    /[id]/edit/page.tsx    # 일지 수정
  /settlement/page.tsx     # 연간 결산
  /members/page.tsx        # 회원 관리
  /dues/page.tsx           # 연회비 현황
  /settings/page.tsx       # 모임 설정 (분류 관리 포함)
  /api
    /sessions/route.ts
    /bank-import/route.ts   # 은행 엑셀 파싱
    /export/pdf/[id]/route.ts
/components
  /layout         Sidebar.tsx, MobileTabBar.tsx
  /session
    SessionForm.tsx        # 6단계 스테퍼
    Step1BasicInfo.tsx ~ Step6Confirm.tsx
    SessionPreview.tsx
    BalanceChain.tsx
  /bank
    BankImporter.tsx       # 엑셀 업로드 + 파싱
    TransactionList.tsx    # 추출 거래 목록 (체크)
    SplitModal.tsx         # 분할 입력 (회원 선택형)
  /entry
    CategoryEntry.tsx      # 분류 + 상세항목 입력
    MemberChips.tsx        # 회원 칩 선택
    GoodsDonation.tsx      # 물품찬조 텍스트 입력
  /member  MemberSelector.tsx
  /common  ExportButtons.tsx, StatCard.tsx, Badge.tsx
/lib
  supabase.ts
  balance.ts               # 잔액 계산
  bankParsers.ts           # 은행별 파서 (케이뱅크 포함)
  members.ts, sessions.ts, dues.ts, settlement.ts, categories.ts
  export.ts, format.ts
/types  index.ts
/public /logo, favicon.svg
/supabase /migrations/001_init.sql
```

---

## 브랜드 가이드

### 이름
- 정식 명칭: **총무야** / 영문·도메인: `chongmuya` / 슬로건: "모임 경비 관리"

### 로고 (`/public/logo/`)
- `icon.svg` 앱 아이콘(파란 배경, 동전+체크), `icon-white.svg` 어두운 배경용
- `wordmark.svg` 아이콘+"총무야" 가로형, `favicon.svg` 파비콘
- 워드마크의 "야"는 항상 Primary 파랑(#2563EB)
- 의미: 원(돈) + 체크(확인) = "경비 확인했다"

### 컬러 시스템
```
Primary  #2563EB   주요 액션·강조·링크
Dark     #1E3A6E   사이드바 어두운 배경(선택)
Light    #EFF6FF   active 메뉴 배경
Text     #111827   기본 텍스트
수입     #16A34A (초록) / 지출 #DC2626 (빨강)
교차     #D97706 (주황) / 잔액 #2563EB (파랑)
```
Tailwind 커스텀 컬러: primary, income, expense, cross, balance

### 타이포 / UI 톤
- 폰트: Pretendard CDN
  `https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css`
- 제목 700 / 본문 400 / 보조 회색(#9CA3AF)
- 흰 배경 + 얇은 보더(border-gray-100) + 넉넉한 여백, 그림자 없음, 무인양품 톤
- 카드: rounded-xl, border-gray-100, p-5 / 버튼: rounded-lg 실선 보더

---

## DB 스키마

### members (회원)
```sql
id          uuid pk default gen_random_uuid()
name        text not null
type        text not null check (type in ('member','general'))  -- 정회원/일반회원
phone       text
joined_at   date
is_active   boolean default true
created_at  timestamptz default now()
```

### categories (분류 — 커스텀 가능)
```sql
id          uuid pk default gen_random_uuid()
name        text not null               -- '식비','버스/교통','당일회비'...
kind        text not null check (kind in ('income','expense'))
is_system   boolean default false       -- true면 삭제 불가(당일회비/찬조/연회비)
is_active   boolean default true        -- 비활성 분류는 신규 입력 목록에서 숨김
special     text                        -- 'daily_fee'|'donation'|'annual_dues'|null
                                         -- 회원 연동되는 특수 분류 표시
sort_order  integer default 0
```
- 시드: 지출 = 버스/교통, 식비, 숙박, 입장료, 커피/간식, 선물, 경조사비, 2차모임, 기타
- 시드: 수입 = 당일회비(special=daily_fee, system), 찬조(donation, system),
  연회비(annual_dues, system), 은행이자, 기타
- **분류 삭제 규칙**: is_system=true는 삭제 불가. 그 외 분류도 이미 entries가
  참조 중이면 하드 삭제 금지. 대신 is_active=false로 비활성 처리(소프트 삭제) —
  과거 일지·결산의 분류 표시는 유지되고, 신규 입력 분류 목록에서만 숨긴다.
  참조하는 entry가 0건일 때만 실제 삭제 허용.
  (삭제 시도 시 사용 중이면 "이 분류를 쓰는 일지 N건이 있어 비활성 처리됩니다" 안내)

### sessions (회차)
```sql
id          uuid pk
number      integer not null unique
type        text not null   -- hike|general_meeting|regular_meeting|sansanje|travel|flash
location    text not null
date_start  date not null
date_end    date            -- 다박이면 종료일, 당일이면 null
fee_per_person integer default 0   -- 당일회비 단가
note        text
chairperson text
treasurer   text
carry_over  bigint default 0
is_manual_carry_over boolean default false
created_at  timestamptz default now()
updated_at  timestamptz default now()
```

### session_attendees (참석자)
```sql
id          uuid pk
session_id  uuid references sessions(id) on delete cascade
member_id   uuid references members(id)
member_type_snapshot text not null
```

### entries (수입·지출 항목 — 분류 단위)
```sql
id          uuid pk
session_id  uuid references sessions(id) on delete cascade
kind        text not null check (kind in ('income','expense'))
category_id uuid references categories(id)
amount      bigint not null              -- 이 분류의 합계 (상세 합과 일치)
cross_session_id uuid references sessions(id)  -- 선입금/선지급이면 귀속회차, 당일이면 null
bank_tx_id  uuid references bank_transactions(id)  -- 은행 거래 매칭(있으면)
sort_order  integer default 0
```

### entry_details (상세항목 — 한 분류 안의 식당1·식당2 등)
```sql
id          uuid pk
entry_id    uuid references entries(id) on delete cascade
label       text not null               -- '황태덕장(점심)','버스 28인승'...
amount      bigint not null
receipt_url text                        -- 상세항목별 영수증
sort_order  integer default 0
```

### entry_members (분류-회원 연결 — 당일회비/찬조/연회비)
```sql
id          uuid pk
entry_id    uuid references entries(id) on delete cascade
member_id   uuid references members(id)
-- 후자 방식: 한 entry(예 당일회비 15만)에 납부 회원 명단을 연결
-- 일지에는 "당일회비 (강성환·김영희·송인규) 150,000"으로 표시
```

### goods_donations (물품 찬조 — 금액 없음)
```sql
id          uuid pk
session_id  uuid references sessions(id) on delete cascade
item        text not null               -- '텀블러 20개'
donor       text                        -- '최봉식'
```

### annual_dues (연회비 납부)
```sql
id          uuid pk
member_id   uuid references members(id)
session_id  uuid references sessions(id)
year_label  text not null               -- '25~26','26~27'
amount      bigint not null default 100000
paid_at     date not null
note        text
```

### bank_transactions (업로드된 은행 거래)
```sql
id          uuid pk
session_id  uuid references sessions(id)   -- 어느 일지에서 가져왔는지(매칭 후)
tx_date     date not null
description text not null                -- 적요/보낸분
amount      bigint not null              -- 입금 양수, 출금 음수
bank        text                         -- 'kbank','kookmin','shinhan'...
is_used     boolean default false        -- 일지에 이미 반영됐는지(중복 방지)
raw         jsonb                        -- 원본 행 보관
```

### club_settings (모임 설정 — 싱글톤, id=1 고정)
```sql
id          integer pk default 1 check (id = 1)
club_name   text
default_chairperson text             -- 회장 기본값
default_treasurer   text             -- 총무 기본값
dues_renewal_month  integer not null default 3 check (between 1 and 12)
                                      -- 연회비 갱신 월 (모임마다 다름)
default_due_amount  bigint not null default 100000  -- 연회비 기본 금액
updated_at  timestamptz default now()
```
- **연회비 갱신월은 설정에서 커스텀.** year_label은 이 값 기준으로 계산:
  현재 날짜의 월 >= dues_renewal_month이면 "YY~(YY+1)", 아니면 "(YY-1)~YY".
  예) 갱신월=3, 현재 2026.6 → "26~27" / 현재 2026.2 → "25~26".
  currentYearLabel()은 하드코딩하지 말고 club_settings.dues_renewal_month를 읽어 계산.

---

## 핵심 비즈니스 로직

### 잔액 계산 (`/lib/balance.ts`)
```
당일수입 = SUM(entries WHERE kind=income AND cross_session_id IS NULL .amount)
당일지출 = SUM(entries WHERE kind=expense AND cross_session_id IS NULL .amount)
당일잔액 = 당일수입 - 당일지출
교차수입 = SUM(entries WHERE kind=income AND cross_session_id IS NOT NULL)
교차지출 = SUM(entries WHERE kind=expense AND cross_session_id IS NOT NULL)
총잔액  = 당일잔액 + 교차수입 - 교차지출 + 이월금
```
- entry.amount는 항상 그 entry의 entry_details 합과 일치해야 함(저장 시 검증)
- **entry_details는 최소 1개 필수.** 단일 항목(예: 식비 705,000 한 줄)도
  detail 1개로 저장한다. detail 0개는 허용하지 않음(합=0이 되어 검증 실패).
- 물품찬조(goods_donations)는 금액 계산에 미포함 — 표시만

### 이월금 자동화 (★ 핵심)
- 새 회차 생성 시 직전 회차 총잔액을 carry_over에 자동 세팅
- is_manual_carry_over=true이면 자동 덮어쓰기 금지
- 첫 회차/보정 시에만 수동 편집
- **연쇄 재계산:** 회차를 저장/수정/삭제하면 그 이후의 모든 회차
  carry_over를 number 순서대로 자동 재계산한다. (단, is_manual_carry_over=true인
  회차는 건너뛰고 그 값을 기준으로 이후를 다시 계산.)
  예) 741차 금액을 고치면 742→743→... 의 이월금과 총잔액이 자동 갱신.

### 일지 뷰 vs 결산 뷰
- 일지 뷰: 해당 session의 모든 entries(교차 포함) → 통장 잔액 증명
- 결산 뷰: 귀속된 항목만 = (cross_session_id IS NULL) + (다른 회차에서 cross_session_id=이 회차)
- **교차항목의 분류 처리**: 결산 집계 시 교차로 넘어온 항목은 그 항목이 가진
  category_id를 그대로 사용한다. 예) 760차에서 선지급한 "숙박" 예약금이
  cross_session_id=761이면, 761차 결산의 "숙박" 분류로 합산된다.
  별도 분류 변환 없음 — entry의 원래 category를 귀속회차 결산에 그대로 반영.

### 은행 거래내역 가져오기
1. `/components/bank/BankImporter` 에서 엑셀(.xlsx)/CSV 업로드
2. `/lib/bankParsers.ts`로 은행 자동 인식 → 거래 목록 추출
   - **케이뱅크(kbank) 파서 필수 포함**
   - 그 외: 국민, 신한, 우리, 농협 기본 제공
   - 인식 안 되는 양식 → 컬럼 매핑 UI(날짜/적요/금액 열 지정)
3. 추출된 거래는 bank_transactions에 저장, 화면에 체크박스 목록
4. 총무가 체크 → "입력"(단일 entry) 또는 "분할"(여러 entry)
5. 사용된 거래는 is_used=true (중복 방지, "반영됨" 표시)
6. 숫자 타이핑 없이 체크만 → 통장 잔액 자동 대조

### 분할 입력 (입금·출금 모두 가능)
- 모든 거래는 선택 후 분할 가능 (별도 "분할가능" 상태 없음)
- 분할 = 원본 거래 1건을 여러 entry로 나눔
- 각 분할 항목은 분류를 선택
- 당일회비/찬조/연회비 분류는 **회원 선택형**:
  - 당일회비(special=daily_fee): 참석자 중에서만 선택, 금액 = 단가 × 선택인원 자동
    (개별 회원 금액이 다르면 그 회원만 직접 금액 조정 가능 — 기본은 단가×인원)
  - 찬조/연회비(donation/annual_dues): 전회원 선택 가능
  - 선택 회원은 entry_members에 연결 (후자 방식: 한 entry에 명단)
  - 연회비 선택 시 annual_dues에도 자동 기록
- **검증: 분할 합계 = 원본 금액. 불일치 시 저장 차단(빨간 경고).**

### 분류 + 상세항목 (category + detail)
- entry = 분류 단위(식비, 교통...), entry_details = 그 안의 상세(식당1, 식당2...)
- entry.amount = entry_details 합계 (자동 계산·검증)
- 미리보기 표시: "식비 (황태덕장·대관령한우·휴게소) 2,150,000"
- 분류는 설정 페이지에서 커스텀(추가/삭제/이름변경)
- is_system=true(당일회비/찬조/연회비)는 삭제 불가

### 연회비 연동
- 분할/입력에서 연회비 분류 선택 + 회원 지정 → annual_dues 기록
- /dues에서 year_label별 납부 현황, 회원 목록에 납부 뱃지

### 연간 결산 구성 (`/settlement`)
결산 페이지는 다음 5가지로 구성:
1. 요약 카드: 총수입 / 총지출 / 총잔액 / 회차수 (선택 연도 기준)
2. 회차별 결산 테이블: 결산 뷰 기준(귀속 항목만), 회차/장소/일자/수입/지출/잔액
3. 분류별 지출 차트: recharts BarChart
4. 연회비 납부 현황: 해당 연도 year_label 기준, 회원별 납부 여부
5. 누적 찬조액: 회원별 현금 찬조 합계
   - **정렬: 가나다순(이름 기준). 금액 많은 순 아님.**
   - 현금 찬조만 금액 합산 (entries에서 category special=donation)
   - 물품 찬조(goods_donations)는 금액 없이 비고란에 텍스트로 표기
     예) "최봉식 — 텀블러 20개 / 장순복 — 막걸리 1박스"
- 결산 PDF 내보내기 시 위 5개 섹션 모두 포함

---

## 일지 작성 6단계
```
Step 1 기본정보  회차번호(자동제안), 유형, 장소, 시작일,
                 종료일(다박 체크→N박M일), 당일회비 단가, 메모, 총무·회장명
Step 2 참석자    회원/일반회원 탭, 체크 선택 → 당일회비 단가×인원 자동
Step 3 수입      [은행내역 가져오기] 또는 [직접 입력]
                 분류+상세 / 회원선택형(당일회비·찬조·연회비) / 물품찬조
Step 4 지출      [은행내역 가져오기] 또는 [직접 입력]
                 분류+상세항목, 상세별 영수증 첨부
Step 5 교차·연회비  선입금/선지급(귀속회차), 연회비 회원 지정
Step 6 확인·출력  BalanceChain, 이월금 자동(수동보정), 저장→미리보기→PDF/JPG
```

---

## 미리보기 & 출력 (`SessionPreview`, id="preview-target")
엑셀 양식 재현:
1. 제목(유형별 명칭 N차) 2. 장소|일자(N박M일)|당일회비
3. 참석자(회원/일반 명단, 총N명) 4. 찬조(현금+물품찬조 텍스트)
5. 수입/지출 2단 — 분류별 합계 + 상세 괄호표기
6. 잔액블록(당일잔액→교차→이월금→총잔액)
7. 결제란(총무/회장) 8. 영수증 첨부 목록
- PDF: `/api/export/pdf/[id]` puppeteer-core + @sparticuz/chromium, A4 10mm
- JPG: html2canvas(`#preview-target`, scale:2), `일지_N차_YYYYMMDD.jpg`

---

## 코딩 컨벤션
- 컴포넌트 PascalCase / 유틸·훅 camelCase
- DB 쿼리는 `/lib/` 함수로만 (컴포넌트 직접 호출 금지)
- 타입은 `/types/index.ts` 중앙관리, `any` 금지
- 금액 DB는 정수(원), 표시만 toLocaleString('ko-KR')
- 날짜 'YYYY. M. D'
- 모든 async에 로딩+에러처리(toast)
- 시맨틱 컬러는 Tailwind 커스텀 클래스(text-income 등)
- entry 저장 시 항상 detail 합 = amount, 분할 합 = 원본 검증

## 환경변수
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## 배포
- Vercel(프론트+API) + Supabase(DB 500MB/Storage 1GB), 전부 무료
- 도메인 chongmuya.vercel.app
- PDF는 puppeteer-core + @sparticuz/chromium (일반 puppeteer 용량초과)
- vercel.json에서 PDF 라우트 maxDuration 상향

## 커밋 규칙
- 작업을 검증 가능한 작은 단위로 끝낼 때마다 **묻지 말고 알아서 커밋**한다.
- 형식: Conventional Commits `type(scope): subject` (한글 본문 가능).
- 한 커밋 = 한 논리 변경. 커밋 전 `git status`로 `.env`·시크릿·빌드 산출물 제외 확인.
- 빌드/타입체크가 통과한 working state에서만 커밋한다.
- 커밋 후 멈추고 사용자 리뷰를 기다린다. (push는 명시적 요청 시에만)