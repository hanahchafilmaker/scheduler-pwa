import React, { useState, useEffect } from "react";

/**
 * EditModal
 *
 *   :
 *   check_in, check_out, break_min, memo
 *
 * Props:
 *   row       attendance row (null )
 *   onClose   () => void
 *   onSave    (payload) => Promise<void>
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
    //   
    if (form.check_in && form.check_out) {
      if (toMin(form.check_out) <= toMin(form.check_in)) {
        setError("    .");
        return;
      }
    }
    if (form.break_min !== "" && Number(form.break_min) < 0) {
      setError("  0  .");
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
      setError("   .");
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
             
          </h3>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label=""
          >
            
          </button>
        </div>

        <div className="modal-body">
          {/*   */}
          <div className="modal-info-grid modal-readonly-summary">
            <InfoRow label=""   value={row.name  || "-"} />
            <InfoRow label=""   value={row.date  || "-"} />
            <InfoRow label=""   value={row.part  || "-"} />
            <InfoRow
              label=""
              value={
                row.planned_start && row.planned_end
                  ? `${row.planned_start} ~ ${row.planned_end}`
                  : "-"
              }
            />
          </div>

          <hr className="modal-divider" />

          {/*    */}
          <div className="modal-fields">
            <Field label=" " hint="HH:MM">
              <input
                type="time"
                className="modal-input"
                value={form.check_in}
                onChange={handleChange("check_in")}
                disabled={loading}
              />
            </Field>

            <Field label=" " hint="HH:MM">
              <input
                type="time"
                className="modal-input"
                value={form.check_out}
                onChange={handleChange("check_out")}
                disabled={loading}
              />
            </Field>

            <Field label=" " hint=" ">
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

            <Field label="" fullWidth>
              <textarea
                className="modal-textarea"
                value={form.memo}
                onChange={handleChange("memo")}
                rows={3}
                placeholder=" "
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
            
          </button>
          <button
            type="button"
            className="att-btn primary"
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? " " : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

//    

function makeForm(row) {
  if (!row) return { check_in: "", check_out: "", break_min: "", memo: "" };
  return {
    check_in:  row.check_in  || "",
    check_out: row.check_out || "",
    break_min: row.break_min != null ? String(row.break_min) : "",
    memo:      row.memo      || "",
  };
}

/** "HH:MM"    */
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
