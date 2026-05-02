import { useState, useCallback } from "react";
import { API_URL } from "../constants";

export function useApi() {
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees]   = useState([]);
  const [schedule, setSchedule]     = useState([]);
  const [attendance, setAttendance] = useState([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API_URL}?action=all`);
      const json = await res.json();
      setEmployees(json.employees   || []);
      setSchedule(json.schedule     || []);
      setAttendance(json.attendance || []);
    } finally {
      setLoading(false);
    }
  }, []);

  const post = useCallback(async (body) => {
    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return res.json();
  }, []);

  return { loading, employees, schedule, attendance, fetchAll, post };
}
