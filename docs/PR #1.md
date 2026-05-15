# 🔀 PR #1 — DOMAIN CORE RECOVERY (Status Engine)

---

# 📁 1. 신규 파일 생성

## `src/domain/attendance/getAttendanceStatus.js`

```diff
+// src/domain/attendance/getAttendanceStatus.js
+
+export function getAttendanceStatus(row) {
+  if (!row) return "OPEN";
+
+  const hasCheckIn = !!row.check_in;
+  const hasCheckOut = !!row.check_out;
+
+  // 아직 출근 안함
+  if (!hasCheckIn) return "OPEN";
+
+  // 출근만 있음 (근무 중)
+  if (hasCheckIn && !hasCheckOut) return "WORKING";
+
+  // 퇴근 완료
+  if (hasCheckOut) {
+    if (row.approval_status === "rejected") return "REJECTED";
+    if (row.approval_status === "pending") return "PENDING";
+    if (
+      row.approval_status === "approved" ||
+      row.approval_status === "auto_closed"
+    ) {
+      return "APPROVED";
+    }
+    return "CLOSED";
+  }
+
+  return "UNKNOWN";
+}
```

---

# 📁 2. AttTab.jsx 수정 패치

## ❌ 기존 코드 (삭제 대상)

```diff
- if (row.approval_status === "pending") ...
- if (row.approval_status === "approved") ...
- if (!row.check_in) ...
- if (row.check_out && ...) ...
```

---

## ✅ 변경 코드

### 1) import 추가

```diff
+import { getAttendanceStatus } from "../../domain/attendance/getAttendanceStatus";
```

---

### 2) status 계산 전부 교체

#### ❌ 기존 (여러 군데 존재)

```js
const isPending = row.approval_status === "pending";
const isRejected = row.approval_status === "rejected";
const isApproved = row.approval_status === "approved";
```

---

#### ✅ 변경

```diff
+const status = getAttendanceStatus(row);

+const isPending = status === "PENDING";
+const isRejected = status === "REJECTED";
+const isApproved = status === "APPROVED";
+const isWorking = status === "WORKING";
+const isOpen = status === "OPEN";
```

---

### 3) 테이블 렌더링 수정

#### ❌ 기존

```jsx
{row.approval_status === "pending" && (
  <Badge>Pending</Badge>
)}
```

---

#### ✅ 변경

```diff
+const status = getAttendanceStatus(row);

+{status === "PENDING" && (
+  <Badge>Pending</Badge>
+)}
+
+{status === "APPROVED" && (
+  <Badge>Approved</Badge>
+)}
+
+{status === "REJECTED" && (
+  <Badge>Rejected</Badge>
+)}
+
+{status === "WORKING" && (
+  <Badge>Working</Badge>
+)}
```

---

### 4) summary 계산 보호 (중요)

#### ❌ 기존 위험 코드

```js
rows.reduce((sum, row) => {
  return sum + row.hourly_wage * row.workMin / 60;
}, 0);
```

---

#### ✅ 변경 (status 기반 필터 추가)

```diff
+import { getAttendanceStatus } from "../../domain/attendance/getAttendanceStatus";

rows.reduce((sum, row) => {
+  const status = getAttendanceStatus(row);
+
+  // 정산 제외 상태 필터
+  if (status === "REJECTED") return sum;
+  if (status === "OPEN") return sum;

  return sum + calcRowPayWithSeparation(row);
}, 0);
```

---

# 🧪 3. 검증 포인트

PR #1 완료 기준:

* [ ] approval_status 직접 비교 0개
* [ ] status 판단 100% getAttendanceStatus 기반
* [ ] PENDING / REJECTED UI 정상 표시
* [ ] WORKING / CLOSED 구분 정상
* [ ] summary 계산 일관성 유지

---

# 🧠 핵심 변화 (이 PR의 의미)

이 PR 하나로 시스템이 이렇게 바뀜:

### BEFORE

UI가 상태를 판단함 ❌

### AFTER

Domain이 상태를 정의함 ✅

---

# 🚀 다음 PR (#2) 미리 말해주면

다음은:

> **labels.js 분리 (UI 텍스트 완전 제거)**

→ AttTab이 거의 “순수 렌더러”로 바뀜

