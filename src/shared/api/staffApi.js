import { STAFF_API_URL } from "./staffConfig";

export async function fetchStaffEmployees() {
  const res = await fetch(`${STAFF_API_URL}?action=all`, { redirect: "follow" });
  const json = await res.json();
  return json.employees || [];
}

export async function fetchStaffToday(employeeId) {
  if (!employeeId) return { schedule: [], attendance: [] };
  const res = await fetch(
    `${STAFF_API_URL}?action=staff_today&employee_id=${employeeId}`,
    { redirect: "follow" }
  );
  const json = await res.json();
  return {
    schedule: json.schedule || [],
    attendance: json.attendance || [],
  };
}

export async function fetchStaffMonth(employeeId, month) {
  if (!employeeId || !month) return [];
  const res = await fetch(
    `${STAFF_API_URL}?action=staff_month&employee_id=${employeeId}&month=${month}`,
    { redirect: "follow" }
  );
  const json = await res.json();
  return json.attendance || [];
}

export async function checkInStaff({ employee, workType, date, checkIn }) {
  const res = await fetch(STAFF_API_URL, {
    method: "POST",
    redirect: "follow",
    body: JSON.stringify({
      action: "check_in",
      employee_id: employee.employee_id,
      name: employee.name,
      date,
      part: workType,
      check_in: checkIn,
    }),
  });
  const json = await res.json();
  if (json.ok === false) throw new Error(json.error || " ????");
  return json;
}

export async function checkOutStaff({ attendanceId, checkOut }) {
  const res = await fetch(STAFF_API_URL, {
    method: "POST",
    redirect: "follow",
    body: JSON.stringify({
      action: "check_out",
      attendance_id: attendanceId,
      check_out: checkOut,
    }),
  });
  const json = await res.json();
  if (json.ok === false) throw new Error(json.error || "? ????");
  return json;
}

