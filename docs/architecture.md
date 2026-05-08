# scheduler-pwa 아키텍처

## 프로젝트 목적

scheduler-pwa는 작은 사업장을 위한 출퇴근 및 근무 관리 프로젝트이다.

핵심 목적:

- 오늘 근무 현황 확인
- 출퇴근 기록 관리
- 승인 대기 관리
- 대타 흐름 관리
- 실제 근무 기준 급여 정산

## 핵심 데이터 구조

schedule = 계획
attendance = 실제 기록

정산은 attendance 기준으로만 계산한다.

## 현재 폴더 구조

src/
├─ admin/
├─ staff/
├─ shared/
│  ├─ api/
│  ├─ components/
│  ├─ constants/
│  ├─ hooks/
│  └─ utils/

## 주요 컴포넌트

- TodayTab
- AttTab
- ShiftTab
- SimTab
- Nav

## Today 운영 중심 구조

TodayTab은 아래 4개 섹션 기준으로 동작한다.

1. 현재 근무중
2. 승인대기
3. 미출근
4. 자동퇴근 예정

## 정산 기준

정산 포함 조건:

- attendance 존재
- check_in 존재
- check_out 존재
- approved = true

## 절대 금지

- schedule과 attendance 혼합 금지
- todayAttendance / monthAttendance 혼합 금지
- TodayTab 내부 fetch 금지
- App.jsx 상태 구조 임의 변경 금지

## 인코딩 원칙

모든 파일은 UTF-8로 저장한다.