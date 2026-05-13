
# 📘 README.md

 md id="readme_final"
# ⏱ Scheduler PWA

스케줄 기반 출퇴근 관리 + 승인 + 급여 계산을 통합한 근무 관리 시스템입니다.

---

## 📌 시스템 개요

본 시스템은 다음을 처리합니다:

- 직원 스케줄 관리
- 출퇴근 체크인 / 체크아웃
- 지각 / 조기퇴근 / 연장근무 자동 계산
- 관리자 승인 프로세스
- 급여 정산

---

## 🧠 핵심 구조

 

React UI
↓
useApi (비즈니스 로직)
↓
Supabase (attendance 중심)

 id="arch_1"

---

## 📊 핵심 데이터 모델

### 1. attendance (핵심 테이블)

모든 출퇴근 기록의 단일 진실(Source of Truth)

| 필드 | 설명 |
|------|------|
| check_in | 실제 출근 |
| check_out | 실제 퇴근 |
| paid_check_in | 급여 반영 출근 |
| paid_check_out | 급여 반영 퇴근 |
| approved | 승인 상태 (null / true / false) |
| approval_reason | 승인 필요 사유 |
| approval_note | 관리자/시스템 설명 |
| late_min | 지각 |
| extra_work_min | 연장근무 |
| early_leave_min | 조기퇴근 |

---

### 2. schedules

- 직원별 예정 근무 시간

---

### 3. employees

- 직원 정보 (급여 포함)

---

## ⚙️ 승인 시스템

승인 상태는 3가지입니다:

 

null   → 승인 대기
true   → 승인 완료
false  → 거절

 id="arch_2"

---

## 🔄 상태 흐름 (핵심 로직)

### 1. 체크인

 

checkIn()
→ doCheckIn()
→ evaluateCheckIn()
→ attendance INSERT

 id="arch_3"

### 평가 결과

- 정상 출근 → approved = true
- 지각 → approved = null (승인 필요)
- 스케줄 외 → approved = null

---

### 2. 체크아웃

 

checkOut()
→ doCheckOut()
→ evaluateCheckOut()
→ attendance UPDATE

 id="arch_4"

### 평가 결과

- 정상 퇴근 → 승인 유지
- 연장근무 → pending
- 조기퇴근 → pending

---

## 🧮 급여 계산 방식

- paid_check_in/out 기준
- break_min 차감
- 야간 근무 포함
- 실제 vs 지급 기준 분리

---

## 🧩 UI 구조

### Staff
- 출근 / 퇴근
- 오늘 근무 확인

### Admin
- 스케줄 관리
- 승인 처리
- 월별 정산

---

## 📁 구조

 

src/
├── shared/
│    ├── hooks/useApi.js   (핵심 로직)
│    ├── utils/pay.js      (급여 계산)
│    ├── api/
├── staff/
├── admin/

 id="arch_5"

---

## ⚠️ 현재 구조 특징

- Event Sourcing 아님
- attendance row가 상태를 모두 포함
- approval + work logic 혼합 구조
- evaluate 함수 기반 상태 추론

---

## 🚧 제한사항

- approval_reason 단일값 구조
- check-in / check-out 이벤트 분리 없음
- 승인 history 없음
- 상태 변경 로그 없음

---

## 🔮 향후 확장 방향

### Option A (현재 유지)
- UI/로직 정리
- 상태 계산 분리
- 안정화 중심

### Option B (권장 구조)
 

attendance (raw log)
work_events (state machine)

 id="arch_6"

- 이벤트 기반 구조
- 승인 history 완전 분리
- 확장성 확보

---

## 🎯 핵심 요약

> 현재 시스템은 “평가 기반 단일 row 상태 머신” 구조이다.
 