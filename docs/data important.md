## 중요 파일 백업 우선순위

```
src
├─ admin
│  └─ App.jsx                                        🔴 절대 백업 먼저
│
├─ shared
│  ├─ components
│  │  ├─ PayrollAdminPanel.jsx                       🔴 절대 백업 먼저  ← PDF/메일 발송 핵심
│  │  ├─ AttTab.jsx                                  🔴 절대 백업 먼저
│  │  ├─ PayslipModal.jsx                            🔴 절대 백업 먼저
│  │  ├─ SettleTab.jsx                               🔴 절대 백업 먼저
│  │  ├─ ShiftTab.jsx                                🟡 부분 백업
│  │  ├─ TodayTab.jsx                                🟡 부분 백업
│  │  ├─ EmployeeTab.jsx                             🟡 부분 백업
│  │  ├─ SimTab.jsx                                  🟡 부분 백업
│  │  └─ *.css                                       🟢 수정 가능
│  │
│  ├─ domain
│  │  └─ attendance
│  │     ├─ payroll
│  │     │  ├─ calculator
│  │     │  │  └─ payCalculator.js                   🔴 절대 백업 먼저  ← 지각/조퇴 공제 로직
│  │     │  ├─ engine
│  │     │  │  └─ payEngine.js                       🔴 절대 백업 먼저
│  │     │  ├─ summary
│  │     │  │  └─ paySummary.js                      🔴 절대 백업 먼저
│  │     │  └─ time
│  │     │     └─ timeUtils.js                       🔴 절대 백업 먼저
│  │     ├─ rules
│  │     │  └─ settledRules.js                       🔴 절대 백업 먼저
│  │     └─ settlement
│  │        └─ buildSettlement.js                    🔴 절대 백업 먼저
│  │
│  ├─ hooks
│  │  └─ useApi.js                                   🟡 부분 백업
│  │
│  ├─ api
│  │  └─ *.js                                        🟡 부분 백업
│  │
│  └─ utils
│     └─ *.js                                        🟡 부분 백업
│
├─ staff
│  └─ components
│     └─ StaffHome.jsx                               🟡 부분 백업
│
└─ supabase
   └─ functions
      └─ send-payroll-mails
         └─ index.ts                                 🔴 절대 백업 먼저  ← 메일 발송 Edge Function
```

## 핵심 변경 이력 (2026-05)

| 파일 | 변경 내용 |
|------|----------|
| `payCalculator.js` | 지각·조퇴 5분 유예 제거, 조기출근 10분 인정 제거 |
| `PayrollAdminPanel.jsx` | PDF 생성 jsPDF → html2canvas 방식으로 교체 (한글 깨짐 해결) |
| `send-payroll-mails/index.ts` | 메일 발송 Edge Function 배포 |