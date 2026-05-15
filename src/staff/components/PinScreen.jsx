import React from "react";

export default function PinScreen(props) {
  const {
    mode = "staff", // 👈 추가
    inputPin = "",
    setInputPin,
    pinError = "",
    loading = false,
    onLogin,
  } = props;

  const isAdmin = mode === "admin";

  const handleSubmit = (e) => {
    e.preventDefault();
    if (loading) return;
    onLogin?.();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!loading) onLogin?.();
    }
  };

  return (
    <div className="pin-card">
      <div className="pin-brand">SHIFT</div>

      <h1>{isAdmin ? "관리자 로그인" : "직원 로그인"}</h1>

      <p>
        {isAdmin
          ? "관리자 PIN을 입력하세요."
          : "PIN을 입력하고 오늘 근무 상태를 확인하세요."}
      </p>

      <form onSubmit={handleSubmit}>
        <input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          placeholder="PIN 입력"
          value={inputPin}
          onChange={(e) => setInputPin?.(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />

        <button type="submit" disabled={loading}>
          {loading ? "불러오는 중..." : "로그인"}
        </button>
      </form>

      {pinError ? <div className="staff-error">{pinError}</div> : null}
    </div>
  );
}