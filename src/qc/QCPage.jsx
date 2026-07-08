import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
// ↑ 프로젝트의 실제 supabase client export 위치에 맞게 이 경로를 조정하세요.

// ---- 기준일 타입별 라벨 ----
export const BASIS_LABEL = {
  subdiv: '소분일',
  thaw: '해동일',
  open: '개봉일',
  openOnly: '개봉일',
  expiryOnly: '소비기한',
};

// basis 별로 base_date 입력이 필요한지 (openOnly 포함)
export function needsBaseDate(basis) {
  return basis === 'subdiv' || basis === 'thaw' || basis === 'open' || basis === 'openOnly';
}

// basis 별로 base_date + duration 으로 "마감일 계산"을 하는지
// (openOnly 는 개봉일만 표시하고 계산하지 않음 — 스키마 주석 참고)
export function isCalculated(basis) {
  return basis === 'subdiv' || basis === 'thaw' || basis === 'open';
}

// expiry(소비기한) 입력란을 보여줄지 — openOnly 만 제외
export function showsExpiry(basis) {
  return basis !== 'openOnly';
}

function addDuration(baseDateIso, value, unit) {
  if (!baseDateIso || value == null) return null;
  const base = new Date(baseDateIso);
  if (Number.isNaN(base.getTime())) return null;
  const ms = unit === 'hour' ? value * 60 * 60 * 1000 : value * 24 * 60 * 60 * 1000;
  return new Date(base.getTime() + ms);
}

function toDateOnly(value) {
  if (!value) return null;
  const dt = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function daysBetween(from, to) {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / MS_PER_DAY);
}

/**
 * 제품 + 현재 entry(base_date/expiry) 를 받아 화면에 필요한 상태를 계산합니다.
 *
 * 소비기한(expiry)과 기준일+기간으로 계산된 마감일이 둘 다 있으면
 * 더 임박한(빠른) 쪽을 기준으로 상태를 표시합니다.
 * (예: 해동 후 사용기한이 인쇄된 소비기한보다 먼저 도래하는 경우가 실제로 더 위험하므로)
 */
export function computeQcStatus(product, entry) {
  const candidates = [];

  const explicitExpiry = entry?.expiry || product.default_expiry || null;
  if (explicitExpiry && showsExpiry(product.basis)) {
    candidates.push({ source: 'expiry', date: toDateOnly(explicitExpiry) });
  }

  if (isCalculated(product.basis) && entry?.base_date) {
    const calc = addDuration(entry.base_date, Number(product.duration_value), product.duration_unit);
    if (calc) candidates.push({ source: 'basis', date: calc });
  }

  if (candidates.length === 0) {
    return { status: 'unset', deadline: null, daysLeft: null, source: null };
  }

  candidates.sort((a, b) => a.date - b.date);
  const soonest = candidates[0];
  const daysLeft = daysBetween(new Date(), soonest.date);

  let status = 'ok';
  if (daysLeft < 0) status = 'expired';
  else if (daysLeft === 0) status = 'today';
  else if (daysLeft <= 1) status = 'urgent';
  else if (daysLeft <= 3) status = 'warning';

  return { status, deadline: soonest.date, daysLeft, source: soonest.source };
}

export default function useQCData() {
  const [zones, setZones] = useState([]);
  const [products, setProducts] = useState([]);
  const [entries, setEntries] = useState({}); // product_id -> entry
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [zonesRes, productsRes, entriesRes] = await Promise.all([
        supabase.from('qc_zones').select('*').order('sort_order', { ascending: true }),
        supabase.from('qc_products').select('*').order('sort_order', { ascending: true }),
        supabase.from('qc_entries').select('*'),
      ]);

      if (zonesRes.error) throw zonesRes.error;
      if (productsRes.error) throw productsRes.error;
      if (entriesRes.error) throw entriesRes.error;

      setZones(zonesRes.data || []);
      setProducts(productsRes.data || []);

      const entryMap = {};
      (entriesRes.data || []).forEach((e) => {
        entryMap[e.product_id] = e;
      });
      setEntries(entryMap);
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const productsByZone = useMemo(() => {
    const grouped = {};
    for (const p of products) {
      if (!grouped[p.zone]) grouped[p.zone] = [];
      grouped[p.zone].push(p);
    }
    return grouped;
  }, [products]);

  const findByBarcode = useCallback(
    (barcode) => products.find((p) => p.barcode === barcode) || null,
    [products]
  );

  /**
   * base_date / expiry 를 upsert 하고, qc_entry_logs 에 변경 이력도 함께 남깁니다.
   */
  const upsertEntry = useCallback(async ({ product_id, base_date = null, expiry = null }) => {
    const { data: userData } = await supabase.auth.getUser();
    const changedBy = userData?.user?.id || null;

    const { error: upsertErr } = await supabase
      .from('qc_entries')
      .upsert({ product_id, base_date, expiry }, { onConflict: 'product_id' });
    if (upsertErr) throw upsertErr;

    const { error: logErr } = await supabase
      .from('qc_entry_logs')
      .insert({ product_id, base_date, expiry, changed_by: changedBy });
    if (logErr) throw logErr;

    setEntries((prev) => ({
      ...prev,
      [product_id]: { ...(prev[product_id] || {}), product_id, base_date, expiry },
    }));
  }, []);

  return {
    zones,
    products,
    entries,
    productsByZone,
    loading,
    error,
    refresh: fetchAll,
    findByBarcode,
    upsertEntry,
  };
}