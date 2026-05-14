
# 🧭 Attendance System Full Architecture (FE + BE + DB + Ops)

---

# 1. 전체 구조 (End-to-End)

```id="arch_overall"
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
│  (audit, sync, recalculation) │
└──────────────────────────────┘
```

---

# 2. 핵심 도메인 구조 (Backend)

## 📦 3대 핵심 도메인

```id="domain_model"
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

```sql id="att_table"
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

---

### 상태는 DB가 아니라 “계산값”

> ⚠️ 절대 DB에 status 저장하지 않음 (중요)

---

## 2.2 Schedule Domain

```sql id="schedule_table"
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

```sql id="approval_table"
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

## 🔥 핵심 규칙: Status Engine = Backend에서 정의

```id="status_engine"
getAttendanceStatus(attendance)
```

---

## 상태 정의

```ts id="status_def"
WORKING
→ check_in exists AND check_out null

CLOSED
→ check_out exists

PENDING
→ CLOSED + approval pending

REJECTED
→ approval rejected
```

---

# 4. API 구조

## 4.1 Today Dashboard API

```http id="api_today"
GET /api/today
```

### Response

```json id="today_response"
{
  "attendance": [],
  "schedule": [],
  "employees": []
}
```

---

## 4.2 Attendance APIs

```http id="att_api"
POST /attendance/check-in
POST /attendance/check-out
GET  /attendance/today
```

---

## 4.3 Approval APIs

```http id="approval_api"
POST /approval/approve
POST /approval/reject
GET  /approval/pending
```

---

# 5. Backend Processing Flow

## 🧠 핵심 흐름

```id="backend_flow"
CHECK IN
  ↓
Attendance 생성 (WORKING)

CHECK OUT
  ↓
Attendance 업데이트 (CLOSED)

Trigger Event
  ↓
Approval 생성 (if needed)

Frontend Query
  ↓
selectTodayState (FE or BE optional)
```

---

# 6. Event / Trigger Layer (중요)

## 목적

* 데이터 자동 보정
* 승인 상태 자동 생성
* 이상 데이터 감지

---

## DB Trigger or Queue Event

```id="event_layer"
attendance.updated
attendance.created
schedule.missing_match
```

---

## 예시

```ts id="event_example"
if (check_out exists && approval_status null) {
  create approval(pending)
}
```

---

# 7. Frontend vs Backend 책임 분리

## ❌ 잘못된 구조

* FE가 상태 계산
* FE가 매칭 판단
* FE가 business rule 처리

---

## ✅ 올바른 구조

| Layer    | 책임              |
| -------- | --------------- |
| Backend  | truth + rules   |
| API      | normalized data |
| Frontend | render only     |

---

# 8. 데이터 흐름 (Full Cycle)

```id="full_flow"
1. USER ACTION
   check-in / check-out

2. BACKEND
   attendance update

3. EVENT LAYER
   approval 생성 / 상태 변화

4. API
   normalized response

5. FRONTEND
   selectTodayState()

6. UI
   TodayTab render
```

---

# 9. 운영 안정 구조 (핵심)

## 3단 안정 구조

```id="stability"
[1] Raw Data Layer (DB)
[2] Domain Logic Layer (Backend)
[3] Presentation Layer (Frontend)
```

---

## 절대 원칙

> “상태 판단은 Backend or Shared Engine 하나만 존재”

---

# 10. 디버깅 구조 (5분 컷 설계)

## 문제 발생 시 3단계

### 1️⃣ Backend 확인

```sql
SELECT * FROM attendance WHERE id=?
```

---

### 2️⃣ Status Engine 확인

```ts
getAttendanceStatus(row)
```

---

### 3️⃣ FE state 확인

```ts
selectTodayState()
```

---

## 장애 유형 매핑

| 증상       | 원인                       |
| -------- | ------------------------ |
| 승인 버튼 이상 | approval_status mismatch |
| 근무 중 오류  | check_in/out 불일치         |
| 미출근 오류   | schedule-matching 실패     |
| UI 상태 꼬임 | FE raw logic 존재          |

---

# 11. 확장 구조 (운영 레벨)

## 추천 확장

### 1. Redis cache

* 오늘 attendance pre-aggregation

### 2. Event Queue (Kafka / RabbitMQ)

* 상태 변화 이벤트 처리

### 3. Audit Log

```id="audit"
attendance_change_log
approval_log
```

---

### 4. Status Service 분리 (Advanced)

```id="status_service"
attendance-status-service
→ getAttendanceStatus() 중앙화
```

---

# 🧾 한 줄 요약

> 이 시스템의 핵심은 “Backend가 진짜 상태를 정의하고, Frontend는 그 결과만 렌더링하는 구조”이다.

