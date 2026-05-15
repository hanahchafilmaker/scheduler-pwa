# 🔀 PR #5 — UI PURIFICATION (AttTab CLEANUP)

## 🎯 목표

* AttTab = render only
* 모든 계산/필터/유틸 제거
* domain/selectors/pay만 사용
* “UI가 아무 판단도 하지 않는 상태” 완성

---

# 📁 1. AttTab.jsx — 제거 대상

## ❌ 삭제 (핵심)

```diff id="ui001"
- safeArray
- timeRange
- matchesSearch
- inline filter logic
- approval_status 직접 비교
- hourly_wage 계산
- workMin 계산
```

---

# 📁 2. AttTab.jsx — import 정리

## ❌ 기존 (혼재 상태)

```diff id="ui002"
-import { useState, useMemo } from "react";
-import { getPaidWorkMinutes } from "../hooks/useApi";
-import { getApprovalStatusLabel } from "../hooks/useApi";
```

---

## ✅ 변경 (domain only)

```diff id="ui003"
+import { useState } from "react";
+
+import { getAttendanceStatus } from "../../domain/attendance/getAttendanceStatus";
+import {
+  selectByDate,
+  selectByKeyword,
+  selectPending,
+  selectSettled,
+  selectWorking
+} from "../../domain/attendance/selectors";
+
+import { calcRowPayWithSeparation } from "../../shared/utils/pay";
```

---

# 📁 3. 데이터 파이프라인 단순화

## ❌ 기존 (복잡한 UI 처리)

```js id="ui004"
const filtered = rows
  .filter(...)
  .map(...)
  .reduce(...)
```

---

## ✅ 변경 (3단계 고정 구조)

```diff id="ui005"
+const base = selectByDate(rows, selectedDate);
+const searched = selectByKeyword(base, keyword);
+
+const pendingRows = selectPending(searched);
+const approvedRows = selectSettled(searched);
+const workingRows = selectWorking(searched);
```

---

# 📁 4. summary 계산 완전 정리

## ❌ 기존

```js id="ui006"
rows.reduce((sum, row) => {
  return sum + row.hourly_wage * row.workMin / 60;
}, 0);
```

---

## ✅ 변경

```diff id="ui007"
+const todayLaborCost = searched.reduce((sum, row) => {
+  const status = getAttendanceStatus(row);
+
+  if (status === "REJECTED") return sum;
+  if (status === "OPEN") return sum;
+
+  return sum + calcRowPayWithSeparation(row);
+}, 0);
```

---

# 📁 5. JSX 렌더링 단순화

## ❌ 기존

```jsx id="ui008"
{row.approval_status === "pending" && <Badge />}
{row.approval_reason === "substitute" && <Tag />}
```

---

## ✅ 변경

```diff id="ui009"
+const status = getAttendanceStatus(row);
+
+{status === "PENDING" && <Badge>Pending</Badge>}
+{status === "APPROVED" && <Badge>Approved</Badge>}
+{status === "REJECTED" && <Badge>Rejected</Badge>}
+
+{row.approval_reason && (
+  <Tag>
+    {row.approval_reason}
+  </Tag>
+)}
```

👉 label 변환은 이미 domain에서 끝남

---

# 📁 6. 최종 구조 변화

## BEFORE (AttTab)

```text id="ui010"
UI
 ├─ filtering
 ├─ searching
 ├─ status logic
 ├─ pay logic
 ├─ label logic
 └─ rendering
```

---

## AFTER (AttTab)

```text id="ui011"
UI
 ├─ state handling
 ├─ event handlers
 └─ rendering only
```

---

# 🧪 7. 검증 체크리스트

* [ ] AttTab 내부 filter 0개
* [ ] status 비교 0개
* [ ] label 함수 없음
* [ ] pay 계산 없음
* [ ] search logic 없음
* [ ] selectors만 사용
* [ ] render-only 구조

---

# 🧠 핵심 변화

## BEFORE

UI = business logic + rendering ❌

## AFTER

UI = rendering only ✅

---

# 🚀 현재 아키텍처 상태

PR #5 완료 시:

```text id="arch_after_pr5"
Domain (truth)
   ↓
Selectors (data shaping)
   ↓
Pay Engine (calculation)
   ↓
UI (render only)
```