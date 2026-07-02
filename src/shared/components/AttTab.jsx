import React, { useMemo, useState, useEffect } from "react";
import {
  getApprovalReasonLabel,
  getApprovalStatusLabel,
  getPaidWorkMinutes,
  getScheduledWorkMinutes,
} from "../hooks/useApi";
import "./AttTab.css";

// ── 내부 유틸 ──────────────────────────────────────────────
function diffMinutes(start, end) {
  if (!start || !end) return 0;
  const toMin = (t) => {
    const [h, m] = String(t).split(":").map(Number);
    return h * 60 + m;
  };
  return Math.max(0, toMin(end) - toMin(start));
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function timeRange(start, end) {
  const s = start || "-";
  const e = end || "-";
  return `${s} ~ ${e}`;
}

function getPartLabel(part) {
  switch (String(part || "").toLowerCase()) {
    case "open":
      return "오픈";
    case "middle_a":
      return "미들A";
    case "middle_b":
      return "미들B";
    case "close":
      return "마감";
    case "extra":
      return "추가";
    default:
      return part || "-";
  }
}

function formatMinutes(mins) {
  const n = Number(mins || 0);
  if (!n) return "0분";
  const h = Math.floor(n / 60);
  const m = n % 60;
  if (h && m) return `${h}시간 ${m}분`;
  if (h) return `${h}시간`;
  return `${m}분`;
}

function matchesSearch(row, keyword) {
  if (!keyword.trim()) return true;
  const q = keyword.trim().toLowerCase();

  return [
    row.name,
    row.employee_id,
    row.part,
    row.date,
    row.approval_status,
    row.approval_reason,
    row.memo,
  ]
    .filter(Boolean)
    .some((v) => String(v).toLowerCase().includes(q));
}

function StatusBadge({ status }) {
  return (
    <span className={`att-badge status-${status || "default"}`}>
      {getApprovalStatusLabel(status)}
    </span>
  );
}

function ReasonBadge({ reason }) {
  return (
    <span className={`att-badge reason-${reason || "default"}`}>
      {getApprovalReasonLabel(reason)}
    </span>
  );
}

function SummaryCard({ title, value, sub }) {
  return (
    <div className="att-summary-card">
      <div className="att-summary-title">{title}</div>
      <div className="att-summary-value">{value}</div>
      {sub ? <div className="att-summary-sub">{sub}</div> : null}
    </div>
  );
}

function ApprovalModal({ row, onClose, onApprove, onReject }) {
  const [note, setNote] = useState("");

  if (!row) return null;

  return (
    <div className="att-modal-overlay">
      <div className="att-modal">
        <div className="att-modal-header">
          <h3>근태 승인 처리</h3>
          <button type="button" className="att-icon-btn" onClick={onClose}>
            닫기
          </button>
        </div>

        <div className="att-modal-body">
          <div className="att-detail-grid">
            <div>
              <strong>직원</strong>
              <div>{row.name || "-"}</div>
            </div>
            <div>
              <strong>날짜</strong>
              <div>{row.date || "-"}</div>
            </div>
            <div>
              <strong>파트</strong>
              <div>{getPartLabel(row.part)}</div>
            </div>
            <div>
              <strong>현재 상태</strong>
              <div><StatusBadge status={row.approval_status} /></div>
            </div>
            <div>
              <strong>사유</strong>
              <div>{getApprovalReasonLabel(row.approval_reason)}</div>
            </div>
            <div>
              <strong>예정시간</strong>
              <div>{timeRange(row.planned_start, row.planned_end)}</div>
            </div>
            <div>
              <strong>실제시간</strong>
              <div>{timeRange(row.check_in, row.check_out)}</div>
            </div>
            <div>
              <strong>지급시간</strong>
              <div>{timeRange(row.paid_check_in, row.paid_check_out)}</div>
            </div>
            <div>
              <strong>차감/연장</strong>
              <div style={{ whiteSpace: 'pre-wrap' }}>
                {`지각차감 ${Number(row.late_deduct_min || 0)}분 / 조퇴차감 ${Number(row.early_leave_min || 0)}분 / 추가 ${Number(row.extra_work_min || 0)}분 / 연장 ${Number(row.extension_min || 0)}분`}
              </div>
            </div>
          </div>

          {row.approval_note ? (
            <div className="att-note-box">
              <strong>기존 메모</strong>
              <div>{row.approval_note}</div>
            </div>
          ) : null}

          <label className="att-label">
            승인 메모
            <textarea
              className="att-textarea"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="승인/거절 사유 메모"
            />
          </label>
        </div>

        <div className="att-modal-actions">
          <button type="button" className="att-btn secondary" onClick={() => onReject(row, note)}>
            거절
          </button>
          <button type="button" className="att-btn primary" onClick={() => onApprove(row, note)}>
            승인
          </button>
        </div>
      </div>
    </div>
  );
}


const PART_OPTIONS = [
  { value: "open", label: "오픈" },
  { value: "middle_a", label: "미들A" },
  { value: "middle_b", label: "미들B" },
  { value: "close", label: "마감" },
  { value: "extra", label: "추가" },
];

function EditModal({ row, onClose, onSave }) {
  const [part, setPart] = useState(row?.part || "");
  const [checkIn, setCheckIn] = useState(row?.check_in || "");
  const [checkOut, setCheckOut] = useState(row?.check_out || "");
  const [paidIn, setPaidIn] = useState(row?.paid_check_in || "");
  const [paidOut, setPaidOut] = useState(row?.paid_check_out || "");
  const [breakMin, setBreakMin] = useState(String(row?.break_min || 0));
  const [note, setNote] = useState(row?.approval_note || "");

  // row prop이 바뀔 때마다(다른 행을 수정하러 들어올 때마다) 폼 상태를 동기화합니다.
  useEffect(() => {
    if (row) {
      setPart(row.part || "");
      setCheckIn(row.check_in || "");
      setCheckOut(row.check_out || "");
      setPaidIn(row.paid_check_in || "");
      setPaidOut(row.paid_check_out || "");
      setBreakMin(String(row.break_min || 0));
      setNote(row.approval_note || "");
    }
  }, [row]);

  if (!row) return null;

  const handleSave = () => {
    // Basic validation: check-in required; if check-out provided, it must be after check-in
    if (!checkIn) {
      alert("출근 시간은 필수입니다.");
      return;
    }
    if (checkOut && checkIn > checkOut) {
      alert("퇴근 시간은 출근 시간보다 이전일 수 없습니다.");
      return;
    }

    onSave({
      attendance_id: row.attendance_id,
      part: part || null,
      check_in: checkIn,
      check_out: checkOut || null,
      paid_check_in: paidIn,
      paid_check_out: paidOut,
      break_min: Number(breakMin) || 0,
      approval_note: note,
    });
    onClose();
  };

  return (
    <div className="att-modal-overlay">
      <div className="att-modal">
        <div className="att-modal-header">
          <h3>근태 수정</h3>
          <button type="button" className="att-icon-btn" onClick={onClose}>닫기</button>
        </div>

        <div className="att-modal-body">
          <div className="att-detail-grid">
            <div>
              <strong>직원</strong>
              <div>{row.name || "-"}</div>
            </div>
            <div>
              <strong>날짜</strong>
              <div>{row.date || "-"}</div>
            </div>
            <div>
              <strong>파트</strong>
              <div>{getPartLabel(row.part)}</div>
            </div>
          </div>

          <label className="att-label">
            파트 (오픈/미들/마감)
            <select
              className="att-select"
              value={part}
              onChange={(e) => setPart(e.target.value)}
            >
              <option value="">선택 안 함</option>
              {PART_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="att-label">
            실제 출근 시간
            <input
              className="att-input"
              type="time"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
            />
          </label>
          <label className="att-label">
            실제 퇴근 시간 (비워두면 미퇴근)
            <input
              className="att-input"
              type="time"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
            />
          </label>
          <label className="att-label">
            지급 출근 시간
            <input
              className="att-input"
              type="time"
              value={paidIn}
              onChange={(e) => setPaidIn(e.target.value)}
            />
          </label>
          <label className="att-label">
            지급 퇴근 시간
            <input
              className="att-input"
              type="time"
              value={paidOut}
              onChange={(e) => setPaidOut(e.target.value)}
            />
          </label>
          <label className="att-label">
            휴게 시간 (분)
            <input
              className="att-input"
              type="number"
              min={0}
              value={breakMin}
              onChange={(e) => setBreakMin(e.target.value)}
            />
          </label>
          <label className="att-label">
            메모
            <textarea
              className="att-textarea"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="수정 사유 등"
            />
          </label>
        </div>
        <div className="att-modal-actions">
          <button type="button" className="att-btn secondary" onClick={onClose}>취소</button>
          <button type="button" className="att-btn primary" onClick={handleSave}>저장</button>
        </div>
      </div>
    </div>
  );
}

export default function AttTab(props) {
  const {
    monthAttendance = [],
    approveAttendance,
    updateAttendance,
    selectedMonth = "",
    currentManagerName = "manager",
  } = props;

  const [statusFilter, setStatusFilter] = useState("all");
  const [reasonFilter, setReasonFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedRow, setSelectedRow] = useState(null);
  const [editRow, setEditRow] = useState(null);

  const attendanceList = safeArray(monthAttendance);

  const filteredRows = useMemo(() => {
    return attendanceList.filter((row) => {
      const matchStatus = statusFilter === "all" ? true : row.approval_status === statusFilter;
      const matchReason = reasonFilter === "all" ? true : row.approval_reason === reasonFilter;
      const matchKeyword = matchesSearch(row, search);
      return matchStatus && matchReason && matchKeyword;
    });
  }, [attendanceList, reasonFilter, search, statusFilter]);

  const summary = useMemo(() => {
    const pending = attendanceList.filter((r) => r.approval_status === "pending");
    const approved = attendanceList.filter((r) => r.approval_status === "approved");
    const rejected = attendanceList.filter((r) => r.approval_status === "rejected");

    const totalPaidMinutes = attendanceList
      .filter((r) => r.approval_status !== "pending")
      .reduce((acc, row) => acc + getPaidWorkMinutes(row), 0);

    const totalActualMinutes = attendanceList.reduce(
      (acc, row) =>
        acc +
        Math.max(0, diffMinutes(row.check_in, row.check_out) - Number(row.break_min || 0)),
      0
    );

    return {
      total: attendanceList.length,
      pending: pending.length,
      approved: approved.length,
      rejected: rejected.length,
      totalPaidMinutes,
      totalActualMinutes,
    };
  }, [attendanceList]);

  const handleApprove = async (row, note) => {
    if (!approveAttendance) return;

    await approveAttendance({
      attendance_id: row.attendance_id,
      approved: true,
      approved_by: currentManagerName,
      approval_note: note || "",
      date: row.date,
    });

    setSelectedRow(null);
  };

  const handleReject = async (row, note) => {
    if (!approveAttendance) return;

    await approveAttendance({
      attendance_id: row.attendance_id,
      approved: false,
      approved_by: currentManagerName,
      approval_note: note || "",
      date: row.date,
    });

    setSelectedRow(null);
  };

  const handleEdit = async (payload) => {
    if (!updateAttendance) return;
    await updateAttendance(payload);
  };

  return (
    <div className="att-tab">
      <div className="att-topbar">
        <div>
          <h2 className="att-title">출퇴근 / 정산</h2>
          <p className="att-subtitle">
            {selectedMonth || "-"} · 실제시간과 지급시간을 분리해서 확인
          </p>
        </div>
      </div>

      <div className="att-summary-grid">
        <SummaryCard title="전체 기록" value={summary.total} sub="월 전체 attendance" />
        <SummaryCard title="승인대기" value={summary.pending} sub="관리자 확인 필요" />
        <SummaryCard
          title="지급 근무시간"
          value={formatMinutes(summary.totalPaidMinutes)}
          sub="pending 제외"
        />
        <SummaryCard
          title="실제 근무시간"
          value={formatMinutes(summary.totalActualMinutes)}
          sub="check 기준"
        />
      </div>

      <section className="att-panel">
        <div className="att-filter-row">
          <input
            className="att-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름, 날짜, 사유 검색"
          />

          <select
            className="att-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">전체 상태</option>
            <option value="approved">승인</option>
            <option value="pending">승인대기</option>
            <option value="rejected">거절</option>
            <option value="auto_closed">자동종료</option>
          </select>

          <select
            className="att-select"
            value={reasonFilter}
            onChange={(e) => setReasonFilter(e.target.value)}
          >
            <option value="all">전체 사유</option>
            <option value="late_check_in">지각</option>
            <option value="early_leave">조기퇴근</option>
            <option value="late_checkout">추가근무</option>
            <option value="next_part_late_extension">다음 파트 지각 연장</option>
            <option value="next_part_no_show_extension">다음 파트 미출근 연장</option>
            <option value="out_of_schedule">스케줄 외 출근</option>
          </select>
        </div>

        <div className="att-table-wrap">
          <table className="att-table">
            <thead>
              <tr>
                <th>이름</th>
                <th>날짜</th>
                <th>파트</th>
                <th>예정시간</th>
                <th>파트기준</th>
                <th>실제시간</th>
                <th>지각</th>
                <th>지급시간</th>
                <th>상태</th>
                <th>사유</th>
                <th>휴게</th>
                <th>실지급</th>
                <th>메모</th>
                <th>처리</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={14} className="att-empty-cell">
                    조건에 맞는 근태 기록이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  return (
                    <tr key={row.attendance_id}>
                      <td>
                        {row.name || "-"}
                        {row.is_substitute && (
                          <span style={{ fontSize: 10, color: "#f59e0b", marginLeft: 4 }}>
                            대타
                          </span>
                        )}
                      </td>
                      <td>{row.date || "-"}</td>
                      <td>
                        {getPartLabel(row.part)}
                        {row.original_part && row.original_part !== row.part && (
                          <span style={{ fontSize: 10, color: "#9ca3af", display: "block" }}>
                            원래: {getPartLabel(row.original_part)}
                          </span>
                        )}
                      </td>
                      <td>{timeRange(row.planned_start, row.planned_end)}</td>
                      <td style={{ color: "#6b7280", fontSize: 12 }}>
                        {formatMinutes(getScheduledWorkMinutes(row))}
                      </td>
                      <td>{timeRange(row.check_in, row.check_out)}</td>
                      <td>
                        {row.late_display_min > 0 ? (
                          <span style={{ color: "#dc2626", fontSize: 12 }}>
                            {row.late_display_min}분
                          </span>
                        ) : (
                          <span className="att-muted">-</span>
                        )}
                      </td>
                      <td>{timeRange(row.paid_check_in, row.paid_check_out)}</td>
                      <td>
                        <StatusBadge status={row.approval_status} />
                      </td>
                      <td>
                        {row.approval_reason ? (
                          <ReasonBadge reason={row.approval_reason} />
                        ) : (
                          <span className="att-muted">-</span>
                        )}
                      </td>
                      <td>{Number(row.break_min || 0)}분</td>
                      <td>{formatMinutes(getPaidWorkMinutes(row))}</td>
                      <td className="att-note-cell">{row.memo || row.approval_note || "-"}</td>
                      <td>
                        <div style={{ display: "flex", gap: 4, flexWrap: "nowrap" }}>
                          <button
                            type="button"
                            className="att-btn primary small"
                            onClick={() => setSelectedRow(row)}
                          >
                            {row.approval_status === "pending" ? "승인" : "상태변경"}
                          </button>
                          <button
                            type="button"
                            className="att-btn secondary small"
                            onClick={() => setEditRow(row)}
                          >
                            수정
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <ApprovalModal
        row={selectedRow}
        onClose={() => setSelectedRow(null)}
        onApprove={handleApprove}
        onReject={handleReject}
      />

      <EditModal
        row={editRow}
        onClose={() => setEditRow(null)}
        onSave={handleEdit}
      />
    </div>
  );
}