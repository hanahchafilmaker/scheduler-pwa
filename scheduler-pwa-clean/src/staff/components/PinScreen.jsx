export default function PinScreen({
  inputPin,
  setInputPin,
  pinError,
  loading,
  onLogin,
}) {
  // FIX: loading 중이거나 inputPin 없을 때 엔터키 차단
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !loading && inputPin) onLogin();
  };

  return (
    <div className="staff-root">
      <div className="pin-card">
        <div className="pin-brand">SHIFT</div>
        <h1>직원 로그인</h1>
        <p>PIN을 입력해주세요</p>

        <input
          id="pin"
          name="pin"
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          placeholder="PIN 입력"
          value={inputPin}
          onChange={(e) => setInputPin(e.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="current-password"
          autoFocus
        />

        <button onClick={onLogin} disabled={loading || !inputPin}>
          {loading ? "불러오는 중..." : "로그인"}
        </button>

        {pinError && <div className="staff-error">{pinError}</div>}
      </div>
    </div>
  );
}