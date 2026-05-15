# 🔀 PR #6 — MODAL STABILITY FIX (diff)

## 🎯 목표

* ApprovalModal / EditModal “절대 닫힘 방지 안정화”
* API 실패 시 상태 유지
* 에러 UI 표준화
* 사용자 입력 유실 방지

---

# 📁 1. ApprovalModal.jsx 수정

---

## ❌ 기존 문제 구조

```js id="mod001"
await approveAttendance()
setOpen(false) // ❌ 성공/실패 구분 없음
```

👉 문제:

* API 실패해도 모달 닫힘
* 사용자는 “처리된 줄 착각”

---

## ✅ 변경 (try/catch + 상태 유지)

```diff id="mod002"
+const [loading, setLoading] = useState(false);
+const [error, setError] = useState(null);

const handleApprove = async () => {
+  setLoading(true);
+  setError(null);

  try {
    await approveAttendance(attendanceId);

+    // 성공 시에만 닫기
    setOpen(false);
  } catch (e) {
+    setError("승인 처리 실패");
+    console.error(e);
  } finally {
+    setLoading(false);
  }
};
```

---

## UI 추가

```diff id="mod003"
+{error && (
+  <div className="error-banner">
+    {error}
+  </div>
+)}
+
+<button disabled={loading}>
+  {loading ? "처리중..." : "승인"}
+</button>
```

---

# 📁 2. EditModal.jsx 수정

---

## ❌ 기존 문제

```js id="mod004"
await updateAttendance()
setOpen(false)
```

---

## ✅ 변경

```diff id="mod005"
+const [loading, setLoading] = useState(false);
+const [error, setError] = useState(null);

const handleSave = async () => {
+  if (checkOut < checkIn) {
+    setError("퇴근 시간이 출근보다 빠를 수 없습니다.");
+    return;
+  }

+  setLoading(true);
+  setError(null);

  try {
    await updateAttendance({
      check_in,
      check_out,
      break_min
    });

+    setOpen(false);
  } catch (e) {
+    setError("수정 저장 실패");
  } finally {
+    setLoading(false);
  }
};
```

---

# 📁 3. 공통 패턴 도입 (중요)

## Modal 표준 패턴

```text id="mod006"
1. loading state
2. error state
3. try/catch
4. 성공시에만 close
```

---

# 📁 4. UX 개선

## 버튼 상태

```diff id="mod007"
+disabled={loading}
```

---

## 에러 표시 위치

```diff id="mod008"
+모달 내부 상단 fixed error banner
```

---

# 📁 5. 구조 변화

## BEFORE

```text id="mod009"
API 실패 → 모달 닫힘 → 사용자 혼란
```

---

## AFTER

```text id="mod010"
API 실패 → 모달 유지 → 에러 표시 → 재시도 가능
```

---

# 🧪 6. 검증 체크리스트

* [ ] API 실패 시 모달 유지
* [ ] loading 상태 정상 표시
* [ ] error 메시지 표시
* [ ] success 시에만 close
* [ ] 입력값 유지됨
* [ ] validation 작동

---

# 🧠 핵심 변화

## BEFORE

Modal = 단발성 UI ❌

## AFTER

Modal = transactional UI (안전한 트랜잭션 단위) ✅

---

# 🚀 현재 전체 아키텍처 상태 (PR #6 완료 기준)

이제 시스템은 이렇게 됩니다:

```text id="final_arch"
UI (render only)
   ↓
Selectors (filter/search)
   ↓
Domain (status engine)
   ↓
Pay Engine (single source)
   ↓
Backend API (truth)
```

---

# 🔥 이제 상태 요약

## ✔ 완료된 것

* status engine 통합
* labels domain화
* selectors 분리
* pay 단일화
* UI purify
* modal 안정화

