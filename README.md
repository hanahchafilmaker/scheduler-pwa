# scheduler-pwa

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
