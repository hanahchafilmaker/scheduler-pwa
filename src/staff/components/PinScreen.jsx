import React from "react";

export default function PinScreen(props) {
  const {
    mode = "staff", //  
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

      <h1>{isAdmin ? " " : " "}</h1>

      <p>
        {isAdmin
          ? " PIN ."
          : "PIN     ."}
      </p>

      <form onSubmit={handleSubmit}>
        <input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          placeholder="PIN "
          value={inputPin}
          onChange={(e) => setInputPin?.(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />

        <button type="submit" disabled={loading}>
          {loading ? " ..." : ""}
        </button>
      </form>

      {pinError ? <div className="staff-error">{pinError}</div> : null}
    </div>
  );
}
