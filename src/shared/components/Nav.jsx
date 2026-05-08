import { NAV_ITEMS } from "../constants";

export function Sidebar({ tab, setTab, loading, onRefresh }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-logo">SHIFT</div>
        <div className="brand-title">관리자 대시보드</div>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${tab === item.id ? "active" : ""}`}
            onClick={() => setTab(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button className="refresh-btn" onClick={onRefresh} disabled={loading}>
          {loading ? "불러오는 중..." : "새로고침"}
        </button>
      </div>
    </aside>
  );
}

export function MobileTabs({ tab, setTab }) {
  return (
    <div className="mobile-tabs">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          className={`mobile-tab ${tab === item.id ? "active" : ""}`}
          onClick={() => setTab(item.id)}
        >
          <span>{item.icon}</span>
        </button>
      ))}
    </div>
  );
}