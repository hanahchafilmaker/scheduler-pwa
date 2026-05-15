# 🔀 PR #2 — LABEL SYSTEM ISOLATION (diff)

---

# 📁 1. 신규 파일 생성

## `src/domain/attendance/labels.js`

```diff id="lbl001"
+// src/domain/attendance/labels.js
+
+export function getApprovalStatusLabel(status) {
+  switch (status) {
+    case "pending":
+      return "승인 대기";
+    case "approved":
+      return "승인됨";
+    case "rejected":
+      return "거절됨";
+    case "auto_closed":
+      return "자동 마감";
+    default:
+      return "알 수 없음";
+  }
+}
+
+export function getApprovalReasonLabel(reason) {
+  switch (reason) {
+    case "substitute":
+      return "대타";
+    case "late":
+      return "지각";
+    case "early_leave":
+      return "조퇴";
+    case "manual":
+      return "수동 수정";
+    default:
+      return "-";
+  }
+}
+
+export function getPartLabel(part) {
+  switch (part) {
+    case "morning":
+      return "오전";
+    case "afternoon":
+      return "오후";
+    case "night":
+      return "야간";
+    default:
+      return part;
+  }
+}
```

---

# 📁 2. useApi.js 수정 (핵심 제거)

## ❌ 기존 (삭제 대상)

```diff id="api001"
-export function getApprovalStatusLabel(status) {
-  switch (status) {
-    case "pending": return "승인 대기";
-    case "approved": return "승인됨";
-    case "rejected": return "거절됨";
-    default: return "알 수 없음";
-  }
-}
-
-export function getApprovalReasonLabel(reason) {
-  switch (reason) {
-    case "substitute": return "대타";
-    case "late": return "지각";
-    default: return "-";
-  }
-}
```

---

## ✅ 변경 (삭제 또는 export 제거)

```diff id="api002"
+// useApi.js에서 UI label 로직 완전 제거
+// domain/attendance/labels.js로 이동
```

---

# 📁 3. AttTab.jsx 수정

## ❌ 기존 import

```diff id="tab001"
-import {
-  getApprovalStatusLabel,
-  getApprovalReasonLabel
-} from "../hooks/useApi";
```

---

## ✅ 변경 import

```diff id="tab002"
+import {
+  getApprovalStatusLabel,
+  getApprovalReasonLabel,
+  getPartLabel
+} from "../../domain/attendance/labels";
```

---

## ❌ 기존 UI 코드

```jsx id="tab003"
<span>{getApprovalStatusLabel(row.approval_status)}</span>
<span>{getApprovalReasonLabel(row.approval_reason)}</span>
```

---

## ✅ 변경 없음 (단, source만 변경됨)

```jsx id="tab004"
<span>{getApprovalStatusLabel(row.approval_status)}</span>
<span>{getApprovalReasonLabel(row.approval_reason)}</span>
```

👉 UI는 그대로지만 **source가 domain으로 이동**

---

# 📁 4. 영향 정리 (중요)

## BEFORE

```
useApi.js
 ├─ fetch logic
 ├─ label logic ❌ (혼재)
 ├─ data transform
```

---

## AFTER

```
useApi.js
 ├─ API fetch only

domain/attendance/labels.js
 ├─ UI label mapping (single source)
```

---

# 🧪 5. 검증 체크리스트

* [ ] useApi에서 label 함수 제거됨
* [ ] AttTab import domain으로 변경
* [ ] approval_status → label 정상 출력
* [ ] approval_reason → label 정상 출력
* [ ] part label 정상 출력
* [ ] UI 변경 없음 (render 유지)

---

# 🧠 핵심 변화

## BEFORE

UI + API + label logic 혼합 ❌

## AFTER

* API = data only
* Domain = meaning
* UI = render only