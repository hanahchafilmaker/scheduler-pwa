import React, { useMemo, useState } from "react";

const EMPTY_FORM = {
  name: "",
  phone: "",
  hourly_wage: "",
  pin: "",
  active: true,
};

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

export default function EmployeeTab(props) {
  const { employees = [], addEmployee, updateEmployee, deleteEmployee } = props;

  const [form, setForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [error, setError] = useState("");

  const employeeList = safeArray(employees);

  const filteredEmployees = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();
    if (!q) return employeeList;

    return employeeList.filter((emp) =>
      [emp.name, emp.phone, emp.employee_id, emp.pin]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [employeeList, search]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId("");
    setError("");
  };

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleEdit = (emp) => {
    setEditingId(emp.employee_id);
    setForm({
      name: emp.name || "",
      phone: emp.phone || "",
      hourly_wage: String(emp.hourly_wage || ""),
      pin: emp.pin || "",
      active: emp.active !== false,
    });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.name.trim()) {
      setError("이름을 입력해주세요.");
      return;
    }

    if (!form.pin.trim()) {
      setError("PIN을 입력해주세요.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        hourly_wage: Number(form.hourly_wage || 0),
        pin: form.pin.trim(),
        active: form.active,
      };

      if (editingId) {
        await updateEmployee({
          employee_id: editingId,
          ...payload,
        });
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
      await updateEmployee({
        employee_id: emp.employee_id,
        active: emp.active === false,
      });
    } catch (err) {
      setError(err.message || "상태 변경에 실패했습니다.");
    }
  };

  const handleDelete = async (emp) => {
    const ok = window.confirm(`${emp.name} 직원을 삭제할까요?`);
    if (!ok) return;

    try {
      await deleteEmployee({ employee_id: emp.employee_id });
      if (editingId === emp.employee_id) resetForm();
    } catch (err) {
      setError(err.message || "직원 삭제에 실패했습니다.");
    }
  };

  return (
    <div className="page">
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>직원 관리</h2>
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
              <div style={{ marginBottom: 6, fontWeight: 700 }}>이름</div>
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
              <div style={{ marginBottom: 6, fontWeight: 700 }}>시급</div>
              <input
                className="input"
                type="number"
                value={form.hourly_wage}
                onChange={(e) => handleChange("hourly_wage", e.target.value)}
                placeholder="10030"
              />
            </label>

            <label>
              <div style={{ marginBottom: 6, fontWeight: 700 }}>PIN</div>
              <input
                className="input"
                value={form.pin}
                onChange={(e) => handleChange("pin", e.target.value)}
                placeholder="4자리 이상"
              />
            </label>
          </div>

          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              marginTop: 12,
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => handleChange("active", e.target.checked)}
            />
            활성 직원으로 등록
          </label>

          {error ? (
            <div style={{ marginTop: 10, color: "#dc2626", fontSize: 13 }}>{error}</div>
          ) : null}

          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            <button type="submit" className="att-btn primary">
              {saving ? "저장 중..." : editingId ? "직원 수정" : "직원 추가"}
            </button>

            {editingId ? (
              <button type="button" className="att-btn secondary" onClick={resetForm}>
                취소
              </button>
            ) : null}
          </div>
        </form>
      </div>

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
          <h3 style={{ margin: 0 }}>직원 목록</h3>
          <input
            className="att-input"
            style={{ maxWidth: 260 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름, 전화번호, PIN 검색"
          />
        </div>

        <div className="att-table-wrap">
          <table className="att-table">
            <thead>
              <tr>
                <th>이름</th>
                <th>전화번호</th>
                <th>시급</th>
                <th>PIN</th>
                <th>상태</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="att-empty-cell">
                    등록된 직원이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr key={emp.employee_id}>
                    <td>{emp.name || "-"}</td>
                    <td>{emp.phone || "-"}</td>
                    <td>{Number(emp.hourly_wage || 0).toLocaleString()}원</td>
                    <td>{emp.pin || "-"}</td>
                    <td>{emp.active === false ? "비활성" : "활성"}</td>
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
                          {emp.active === false ? "활성화" : "비활성화"}
                        </button>
                        <button
                          type="button"
                          className="att-btn secondary small"
                          onClick={() => handleDelete(emp)}
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}