# scheduler-pwa 정리본

## 1. 프로젝트 개요

* 근무 스케줄 관리와 실제 출퇴근(근태) 기록을 분리하는 PWA 시스템
* 스케줄은 계획(schedule), 실제 출근은 attendance에 기록
* 대타는 schedule을 덮어쓰지 않고 attendance에서 실제 근무자로 처리
* 백엔드는 주로

  * 프론트엔드: React
  * DB/API: Supabase

---

## 2. 핵심 운영 원칙

### 스케줄 vs 근태

* `schedule`: 원래 배정된 근무 계획
* `attendance`: 실제 출근/퇴근 기록
* 항상 schedule은 기준 데이터, attendance는 실제 데이터

### 대타 원칙

* 대타 요청은 기존 스케줄을 수정하지 않음
* 승인 후 실제 출근자만 attendance에 반영
* 표시 항목:

  * 예정 근무자
  * 실제 근무자
  * 대타 여부
  * 대타 대상 파트 시간

### 승인 상태 흐름

* pending → approved / rejected
* rejected는 급여 계산 제외
* pending은 관리자 확정 전 임금 미확정

---

## 3. 현재 구현 완료 항목

### UI

* Attendance 탭
* Schedule 탭
* 직원 관리 탭
* 승인 모달 (`ApprovalModal.jsx`)
* 수정 모달 (`EditModal.jsx`)

### 급여 로직

* `pay.js` 단일 계산 모듈
* 지각 차감 반영
* 휴게 차감 반영
* 초과 근무 반영
* 대타 시간 반영
* 정산 완료 여부 처리

### 분리된 유틸

* `getAttendanceStatus.js`
* `labels.js`
* `selectors.js`

---

## 4. 남은 핵심 작업

## 우선순위 A (필수)

1. ApprovalModal 실제 연결
2. EditModal 실제 연결
3. pay.js 완전 단일화
4. 전체 테스트

## 우선순위 B (안정화)

5. attendance_logs 테이블 추가
6. final_pay snapshot 저장
7. 관리자 정산 화면 개선

## 우선순위 C (고도화)

8. 알림 시스템
9. 월별 리포트
10. 권한 분리 강화

---

## 5. DB 구조 권장

### schedule

* id
* employee_id
* date
* start_time
* end_time
* part

### attendance

* id
* employee_id
* actual_employee_id
* date
* check_in
* check_out
* break_min
* status
* final_pay
* settled_at
* settled_by

### attendance_logs

* id
* attendance_id
* action
* before_json
* after_json
* actor
* created_at

---

## 6. 작업 순서 (실제 진행용)

### 오늘

1. ApprovalModal 연결
2. EditModal 연결
3. pay.js 통합
4. 승인/거절 테스트
5. 급여 검증

### 내일

1. logs 생성
2. snapshot 생성
3. 정산 화면
4. UI 정리

---

## 7. 코드 기준 규칙

### 절대 원칙

* 계산 로직은 한 곳만
* 상태 로직은 한 곳만
* schedule 직접 수정 최소화
* attendance 기준 실제 처리
* 정산 후 금액 고정

### 금지

* 컴포넌트 내부 직접 급여 계산
* status 문자열 직접 비교
* rejected 포함 합산
* schedule 대타 덮어쓰기

---

## 8. 다음 바로 수정 파일

* `src/features/attendance/AttTab.jsx`
* `src/features/attendance/ApprovalModal.jsx`
* `src/features/attendance/EditModal.jsx`
* `src/shared/utils/pay.js`
* `src/shared/utils/getAttendanceStatus.js`
* `src/shared/utils/selectors.js`
* `src/shared/hooks/useApi.js`

---

## 9. 체크리스트

* [ ] 승인 정상 작동
* [ ] 거절 정상 작동
* [ ] 수정 저장 정상 작동
* [ ] 지각 반영
* [ ] 대타 반영
* [ ] 초과수당 반영
* [ ] 월 예상 계산
* [ ] 정산 고정값 저장
* [ ] 로그 저장

---

## 10. AttTab.jsx 리팩토링 작업표

### 목표

* AttTab을 UI 렌더링 중심 컴포넌트로 정리
* 상태 계산/레이블/검색/집계 로직을 domain 및 utils 레이어로 이동

### 1단계 — 신규 파일 생성

생성 파일:

* `src/domain/attendance/getAttendanceStatus.js`
* `src/domain/attendance/labels.js`
* `src/domain/attendance/selectors.js`

구현 항목:

* `getAttendanceStatus(row)`
* `getApprovalStatusLabel(status)`
* `getApprovalReasonLabel(reason)`
* `getPartLabel(part)`
* `selectPending(rows)`
* `selectSettled(rows)`
* `selectByKeyword(rows, keyword)`

### 2단계 — AttTab에서 제거할 코드

삭제 대상 내부 함수:

* `safeArray`
* `timeRange`
* `matchesSearch`
* `getPartLabel`
* `todayLaborCost` 직접 reduce 계산
* `approval_status` 직접 비교 분기

### 3단계 — AttTab 신규 import

추가 import:

* `getAttendanceStatus`
* `getApprovalStatusLabel`
* `getApprovalReasonLabel`
* `getPartLabel`
* `selectPending`
* `selectSettled`
* `selectByKeyword`
* `calcRowPayWithSeparation`

### 4단계 — 교체 포인트

#### 상태 비교 교체

기존:

* `row.approval_status === "pending"`
* `row.approval_status === "approved"`
* `row.approval_status === "rejected"`

변경:

* `getAttendanceStatus(row)`

#### 급여 계산 교체

기존:

* `hourly_wage * workMin / 60`

변경:

* `calcRowPayWithSeparation(row)`

#### 검색 교체

기존:

* `matchesSearch(row, keyword)`

변경:

* `selectByKeyword(rows, keyword)`

### 5단계 — 최종 점검 체크리스트

* [ ] 승인 버튼 정상
* [ ] 거절 버튼 정상
* [ ] 수정 버튼 정상
* [ ] pending 미정산 표시
* [ ] rejected 제외
* [ ] auto_closed 표시
* [ ] 지각 차감 반영
* [ ] 대타 표시
* [ ] 월 예상 인건비 정상
* [ ] 검색 정상

### 6단계 — 커밋 메시지 추천

```bash
git add .
git commit -m "refactor(attendance): split AttTab domain logic and unify pay/status sources"
```

---

## 11. 🧭 Attendance System Full Architecture (FE + BE + DB + Ops)

# 1. 전체 구조 (End-to-End)

```
┌──────────────────────────────┐
│          Frontend (PWA)       │
│  React / TodayTab / Hooks     │
└──────────────┬───────────────┘
               │ REST / API
               ▼
┌──────────────────────────────┐
│        API Gateway Layer      │
│  Auth / RateLimit / Logging   │
└──────────────┬───────────────┘
               ▼
┌──────────────────────────────┐
│        Backend Service        │
│  Attendance Domain Service    │
│  Schedule Service             │
│  Approval Service             │
└──────────────┬───────────────┘
               ▼
┌──────────────────────────────┐
│           Database            │
│ PostgreSQL (core source)      │
└──────────────┬───────────────┘
               ▼
┌──────────────────────────────┐
│     Event / Trigger Layer     │
│  DB Trigger / Event Queue     │
│  (audit, sync, recalculation)│
└──────────────────────────────┘
```

---

# 2. 핵심 도메인 구조 (Backend)

## 3대 핵심 도메인

```
1. Attendance Domain
2. Schedule Domain
3. Approval Domain
```

---

## 2.1 Attendance Domain

### 역할

* 출근/퇴근 기록 생성
* 상태 계산 기반 데이터 제공

### 핵심 테이블

```
attendance
- attendance_id
- employee_id
- schedule_id (nullable)
- check_in
- check_out
- paid_check_in
- paid_check_out
- approval_status
- approval_reason
- created_at
```

### 상태는 DB가 아니라 “계산값”

> ⚠️ 절대 DB에 status 저장하지 않음

---

## 2.2 Schedule Domain

```
schedule
- schedule_id
- employee_id
- date
- part
- planned_start
- planned_end
```

---

## 2.3 Approval Domain

```
approval
- approval_id
- attendance_id
- status (pending/approved/rejected)
- reason
- note
- processed_by
- processed_at
```

---

# 3. 상태 엔진 (Backend Core Logic)

```
getAttendanceStatus(attendance)
```

### 상태 정의

* WORKING → check_in exists AND check_out null
* CLOSED → check_out exists
* PENDING → CLOSED + approval pending
* REJECTED → approval rejected

---

# 4. API 구조

## Today Dashboard API

```
GET /api/today
```

## Attendance APIs

```
POST /attendance/check-in
POST /attendance/check-out
GET  /attendance/today
```

## Approval APIs

```
POST /approval/approve
POST /approval/reject
GET  /approval/pending
```

---

# 5. Backend Processing Flow

```
CHECK IN → Attendance 생성 (WORKING)
CHECK OUT → Attendance 업데이트 (CLOSED)
Trigger → Approval 생성 (if needed)
Frontend → selectTodayState()
UI → TodayTab render
```

---

# 6. Event / Trigger Layer

```
attendance.created
attendance.updated
schedule.missing_match
```

### 예시

```
if (check_out exists && approval_status null) {
  create approval(pending)
}
```

---

# 7. Frontend vs Backend 책임 분리

| Layer    | 책임              |
| -------- | --------------- |
| Backend  | truth + rules   |
| API      | normalized data |
| Frontend | render only     |

---

# 8. Full Data Flow

```
User Action → Backend → Event Layer → API → Frontend → UI
```

---

# 9. 운영 안정 구조

```
Raw Data (DB)
→ Domain Logic (Backend)
→ Presentation (Frontend)
```

---

# 10. 디버깅 구조

1. DB 확인
2. getAttendanceStatus 확인
3. FE state 확인

---

# 11. 확장 구조

* Redis cache
* Event Queue
* Audit Log
* Status Service 분리

---

# 🧾 한 줄 요약

Backend가 상태를 정의하고 Frontend는 렌더링만 수행한다.

---

# 🔗 14. SRC → DOCS MAPPING TABLE

## 📦 Root Mapping (Top-Level)

| Source (src)                                 | Responsibility            | Target Doc                                          |
| -------------------------------------------- | ------------------------- | --------------------------------------------------- |
| src/features/attendance/AttTab.jsx           | Attendance UI + dashboard | 11_FRONTEND_ARCHITECTURE.md                         |
| src/features/attendance/ApprovalModal.jsx    | 승인 UI                     | 05_DOMAIN_APPROVAL.md + 11_FRONTEND_ARCHITECTURE.md |
| src/features/attendance/EditModal.jsx        | 수정 UI                     | 03_DOMAIN_ATTENDANCE.md                             |
| src/shared/utils/pay.js                      | 급여 계산 엔진                  | 09_PAY_SYSTEM.md                                    |
| src/domain/attendance/getAttendanceStatus.js | 상태 엔진                     | 03_DOMAIN_ATTENDANCE.md                             |
| src/domain/attendance/labels.js              | UI label mapping          | 03_DOMAIN_ATTENDANCE.md                             |
| src/domain/attendance/selectors.js           | 필터/조회 로직                  | 03_DOMAIN_ATTENDANCE.md                             |
| src/shared/hooks/useApi.js                   | API layer + fetch logic   | 06_API_SPEC.md                                      |

---

## 🧠 Domain Layer Mapping

| Source                 | Domain Role | Doc                     |
| ---------------------- | ----------- | ----------------------- |
| attendance table logic | 실제 출근 데이터   | 03_DOMAIN_ATTENDANCE.md |
| schedule table logic   | 근무 계획       | 04_DOMAIN_SCHEDULE.md   |
| approval table logic   | 승인 프로세스     | 05_DOMAIN_APPROVAL.md   |

---

## ⚙️ Business Logic Mapping

| Logic    | Location              | Doc                     |
| -------- | --------------------- | ----------------------- |
| 지각/조퇴 계산 | pay.js                | 09_PAY_SYSTEM.md        |
| 대타 처리    | attendance + schedule | 08_BUSINESS_RULES.md    |
| 승인 흐름    | ApprovalModal + API   | 05_DOMAIN_APPROVAL.md   |
| 상태 판단    | getAttendanceStatus   | 03_DOMAIN_ATTENDANCE.md |

---

## 🖥 Frontend Mapping

| Component         | Responsibility   | Doc                         |
| ----------------- | ---------------- | --------------------------- |
| AttTab            | 전체 dashboard     | 11_FRONTEND_ARCHITECTURE.md |
| Modals            | CRUD interaction | 11_FRONTEND_ARCHITECTURE.md |
| Filters/Selectors | UI filtering     | 11_FRONTEND_ARCHITECTURE.md |

---

## 🔥 Critical Rule Mapping

| Rule                 | Enforcement Location | Doc                         |
| -------------------- | -------------------- | --------------------------- |
| status 계산 단일화        | getAttendanceStatus  | 03_DOMAIN_ATTENDANCE.md     |
| 급여 단일화               | pay.js               | 09_PAY_SYSTEM.md            |
| schedule 불변          | backend rule         | 08_BUSINESS_RULES.md        |
| frontend render only | React components     | 11_FRONTEND_ARCHITECTURE.md |

---

## 🧭 Summary

> src 구조는 “실행 코드”, docs 구조는 “진실(source of truth)”이다.
> 모든 src 파일은 반드시 하나 이상의 docs 문서에 귀속된다.

---

# 🚨 15. ARCHITECTURE VIOLATION DETECTION (TOP ISSUES)

## 🔴 CRITICAL (즉시 수정)

### 1. AttTab.jsx에서 status 직접 비교

* 위치: src/features/attendance/AttTab.jsx
* 문제: approval_status / check_in/out 직접 분기
* 위반: getAttendanceStatus 미사용
* 영향: UI 상태 불일치

---

### 2. AttTab.jsx에서 급여 직접 계산

* 위치

  * hourly_wage * workMin / 60
  * reduce 기반 todayLaborCost
* 위반: pay.js 단일 소스 원칙 깨짐
* 영향: 화면마다 급여 값 다름

---

### 3. pending row 포함 정산

* 위치: AttTab summary
* 문제: rejected/pending 포함 합산 가능성
* 위반: isPaySettledRow 미적용 구간 존재
* 영향: 인건비 과다 계산

---

## 🟠 HIGH (다음 PR)

### 4. useApi에 domain label 함수 존재

* 문제: UI 레이어와 data layer 혼합
* 대상:

  * getApprovalStatusLabel
  * getApprovalReasonLabel

---

### 5. selectors 로직 미분리

* 위치: AttTab 내부 filter/match 로직
* 위반: selectors.js 미사용

---

### 6. search logic UI 내부 존재

* 문제: matchesSearch inline 구현
* 영향: 재사용 불가

---

### 7. modal 실패 시 state 초기화 문제

* ApprovalModal / EditModal
* 문제: API 실패에도 close 발생 가능 구조

---

## 🟡 MEDIUM (리팩토링)

### 8. auto_closed 상태 UI 구분 없음

* 문제: 운영 데이터 혼동 가능

---

### 9. pay.js legacy 함수 공존

* calcRowPay / calcPay 미정리
* 영향: 계산 기준 혼재 위험

---

### 10. util 함수 UI 내부 정의

* safeArray, timeRange, getPartLabel 등
* 위치: AttTab.jsx 내부
* 위반: utils/domain 분리 규칙

---

## 🧭 SUMMARY

> 현재 시스템 문제의 80%는 "domain 로직이 UI에 남아있는 것"이다.
> 해결 방향은 단 하나: UI = render only

---

# 🔀 16. REFACTORING PR PLAN (COMMIT-LEVEL BREAKDOWN)

## 🧭 전략

* 1 PR = 1 책임 변경
* UI / Domain / Pay / Utils / Stability를 완전히 분리
* 각 PR은 독립적으로 deploy 가능해야 함

---

# PR #1 — DOMAIN CORE RECOVERY (Status Engine)

## 목표

* getAttendanceStatus 단일 소스 확립
* UI에서 status 직접 비교 제거

## 변경 파일

* src/domain/attendance/getAttendanceStatus.js (NEW)
* src/features/attendance/AttTab.jsx

## Commit 단위

1. feat(domain): add getAttendanceStatus core engine
2. refactor(attendance): replace raw status checks with domain engine
3. test(attendance): verify status consistency

---

# PR #2 — LABEL SYSTEM ISOLATION

## 목표

* UI label 로직 useApi에서 분리

## 변경 파일

* src/domain/attendance/labels.js (NEW)
* src/features/attendance/AttTab.jsx
* src/shared/hooks/useApi.js

## Commit 단위

1. feat(domain): extract attendance label mapping
2. refactor(api): remove UI label logic from useApi
3. refactor(ui): replace label imports to domain layer

---

# PR #3 — SELECTORS LAYER INTRODUCTION

## 목표

* filtering / search 로직 domain화

## 변경 파일

* src/domain/attendance/selectors.js (NEW)
* AttTab.jsx

## Commit 단위

1. feat(domain): introduce attendance selectors
2. refactor(ui): migrate filter/search logic to selectors

---

# PR #4 — PAY SYSTEM UNIFICATION

## 목표

* pay.js 단일 계산 엔진 확립

## 변경 파일

* src/shared/utils/pay.js
* AttTab.jsx

## Commit 단위

1. refactor(pay): unify calculation into calcRowPayWithSeparation
2. refactor(pay): deprecate calcRowPay and calcPay legacy functions
3. refactor(ui): remove inline wage calculations

---

# PR #5 — UI LOGIC PURIFICATION (AttTab CLEANUP)

## 목표

* AttTab = pure render component

## 제거 대상

* safeArray
* timeRange
* matchesSearch
* inline reduce calculations

## Commit 단위

1. refactor(ui): remove utility functions from AttTab
2. refactor(ui): simplify summary calculation using selectors
3. refactor(ui): enforce render-only structure

---

# PR #6 — MODAL STABILITY FIX

## 목표

* Approval/Edit modal 안정성 확보

## 변경 파일

* ApprovalModal.jsx
* EditModal.jsx

## Commit 단위

1. fix(modal): prevent close on API failure
2. refactor(modal): unify error handling pattern
3. test(modal): verify failure persistence behavior

---

# PR #7 — PAY ACCURACY + EDGE CASE FIX

## 목표

* rejected / pending / auto_closed 계산 정확도 확보

## Commit 단위

1. fix(pay): exclude non-settled rows from totals
2. fix(pay): correct monthly projection formula
3. test(pay): validate edge cases (holiday / zero attendance)

---

# PR #8 — FINAL ARCHITECTURE ALIGNMENT

## 목표

* docs ↔ src 완전 일치

## Commit 단위

1. chore(docs): align architecture with implementation
2. chore(docs): update mapping table
3. chore(repo): finalize refactor documentation

---

# 🧭 FINAL FLOW

PR 순서:

1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

---

# 🧠 핵심 철학

> “UI는 절대 판단하지 않는다. 판단은 Domain이 한다.”
