import React, { useState, useEffect } from "react";

/**
 * EditModal
 *
 * 수정 가능 필드:
 *   check_in, check_out, break_min, memo
 *
 * Props:
 *   row      — attendance row (null이면 닫힘)
 *   onClose  — () => void
 *   onSave   — (payload) => Promise<void>
 *             payload: { attendance_id, check_in, check_out, break_min, memo }
 */
export default function EditModal({ row, onClose, onSave }) {
  const [form, setForm] = useState(makeForm(null));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (row) {
      setForm(makeForm(row));
      setError("");
      setLoading(false);
    }
  }, [row]);

  if (!row) return null;

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSave = async () => {
    // 기본 유효성 검사
    if (form.check_in && form.check_out) {
      if (toMin(form.check_out) <= toMin(form.check_in)) {
        setError("퇴근 시간이 출근 시간보다 빠릅니다.");
        return;
      }
    }
    if (form.break_min !== "" && Number(form.break_min) < 0) {
      setError("휴게 시간은 0분 이상이어야 합니다.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await onSave({
        attendance_id: row.attendance_id,
        check_in:  form.check_in  || null,
        check_out: form.check_out || null,
        break_min: form.break_min !== "" ? Number(form.break_min) : 0,
        memo:      form.memo      || null,
      });
      onClose();
    } catch (e) {
      setError("저장 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-modal-title"
      >
        <div className="modal-header">
          <h3 id="edit-modal-title" className="modal-title">
            근태 수정
          </h3>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          {/* 읽기전용 요약 */}
          <div className="modal-info-grid modal-readonly-summary">
            <InfoRow label="이름"   value={row.name  || "-"} />
            <InfoRow label="날짜"   value={row.date  || "-"} />
            <InfoRow label="파트"   value={row.part  || "-"} />
            <InfoRow
              label="예정"
              value={
                row.planned_start && row.planned_end
                  ? `${row.planned_start} ~ ${row.planned_end}`
                  : "-"
              }
            />
          </div>

          <hr className="modal-divider" />

          {/* 편집 가능 필드 */}
          <div className="modal-fields">
            <Field label="출근 시간" hint="HH:MM">
              <input
                type="time"
                className="modal-input"
                value={form.check_in}
                onChange={handleChange("check_in")}
                disabled={loading}
              />
            </Field>

            <Field label="퇴근 시간" hint="HH:MM">
              <input
                type="time"
                className="modal-input"
                value={form.check_out}
                onChange={handleChange("check_out")}
                disabled={loading}
              />
            </Field>

            <Field label="휴게 시간" hint="분 단위">
              <input
                type="number"
                className="modal-input"
                value={form.break_min}
                onChange={handleChange("break_min")}
                min={0}
                max={480}
                step={5}
                placeholder="0"
                disabled={loading}
              />
            </Field>

            <Field label="메모" fullWidth>
              <textarea
                className="modal-textarea"
                value={form.memo}
                onChange={handleChange("memo")}
                rows={3}
                placeholder="관리자 메모"
                disabled={loading}
              />
            </Field>
          </div>

          {error && <p className="modal-error">{error}</p>}
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="att-btn secondary"
            onClick={onClose}
            disabled={loading}
          >
            취소
          </button>
          <button
            type="button"
            className="att-btn primary"
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? "저장 중…" : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 내부 헬퍼 ──────────────────────────────────────────────────────────────

function makeForm(row) {
  if (!row) return { check_in: "", check_out: "", break_min: "", memo: "" };
  return {
    check_in:  row.check_in  || "",
    check_out: row.check_out || "",
    break_min: row.break_min != null ? String(row.break_min) : "",
    memo:      row.memo      || "",
  };
}

/** "HH:MM" → 분 정수 */
function toMin(t) {
  const m = String(t || "").match(/(\d+):(\d+)/);
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

function InfoRow({ label, value }) {
  return (
    <>
      <dt className="modal-info-label">{label}</dt>
      <dd className="modal-info-value">{value}</dd>
    </>
  );
}

function Field({ label, hint, fullWidth, children }) {
  return (
    <div className={`modal-field${fullWidth ? " modal-field-full" : ""}`}>
      <label className="modal-label">
        {label}
        {hint && <span className="modal-hint"> ({hint})</span>}
      </label>
      {children}
    </div>
  );
}