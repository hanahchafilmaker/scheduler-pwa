
# 🧭 scheduler-pwa 정리본 
---

# 1. 프로젝트 개요

* 근무 스케줄 + 실제 출퇴근(근태) 분리 시스템
* schedule = 계획
* attendance = 실제 기록
* 정산 = attendance 기준

### 핵심 구조

* Frontend: React PWA
* Backend: Supabase
* DB: PostgreSQL

---

# 2. 핵심 운영 원칙

## 📌 데이터 역할

```txt id="role_core"
schedule   = 계획 (참고용)
attendance = 실제 기록 (정산 기준)
```

---

## 📌 대타 원칙

* schedule 수정 ❌
* attendance 기준으로 실제 근무자 처리
* 대타는 approval 필요

---

## 📌 승인 흐름

```txt id="approval_flow"
pending → approved → rejected
```

---

# 3. 핵심 기능 상태

## UI 구성

* Attendance Tab
* Schedule Tab
* Employee Tab
* ApprovalModal
* EditModal

---

## 급여 로직

* pay.js 단일 엔진
* 지각 / 휴게 / 초과 근무 반영
* 대타 반영
* 정산 완료 고정

---

# 4. 현재 구조 문제 해결 방향

## 반드시 분리된 것

* status 계산 → domain
* 급여 계산 → pay.js
* 필터/검색 → selectors
* label → labels.js

---

# 5. DB 구조

## schedule

```txt
id
employee_id
date
start_time
end_time
part
```

---

## attendance

```txt
id
employee_id
actual_employee_id
date
check_in
check_out
break_min
status
final_pay
settled_at
```

---

## attendance_logs

```txt
id
attendance_id
action
before_json
after_json
actor
created_at
```

---

# 6. 상태 시스템

```txt id="state_machine"
OPEN      = check_in 없음
WORKING   = check_in 있음 + check_out 없음
CLOSED    = check_out 있음
PENDING   = 승인 대기
APPROVED  = 승인 완료
REJECTED  = 승인 거절
```

---

# 7. 정산 규칙

```txt id="pay_rule"
정산 = attendance ONLY
```

## 포함

* check_in + check_out
* approved only

## 제외

* schedule
* pending
* rejected

---

# 8. 금지 규칙

❌ UI에서 급여 계산
❌ UI에서 상태 판단
❌ schedule로 정산
❌ rejected 포함 합산

---

# 9. 핵심 구조 원칙

```txt id="core_principle"
Backend = truth
Domain = rules
API = data
Frontend = render only
```

---

# 10. 작업 우선순위

## A (필수)

* ApprovalModal 연결
* EditModal 연결
* pay.js 단일화
* 승인 테스트

## B (안정화)

* logs 테이블
* final_pay snapshot
* 관리자 정산 화면

## C (고도화)

* 알림 시스템
* 월 리포트
* 권한 분리

---

# 11. 리팩토링 핵심

## AttTab 기준

### 제거

* inline status logic
* inline pay calc
* filter/search logic

### 이동

* status → domain
* pay → pay.js
* filter → selectors
* label → labels

---

# 12. 핵심 파일 구조

```txt id="file_map"
AttTab.jsx
ApprovalModal.jsx
EditModal.jsx
pay.js
getAttendanceStatus.js
selectors.js
labels.js
useApi.js
```

---

# 13. 아키텍처 구조

```
Frontend (Render Only)
        ↓
API Layer
        ↓
Domain Engine (Status / Rules)
        ↓
Event Layer
        ↓
Database
        ↓
Worker (Reconciliation)
```

---

# 14. 운영 체크리스트

* [ ] 승인 정상
* [ ] 거절 정상
* [ ] 수정 정상
* [ ] 급여 계산 일치
* [ ] 대타 반영
* [ ] 로그 저장
* [ ] 월 정산 고정

---

# 15. 핵심 문장

> schedule은 참고 데이터이며,
> 모든 판단과 정산은 attendance 기준으로만 수행된다.

---

# 🧭 한 줄 요약

> UI는 표시만 하고, 판단은 Domain이 한다.

