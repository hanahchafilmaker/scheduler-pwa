import React, { useState, useEffect } from "react";

/**
 * ApprovalModal
 *
 * Props:
 *   row           attendance row (null )
 *   onClose       () => void
 *   onApprove     (row, note) => Promise<void>
 *   onReject      (row, note) => Promise<void>
 */
export default function ApprovalModal({ row, onClose, onApprove, onReject }) {
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // row    
  useEffect(() => {
    if (row) {
      setNote("");
      setError("");
      setLoading(false);
    }
  }, [row]);

  if (!row) return null;

  const handleAction = async (actionFn, label) => {
    setLoading(true);
    setError("");
    try {
      await actionFn(row, note);
      onClose();
    } catch (e) {
      setError(`${label}    .`);
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
        aria-labelledby="approval-modal-title"
      >
        <div className="modal-header">
          <h3 id="approval-modal-title" className="modal-title">
              
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
          <div className="modal-info-grid">
            <InfoRow label="" value={row.name || "-"} />
            <InfoRow label="" value={row.date || "-"} />
            <InfoRow label="" value={row.part || "-"} />
            <InfoRow
              label=""
              value={row.check_in || "-"}
            />
            <InfoRow
              label=""
              value={row.check_out || "-"}
            />
            {row.approval_reason && (
              <InfoRow label="" value={row.approval_reason} highlight />
            )}
          </div>

          {/*   */}
          <div className="modal-field">
            <label className="modal-label" htmlFor="approval-note">
                <span className="modal-optional">()</span>
            </label>
            <textarea
              id="approval-note"
              className="modal-textarea"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="  "
              rows={3}
              disabled={loading}
            />
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
            className="att-btn danger"
            onClick={() => handleAction(onReject, "")}
            disabled={loading}
          >
            {loading ? " " : ""}
          </button>
          <button
            type="button"
            className="att-btn primary"
            onClick={() => handleAction(onApprove, "")}
            disabled={loading}
          >
            {loading ? " " : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, highlight }) {
  return (
    <>
      <dt className="modal-info-label">{label}</dt>
      <dd className={`modal-info-value${highlight ? " modal-info-highlight" : ""}`}>
        {value}
      </dd>
    </>
  );
}
