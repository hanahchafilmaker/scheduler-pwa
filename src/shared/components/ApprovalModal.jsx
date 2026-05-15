import React, { useState, useEffect } from "react";

/**
 * ApprovalModal
 *
 * Props:
 *   row          — attendance row (null이면 닫힘)
 *   onClose      — () => void
 *   onApprove    — (row, note) => Promise<void>
 *   onReject     — (row, note) => Promise<void>
 */
export default function ApprovalModal({ row, onClose, onApprove, onReject }) {
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // row가 바뀔 때마다 입력 초기화
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
      setError(`${label} 처리 중 오류가 발생했습니다.`);
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
            근태 승인 처리
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
          {/* 요약 정보 */}
          <div className="modal-info-grid">
            <InfoRow label="이름" value={row.name || "-"} />
            <InfoRow label="날짜" value={row.date || "-"} />
            <InfoRow label="파트" value={row.part || "-"} />
            <InfoRow
              label="출근"
              value={row.check_in || "-"}
            />
            <InfoRow
              label="퇴근"
              value={row.check_out || "-"}
            />
            {row.approval_reason && (
              <InfoRow label="사유" value={row.approval_reason} highlight />
            )}
          </div>

          {/* 메모 입력 */}
          <div className="modal-field">
            <label className="modal-label" htmlFor="approval-note">
              승인 메모 <span className="modal-optional">(선택)</span>
            </label>
            <textarea
              id="approval-note"
              className="modal-textarea"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="관리자 메모를 입력하세요"
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
            취소
          </button>
          <button
            type="button"
            className="att-btn danger"
            onClick={() => handleAction(onReject, "거절")}
            disabled={loading}
          >
            {loading ? "처리 중…" : "거절"}
          </button>
          <button
            type="button"
            className="att-btn primary"
            onClick={() => handleAction(onApprove, "승인")}
            disabled={loading}
          >
            {loading ? "처리 중…" : "승인"}
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