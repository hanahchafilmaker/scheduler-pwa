# 대타 운영 흐름

## 핵심 원칙

대타는 schedule을 덮어쓰지 않는다.

기존 스케줄은 원래 근무자의 계획으로 유지하고,
실제 출근자는 attendance에 기록한다.

## 상태 흐름

대타 요청 상태는 다음 흐름을 따른다.

requested
→ approved
→ fulfilled

## 상태 의미

### requested

대타 요청이 생성된 상태.

아직 관리자가 승인하지 않은 상태이다.

### approved

관리자가 대타 요청을 승인한 상태.

아직 실제 출근이 완료된 것은 아니다.

### fulfilled

대타 근무자가 실제로 출근하여 attendance 기록이 생성된 상태.

## 데이터 기준

원래 근무자는 다음 필드로 유지한다.

- original_employee_id

실제 출근자는 attendance의 employee_id 기준으로 기록한다.

## 금지사항

- 대타 승인 시 schedule 자체를 덮어쓰지 말 것
- 원래 근무자 정보를 삭제하지 말 것
- 정산을 schedule 기준으로 하지 말 것

## 정산

대타 정산도 일반 근무와 동일하게 처리한다.

정산 조건:

- attendance 기록 있음
- check_in 있음
- check_out 있음
- approved = true