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
      setPinError("PIN .");
      return;
    }

    setLoading(true);

    try {
      // Supabase PIN +   
      const { data, error } = await supabase
        .from("employees")
        .select("id, name, role, active")
        .eq("pin", pin)
        .eq("active", true)
        .single();

      if (error || !data) {
        setPinError("PIN  .");
        setInputPin("");
        return;
      }

      if (data.role !== "admin") {
        setPinError("  .");
        setInputPin("");
        return;
      }

      //  
      onSuccess?.(data);
    } catch (err) {
      console.error(err);
      setPinError("   .");
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

        <h1> </h1>
        <p>PIN </p>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            placeholder=" PIN"
            value={inputPin}
            onChange={(e) => setInputPin(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />

          <button type="submit" disabled={loading}>
            {loading ? " ..." : ""}
          </button>
        </form>

        {pinError && <div className="admin-error">{pinError}</div>}
      </div>
    </div>
  );
}
