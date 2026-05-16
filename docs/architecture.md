

# 🧭 Attendance System Full Architecture (Production Final)

---

# 1. 전체 구조 (End-to-End)

```id="arch_final"
┌──────────────────────────────┐
│        Frontend (PWA)        │
│ React / Hooks / Today UI     │
│  - Render Only               │
└──────────────┬───────────────┘
               │ HTTPS (REST / RPC)
               ▼
┌──────────────────────────────┐
│        API Layer              │
│ Edge Functions / Server API  │
│  - Auth Verification         │
│  - Input Validation          │
│  - Idempotency Check         │
└──────────────┬───────────────┘
               ▼
┌──────────────────────────────┐
│     Domain Engine Layer       │
│ Attendance / Schedule / Pay   │
│ Status Engine (Single Source) │
└──────────────┬───────────────┘
               ▼
┌──────────────────────────────┐
│      Event / Queue Layer      │
│ Event Trigger / Job Queue     │
│ - approval 생성              │
│ - payroll 계산              │
│ - audit log                 │
└──────────────┬───────────────┘
               ▼
┌──────────────────────────────┐
│        Database Layer         │
│ PostgreSQL (Source of Truth)  │
│ + RLS Policies               │
└──────────────┬───────────────┘
               ▼
┌──────────────────────────────┐
│   Reconciliation / Worker     │
│ Cron Job / Repair System      │
│ - 상태 정합성 복구           │
│ - 누락 이벤트 재처리         │
└──────────────────────────────┘
```

---

# 2. 도메인 구조

```id="domain_final"
1. Attendance Domain
2. Schedule Domain
3. Approval Domain
4. Payroll Domain
```

---

# 2.1 Attendance Domain

```sql id="attendance_final"
attendance
- id
- employee_id
- schedule_id (nullable)
- check_in
- check_out
- created_at
```

👉 ❌ 상태 컬럼 없음
👉 ❌ 지급 관련 필드 없음

---

# 2.2 Schedule Domain

```sql id="schedule_final"
schedule
- id
- employee_id
- date
- shift_type
- planned_start
- planned_end
```

---

# 2.3 Approval Domain

```sql id="approval_final"
approval
- id
- attendance_id
- status (pending / approved / rejected)
- reason
- note
- processed_by
- processed_at
```

---

# 2.4 Payroll Domain

```sql id="payroll_final"
payroll
- id
- employee_id
- attendance_id
- base_pay
- deduction
- final_pay
- calculated_at
```

---

# 3. Status Engine (Single Source)

```id="status_engine_final"
getAttendanceStatus(attendance, schedule, approval)
```

---

## 상태 정의

```ts id="status_final"
WORKING
→ check_in exists AND check_out null

COMPLETED
→ check_out exists

PENDING_APPROVAL
→ completed + approval = pending

APPROVED
→ approval = approved

REJECTED
→ approval = rejected
```

---

# 4. API 구조

---

## 4.1 Attendance API

```http id="api_att_final"
POST /attendance/check-in
POST /attendance/check-out
GET  /attendance/today
```

---

## 4.2 Approval API

```http id="api_app_final"
POST /approval/approve
POST /approval/reject
GET  /approval/pending
```

---

## 4.3 Payroll API

```http id="api_pay_final"
GET /payroll/today
POST /payroll/recalculate
```

---

# 5. Backend Flow

```id="flow_final"
CHECK IN
  ↓
DB INSERT

CHECK OUT
  ↓
DB UPDATE

EVENT TRIGGER
  ↓
Status Engine 실행
  ↓
Approval 생성 (if needed)
  ↓
Payroll Queue 실행
```

---

# 6. Event System

```id="event_final"
attendance.created
attendance.updated
approval.created
payroll.requested
```

---

## Event Rule

```ts id="event_rule_final"
if (attendance.updated) {
  runStatusEngine()
  enqueueApproval()
  enqueuePayroll()
}
```

---

# 7. Frontend 책임

```id="fe_final"
✔ API 호출
✔ UI 렌더링
✔ 로컬 캐시

❌ 상태 계산
❌ 근무 판정
❌ 급여 로직
```

---

# 8. 데이터 흐름

```id="data_flow_final"
1. USER ACTION
   check-in / check-out

2. API Layer
   validate + idempotency check

3. Domain Engine
   status + rule computation

4. Event System
   approval + payroll trigger

5. DB
   source of truth

6. Worker
   reconciliation + repair

7. Frontend
   render only
```

---

# 9. 운영 안정 구조

```id="stability_final"
[1] DB (Source of Truth)
[2] Domain Engine (Single Rule Source)
[3] Event System (Async Processing)
[4] Worker (Repair / Sync)
[5] Frontend (Render Only)
```

---

# 10. Reconciliation System

```id="recon_final"
cron: every 10~30 min
```

---

## 역할

* 누락 approval 생성
* payroll mismatch 복구
* status 재계산

---

# 🧾 최종 핵심 요약

```txt
✔ 상태는 오직 Domain Engine 하나만 관리
✔ DB는 저장만 담당
✔ Event는 비동기 처리
✔ Worker는 항상 복구 책임
✔ Frontend는 렌더링만 수행
```

---

# 🔥 한 줄 결론

> 이 구조는 “실시간 + 이벤트 기반 + 복구 가능한 급여/근태 시스템”의 운영 안정형 아키텍처다.
