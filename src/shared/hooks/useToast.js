import { useState, useCallback, useRef, useEffect } from "react";

export function useToast() {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  // FIX: 기존 구현은 setTimeout ID를 관리하지 않아 빠르게 연속 호출 시
  //      이전 타이머가 남아 예기치 않게 toast가 사라지는 문제 수정
  const showToast = useCallback((msg, type = "ok") => {
    setToast({ msg, type });
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setToast(null), 2500);
  }, []);

  // 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  return { toast, showToast };
}
