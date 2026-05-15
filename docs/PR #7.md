# 🔀 PR #7 — PAY EDGE CASE + MONTHLY FIX (diff)

## 🎯 목표

* 월급 계산 정확도 안정화
* 휴무일 / 데이터 0건 케이스 처리
* 월 예상값 왜곡 제거
* 정산 기준 고정 구조 준비

---

# 📁 1. pay.js 수정 (핵심 안정화)

---

## ❌ 기존 문제

```js id="pay001"
monthlyForecast = todayCost * remainingDays
```

👉 문제:

* 오늘 데이터 0이면 전체 월급 0원됨
* 휴무일 왜곡 발생

---

## ✅ 변경: 안정적인 평균 기반 계산

```diff id="pay002"
+export function calcMonthlyForecast({
+  monthlySum = 0,
+  elapsedDays = 1,
+  totalWorkingDays = 30
+}) {
+  const safeElapsed = Math.max(1, elapsedDays);
+
+  const avgDaily = monthlySum / safeElapsed;
+
+  return avgDaily * totalWorkingDays;
+}
```

---

# 📁 2. AttTab.jsx 수정 (월 계산 교체)

---

## ❌ 기존

```js id="pay003"
const forecast = todayLaborCost * remainingDays;
```

---

## ✅ 변경

```diff id="pay004"
+import { calcMonthlyForecast } from "../../shared/utils/pay";

+const forecast = calcMonthlyForecast({
+  monthlySum,
+  elapsedDays,
+  totalWorkingDays
+});
```

---

# 📁 3. 0 데이터 방어 로직 추가

---

## ❌ 문제 케이스

* 휴무일
* 출근 0명
* 시스템 초기 데이터

---

## ✅ 보호 로직

```diff id="pay005"
+if (!rows || rows.length === 0) {
+  return {
+    todayLaborCost: 0,
+    forecast: 0
+  };
+}
```

---

# 📁 4. rejected / pending 완전 차단

---

## ❌ 기존 위험

```js id="pay006"
reduce(all rows)
```

---

## ✅ 변경

```diff id="pay007"
rows.reduce((sum, row) => {
  const status = getAttendanceStatus(row);

+  if (status === "REJECTED") return sum;
+  if (status === "OPEN") return sum;
+  if (status === "PENDING") return sum;

  return sum + calcRowPayWithSeparation(row);
}, 0);
```

---

# 📁 5. 월 계산 기준 통일

---

## 추가 기준 정의

```text id="pay008"
monthlySum = APPROVED + AUTO_CLOSED only
```

---

## 적용

```diff id="pay009"
const monthlyRows = rows.filter((r) => {
  const status = getAttendanceStatus(r);
  return status === "APPROVED" || status === "AUTO_CLOSED";
});
```

---

# 📁 6. snapshot 대비 구조 (준비 단계)

---

## 추가 필드 구조

```ts id="pay010"
final_pay: number
settled_at: string
settled_month: string
```

---

# 🧪 7. 검증 체크리스트

* [ ] 휴무일 월 예상 0원 문제 해결
* [ ] 데이터 0건 안정 처리
* [ ] rejected 완전 제외
* [ ] pending 미포함
* [ ] 월 평균 계산 정상
* [ ] daily fluctuation 안정화
* [ ] forecast 값 흔들림 없음

---

# 🧠 핵심 변화

## BEFORE

```text id="pay_before"
오늘 기준 × 남은 일수 (불안정)
```

---

## AFTER

```text id="pay_after"
월 평균 기반 × 총 근무일 (안정)
```

---

# 🚀 전체 아키텍처 최종 상태

PR #7 완료 시:

```text id="final_arch"
UI (render only)
   ↓
Selectors (data shaping)
   ↓
Domain (status engine)
   ↓
Pay Engine (stable + averaged)
   ↓
Backend (truth)
```

---

# 🧾 이제 상태는 “운영 시스템” 단계

이 시점에서 이미:

* 구조 설계 완료
* 리팩토링 완료
* 안정성 확보
* 도메인 분리 완료

