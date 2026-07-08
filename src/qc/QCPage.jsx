import { useEffect, useState } from 'react';
import useApi from '../../shared/hooks/useApi';
import QCTab from '../shared/components/QCTab';
import './qc.css';

function QCPage() {
  const [month, setMonth] = useState('');
  const { monthAttendance, loading, error, refreshAll } = useApi({ month });

  // initialize month to current YYYY-MM on first render
  useEffect(() => {
    if (!month) {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      setMonth(`${y}-${m}`);
    }
  }, [month]);

  const handleRefresh = () => {
    refreshAll().catch(() => {});
  };

  if (error) {
    return <div className="error">오류: {error}</div>;
  }

  return (
    <div className="qc-page">
      <header className="qc-header">
        <h1>품질 검사 (QC)</h1>
        <button onClick={handleRefresh} className="refresh-btn">
          새로고침
        </button>
      </header>
      <main className="qc-content">
        {loading ? <div className="loading">로드 중...</div> : (
          <QCTab
            monthAttendance={monthAttendance}
            approveAttendance={() => {}} // TODO: implement actual approve function from useApi if needed
            selectedMonth={month}
            currentManagerName=""
          />
        )}
      </main>
    </div>
  );
}

export default QCPage;