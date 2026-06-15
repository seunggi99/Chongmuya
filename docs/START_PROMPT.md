# 총무야 — 시작 프롬프트

claude.md를 컨텍스트에 추가한 뒤, 아래 "첫 프롬프트"를 입력창에 붙여넣으세요.
이후 A~I를 순서대로 진행하면 됩니다.

---

## 첫 프롬프트 (복붙)

```
claude.md를 읽고 "총무야" 프로젝트를 세팅해줘.

1) 초기화
- npx create-next-app@latest . --typescript --tailwind --app --eslint --src-dir=false
  (현재 폴더에 생성. public/logo, claude.md, README, docs는 유지)
- 패키지: @supabase/supabase-js @supabase/ssr xlsx html2canvas
  puppeteer-core @sparticuz/chromium lucide-react recharts

2) Pretendard + Tailwind 커스텀 컬러
- layout.tsx에 Pretendard CDN
- tailwind 커스텀: primary #2563EB, income #16A34A, expense #DC2626,
  cross #D97706, balance #2563EB

3) Supabase
- claude.md DB 스키마대로 supabase/migrations/001_init.sql (RLS 포함)
- categories 시드 데이터도 INSERT로 포함 (지출/수입 기본 분류)
- lib/supabase.ts 클라이언트/서버 분리

4) 타입 types/index.ts
- Member, Category, Session, SessionAttendee, Entry, EntryDetail,
  EntryMember, GoodsDonation, AnnualDue, BankTransaction, BalanceSummary

5) lib/balance.ts + lib/format.ts
- 잔액 계산(entry 기반), formatKRW, formatDate('YYYY. M. D'), formatDateRange

6) 레이아웃 + 사이드바 (wordmark.svg)
- 메뉴: 홈/회차목록/새일지/연간결산/회원관리/연회비현황/설정
- 모바일 하단 탭바, active는 #EFF6FF 배경 #2563EB 텍스트

7) 홈 대시보드
- 지표카드 4개(이번달 회차수/현재 통장잔액/이번달 총지출/전체 회원수)
- 최근 회차 5개, "새 일지" 버튼

완료 후 실행방법/실행할 SQL/환경변수 알려줘.
규칙: DB는 lib/ 함수로만. 금액 정수저장·표시만 포맷. any 금지.
entry 저장 시 detail합=amount 검증.
```

---

## A — 회원 관리
```
회원 관리(app/members/page.tsx) + lib/members.ts.
- 목록: 이름/등급/전화/가입일/활성/연회비 납부뱃지(현재연도)
- 신규 추가 모달, 등급 인라인 변경, 비활성(소프트삭제), 이름검색
- annual_dues 조인 → 완납(초록)/미납(회색) 뱃지
```

## B — 분류 관리 (설정)
```
설정 페이지(app/settings/page.tsx)에 분류 관리 + lib/categories.ts.
- 지출 분류 / 수입 분류 섹션 분리
- 분류 추가/삭제/이름변경 (드래그 정렬 sort_order)
- is_system=true(당일회비/찬조/연회비)는 삭제 버튼 비활성 + 자물쇠 표시
- 모임 기본정보(이름, 회장/총무 기본값)도 같은 페이지에
```

## C — 연회비 현황
```
연회비 현황(app/dues/page.tsx) + lib/dues.ts.
- year_label 탭(25~26, 26~27)
- 전체회원 × 납부여부 그리드(납부: 이름+날짜+초록 / 미납: 회색점)
- 우상단 납부율, 수동 납부 등록 버튼
```

## D — 회차 목록
```
회차 목록(app/sessions/page.tsx) + lib/sessions.ts.
- 카드 리스트(최신순): 회차번호/유형뱃지/장소/일자(다박 N박M일)/참석/총잔액
- 필터: 연도/유형. 유형뱃지색: 산행 파랑·총회 보라·여행 주황·시산제 초록·번개 빨강
- 카드 클릭 → /sessions/[id], "새 일지" 버튼
```

## E — 은행 거래내역 가져오기 (핵심1)
```
은행 엑셀 업로드/파싱 기능을 만들어줘.
- lib/bankParsers.ts: 은행별 파서
  * 케이뱅크(kbank) 반드시 포함
  * 국민/신한/우리/농협 기본 제공
  * 헤더 자동 인식, 인식 실패 시 컬럼 매핑(날짜/적요/금액) 함수 제공
  * 출력: { tx_date, description, amount(입금+/출금-), bank, raw }[]
- app/api/bank-import/route.ts: xlsx 파싱 → bank_transactions 저장
- components/bank/BankImporter.tsx: 업로드 존
- components/bank/TransactionList.tsx: 추출 거래 목록
  체크박스 / 입금초록·출금빨강 / is_used는 "반영됨" 뱃지(중복방지)
  각 행에 "입력" "분할" 버튼
```

## F — 분류+상세 입력 & 분할 (핵심2)
```
수입/지출 입력 컴포넌트를 만들어줘. claude.md "분류+상세항목", "분할 입력" 그대로.
- components/entry/CategoryEntry.tsx
  분류 select + 상세항목(label/amount) 여러 개 추가
  entry.amount = 상세 합계 자동, 미리보기 "식비 (식당1·식당2) 합계"
  단일 항목도 상세 1개로 저장(상세 0개 금지)
- components/entry/MemberChips.tsx
  당일회비: 참석자만 칩 선택, 금액=단가×인원 자동
  찬조/연회비: 전회원 칩 선택
  선택 회원 → entry_members 연결(후자 방식: 한 entry에 명단)
  연회비 선택 시 annual_dues 자동 기록
- components/bank/SplitModal.tsx
  원본 거래 1건 → 분할 항목 여러 개(입금/출금 모두)
  각 항목 분류 선택, 회원연동 분류면 MemberChips
  검증: 분할 합계=원본. 불일치 시 빨간경고+저장차단
- components/entry/GoodsDonation.tsx
  물품찬조: item/donor 텍스트만(금액 없음), goods_donations 저장
```

## G — 일지 작성 폼
```
일지 작성 6단계 폼. claude.md "일지 작성 6단계" 그대로.
- SessionForm(스테퍼) + Step1~6
- Step1 다박 체크→N박M일
- Step2 회원/일반 탭, 체크→당일회비 자동
- Step3/4 [은행내역 가져오기 | 직접입력] 토글, CategoryEntry/MemberChips/GoodsDonation 사용
- Step5 교차(귀속회차)+연회비
- Step6 BalanceChain + 이월금 자동(수동보정) + 저장
- 저장: app/api/sessions/route.ts (entry+detail+member 트랜잭션, 검증 포함)
- 상태관리 useReducer
```

## H — 일지 상세 & 미리보기
```
일지 상세(app/sessions/[id]/page.tsx) + SessionPreview.
- 좌: 정보+액션, 우: 미리보기(id="preview-target")
- 양식: claude.md "미리보기 & 출력" — 분류별 합계+상세 괄호, 물품찬조 텍스트
- PDF: app/api/export/pdf/[id] (puppeteer-core + @sparticuz/chromium, A4 10mm)
- JPG: html2canvas(scale:2), "일지_N차_YYYYMMDD.jpg"
```

## I — 연간 결산 & 배포
```
1) 연간 결산(app/settlement/page.tsx) + lib/settlement.ts
- 연도선택, 요약카드(총수입/총지출/총잔액/회차수)
- 회차별 결산 테이블(결산 뷰: 귀속 항목만)
  교차로 넘어온 항목은 원래 category를 그대로 귀속회차 결산에 합산
- 분류별 지출 차트(recharts BarChart)
- 연회비 납부 현황(해당 연도 year_label, 회원별 납부여부)
- 누적 찬조액: 회원별 현금 찬조 합계, 가나다순 정렬(금액순 아님)
  물품찬조는 금액 없이 비고란에 텍스트 표기
- 결산 PDF에 위 섹션 모두 포함
2) 배포
- vercel.json(PDF maxDuration), 001_init.sql 최종점검(RLS)
- Storage 버킷 receipts, README 배포 체크리스트
```

---

## 팁
- 에러는 메시지 전체를 그대로 붙여넣기
- 단계는 독립 진행 가능 (단, E·F는 G 전에 먼저)
- 디자인 수정은 구체적으로: "카드 그림자 없애고 보더만"
