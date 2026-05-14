# 📘 Attendance PWA Frontend Architecture (TodayTab 중심)

## 1. 개요

본 프로젝트는 출퇴근/스케줄/승인 상태를 통합 관리하는 **Attendance PWA 프론트엔드 시스템**이다.

핵심 목표는 다음 3가지:

* 상태 기반 UI (status-driven UI)
* raw field 직접 비교 제거
* 운영 중 장애 디버깅 최소화 (5분 내 원인 추적)

---

# 🧱 2. 전체 아키텍처 구조

```
📦 Frontend (React)
│
├── 📁 pages
│     └── TodayTab.jsx
│
├── 📁 hooks
│     └── useApi.js
│         ├── getAttendanceStatus()
│         ├── ATTENDANCE_STATUS
│         ├── getApprovalStatusLabel()
│         └── getApprovalReasonLabel()
│
├── 📁 domain layer (logical)
│     └── selectTodayState()
│
├── 📁 UI components
│     ├── StatCard
│     ├── PersonRow
│     ├── StatusBadge
│     └── ReasonBadge
│
└── 📁 styles
      └── TodayTab.css
```

---

# 🧠 3. 핵심 설계 원칙

## 3.1 상태 기반 UI (State-Driven UI)

모든 화면은 **raw data가 아니라 상태로만 렌더링한다**

### ❌ 금지

```js
row.check_out === null
row.approval_status === "pending"
```

### ✅ 권장

```js
getAttendanceStatus(row) === ATTENDANCE_STATUS.WORKING
```

---

## 3.2 Domain Layer 분리

모든 분류 로직은 UI 밖에서 처리

```
TodayTab (UI)
   ↓
selectTodayState (Domain)
   ↓
getAttendanceStatus (Rule Engine)
```

---

## 3.3 단일 상태 엔진 원칙

```
getAttendanceStatus(row)
→ 시스템의 "유일한 truth"
```

---

# ⚙️ 4. 상태 정의 (핵심)

## ATTENDANCE_STATUS

```ts
WORKING   // 출근 후 근무 중
PENDING   // 승인 대기 상태
CLOSED    // 퇴근 완료
REJECTED  // 반려 상태
```

---

## 상태 흐름

```
CHECK IN
   ↓
WORKING
   ↓
CHECK OUT
   ↓
CLOSED
   ↓
APPROVAL
   ├─ PENDING
   ├─ APPROVED
   └─ REJECTED
```

---

# 🧩 5. selectTodayState (Domain Engine)

## 역할

TodayTab의 모든 데이터를 **5개 UI 상태로 변환**

---

## 출력 구조

```ts
{
  workingNow: [],
  attentionOpenList: [],
  normalPending: [],
  extensionPending: [],
  lateNoShowList: []
}
```

---

## 분류 기준

### 1. workingNow

```
ATTENDANCE_STATUS.WORKING
+ schedule 매칭됨
```

---

### 2. attentionOpenList

```
WORKING / PENDING / REJECTED
+ 스케줄 mismatch or out_of_schedule
```

---

### 3. normalPending

```
ATTENDANCE_STATUS.CLOSED
+ approval_status = pending
+ 일반 승인 건
```

---

### 4. extensionPending

```
CLOSED
+ extension reason
```

---

### 5. lateNoShowList

```
schedule 존재
+ attendance 없음
```

---

# 🖥 6. UI 구조 (TodayTab)

## 화면 구성

```
[현재 근무중]
[확인 필요]

[승인 대기]
[연장 요청]

[미출근]
[오늘 스케줄 요약]
```

---

## UI 특징

* 모든 badge는 status 기반
* 모든 리스트는 domain state 기반
* approve/reject는 event handler만 전달

---

# 🔌 7. 데이터 흐름

```
API Response
   ↓
safeArray normalization
   ↓
useMemo(selectTodayState)
   ↓
UI render only
```

---

# 🧪 8. 디버깅 구조 (운영 기준)

## 1단계: 상태 확인

```js
getAttendanceStatus(row)
```

---

## 2단계: domain 분류 확인

```js
selectTodayState()
```

---

## 3단계: UI 문제 확인

```
StatCard → PersonRow → Badge
```

---

## 4단계: 매칭 문제

```
schedule ↔ attendance
findMatchingAttendance()
hasMatchingSchedule()
```

---

# ⚠️ 9. 절대 금지 패턴

## ❌ raw 상태 비교

```js
row.approval_status === "pending"
row.check_out === null
```

---

## ❌ UI에서 상태 계산

```js
if (row.check_in && !row.check_out)
```

---

## ❌ schedule + attendance 혼합 판단

UI 내부에서 직접 매칭 금지

---

# 🚀 10. 운영 안정성 설계

## 목표

* 상태 변경 시 UI 수정 없음
* backend enum 변경 영향 최소화
* 디버깅 5분 이내

---

## 핵심 전략

```
Single Source of Truth:
→ getAttendanceStatus()

Single Domain Layer:
→ selectTodayState()

UI is Pure Renderer:
→ TodayTab
```

---

# 📌 11. 향후 개선 방향 (권장)

* selectTodayState → reducer 구조로 전환
* status logging middleware 추가
* attendance 상태 event log 저장
* schedule-attendance 매칭 cache화
* approve/reject mutation layer 분리

---

# 🧾 한 줄 요약

> 이 구조의 핵심은 “UI에서 판단하지 않고, 상태 엔진 하나만 믿는 구조”이다.
