import { useEffect, useMemo, useState } from 'react';
import useQCData, {
  BASIS_LABEL,
  computeQcStatus,
  needsBaseDate,
  showsExpiry,
} from './useQCData';
import './QCProductsTab.css';

const STATUS_LABEL = {
  ok: '정상',
  warning: '주의',
  urgent: '임박',
  today: '오늘마감',
  expired: '기한만료',
  unset: '미기록',
};

// 리스트 정렬 우선순위: 급한 것부터 (숫자가 작을수록 먼저)
const STATUS_ORDER = { expired: 0, today: 1, urgent: 2, warning: 3, unset: 4, ok: 5 };

function formatDate(d) {
  if (!d) return '-';
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return '-';
  return dt.toISOString().slice(0, 10);
}

function toDatetimeLocalValue(iso) {
  if (!iso) return '';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(
    dt.getHours()
  )}:${pad(dt.getMinutes())}`;
}

function EntryModal({ product, entry, onClose, onSave }) {
  const [baseDate, setBaseDate] = useState(toDatetimeLocalValue(entry?.base_date));
  const [expiry, setExpiry] = useState(entry?.expiry || '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  if (!product) return null;

  const showBaseDate = needsBaseDate(product.basis);
  const showExpiryField = showsExpiry(product.basis);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await onSave({
        product_id: product.id,
        base_date: showBaseDate && baseDate ? new Date(baseDate).toISOString() : null,
        expiry: showExpiryField && expiry ? expiry : null,
      });
      onClose();
    } catch (err) {
      setSaveError(err?.message || String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="qc-modal-overlay" onClick={onClose}>
      <div className="qc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="qc-modal-header">
          <div>
            <h3>{product.name}</h3>
            <p className="qc-modal-sub">
              {product.category} · {BASIS_LABEL[product.basis] || product.basis}
            </p>
          </div>
          <button type="button" className="qc-icon-btn" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>

        <div className="qc-modal-body">
          {showBaseDate && (
            <label className="qc-field">
              <span>{BASIS_LABEL[product.basis] || '기준일'}</span>
              <input
                type="datetime-local"
                value={baseDate}
                onChange={(e) => setBaseDate(e.target.value)}
              />
            </label>
          )}

          {showExpiryField && (
            <label className="qc-field">
              <span>소비기한</span>
              <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
            </label>
          )}

          {!showBaseDate && !showExpiryField && (
            <p className="qc-modal-empty">이 제품은 별도 기록이 필요하지 않습니다.</p>
          )}

          {saveError && <p className="qc-modal-error">저장 실패: {saveError}</p>}
        </div>

        <div className="qc-modal-actions">
          <button type="button" className="qc-btn qc-btn-secondary" onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className="qc-btn qc-btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function QCProductsTab() {
  const {
    zones,
    entries,
    productsByZone,
    loading,
    error,
    refresh,
    findByBarcode,
    upsertEntry,
  } = useQCData();

  const [activeZone, setActiveZone] = useState('');
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    if (!activeZone && zones.length > 0) {
      setActiveZone(zones[0].key || zones[0].id);
    }
  }, [zones, activeZone]);

  const zoneProducts = productsByZone[activeZone] || [];

  const visibleProducts = useMemo(() => {
    const q = search.trim().toLowerCase();

    const rows = zoneProducts.map((p) => ({
      product: p,
      status: computeQcStatus(p, entries[p.id]),
    }));

    const filtered = q
      ? rows.filter(
          (r) =>
            r.product.name.toLowerCase().includes(q) ||
            (r.product.barcode || '').includes(q) ||
            r.product.category.toLowerCase().includes(q)
        )
      : rows;

    return filtered.sort((a, b) => {
      const orderDiff = STATUS_ORDER[a.status.status] - STATUS_ORDER[b.status.status];
      if (orderDiff !== 0) return orderDiff;
      return a.product.sort_order - b.product.sort_order;
    });
  }, [zoneProducts, entries, search]);

  const handleBarcodeSearch = (e) => {
    if (e.key !== 'Enter') return;
    const match = findByBarcode(search.trim());
    if (match) {
      setActiveZone(match.zone);
      setSelectedProduct(match);
      setSearch('');
    }
  };

  const handleRefresh = () => {
    refresh().catch(() => {});
  };

  if (error) {
    return (
      <div className="qc-error">
        데이터를 불러오지 못했습니다: {error}
        <button type="button" className="qc-btn qc-btn-secondary" onClick={handleRefresh}>
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="qc-tab">
      <div className="qc-toolbar">
        <input
          className="qc-search"
          type="text"
          placeholder="바코드 스캔 또는 이름 검색 후 Enter"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleBarcodeSearch}
        />
        <button type="button" className="qc-btn qc-btn-secondary" onClick={handleRefresh}>
          새로고침
        </button>
      </div>

      <div className="qc-zone-tabs">
        {zones.map((z) => (
          <button
            key={z.key || z.id}
            type="button"
            className={`qc-zone-tab ${(z.key || z.id) === activeZone ? 'active' : ''}`}
            onClick={() => setActiveZone(z.key || z.id)}
          >
            {z.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="qc-loading">불러오는 중...</div>
      ) : visibleProducts.length === 0 ? (
        <div className="qc-empty">해당 구역에 표시할 제품이 없습니다.</div>
      ) : (
        <ul className="qc-product-list">
          {visibleProducts.map(({ product, status }) => (
            <li
              key={product.id}
              className={`qc-product-row status-${status.status}`}
              onClick={() => setSelectedProduct(product)}
            >
              <div className="qc-product-main">
                <span className="qc-product-name">{product.name}</span>
                <span className="qc-product-category">{product.category}</span>
              </div>
              <div className="qc-product-meta">
                <span className={`qc-status-badge status-${status.status}`}>
                  {STATUS_LABEL[status.status]}
                </span>
                <span className="qc-product-deadline">
                  {status.deadline ? formatDate(status.deadline) : '-'}
                  {status.daysLeft != null && status.status !== 'expired'
                    ? ` (D-${status.daysLeft})`
                    : ''}
                  {status.status === 'expired' ? ` (D+${Math.abs(status.daysLeft)})` : ''}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <EntryModal
        product={selectedProduct}
        entry={selectedProduct ? entries[selectedProduct.id] : null}
        onClose={() => setSelectedProduct(null)}
        onSave={upsertEntry}
      />
    </div>
  );
}
