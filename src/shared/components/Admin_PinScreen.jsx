import React, { useState } from "react";
import "./Admin_PinScreen.css";

export default function AdminPinScreen({ onSuccess }) {
  const [inputPin, setInputPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [pinError, setPinError] = useState("");

  const ADMIN_PIN = "1234"; // 필요하면 env로 빼도 됨

  const handleLogin = async () => {
    setPinError("");

    const normalized = String(inputPin).trim();

    if (!normalized) {
      setPinError("PIN을 입력해주세요.");
      return;
    }

    setLoading(true);

    try {
      // 🔐 여기서 서버 붙이면 됨 (지금은 local check)
      if (normalized !== ADMIN_PIN) {
        setPinError("PIN이 올바르지 않습니다.");
        setInputPin("");
        return;
      }

      onSuccess?.();
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!loading) handleLogin();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!loading) handleLogin();
    }
  };

  return (
    <div className="admin-pin-screen">
      <div className="admin-pin-card">
        <div className="admin-brand">SHIFT ADMIN</div>

        <h1>관리자 로그인</h1>
        <p>PIN을 입력하세요</p>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            placeholder="관리자 PIN"
            value={inputPin}
            onChange={(e) => setInputPin(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />

          <button type="submit" disabled={loading}>
            {loading ? "확인 중..." : "로그인"}
          </button>
        </form>

        {pinError ? <div className="admin-error">{pinError}</div> : null}
      </div>
    </div>
  );
}