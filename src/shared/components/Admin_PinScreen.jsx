import React, { useState } from "react";
import "./Admin_PinScreen.css";
import { supabase } from "../../lib/supabase.js";

export default function AdminPinScreen({ onSuccess }) {
  const [inputPin, setInputPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [pinError, setPinError] = useState("");

  const handleLogin = async () => {
    setPinError("");

    const pin = String(inputPin).trim();

    if (!pin) {
      setPinError("PIN 번호를 입력해주세요.");
      return;
    }

    setLoading(true);

    try {
      // Supabase에서 활성화된 직원의 PIN 번호 확인 및 조회
      const { data, error } = await supabase
        .from("employees")
        .select("id, name, role, active")
        .eq("pin", pin)
        .eq("active", true)
        .single();

      if (error || !data) {
        setPinError("잘못된 PIN 번호입니다.");
        setInputPin("");
        return;
      }

      // 관리자 권한 확인 (역할 검증)
      if (data.role !== "admin") {
        setPinError("관리자 권한이 없습니다.");
        setInputPin("");
        return;
      }

      // 관리자 인증 성공 시 콜백 실행
      onSuccess?.(data);
    } catch (err) {
      console.error(err);
      setPinError("인증 처리 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!loading) handleLogin();
  };

  return (
    <div className="admin-pin-screen">
      <div className="admin-pin-card">
        <div className="admin-brand">SHIFT ADMIN</div>

        <h1>관리자 모드</h1>
        <p>인증을 위해 관리자 PIN 번호를 입력해주세요.</p>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            placeholder="PIN 번호 입력"
            value={inputPin}
            onChange={(e) => setInputPin(e.target.value)}
            disabled={loading}
            maxLength={8} // 일반적인 PIN 자릿수 제한(선택사항)
          />

          <button type="submit" disabled={loading}>
            {loading ? "인증 중..." : "확인"}
          </button>
        </form>

        {pinError && <div className="admin-error">{pinError}</div>}
      </div>
    </div>
  );
}