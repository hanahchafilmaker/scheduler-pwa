export function Toast({ toast }) {
  if (!toast) return null;
  return <div className={`toast ${toast.type === "err" ? "toast-err" : ""}`}>{toast.msg}</div>;
}

export function Modal({ onClose, children, maxWidth = 380 }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth }} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <label className="field-label">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function SectionTitle({ children }) {
  return <div className="section-title-inner">{children}</div>;
}

export function PageHeader({ title, description, right }) {
  return (
    <div className="page-header">
      <div className="page-header-copy">
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {right ? <div className="page-header-right">{right}</div> : null}
    </div>
  );
}

