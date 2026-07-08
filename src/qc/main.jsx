import React from 'react';
import ReactDOM from 'react-dom/client';
import './qc.css';
import QCPage from './QCPage';

function App() {
  return (
    <div className="qc-app">
      <QCPage />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);