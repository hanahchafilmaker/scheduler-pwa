src
├─ App.jsx                          🔴 절대 백업 먼저
│
├─ rules
│  └─ settledRules.js               🔴 절대 백업 먼저
│
├─ shared
│  ├─ time
│  │  └─ timeUtils.js               🔴 절대 백업 먼저
│  │
│  ├─ utils
│  │  ├─ payCalculator.js           🔴 절대 백업 먼저
│  │  ├─ payEngine.js               🔴 절대 백업 먼저
│  │  └─ 기타 helper                🟡 부분 백업
│  │
│  ├─ summary
│  │  └─ paySummary.js              🔴 절대 백업 먼저
│  │
│  ├─ hooks
│  │  └─ useApi.js                  🟡 부분 백업
│  │
│  └─ components
│     ├─ AttTab.jsx                 🔴 절대 백업 먼저
│     ├─ ShiftTab.jsx               🟡 부분 백업
│     ├─ TodayTab.jsx               🟢 수정 가능
│     ├─ SimTab.jsx                 🟡 부분 백업
│     ├─ EmployeeTab.jsx            🟡 부분 백업
│     ├─ Nav.jsx                    🟢 수정 가능
│     └─ modal/*                    🟢 수정 가능
│
├─ styles
│  ├─ *.css                         🟢 수정 가능
│  └─ theme.css                     🟢 수정 가능
│
├─ pages
│  └─ admin/*                       🟡 부분 백업
│
└─ assets                           🟢 수정 가능