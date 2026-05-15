// src/shared/components/CommonUI.jsx
import React, { useEffect } from "react";

/* ----------------------------------------------------------------
   1. Toast Component (알림 메시지)
---------------------------------------------------------------- */
export function Toast({ toast }) {
  if (!toast) return null;

  // err 외에도 다양한 타입(success, info, warning) 확장을 고려한 클래스 바인딩
  const toastTypeClass = toast.type === "err" || toast.type === "error" ? "toast-err" : `toast-${toast.type || "success"}`;

  return (
    <div 
      className={`toast ${toastTypeClass}`} 
      role="alert" 
      aria-live="assertive"
    >
      {toast.msg}
    </div>
  );
}

/* ----------------------------------------------------------------
   2. Modal Component (팝업 창)
---------------------------------------------------------------- */
export function Modal({ onClose, children, maxWidth = 380 }) {
  // ESC 키를 누르면 모달이 닫히는 UX/웹 접근성 추가
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && onClose) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    
    // 모달 오픈 시 뒷배경 스크롤 방지 (선택 사항)
    document.body.style.overflow = "hidden";
    
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div 
        className="modal" 
        style={{ maxWidth, position: "relative" }} 
        onClick={(e) => e.stopPropagation()}
      >
        {/* 명시적인 닫기 버튼 추가로 UX 향상 */}
        {onClose && (
          <button 
            type="button" 
            className="modal-close-btn" 
            onClick={onClose}
            aria-label="닫기"
            style={{
              position: "absolute",
              top: "14px",
              right: "16px",
              background: "none",
              border: "none",
              fontSize: "18px",
              cursor: "pointer",
              color: "#9ca3af",
              lineHeight: 1
            }}
          >
            &times;
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------
   3. Field Component (폼 라벨 & 인풋 컨테이너)
---------------------------------------------------------------- */
export function Field({ label, children }) {
  return (
    // 시맨틱 마크업 버그 방지: 자식으로 div나 대형 컴포넌트가 들어와도 
    // 표준을 위반하지 않도록 하위 요소 배치 구조 개선
    <div className="field-container" style={{ marginBottom: "16px", display: "flex", flexDirection: "column", gap: "6px" }}>
      {label && <span className="field-label-text" style={{ fontSize: "13px", fontWeight: "600", color: "#374151" }}>{label}</span>}
      <div className="field-control-wrap">
        {children}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------
   4. SectionTitle Component (서브 섹션 타이틀)
---------------------------------------------------------------- */
export function SectionTitle({ children }) {
  return <div className="section-title-inner">{children}</div>;
}

/* ----------------------------------------------------------------
   5. PageHeader Component (상단 페이지 제목 바)
---------------------------------------------------------------- */
export function PageHeader({ title, description, right }) {
  return (
    <div className="page-header" style={{ display: "flex", justifyContent: "between", alignItems: "center", marginBottom: "20px" }}>
      <div className="page-header-copy">
        <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#111827" }}>{title}</h2>
        {description ? (
          <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#6b7280" }}>{description}</p>
        ) : null}
      </div>
      {right ? <div className="page-header-right">{right}</div> : null}
    </div>
  );
}