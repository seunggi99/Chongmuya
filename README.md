# 총무야 (chongmuya)

모임 경비 관리 웹 서비스. 회차별 일지 작성 + 연간 결산 + 회원/연회비 관리.

## 이 폴더는?
바이브코딩 시작용 폴더입니다. Claude Code / Cursor에서 이 폴더를 열고 시작하세요.

```
chongmuya/
├── claude.md              ← 프로젝트 설계서 (AI가 항상 참고)
├── README.md              ← 이 파일
├── .env.local.example     ← 환경변수 템플릿
├── docs/
│   └── START_PROMPT.md    ← 첫 메시지로 붙여넣을 프롬프트
└── public/
    ├── favicon.svg
    └── logo/
        ├── icon.svg        ← 앱 아이콘 (파란 배경)
        ├── icon-white.svg  ← 어두운 배경용
        └── wordmark.svg    ← 가로형 워드마크
```

## 시작 방법
1. 이 폴더를 Claude Code 또는 Cursor로 연다
2. `claude.md`를 컨텍스트에 추가한다
3. `docs/START_PROMPT.md`의 내용을 첫 메시지로 붙여넣는다
4. 초기 세팅이 끝나면 같은 파일의 단계별 프롬프트(A~G)를 순서대로 진행

## 기술 스택
Next.js 14 · TypeScript · Tailwind · Supabase · Vercel (전부 무료 범위)

## 배포 비용
완전 무료. Vercel(프론트+API) + Supabase(DB 500MB / Storage 1GB).
도메인은 `chongmuya.vercel.app` 기본 제공.
