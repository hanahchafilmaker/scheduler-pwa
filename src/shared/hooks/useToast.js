import { useState, useCallback, useRef, useEffect } from "react";

export function useToast() {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  // FIX:  ? setTimeout ID? ? ?? ? ??  //      ? ?? ? ??? toast ??? ?
  const showToast = useCallback((msg, type = "ok") => {
    setToast({ msg, type });
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setToast(null), 2500);
  }, []);

  // ?? ???? ?
  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  return { toast, showToast };
}

