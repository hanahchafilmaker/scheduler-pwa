// src/shared/components/EmployeeTab.jsx
import React, { useMemo, useState } from "react";
import { EMPTY_EMP_FORM } from "../constants";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function validateForm(form) {
  if (!form.name.trim()) return "이름을 입력해주세요.";
  if (!form.pin.trim()) return "PIN을 입력해주세요.";
  if (form.pin.trim().length < 4) return "PIN은 4자리 이상이어야 합니다.";
  if (form.hourly_wage !== "" && isNaN(Number(form.hourly_wage)))
    return "시급은 숫자로 입력해주세요.";
  if (form.email && !/\S+@\S+\.\S+/.test(form.email))
    return "이메일 형식이 올바르지 않습니다.";
  return null;
}

export default function EmployeeTab({
  employees = [],
  addEmployee,
  updateEmployee,
  deleteEmployee,
}) {
  const [form, setForm] = useState({
    ...EMPTY_EMP_FORM,
    email: "",
  });
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all"); // "all" | "active" | "inactive"

  const employeeList = safeArray(employees);

  /* ── 통계 ── */
  const stats = useMemo(
    () => ({
      total: employeeList.length,
      active: employeeList.filter((e) => e.active !== false).length,
      inactive: employeeList.filter((e) => e.active === false).length,
      admin: employeeList.filter((e) => e.role === "admin").length,
    }),
    [employeeList],
  );

  /* ── 검색 + 필터 ── */
  const filteredEmployees = useMemo(() => {
    const q = String(search || "")
      .trim()
      .toLowerCase();
    return employeeList.filter((emp) => {
      const matchSearch =
        !q ||
        [emp.name, emp.phone, emp.employee_id, emp.pin, emp.email]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q));
      const matchFilter =
        filter === "all" ? true : filter === "active" ? emp.active !== false : emp.active === false;
      return matchSearch && matchFilter;
    });
  }, [employeeList, search, filter]);

  /* ── 폼 핸들러 ── */
  const resetForm = () => {
    setForm({
      ...EMPTY_EMP_FORM,
      email: "",
    });
    setEditingId("");
    setError("");
  };

  const handleChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleEdit = (emp) => {
    setEditingId(emp.employee_id);
    setForm({
      name: emp.name || "",
      phone: emp.phone || "",
      email: emp.email || "",
      hourly_wage: String(emp.hourly_wage || ""),
      pin: emp.pin || "",
      role: emp.role || "staff",
      active: emp.active !== false,
    });
    setError("");
    document.getElementById("emp-form-top")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const validationError = validateForm(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        hourly_wage: Number(form.hourly_wage || 0),
        pin: form.pin.trim(),
        role: form.role || "staff",
        active: form.active,
      };
      if (editingId) {
        await updateEmployee({ employee_id: editingId, ...payload });
      } else {
        await addEmployee(payload);
      }
      resetForm();
    } catch (err) {
      setError(err.message || "직원 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (emp) => {
    try {
      await updateEmployee({ employee_id: emp.employee_id, active: emp.active === false });
    } catch (err) {
      setError(err.message || "상태 변경에 실패했습니다.");
    }
  };

  const handleDelete = async (emp) => {
    if (!window.confirm(`${emp.name} 직원을 삭제할까요?\n이 작업은 되돌릴 수 없습니다.`)) return;
    try {
      await deleteEmployee({ employee_id: emp.employee_id });
      if (editingId === emp.employee_id) resetForm();
    } catch (err) {
      setError(err.message || "직원 삭제에 실패했습니다.");
    }
  };

  /* ── 렌더 ── */
  return (
    <div className="page">
      {/* ── 통계 요약 카드 ── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { label: "전체", value: stats.total, color: "#374151", bg: "#f9fafb", filterKey: "all" },
          {
            label: "활성",
            value: stats.active,
            color: "#059669",
            bg: "#ecfdf5",
            filterKey: "active",
          },
          {
            label: "비활성",
            value: stats.inactive,
            color: "#9ca3af",
            bg: "#f3f4f6",
            filterKey: "inactive",
          },
          { label: "관리자", value: stats.admin, color: "#7c3aed", bg: "#f5f3ff", filterKey: null },
        ].map(({ label, value, color, bg, filterKey }) => (
          <div
            key={label}
            className="card"
            onClick={() => filterKey && setFilter(filterKey)}
            style={{
              flex: "1 1 72px",
              minWidth: 72,
              textAlign: "center",
              padding: "10px 8px",
              margin: 0,
              cursor: filterKey ? "pointer" : "default",
              outline: filter === filterKey ? `2px solid ${color}` : "none",
              background: filter === filterKey ? bg : undefined,
              transition: "outline 0.15s",
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── 등록 / 수정 폼 ── */}
      <div className="card" id="emp-form-top" style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>{editingId ? "직원 수정" : "직원 추가"}</h2>
          <p style={{ margin: "6px 0 0", color: "#6b7280", fontSize: 14 }}>
            직원 등록, 수정, 비활성화를 여기서 관리합니다.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            }}
          >
            <label>
              <div style={{ marginBottom: 6, fontWeight: 700 }}>
                이름 <span style={{ color: "#dc2626" }}>*</span>
              </div>
              <input
                className="input"
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="직원 이름"
              />
            </label>

            <label>
              <div style={{ marginBottom: 6, fontWeight: 700 }}>전화번호</div>
              <input
                className="input"
                value={form.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                placeholder="010-0000-0000"
              />
            </label>

            <label>
              <div style={{ marginBottom: 6, fontWeight: 700 }}>이메일</div>
              <input
                className="input"
                type="email"
                value={form.email}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="name@example.com"
              />
            </label>

            <label>
              <div style={{ marginBottom: 6, fontWeight: 700 }}>시급</div>
              <input
                className="input"
                type="number"
                value={form.hourly_wage}
                onChange={(e) => handleChange("hourly_wage", e.target.value)}
                placeholder="10030"
                min="0"
              />
            </label>

            <label>
              <div style={{ marginBottom: 6, fontWeight: 700 }}>
                PIN <span style={{ color: "#dc2626" }}>*</span>
              </div>
              <input
                className="input"
                value={form.pin}
                onChange={(e) => handleChange("pin", e.target.value)}
                placeholder="4자리 이상"
                maxLength={8}
              />
            </label>

            <label>
              <div style={{ marginBottom: 6, fontWeight: 700 }}>역할</div>
              <select
                className="input"
                value={form.role}
                onChange={(e) => handleChange("role", e.target.value)}
                style={{ cursor: "pointer" }}
              >
                <option value="staff">일반 직원 (staff)</option>
                <option value="admin">관리자 (admin)</option>
              </select>
            </label>
          </div>

          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              marginTop: 14,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => handleChange("active", e.target.checked)}
            />
            활성 직원으로 등록
          </label>

          {error && (
            <div style={{ marginTop: 10, color: "#dc2626", fontSize: 13, fontWeight: 600 }}>
              ⚠️ {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            <button type="submit" className="att-btn primary" disabled={saving}>
              {saving ? "저장 중..." : editingId ? "✓ 수정 완료" : "+ 직원 추가"}
            </button>
            {editingId && (
              <button type="button" className="att-btn secondary" onClick={resetForm}>
                취소
              </button>
            )}
          </div>
        </form>
      </div>

      {/* ── 직원 목록 ── */}
      <div className="card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            marginBottom: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h3 style={{ margin: 0 }}>직원 목록</h3>

            <div style={{ display: "flex", gap: 4 }}>
              {[
                { key: "all", label: "전체" },
                { key: "active", label: "활성" },
                { key: "inactive", label: "비활성" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  style={{
                    fontSize: 12,
                    padding: "3px 10px",
                    borderRadius: 99,
                    border: "1px solid",
                    borderColor: filter === key ? "#2563eb" : "#d1d5db",
                    background: filter === key ? "#2563eb" : "transparent",
                    color: filter === key ? "#fff" : "#6b7280",
                    cursor: "pointer",
                    fontWeight: filter === key ? 700 : 400,
                    transition: "all 0.15s",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <input
            className="att-input"
            style={{ maxWidth: 240 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름, 전화번호, 이메일 검색"
          />
        </div>

        <div className="att-table-wrap">
          <table className="att-table">
            <thead>
              <tr>
                <th>이름</th>
                <th>전화번호</th>
                <th>이메일</th>
                <th>시급</th>
                <th>PIN</th>
                <th>역할</th>
                <th>상태</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="att-empty-cell">
                    {search ? "검색 결과가 없습니다." : "등록된 직원이 없습니다."}
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => {
                  const isActive = emp.active !== false;
                  const isEditing = editingId === emp.employee_id;
                  return (
                    <tr
                      key={emp.employee_id}
                      style={{
                        background: isEditing ? "#eff6ff" : undefined,
                        opacity: isActive ? 1 : 0.55,
                      }}
                    >
                      <td style={{ fontWeight: 600 }}>
                        {emp.name || "-"}
                        {isEditing && (
                          <span
                            style={{
                              marginLeft: 6,
                              fontSize: 11,
                              background: "#2563eb",
                              color: "#fff",
                              padding: "1px 6px",
                              borderRadius: 4,
                            }}
                          >
                            편집중
                          </span>
                        )}
                      </td>
                      <td>{emp.phone || "-"}</td>
                      <td>{emp.email || "-"}</td>
                      <td>{Number(emp.hourly_wage || 0).toLocaleString()}원</td>
                      <td>
                        <code style={{ fontSize: 13, letterSpacing: 2 }}>{emp.pin || "-"}</code>
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: 12,
                            padding: "2px 8px",
                            borderRadius: 99,
                            fontWeight: 600,
                            background: emp.role === "admin" ? "#f5f3ff" : "#f3f4f6",
                            color: emp.role === "admin" ? "#7c3aed" : "#374151",
                          }}
                        >
                          {emp.role === "admin" ? "관리자" : "직원"}
                        </span>
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: 12,
                            padding: "2px 8px",
                            borderRadius: 99,
                            fontWeight: 600,
                            background: isActive ? "#ecfdf5" : "#f3f4f6",
                            color: isActive ? "#059669" : "#9ca3af",
                          }}
                        >
                          {isActive ? "활성" : "비활성"}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            className="att-btn primary small"
                            onClick={() => handleEdit(emp)}
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            className="att-btn secondary small"
                            onClick={() => handleToggleActive(emp)}
                          >
                            {isActive ? "비활성화" : "활성화"}
                          </button>
                          <button
                            type="button"
                            className="att-btn secondary small"
                            onClick={() => handleDelete(emp)}
                            style={{ color: "#dc2626" }}
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {filteredEmployees.length > 0 && (
          <div style={{ marginTop: 10, fontSize: 12, color: "#9ca3af", textAlign: "right" }}>
            {filteredEmployees.length}명 표시 중 (전체 {stats.total}명)
          </div>
        )}
      </div>
    </div>
  );
}