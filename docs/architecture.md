# 🏗 ARCHITECTURE.md

md id="archdoc_final"
# 🏗 Architecture Document

## 1. 시스템 구조

현재 시스템은 Event Sourcing이 아닌 상태 덮어쓰기 구조입니다.



UI Layer (React)
↓
useApi (state + business logic)
↓
Supabase (attendance 중심)

id="arch_a1"

---

## 2. 핵심 설계 철학

### ❗ Single Source of Truth

 
attendance = 모든 출퇴근 상태의 기준

 id="arch_a2"

이 하나의 row에:

- 출근
- 퇴근
- 승인 상태
- 급여 계산 결과

가 모두 포함됩니다.

---

## 3. attendance 상태 모델

### 상태 구성 요소

 

approved (null | true | false)
check_in / check_out
evaluation result

 id="arch_a3"

---

## 4. 상태 머신 (암묵적 구조)

### 상태 정의

| 상태 | 조건 |
|------|------|
| WORKING | check_in 있음, check_out 없음 |
| PENDING | approved = null |
| APPROVED | approved = true |
| REJECTED | approved = false |

---

## 5. 상태 생성 흐름

### Check-in

 

evaluateCheckIn()

 

결과:

- 정상 → approved = true
- 지각 → approved = null
- 스케줄 외 → approved = null

---

### Check-out

 

evaluateCheckOut()

 

결과:

- 정상 → 유지
- 연장근무 → pending
- 조기퇴근 → pending

---

## 6. 핵심 로직 위치

| 기능 | 위치 |
|------|------|
| 체크인 | doCheckIn |
| 체크아웃 | doCheckOut |
| 승인 | doApproveAttendance |
| 평가 | evaluateCheckIn/out |

👉 useApi.js에 집중

---

## 7. 데이터 흐름

### Check-in Flow

 

User
→ checkIn()
→ doCheckIn()
→ evaluateCheckIn()
→ INSERT attendance

 id="arch_a4"

---

### Check-out Flow

 

User
→ checkOut()
→ doCheckOut()
→ evaluateCheckOut()
→ UPDATE attendance

 id="arch_a5"

---

### Approval Flow

 

Admin
→ approveAttendance()
→ UPDATE attendance.approved

 

---

## 8. 현재 구조의 특징

### 1. Event Sourcing 아님

- 이벤트 로그 없음
- 상태 overwrite 구조

---

### 2. 평가 기반 상태 머신

- 상태는 DB가 아니라 함수로 결정됨
- evaluateCheckIn/out이 핵심

---

### 3. 승인과 근무 로직 결합

- check-in 시 승인 생성
- check-out 시 승인 변경 가능

---

## 9. UI 영향 구조

### Staff UI

- workingNow (derived state)
- today attendance merge

### Admin UI

- pending list
- schedule + attendance merge
- derived grouping logic

---

## 10. 주요 기술 특징

- React Hooks 중심 구조
- Supabase 직접 호출
- client-side business logic 집중
- normalized data layer 존재

---

## 11. 현재 구조의 한계

### ❌ 1. 상태 추적 불가
- 승인 history 없음

### ❌ 2. 상태 단일값 문제
- approval_reason 단일 string

### ❌ 3. 이벤트 기반 아님
- 변경 이력 없음

### ❌ 4. UI 의존성 큼
- TodayTab에서 상태 재계산 많음

---

## 12. 향후 구조 (권장)

### Option A: 현재 구조 유지

- 안정화
- 로직 분리
- UI 개선

---

### Option B: Event-driven 구조

 

attendance (raw)
work_events (state machine)

 id="arch_a6"

- 완전 이벤트 기반
- 승인 history
- 확장성 확보

---

## 13. 결론

현재 시스템은:

> “평가 함수 기반 단일 row 상태 머신”

즉,
DB는 저장소, 상태는 코드가 결정하는 구조
 
