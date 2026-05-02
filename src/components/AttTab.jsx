import { useState } from "react";
import { PART_LABEL } from "../constants";
import { normalizeDate, formatTime, calcWorkMinutes } from "../utils";
import { Modal, Field, SectionTitle } from "./UI";

export function AttTab({ attendance, onSave }) {
  const [attEdit, setAttEdit] = useState(null);

  const handleSave = async () => {
    await onSave(attEdit);
    setAttEdit(null);
  };

  return (
    <div className="page">
      {attEdit && (
        <Modal onClose={() => setAttEdit(null)}>
          <div className="modal-head">
            <strong>출퇴근 수정 — {attEdit.name}</strong>
            <button className="close-btn" onClick={() => setAttEdit(null)}>×</button>
          </div>
          <Field label="출근 시간">
            <input
              value={attEdit.check_in || ""}
              onChange={(e) => setAttEdit((a) => ({ ...a, check_in: e.target.value }))}
            />
          </Field>
          <Field label="퇴근 시간">
            <input
              value={attEdit.check_out || ""}
              onChange={(e) => setAttEdit((a) => ({ ...a, check_out: e.target.value }))}
            />
          </Field>
          <Field label="휴게 분">
            <input
              type="number"
              value={attEdit.break_min || ""}
              onChange={(e) => setAttEdit((a) => ({ ...a, break_min: e.target.value }))}
            />
          </Field>
          <div className="modal-foot">
            <button className="ghost-sm" onClick={() => setAttEdit(null)}>취소</button>
            <button className="primary-sm" onClick={handleSave}>저장</button>
          </div>
        </Modal>
      )}

      <div className="card">
        <SectionTitle>출퇴근 기록</SectionTitle>
        <table className="data-table">
          <thead>
            <tr>
              <th>날짜</th><th>이름</th><th>파트</th>
              <th>출근</th><th>퇴근</th><th>실근무</th><th></th>
            </tr>
          </thead>
          <tbody>
            {[...attendance].reverse().slice(0, 80).map((a) => {
              const min = calcWorkMinutes(a.check_in, a.check_out, a.break_min);
              return (
                <tr key={a.attendance_id || `${a.employee_id}-${a.date}-${a.check_in}`}>
                  <td>{normalizeDate(a.date)}</td>
                  <td><strong>{a.name}</strong></td>
                  <td>{PART_LABEL[a.part] || a.part || "-"}</td>
                  <td>{formatTime(a.check_in)}</td>
                  <td>{formatTime(a.check_out)}</td>
                  <td>{(min / 60).toFixed(1)}h</td>
                  <td>
                    <button className="icon-btn" onClick={() => setAttEdit({ ...a })}>
                      편집
                    </button>
                  </td>
                </tr>
              );
            })}
            {attendance.length === 0 && (
              <tr>
                <td colSpan={7} className="empty">기록이 없습니다</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
