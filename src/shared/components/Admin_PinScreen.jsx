import React, { useState } from "react";
import "./Admin_PinScreen.css";
import { supabase } from "../shared/supabaseClient";

export default function AdminPinScreen({ onSuccess }) {
  const [inputPin, setInputPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [pinError, setPinError] = useState("");

  const handleLogin = async () => {
    setPinError("");

    const pin = String(inputPin).trim();

    if (!pin) {
      setPinError("PIN을 입력해주세요.");
      return;
    }

    setLoading(true);

    try {
      // Supabase에서 PIN + 관리자 권한 검증
      const { data, error } = await supabase
        .from("employees")
        .select("id, name, role, active")
        .eq("pin", pin)
        .eq("active", true)
        .single();

      if (error || !data) {
        setPinError("PIN이 올바르지 않습니다.");
        setInputPin("");
        return;
      }

      if (data.role !== "admin") {
        setPinError("관리자 권한이 없습니다.");
        setInputPin("");
        return;
      }

      // 성공 처리
      onSuccess?.(data);
    } catch (err) {
      console.error(err);
      setPinError("로그인 중 오류가 발생했습니다.");
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

        {pinError && <div className="admin-error">{pinError}</div>}
      </div>
    </div>
  );
}