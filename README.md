# SHIFT Scheduler PWA

소규모 매장 운영을 위한 근무표·출퇴근·급여 정산 보조 시스템입니다.  
Google Sheets를 데이터베이스처럼 사용하고, Google Apps Script를 API 서버로 연결한 React 기반 PWA입니다.

## 주요 기능

### 관리자용

- 월별 근무표 생성
- `input_YYYY_MM` 시트 기반 스케줄 작성
- `schedule_YYYY_MM` 자동 생성
- 직원 출퇴근 기록 확인
- 대타 / 스케줄 외 출근 확인
- 승인 처리
- 자동 퇴근 반영
- 월별 자료 백업
- 정산 완료 월 숨김
- 백업 완료 자료 정리

### 직원용

- PIN 로그인
- 오늘 근무 확인
- 출근 입력
- 퇴근 입력
- 이달 근무 기록 확인
- 스케줄 외 출근 가능

## 기술 스택

- React
- Vite
- PWA
- Google Sheets
- Google Apps Script
- Vite Proxy

## 데이터 구조

### employees

```txt
employee_id	name	pin	phone	hourly_wage	active