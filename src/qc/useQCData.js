import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

// ---- 기준일 타입별 라벨 ----
export const BASIS_LABEL = {
  subdiv: '소분일',
  thaw: '해동일',
  open: '개봉일',
  openOnly: '개봉일',
  expiryOnly: '소비기한',
};

export function needsBaseDate(basis) {
  return basis === 'subdiv' || basis === 'thaw' || basis === 'open' || basis === 'openOnly';
}

export function isCalculated(basis) {
  return basis === 'subdiv' || basis === 'thaw' || basis === 'open';
}

export function showsExpiry(basis) {
  return basis !== 'openOnly';
}

function addDuration(baseDateIso, value, unit) {
  if (!baseDateIso || value == null) return null;

  const base = new Date(baseDateIso);
  if (Number.isNaN(base.getTime())) return null;

  const ms =
    unit === 'hour'
      ? value * 60 * 60 * 1000
      : value * 24 * 60 * 60 * 1000;

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

export function computeQcStatus(product, entry) {
  const candidates = [];

  const explicitExpiry = entry?.expiry || product.default_expiry || null;

  if (explicitExpiry && showsExpiry(product.basis)) {
    candidates.push({
      source: 'expiry',
      date: toDateOnly(explicitExpiry),
    });
  }

  if (isCalculated(product.basis) && entry?.base_date) {
    const calc = addDuration(
      entry.base_date,
      Number(product.duration_value),
      product.duration_unit
    );

    if (calc) {
      candidates.push({
        source: 'basis',
        date: calc,
      });
    }
  }

  if (candidates.length === 0) {
    return {
      status: 'unset',
      deadline: null,
      daysLeft: null,
      source: null,
    };
  }

  candidates.sort((a, b) => a.date - b.date);

  const soonest = candidates[0];
  const daysLeft = daysBetween(new Date(), soonest.date);

  let status = 'ok';

  if (daysLeft < 0) status = 'expired';
  else if (daysLeft === 0) status = 'today';
  else if (daysLeft <= 1) status = 'urgent';
  else if (daysLeft <= 3) status = 'warning';

  return {
    status,
    deadline: soonest.date,
    daysLeft,
    source: soonest.source,
  };
}

export default function useQCData() {
  const [zones, setZones] = useState([]);
  const [products, setProducts] = useState([]);
  const [entries, setEntries] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('========== QC FETCH START ==========');

      const zonesRes = await supabase
        .from('qc_zones')
        .select('*')
        .order('sort_order', { ascending: true });

      console.log('qc_zones', zonesRes);

      const productsRes = await supabase
        .from('qc_products')
        .select('*')
        .order('sort_order', { ascending: true });

      console.log('qc_products', productsRes);

      const entriesRes = await supabase
        .from('qc_entries')
        .select('*');

      console.log('qc_entries', entriesRes);

      if (zonesRes.error) {
        console.error('qc_zones ERROR', zonesRes.error);
        throw zonesRes.error;
      }

      if (productsRes.error) {
        console.error('qc_products ERROR', productsRes.error);
        throw productsRes.error;
      }

      if (entriesRes.error) {
        console.error('qc_entries ERROR', entriesRes.error);
        throw entriesRes.error;
      }

      console.log('zones count:', zonesRes.data?.length || 0);
      console.log('products count:', productsRes.data?.length || 0);
      console.log('entries count:', entriesRes.data?.length || 0);

      setZones(zonesRes.data || []);
      setProducts(productsRes.data || []);

      const entryMap = {};

      (entriesRes.data || []).forEach((e) => {
        entryMap[e.product_id] = e;
      });

      setEntries(entryMap);

      console.log('========== QC FETCH SUCCESS ==========');
    } catch (err) {
      console.error('========== QC FETCH FAILED ==========');
      console.error(err);

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
    (barcode) =>
      products.find((p) => p.barcode === barcode) || null,
    [products]
  );

  const upsertEntry = useCallback(
    async ({ product_id, base_date = null, expiry = null }) => {
      const { data: userData } = await supabase.auth.getUser();

      const changedBy = userData?.user?.id || null;

      const { error: upsertErr } = await supabase
        .from('qc_entries')
        .upsert(
          {
            product_id,
            base_date,
            expiry,
          },
          {
            onConflict: 'product_id',
          }
        );

      if (upsertErr) {
        console.error('UPSERT ERROR', upsertErr);
        throw upsertErr;
      }

      const { error: logErr } = await supabase
        .from('qc_entry_logs')
        .insert({
          product_id,
          base_date,
          expiry,
          changed_by: changedBy,
        });

      if (logErr) {
        console.error('LOG ERROR', logErr);
        throw logErr;
      }

      setEntries((prev) => ({
        ...prev,
        [product_id]: {
          ...(prev[product_id] || {}),
          product_id,
          base_date,
          expiry,
        },
      }));
    },
    []
  );

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