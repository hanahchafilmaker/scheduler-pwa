import { useState } from "react";
import { EMPTY_EMP_FORM } from "../constants";
import { fmtKRW } from "../utils";
import { Field, SectionTitle } from "./UI";

export function EmpTab({ employees, onSave, onDelete }) {
  const [form,       setForm]       = useState(EMPTY_EMP_FORM);
  const [editingEmp, setEditingEmp] = useState(null);
  const [saving,     setSaving]     = useState(false);

  const updateField = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await onSave(form, editingEmp);
      setForm(EMPTY_EMP_FORM);
      setEditingEmp(null);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (emp) => {
    setEditingEmp(emp);
    setForm({
      name:        emp.name        || "",
      phone:       emp.phone       || "",
      hourly_wage: emp.hourly_wage || "",
      pin:         emp.pin         || "",
      active:      emp.active !== false,
    });
  };

  const cancelEdit = () => {
    setEditingEmp(null);
    setForm(EMPTY_EMP_FORM);
  };

  return (
    <div className="page">
      {/* Form card */}
      <div className="card">
        <SectionTitle>{editingEmp ? "직원 수정" : "직원 추가"}</SectionTitle>
        <div className="form-grid">
          <Field label="이름 *">
            <input value={form.name}        onChange={updateField("name")} />
          </Field>
          <Field label="PIN">
            <input value={form.pin}         onChange={updateField("pin")} />
          </Field>
          <Field label="전화번호">
            <input value={form.phone}       onChange={updateField("phone")} />
          </Field>
          <Field label="시급">
            <input type="number" value={form.hourly_wage} onChange={updateField("hourly_wage")} />
          </Field>
        </div>
        <div className="form-foot">
          {editingEmp && (
            <button className="ghost-sm" onClick={cancelEdit}>취소</button>
          )}
          <button className="primary-sm" onClick={handleSave} disabled={saving}>
            {saving ? "저장중..." : editingEmp ? "수정 완료" : "추가"}
          </button>
        </div>
      </div>

      {/* List card */}
      <div className="card">
        <SectionTitle>직원 목록</SectionTitle>
        <table className="data-table">
          <thead>
            <tr>
              <th>이름</th><th>PIN</th><th>전화</th>
              <th>시급</th><th>상태</th><th></th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr key={emp.employee_id}>
                <td><strong>{emp.name}</strong></td>
                <td><code>{emp.pin || "-"}</code></td>
                <td>{emp.phone || "-"}</td>
                <td>{fmtKRW(Number(emp.hourly_wage) || 0)}</td>
                <td>{emp.active !== false ? "활성" : "비활성"}</td>
                <td>
                  <button className="icon-btn" onClick={() => startEdit(emp)}>편집</button>
                  <button className="icon-btn danger" onClick={() => onDelete(emp)}>삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
