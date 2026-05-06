// ── Toast ─────────────────────────────────────────────────────────────────────
export function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className={`toast ${toast.type === "err" ? "toast-err" : ""}`}>
      {toast.msg}
    </div>
  );
}

// ── Modal wrapper ─────────────────────────────────────────────────────────────
export function Modal({ onClose, children, maxWidth = 380 }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

// ── Field label ───────────────────────────────────────────────────────────────
export function Field({ label, children }) {
  return (
    <label className="field-label">
      <span>{label}</span>
      {children}
    </label>
  );
}

// ── Section title ─────────────────────────────────────────────────────────────
export function SectionTitle({ children }) {
  return <div className="section-title-inner">{children}</div>;
}
