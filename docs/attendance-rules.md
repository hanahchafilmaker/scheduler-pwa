
# OPERATION & RULES 

---

# 1. 시스템 철학

```txt
1. schedule = 참고용 계획 데이터
2. attendance = 유일한 실제 기록
3. 정산 = attendance 기준
```

---

# 2. 데이터 구조

## 📌 schedule (계획)

* employee_id
* date
* planned_start
* planned_end
* part

👉 정산에 사용하지 않음

---

## 📌 attendance (실제 기록)

* employee_id
* check_in
* check_out
* approval_status
* approval_reason

👉 정산 기준 데이터

---

# 3. 출근 규칙 (CHECK-IN)

## ✔ 기본 원칙

```txt
check_in = 출근 기록 생성
```

## ✔ 유형

* 정상 출근 → schedule 범위 내
* 스케줄 외 출근 → pending
* 대타 출근 → approval 필요
* 시간 외 출근 → pending

---

# 4. 퇴근 규칙 (CHECK-OUT)

## ✔ 기본 원칙

```txt
check_out = 실제 퇴근 시점
```

## ✔ 상태

* 정상 퇴근 → CLOSED
* 미퇴근 → WORKING 유지
* 자동퇴근 → 조건 충족 시 처리

---

## 🚫 제거된 규칙

* 5분 지각 유예 ❌
* 5분 조기퇴근 인정 ❌
* 30분 유예 ❌

👉 시간 예외 없음 (정확 기록 기준)

---

# 5. 상태 규칙 (STATE MACHINE)

```txt
OPEN      = check_in 없음
WORKING   = check_in 있음 + check_out 없음
CLOSED    = check_out 있음
PENDING   = 승인 대기
APPROVED  = 승인 완료
REJECTED  = 승인 거절
```

---

# 6. 정산 규칙 (PAYROLL)

## ✔ 기본 원칙

```txt
정산 = attendance ONLY
```

## ✔ 포함 조건

* check_in 있음
* check_out 있음
* approval = approved

## ❌ 제외

* schedule 데이터
* 승인 안 된 기록
* 퇴근 미완료

---

# 7. 미출근 규칙

```txt
schedule 존재 + attendance 없음
```

* 현재 시간 < start → 예정
* 현재 시간 > start → 미출근

---

# 8. 승인 규칙

## 흐름

```txt
PENDING → APPROVED
PENDING → REJECTED
```

## 대상

* 스케줄 외 출근
* 대타 근무
* 시간 외 근무
* 자동 보정 기록

---

# 9. 자동퇴근 규칙

```txt
check_in 있음
check_out 없음
planned_end 초과
```

→ 자동 CLOSE 처리

---

# 10. 예외 처리

* 중복 출근 방지
* 스케줄 mismatch → pending
* 누락 퇴근 → 자동퇴근 or 관리자 승인
* 비정상 데이터 → 검수 리스트

---

# 11. 금지 규칙

❌ schedule로 급여 계산
❌ FE에서 상태 계산
❌ approval_status 임의 변경
❌ UI에서 근태 판단

---

# 12. 허용 규칙

✔ getAttendanceStatus() (단일 엔진)
✔ backend domain logic
✔ API 기반 상태 제공

---

# 13. 디버깅 흐름

```txt
1. DB 확인
2. attendance 상태 확인
3. status engine 결과 확인
4. API response 확인
5. UI 확인
```

---

# 14. 핵심 문장

> schedule은 참고 데이터이며,
> 모든 판단과 정산은 attendance 기준으로만 이루어진다.

---

# 🚀 최종 요약

* schedule = 참고
* attendance = 기준
* status = backend engine
* payroll = attendance only
* frontend = render only
* 예외 없음 (정확 시간 기준 시스템)
