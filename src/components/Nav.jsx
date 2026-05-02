import { NAV_ITEMS } from "../constants";

export function Sidebar({ tab, setTab, loading, onRefresh }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-logo">Dunkin' Donuts</div>
        <div className="brand-title">Scheduler</div>
        <div className="brand-sub">관리자 대시보드</div>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${tab === item.id ? "active" : ""}`}
            onClick={() => setTab(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button className="refresh-btn" onClick={onRefresh}>
          {loading ? "⟳ 로딩중..." : "↻ 새로고침"}
        </button>
      </div>
    </aside>
  );
}

export function MobileTabs({ tab, setTab }) {
  return (
    <div className="tabs-wrap">
      {NAV_ITEMS.map((t) => (
        <button
          key={t.id}
          className={`tab-btn ${tab === t.id ? "active" : ""}`}
          onClick={() => setTab(t.id)}
        >
          {t.icon} {t.label}
        </button>
      ))}
    </div>
  );
}
