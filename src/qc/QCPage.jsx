import React, { useState } from 'react';
import useQCData from './useQCData';

const QCPage = () => {
  const {
    zones,
    productsByZone,
    loading,
    error,
    refresh,
    findByBarcode,
    upsertEntry,
  } = useQCData();

  const [activeZone, setActiveZone] = useState(zones[0]?.id || null);
  const [scanResult, setScanResult] = useState(null); // 스캔된 바코드 값
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formBaseDate, setFormBaseDate] = useState('');
  const [formExpiry, setFormExpiry] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState(false);

  // 바코드 스캔/입력 처리
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && scanResult) {
      const product = findByBarcode(scanResult);
      if (product) {
        // 해당 구역으로 이동
        setActiveZone(product.zone);
        // 편집 모드 열기
        setEditingProduct(product);
        setModalOpen(true);
        // 폼 초기화 (기존 데이터 채워넣기)
        const entry = editingProduct ? editingProduct : null; // useMemo 대신 여기서 처리
        // TODO: entry에서 값을 가져와 폼 채우기 (추후 구현)
        setFormBaseDate('');
        setFormExpiry('');
        setFormError('');
        setFormSuccess(false);
      } else {
        setFormError('해당 바코드의 제품을 찾을 수 없습니다.');
      }
      setScanResult(''); // 스캔 버퍼 초기화
    }
  };

  // 모달 닫기
  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingProduct(null);
    setFormBaseDate('');
    setFormExpiry('');
    setFormError('');
    setFormSuccess(false);
  };

  // 폼 제출
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!editingProduct) return;

    setFormError('');
    setFormSuccess(false);

    try {
      await upsertEntry({
        product_id: editingProduct.id,
        base_date: formBaseDate || null,
        expiry: formExpiry || null,
      });
      setFormSuccess(true);
      setFormError('');
      // 저장 성공 후 잠시 대기 후 모달 닫기 (새로고침 효과)
      setTimeout(() => {
        handleCloseModal();
        refresh(); // 데이터 새로고침
      }, 1500);
    } catch (err) {
      setFormError(err.message || '저장 중 오류가 발생했습니다.');
      setFormSuccess(false);
    }
  };

  if (loading) return <div className="qc-page">로딩 중...</div>;
  if (error) return <div className="qc-page">오류: {error}</div>;

  return (
    <div className="qc-page">
      <div className="qc-header">
        <h1>QC - 품질 검사</h1>
        <button className="refresh-btn" onClick={refresh}>
          새로고침
        </button>
      </div>

      <div className="qc-content">
        {/* 현재 구역의 상품 목록 */}
        {activeZone && productsByZone[activeZone] && (
          <>
            <div style={{ marginBottom: '16px' }}>
              <input
                type="text"
                placeholder="바코드 스캔 또는 입력 후 Enter"
                value={scanResult}
                onChange={(e) => setScanResult(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{
                  padding: '8px 12px',
                  fontSize: '16px',
                  width: '100%',
                  maxWidth: '300px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                }}
              />
            </div>
            <QCProductsTab
              activeZone={activeZone}
              setActiveZone={setActiveZone}
              products={productsByZone[activeZone] || []}
              editingProduct={editingProduct}
              setEditingProduct={setEditingProduct}
              formBaseDate={formBaseDate}
              setFormBaseDate={setFormBaseDate}
              formExpiry={formExpiry}
              setFormExpiry={setFormExpiry}
              formError={formError}
              setFormError={setFormError}
              formSuccess={formSuccess}
              setFormSuccess={setFormSuccess}
              handleCloseModal={handleCloseModal}
              handleSubmit={handleSubmit}
            />
          </>
        )}
      </div>

      {/* 편집 모달 */}
      {editingProduct && modalOpen && (
        <div className="modal-backdrop" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingProduct.name} QC 기록</h3>
              <button className="close-btn" onClick={handleCloseModal}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSubmit}>
                {/* basis에 따라 동적으로 입력 필드 표시 */}
                {editingProduct.basis === 'openOnly' && (
                  <div style={{ marginBottom: '16px' }}>
                    <label>개봉일 (기준일)</label>
                    <input
                      type="date"
                      value={formBaseDate}
                      onChange={(e) => setFormBaseDate(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '8px',
                        marginTop: '4px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                )}
                {!editingProduct.basis === 'openOnly' && (
                  <>
                    <div style={{ marginBottom: '12px' }}>
                      <label>기준일</label>
                      <input
                        type="date"
                        value={formBaseDate}
                        onChange={(e) => setFormBaseDate(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px',
                          marginTop: '4px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    {editingProduct.basis !== 'expiryOnly' && (
                      <div style={{ marginBottom: '12px' }}>
                        <label>소비기한</label>
                        <input
                          type="date"
                          value={formExpiry}
                          onChange={(e) => setFormExpiry(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px',
                            marginTop: '4px',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>
                    )}
                  </>
                )}
                <button
                  type="submit"
                  disabled={!(formBaseDate || formExpiry) || formSuccess}
                  style={{
                    width: '100%',
                    padding: '12px',
                    backgroundColor: formSuccess ? '#28a745' : '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '16px',
                    cursor: formSuccess ? 'not-allowed' : 'pointer',
                  }}
                >
                  {formSuccess ? '저장 완료' : '저장하기'}
                </button>
                {formError && (
                  <div style={{ marginTop: '12px', color: 'dc3545', fontSize: '14px' }}>
                    {formError}
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// QCProductsTab 컴포넌트 (별도 파일로 분리 예정 - 여기서는 인라인 구현)
const QCProductsTab = ({
  activeZone,
  setActiveZone,
  products,
  editingProduct,
  setEditingProduct,
  formBaseDate,
  setFormBaseDate,
  formExpiry,

  // Typo in variable name - should be formExpiry
setFormExpiry,
formError,
setFormError,
formSuccess,
setFormSuccess,
handleCloseModal,
handleSubmit,
}) => {
  if (!products || products.length === 0) {
    return <p>해당 구역에 등록된 상품이 없습니다.</p>;
  }

  // 탭 데이터 (구역 목록은 useQCData에서 zones를 가져와야 함 - 여기서는 간단히 처리)
  // 실제로는 zones를 props로 전달받아야 함
  const zoneTabs = [
    { id: 'refrigerated-left', label: '냉장 좌측' },
    { id: 'refrigerated-right', label: '냉장 우측' },
    { id: 'freezer', label: '냉동고' },
    { id: 'room-temp', label: '상온' },
    { id: 'prep-area', label: '조리실' },
    { id: 'storage', label: '창고' },
  ];

  return (
    <div>
      {/* 구역 탭 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {zoneTabs.map((zone) => (
          <button
            key={zone.id}
            onClick={() => setActiveZone(zone.id)}
            disabled={!zone.id} // 간단한 비활성화 조건
            style={{
              padding: '8px 16px',
              backgroundColor: activeZone === zone.id ? '#007bff' : '#f8f9fa',
              color: activeZone === zone.id ? 'white' : '#333',
              border: 'none',
              borderRadius: '4px',
              cursor: activeZone === zone.id ? 'pointer' : 'not-allowed',
              fontWeight: activeZone === zone.id ? 'bold' : 'normal',
            }}
          >
            {zone.label}
          </button>
        ))}
      </div>

      {/* 상품 목록 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
        {products.map((product) => {
          // TODO: useQCData에서 entries를 받아와서 상태 계산해야 함
          // 현재는Mock 데이터로 상태 표시
          const status = 'ok'; // 실제로는 computeQcStatus(product, entry)으로 계산
          const statusMap = {
            ok: { label: '정상', color: '#28a745' },
            warning: { label: '주의', color: '#ffc107' },
            urgent: { label: '긴급', color: '#fd7e14' },
            today: { label: '오늘마감', color: '#dc3545' },
            expired: { label: '만료', color: '#6f42c1' },
          };
          const statusInfo = statusMap[status] || { label: '-', color: '#6c757d' };

          return (
            <div
              key={product.id}
              className="product-card"
              style={{
                border: '1px solid #ddd',
                borderRadius: '8px',
                padding: '16px',
                backgroundColor: '#f8f9fa',
              }}
            >
              <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>{product.name}</h3>
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
                바코드: {product.barcode || '-'}
              </div>
              <div style={{ marginBottom: '8px' }}>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    backgroundColor: statusInfo.color,
                    color: 'white',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                >
                  {statusInfo.label}
                </span>
              </div>
              <button
                onClick={() => {
                  setEditingProduct(product);
                  setModalOpen(true);
                  // 폼 초기화 로직은 여기서 처리 (간단히)
                  setFormBaseDate('');
                  setFormExpiry('');
                  setFormError('');
                  setFormSuccess(false);
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                기록하기
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export { QCPage, QCProductsTab };