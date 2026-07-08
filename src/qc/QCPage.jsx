import QCProductsTab from './QCProductsTab';

export default function QCPage() {
  return (
    <div className="qc-page">
      <header className="qc-header">
        <h1>품질 검사 (QC)</h1>
      </header>
      <main className="qc-content">
        <QCProductsTab />
      </main>
    </div>
  );
}
