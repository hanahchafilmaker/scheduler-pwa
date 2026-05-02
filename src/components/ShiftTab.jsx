import { useState } from "react";
import { DAYS, PARTS, PART_LABEL, SHIFT_TIME } from "../constants";
import { normalizeDate } from "../utils";
import { Modal, Field } from "./UI";

export function ShiftTab({
  weekDates, weekOffset, setWeekOffset,
  schedule, employees,
  onSaveCell, onAutoGenerate,
}) {
  const [cellEdit,  setCellEdit]  = useState(null);
  const [cellEmpId, setCellEmpId] = useState("");
  const [saving,    setSaving]    = useState(false);

  const openCell = (date, part) => {
    const s = schedule.find((x) => x.part === part && normalizeDate(x.date) === date);
    setCellEmpId(String(s?.employee_id || ""));
    setCellEdit({ date, part, scheduleId: s?.schedule_id });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSaveCell(cellEdit, cellEmpId);
      setCellEdit(null);
    } finally {
      setSaving(false);
    }
  };

  const activeEmps = employees.filter((e) => e.active !== false);

  return (
    <div className="page">
      {/* Toolbar */}
      <div className="shift-toolbar">
        <div className="week-nav">
          <button onClick={() => setWeekOffset((w) => w - 1)}>◀</button>
          <button onClick={() => setWeekOffset(0)}>이번주</button>
          <button onClick={() => setWeekOffset((w) => w + 1)}>▶</button>
        </div>
        <div className="week-range">
          {weekDates[0]?.slice(5)} ~ {weekDates[6]?.slice(5)}
        </div>
        <button className="primary-sm" onClick={onAutoGenerate}>자동 생성</button>
      </div>

      {/* Cell edit modal */}
      {cellEdit && (
        <Modal onClose={() => setCellEdit(null)}>
          <div className="modal-head">
            <strong>{cellEdit.date} · {PART_LABEL[cellEdit.part]}</strong>
            <button className="close-btn" onClick={() => setCellEdit(null)}>×</button>
          </div>
          <Field label="직원 배정">
            <select value={cellEmpId} onChange={(e) => setCellEmpId(e.target.value)}>
              <option value="">-- 없음 --</option>
              {activeEmps.map((e) => (
                <option key={e.employee_id} value={e.employee_id}>{e.name}</option>
              ))}
            </select>
          </Field>
          <div className="modal-foot">
            <button className="ghost-sm" onClick={() => setCellEdit(null)}>취소</button>
            <button className="primary-sm" onClick={handleSave} disabled={saving}>
              {saving ? "저장중..." : "저장"}
            </button>
          </div>
        </Modal>
      )}

      {/* Grid */}
      <div className="shift-wrap">
        <table className="shift-table">
          <thead>
            <tr>
              <th className="part-col">파트</th>
              {weekDates.map((d, i) => (
                <th key={d}>
                  <div>{DAYS[i]}</div>
                  <div className="date-sm">{d.slice(5)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PARTS.map((part) => (
              <tr key={part}>
                <td className="part-label-cell">
                  <strong>{PART_LABEL[part]}</strong>
                  <div className="time-hint">
                    {SHIFT_TIME[part].start}~{SHIFT_TIME[part].end}
                  </div>
                </td>
                {weekDates.map((date) => {
                  const s = schedule.find(
                    (x) => x.part === part && normalizeDate(x.date) === date
                  );
                  return (
                    <td key={date} className="shift-cell" onClick={() => openCell(date, part)}>
                      {s ? (
                        <div className="cell-name">{s.name}</div>
                      ) : (
                        <div className="cell-empty">+</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
