SHIFT Scheduler PWA

소규모 매장의 근무표 관리, 출퇴근 기록, 승인 처리, 임금 계산 보조를 위한 관리자/직원 분리형 PWA입니다.

이 프로젝트는 관리자용 앱과 직원용 앱을 분리해 운영하며, 모바일 홈 화면에 설치해 앱처럼 사용할 수 있도록 구성되어 있습니다.

---

프로젝트 개요

SHIFT Scheduler PWA는 소규모 매장에서 자주 발생하는 아래 문제를 줄이기 위해 만든 앱입니다.

- 종이 근무표 / 카톡 공지 중심 운영
- 출근 기록과 급여 계산 기준이 섞여 혼란스러운 문제
- 대타 / 시간 외 근무 / 연장근무 승인 처리 누락
- 직원이 오늘 스케줄과 본인 기록을 쉽게 확인하기 어려운 문제
- 월별 정산 시 실제 기록과 급여 반영 시간이 달라 확인이 어려운 문제

이 프로젝트는 위 문제를 해결하기 위해 다음 원칙으로 설계되었습니다.

- 정상 파트 근무는 자동 승인
- 추가 근무 / 시간 외 / 연장 / 대타만 승인 요청
- 실제 근무기록과 급여 반영시간을 분리
- 관리자와 직원 화면을 분리
- 모바일에서도 빠르게 체크인/체크아웃 가능

---

앱 구성

관리자 앱

- 월간 스케줄 확인 및 수정
- 직원 목록 관리
- 출퇴근 기록 확인
- 승인 대기 건 처리
- 대타 / 시간 외 / 연장 근무 확인
- 임금 계산 보조 데이터 확인
- 월별 정산 화면 확인

직원 앱

- PIN 기반 로그인
- 오늘 스케줄 확인
- 출근 / 퇴근 처리
- 대타 출근 요청
- 내 근무 기록 확인
- 승인 상태 확인

---

현재 구조

이 프로젝트는 현재 다음과 같은 프런트 구조를 사용합니다.

- `index.html` → 관리자 앱 진입점
- `staff.html` → 직원 앱 진입점
- Vite 멀티 엔트리 빌드
- React 기반 UI
- PWA 설정 포함
- Vercel 배포 라우팅 적용

현재 코드베이스에는 `@supabase/supabase-js`가 포함되어 있으며, 데이터 저장소를 Supabase 중심으로 옮기는 흐름을 염두에 두고 있습니다.  
다만 개발 환경 설정에는 일부 Google Apps Script 프록시 경로가 남아 있어, 완전한 Supabase 단일 구조로 정리 중인 과도기 상태일 수 있습니다.

---

기술 스택

- Frontend
  - React
  - Vite
  - React Router DOM
- App
  - PWA (`vite-plugin-pwa`)
- Backend / Data
  - Supabase 사용 예정 또는 병행 중
  - 일부 개발 프록시에 Google Apps Script 흔적 존재
- Deploy
  - Vercel

---

폴더 구조

txt
scheduler-pwa/
├─ docs/
├─ public/
├─ src/
│ ├─ admin/
│ ├─ staff/
│ └─ shared/
├─ index.html
├─ staff.html
├─ vite.config.js
├─ vercel.json
└─ package.json
`

주요 폴더 설명

`src/admin/`
관리자용 화면과 기능

`src/staff/`
직원용 화면과 기능

`src/shared/`
공통 컴포넌트, 유틸, 훅, 상수

`public/`
아이콘, 정적 파일, PWA 관련 리소스

`docs/`
구조 문서, 비즈니스 룰 문서, 운영 메모

---

실행 방법

1.  설치

bash
npm install

2.  관리자 앱 실행

bash
npm run dev:admin

기본 주소:

txt
http://localhost:5173

3.  직원 앱 실행

bash
npm run dev:staff

기본 주소:

txt
http://localhost:5174/staff.html

4.  빌드

bash
npm run build

5.  프리뷰

bash
npm run preview

---

배포 구조

Vercel 기준으로 다음과 같이 동작합니다.

`/staff` → `staff.html`
그 외 경로 → `index.html`
정적 리소스 및 PWA 관련 파일은 별도 라우팅

즉, 배포 후에는 일반적으로 아래처럼 접근하게 됩니다.

관리자: `/`
직원: `/staff`

---

핵심 비즈니스 규칙

1.  정상 파트 근무

오늘 스케줄이 있고
본인 파트에 맞게 출근한 경우
자동 승인
기본급 반영
추가 승인 요청 없음

2.  승인 요청이 필요한 경우

아래 경우만 승인 요청 대상입니다.

대타 근무
조기출근
뒷타임 지각으로 인한 연장
마감 오버타임
예정 파트 외 추가 근무
자동 연장근무 감지

3.  실제 근무시간과 임금 인정시간 분리

이 시스템은 시간을 두 가지로 나눠 관리합니다.

실제 근무시간

실제 출근 ~ 실제 퇴근 기준
승인 거절된 추가근무도 기록으로 남음

임금 인정시간

파트 예정 근무시간 기준
지각 / 조기퇴근 차감 반영
승인된 시간 외만 수당으로 추가

4.  지각 규칙

5분 이하 지각: 급여 차감 없음, 기록만 남김
6분 이상 지각: 실제 지각 시간만큼 차감

5.  조기출근 규칙

예정보다 일찍 출근한 경우
최대 5분까지만 인정
기본근무시간이 아니라 시간 외 수당으로 처리

6.  자동 연장근무 감지

예정 퇴근시간 이후 일정 시간 동안 퇴근 입력이 없으면
연장 승인 대기 상태 생성
퇴근 버튼은 유지
실제 퇴근시간은 기록
승인 여부에 따라 급여 반영 여부 결정

7.  자동 퇴근

추가 근무는 최대 60분까지만 허용
60분 경과 시 자동 퇴근 처리 가능
이후 체류시간은 추가 반영하지 않음

8.  대타 규칙

대타는 반드시 원래 스케줄과 연결
어떤 직원의 어떤 파트를 대신했는지 저장
대타 시간은 기본급이 아니라 시간 외 수당으로 처리
승인 완료 시만 지급

---

임금 계산 원칙

기본급

기본급은 파트 예정 근무시간 기준으로 계산합니다.

txt
기본급 계산분 = 예정 파트 근무분 - 지각 차감 - 조기퇴근 차감
기본급 = 기본급 계산분 / 60 × 시급

시간 외 수당

다음 항목은 시간 외 수당으로 처리할 수 있습니다.

조기출근 인정분
승인된 연장근무
승인된 마감 오버타임
승인된 추가 근무
승인된 대타 근무

총 지급액

txt
총 지급액 = 기본급 + 시간 외 수당

---

데이터 모델 예시

실제 스키마는 변경될 수 있지만, 개념적으로는 아래처럼 나뉩니다.

직원

txt
employees

- id
- name
- pin
- phone
- hourly_wage
- role
- active
- created_at

스케줄

txt
schedule

- schedule_id
- date
- employee_id
- name
- part
- planned_start
- planned_end
- memo

출퇴근 기록

txt
attendance

- attendance_id
- schedule_id
- employee_id
- date
- name
- part
- planned_start
- planned_end
- check_in
- check_out
- approved
- is_substitute
- original_employee_id
- substitute_for_schedule_id
- substitute_part
- created_at

---

개발 메모

현재 레포는 기능적으로는 운영 앱 형태에 가깝지만, 문서 기준으로는 아직 정리할 부분이 남아 있습니다.

권장 정리 방향:

1. README를 현재 구조 기준으로 유지
2. `docs/ARCHITECTURE.md`에 기술 구조 분리
3. `docs/BUSINESS_RULES.md`에 근태/임금 정책 상세화
4. Google Apps Script 관련 설정을 계속 쓸지, Supabase로 완전히 전환할지 명확히 정리
5. 환경변수 및 배포 설정 문서화

---

추천 문서 분리

txt
README.md
→ 프로젝트 소개 / 실행법 / 배포 / 핵심 규칙

docs/ARCHITECTURE.md
→ 폴더 구조 / 데이터 흐름 / 상태 관리 / 라우팅

docs/BUSINESS_RULES.md
→ 근태 / 승인 / 대타 / 자동퇴근 / 임금 계산 상세 규칙

docs/DEPLOY.md
→ Vercel / 환경변수 / 운영 배포 방법

---

향후 개선 후보

Supabase 단일화
관리자 화면에서 직접 스케줄 수정 강화
승인 대기 워크플로우 정리
월별 정산 UX 개선
직원용 홈 화면 단순화
모바일 UI 최적화
에러 처리 및 네트워크 실패 대응 강화

---

라이선스

개인 프로젝트 용도로 운영 중

Private Use Only
