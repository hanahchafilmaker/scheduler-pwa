# 🔀 PR #4 — PAY SYSTEM UNIFICATION (diff)

## 🎯 목표

* 급여 계산 “단일 소스” 확정 (`pay.js`)
* UI / AttTab / legacy 계산 전부 제거
* `calcRowPayWithSeparation`만 사용

---

# 📁 1. pay.js 정리 (핵심 변경)

## ❌ 기존 legacy 함수 제거

```diff id="pay001"
- export function calcRowPay(row) {
-   return row.hourly_wage * (row.workMin / 60);
- }
-
- export function calcPay(rows) {
-   return rows.reduce((sum, row) => {
-     return sum + calcRowPay(row);
-   }, 0);
- }
```

---

## ✅ 변경 (단일 엔진만 유지)

```diff id="pay002"
+// src/shared/utils/pay.js
+
+export function calcRowPayWithSeparation(row) {
+  if (!row) return 0;
+
+  const wage = Number(row.hourly_wage || 0);
+  const workMin = Number(row.workMin || 0);
+
+  const base = (wage * workMin) / 60;
+
+  const latePenalty = row.late_min ? (wage / 60) * row.late_min : 0;
+  const earlyPenalty = row.early_leave_min ? (wage / 60) * row.early_leave_min : 0;
+
+  const overtime = row.overtime_min
+    ? (wage / 60) * row.overtime_min * 1.5
+    : 0;
+
+  return base - latePenalty - earlyPenalty + overtime;
+}
```

---

# 📁 2. AttTab.jsx 수정 (핵심)

---

## ❌ 기존 계산

```diff id="attpay001"
- const todayLaborCost = rows.reduce((sum, row) => {
-   const wage = Number(row.hourly_wage || 0);
-   const workMin = getPaidWorkMinutes(row);
-   return sum + (wage * workMin / 60);
- }, 0);
```

---

## ❌ 기존 위험 코드 (추가 제거)

```diff id="attpay002"
- row.hourly_wage * workMin / 60
```

---

## ✅ 변경

```diff id="attpay003"
+import { calcRowPayWithSeparation } from "../../shared/utils/pay";
+
+const todayLaborCost = rows.reduce((sum, row) => {
+  const status = getAttendanceStatus(row);
+
+  if (status === "REJECTED") return sum;
+  if (status === "OPEN") return sum;
+
+  return sum + calcRowPayWithSeparation(row);
+}, 0);
```

---

# 📁 3. 월 예상 인건비도 통일

## ❌ 기존

```diff id="attpay004"
- todayLaborCost * remainingDays
```

---

## ✅ 변경 (안정식)

```diff id="attpay005"
+const avgDaily =
+  monthlySum / Math.max(1, elapsedDays);
+
+const monthlyForecast =
+  avgDaily * totalWorkingDays;
```

---

# 📁 4. legacy 참조 제거

```diff id="attpay006"
- getPaidWorkMinutes
- hourly_wage 직접 계산
- workMin 직접 계산
```

---

# 🧪 5. 검증 체크리스트

* [ ] calcRowPayWithSeparation만 사용됨
* [ ] calcRowPay / calcPay 0 사용
* [ ] AttTab 직접 wage 계산 0
* [ ] rejected row 제외 정상
* [ ] overtime 반영 정상
* [ ] 월 예상 값 안정적

---

# 🧠 핵심 변화

## BEFORE

UI + util + legacy 계산 혼재 ❌

## AFTER

```
pay.js (single source of truth)
   ↓
AttTab (render only)
```

---

# 🚀 현재 아키텍처 상태

PR #4 완료 시:

* status engine ✅
* labels domain화 ✅
* selectors 분리 ✅
* pay 단일화 ✅

👉 이제 UI는 거의 “껍데기” 상태
