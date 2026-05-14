# 🧭 ATTENDANCE SYSTEM — OPERATION & RULES (FINAL)

---

# 📌 1. 시스템 철학 (가장 중요)

이 시스템은 단순 출퇴근 기록 앱이 아니라:

>   근태 데이터 기반 정산 시스템 (Attendance-based Payroll System)  

---

## 🧠 핵심 원칙 3가지

```txt
1. schedule = 계획 데이터 (참고용)
2. attendance = 실제 기록 (절대 기준)
3. 정산 = attendance ONLY
```

---

# 🧱 2. 데이터 역할 정의

## 📌 schedule (계획)

* 근무 예정표
* 변경 가능
* 정산에 직접 사용 금지

필드:

* planned_start
* planned_end
* employee_id
* part

---

## 📌 attendance (실제 기록)

* 직원 행동 로그
* 출근/퇴근 기반 생성
* 정산의 유일 기준

필드:

* check_in
* check_out
* approval_status
* approval_reason
* paid_check_in/out

---

# ⏱ 3. 출근 규칙 (CHECK-IN RULES)

## 📌 기본 원칙

```txt
직원 출근 = check_in 기록 생성
```

---

## 📌 출근 유형

### 1. 정상 출근

```txt
schedule 존재 + 시간 내 check_in
```

→ 자동 WORKING 상태

---

### 2. 스케줄 외 출근

```txt
schedule 없음 or mismatch
```

→ approval_status = pending

---

### 3. 대타 / 변경 출근

```txt
다른 직원 schedule로 check_in
```

→ 반드시 approval 필요

---

### 4. 시간외 출근

```txt
planned_start 이전 / 이후 출근
```

→ pending 처리

---

# ⏱ 4. 퇴근 규칙 (CHECK-OUT RULES)

## 📌 기본 원칙

```txt
check_out = 실제 근무 종료 시점
```

---

## 📌 처리 흐름

### 1. 정상 퇴근

* check_out 기록
* CLOSED 상태

---

### 2. 퇴근 누락

```txt
check_in 있음 + check_out 없음
```

→ WORKING 상태 유지

---

### 3. 자동퇴근 대상

조건:

```txt
check_in 있음
check_out 없음
planned_end 초과
+ 30분 유예
```

→ AUTO CHECKOUT 처리 후보

---

# 🧠 5. 상태 규칙 (STATE MACHINE)

## 📌 시스템 상태 정의

```txt
OPEN      = check_in 없음
WORKING   = check_in 있음 + check_out 없음
PENDING   = 승인 대기
APPROVED  = 승인 완료
CLOSED    = check_out 있음
REJECTED  = 승인 거절
```

---

## 📌 상태 결정 원칙

```txt
getAttendanceStatus(row) = 단일 진실 소스
```

---

# 📊 6. 정산 규칙 (PAYROLL RULES)

## 📌 핵심 원칙

```txt
정산 = attendance ONLY
```

---

## 📌 정산 포함 조건

```txt
check_in 있음
check_out 있음
approved = true
```

---

## 📌 정산 제외

* 승인 안 된 기록
* check_out 없는 기록
* schedule-only 데이터

---

## 📌 주의

```txt
schedule은 절대 정산에 사용하지 않는다
```

---

# 🚨 7. 미출근 규칙 (NO-SHOW RULES)

## 📌 기준

```txt
schedule 존재 + attendance 없음
```

---

## 📌 상태 분류

| 조건           | 상태  |
| ------------ | --- |
| 현재시간 < start | 예정  |
| 현재시간 > start | 미출근 |

---

# ⚠️ 8. 예외 처리 규칙

## 📌 1. 스케줄 외 출근

→ pending

---

## 📌 2. 중복 출근

→ 동일 employee + date + part 체크

---

## 📌 3. 누락 퇴근

→ 자동퇴근 or 관리자 승인

---

## 📌 4. 비정상 기록

* schedule mismatch
* missing employee mapping
* invalid part

→ attentionOpenList

---

# 🔁 9. 승인 규칙 (APPROVAL RULES)

## 📌 상태 흐름

```txt
PENDING → APPROVED
PENDING → REJECTED
```

---

## 📌 승인 대상

* 스케줄 외 출근
* 시간외 근무
* 대타 근무
* 자동퇴근 보정

---

## 📌 승인 영향

```txt
approved=true → 정산 포함
approved=false → 정산 제외
```

---

# ⏰ 10. 자동퇴근 규칙 (AUTO CHECKOUT)

## 📌 목적

퇴근 누락 방지

---

## 📌 조건

```txt
check_in 있음
check_out 없음
planned_end 초과
+ 30분 유예
```

---

## 📌 상태 흐름

```txt
WORKING → CHECKOUT REQUIRED → AUTO CLOSE
```

---

# 📉 11. 운영 위험 규칙

## ❌ 금지

* schedule로 급여 계산
* UI에서 상태 계산
* approval_status 직접 변경
* check_in/out 기반 임의 판단

---

## ✅ 허용

* getAttendanceStatus()
* domain selectors
* service layer DB write

---

# 🧭 12. 운영 디버깅 규칙 (매우 중요)

## 장애 발생 시 5단계

```txt
1. DB raw 확인
2. attendance 상태 확인
3. getAttendanceStatus 결과 확인
4. selector 결과 확인
5. UI props 확인
```

---

# 📌 13. 시스템 핵심 문장

> schedule은 계획일 뿐이며
> 모든 판단과 정산은 attendance 상태 머신이 결정한다.

---

# 🚀 14. 결과 구조

이 규칙 적용 시:

* 정산 오류 제거
* 승인 흐름 안정화
* UI 버그 제거
* 디버깅 5분 구조
* 확장성 확보 (급여/세금/리포트)
