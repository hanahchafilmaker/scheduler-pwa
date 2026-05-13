# SHIFT Scheduler PWA Architecture

## 1. 프로젝트 개요

SHIFT Scheduler PWA는 소규모 매장의 스케줄, 출퇴근, 승인 처리, 임금 계산 보조를 위해 만든 관리자/직원 분리형 웹앱입니다.

이 프로젝트는 아래 두 개의 앱으로 구성됩니다.

- **관리자 앱**
- **직원 앱**

두 앱은 하나의 저장소 안에서 공통 모듈을 공유하며, Vite 멀티 엔트리 구조로 빌드됩니다.

---

## 2. 앱 구성

### 관리자 앱
관리자가 사용하는 화면입니다.

주요 역할:
- 직원 관리
- 월간 스케줄 확인 및 수정
- 당일 출퇴근 기록 확인
- 승인 대기 내역 처리
- 대타 / 추가근무 / 연장근무 확인
- 월별 정산 데이터 확인

진입점:
- `index.html`

개발 주소:
- `http://localhost:5173`

배포 주소 예시:
- `/`

---

### 직원 앱
직원이 사용하는 화면입니다.

주요 역할:
- PIN 로그인
- 오늘 스케줄 확인
- 출근 / 퇴근 처리
- 대타 출근 요청
- 내 출근 기록 확인
- 승인 상태 확인

진입점:
- `staff.html`

개발 주소:
- `http://localhost:5174/staff.html`

배포 주소 예시:
- `/staff`

---

## 3. 디렉토리 구조

```txt
scheduler-pwa/
├─ docs/
│  ├─ ARCHITECTURE.md
│  ├─ BUSINESS_RULES.md
│  └─ DEPLOY.md
├─ public/
├─ src/
│  ├─ admin/
│  ├─ staff/
│  └─ shared/
├─ index.html
├─ staff.html
├─ vite.config.js
├─ vercel.json
└─ package.json