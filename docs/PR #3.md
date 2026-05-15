# 🔀 PR #3 — SELECTORS LAYER INTRODUCTION (diff)

## 🎯 목표

* AttTab 내부 filter / search / reduce 로직 제거
* UI에서 “데이터 가공” 완전 제거
* domain selector로 통합

---

# 📁 1. 신규 파일 생성

## `src/domain/attendance/selectors.js`

```diff id="sel001"
+// src/domain/attendance/selectors.js
+import { getAttendanceStatus } from "./getAttendanceStatus";
+
+export function selectPending(rows = []) {
+  return rows.filter((row) => {
+    const status = getAttendanceStatus(row);
+    return status === "PENDING";
+  });
+}
+
+export function selectSettled(rows = []) {
+  return rows.filter((row) => {
+    const status = getAttendanceStatus(row);
+    return status === "APPROVED" || status === "AUTO_CLOSED";
+  });
+}
+
+export function selectWorking(rows = []) {
+  return rows.filter((row) => {
+    const status = getAttendanceStatus(row);
+    return status === "WORKING";
+  });
+}
+
+export function selectByKeyword(rows = [], keyword = "") {
+  if (!keyword) return rows;
+
+  const lower = keyword.toLowerCase();
+
+  return rows.filter((row) => {
+    return (
+      (row.employee_name || "").toLowerCase().includes(lower) ||
+      (row.approval_reason || "").toLowerCase().includes(lower) ||
+      (row.part || "").toLowerCase().includes(lower)
+    );
+  });
+}
+
+export function selectByDate(rows = [], date) {
+  if (!date) return rows;
+  return rows.filter((row) => row.date === date);
+}
```

---

# 📁 2. AttTab.jsx 수정

---

## ❌ 기존 filter / search 로직

```diff id="att001"
-const filtered = rows.filter((row) => {
-  const matchKeyword =
-    row.employee_name?.includes(keyword) ||
-    row.approval_reason?.includes(keyword);
-
-  const matchDate = !selectedDate || row.date === selectedDate;
-
-  return matchKeyword && matchDate;
-});
```

---

## ✅ 변경

```diff id="att002"
+import {
+  selectPending,
+  selectSettled,
+  selectWorking,
+  selectByKeyword,
+  selectByDate
+} from "../../domain/attendance/selectors";
+
+const base = selectByDate(rows, selectedDate);
+const searched = selectByKeyword(base, keyword);
```

---

## ❌ 기존 상태별 분기

```diff id="att003"
-const pendingRows = rows.filter(r => r.approval_status === "pending");
-const approvedRows = rows.filter(r => r.approval_status === "approved");
```

---

## ✅ 변경

```diff id="att004"
+const pendingRows = selectPending(searched);
+const approvedRows = selectSettled(searched);
+const workingRows = selectWorking(searched);
```

---

# 📁 3. 기존 AttTab 내부 함수 제거

삭제 대상:

```diff id="att005"
- matchesSearch
- safeArray
- inline filter logic
- approval_status 직접 비교
```

---

# 📁 4. 구조 변화

## BEFORE

```text id="before"
AttTab.jsx
 ├─ filter logic
 ├─ search logic
 ├─ status logic
 ├─ pay logic (still present)
```

---

## AFTER

```text id="after"
AttTab.jsx
 ├─ render only
 ├─ selectors 호출
 ├─ event handler only
```

---

# 🧪 5. 검증 체크리스트

* [ ] AttTab 내부 filter 0개
* [ ] search logic 0개
* [ ] approval_status 직접 비교 0개
* [ ] selectPending 정상 작동
* [ ] selectSettled 정상 작동
* [ ] 날짜 필터 정상 작동
* [ ] keyword 검색 정상 작동

---

# 🧠 핵심 변화

## BEFORE

UI가 데이터 가공까지 수행 ❌

## AFTER

UI = rendering only + selectors 호출만 수행 ✅

---

# 🚀 현재 상태 (PR #3 완료 기준)

이 시점이면 구조가 이렇게 바뀜:

```text
UI (AttTab)
 ↓
Selectors (domain)
 ↓
Status Engine
 ↓
Data
```

