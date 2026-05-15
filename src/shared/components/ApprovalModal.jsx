import React, { useState, useEffect } from "react";

/**
 * ApprovalModal
 *
 * Props:
 *   row          근무 이력 데이터 row (선택된 내역이 없으면 null)
 *   onClose      모달 닫기 함수 () => void
 *   onApprove    승인 처리 함수 (row, note) => Promise<void>
 *   onReject     반려 처리 함수 (row, note) => Promise<void>
 */
export default function ApprovalModal({ row, onClose, onApprove, onReject }) {
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 선택된 row 데이터가 변경되면 상태 초기화
  useEffect(() => {
    if (row) {
      setNote("");
      setError("");
      setLoading(false);
    }
  }, [row]);

  if (!row) return null;

  // 승인 또는 반려 공통 액션 처리 핸들러
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
        {/* 헤더 구역 */}
        <div className="modal-header">
          <h3 id="approval-modal-title" className="modal-title">
            근무 기록 결재 승인
          </h3>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="모달 닫기"
          >
            ✕
          </button>
        </div>

        {/* 본문 구역 */}
        <div className="modal-body">
          {/* 근무자 및 기록 정보 정보 목록 */}
          <dl className="modal-info-grid">
            <InfoRow label="이름" value={row.name || "-"} />
            <InfoRow label="일자" value={row.date || "-"} />
            <InfoRow label="근무 파트" value={row.part || "-"} />
            <InfoRow label="출근 시간" value={row.check_in || "-"} />
            <InfoRow label="퇴근 시간" value={row.check_out || "-"} />
            {row.approval_reason && (
              <InfoRow label="신청 사유" value={row.approval_reason} highlight />
            )}
          </dl>

          {/* 승인/반려 메모 입력란 */}
          <div className="modal-field">
            <label className="modal-label" htmlFor="approval-note">
              결재 의견 <span className="modal-optional">(선택)</span>
            </label>
            <textarea
              id="approval-note"
              className="modal-textarea"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="승인 또는 반려 사유를 입력해주세요."
              rows={3}
              disabled={loading}
            />
          </div>

          {error && <p className="modal-error">{error}</p>}
        </div>

        {/* 하단 버튼 구역 */}
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
            onClick={() => handleAction(onReject, "반려")}
            disabled={loading}
          >
            {loading ? "처리 중..." : "반려"}
          </button>
          <button
            type="button"
            className="att-btn primary"
            onClick={() => handleAction(onApprove, "승인")}
            disabled={loading}
          >
            {loading ? "처리 중..." : "승인 완료"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * InfoRow 컴포넌트
 * dt, dd 쌍을 안전하게 시맨틱하게 묶어주기 위해 부모단에 dl을 배치해야 합니다.
 */
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