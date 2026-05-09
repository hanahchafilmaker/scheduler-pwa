import { WORK_TYPE_LABEL } from "@shared/constants";
import { formatTime, formatMinutes, normalizeDate } from "@shared/utils";

export default function StaffHome({
  employee,
  toast,
  todaySchedule,
  todayAttendance,
  todayLoading, // ✅ 추가: 오늘 데이터 로딩 중 여부
  workType,
  setWorkType,
  isPending,
  isWorking,
  isDone,
  isRejected,
  actionLoading,
  records,
  stats,
  onCheckIn,
  onCheckOut,
  onLogout,
}) {
  const statusLabel = todayLoading
    ? "확인 중..."
    : isPending
      ? "승인 대기"
      : isWorking
        ? "근무중"
        : isDone
          ? "퇴근 완료"
          : isRejected
            ? "출근 거절"
            : "출근 전";

  const workTypeDisabled = isPending || isWorking || isDone;

  return (
    <div className="staff-root">
      {toast && <div className="staff-toast">{toast}</div>}

      <header className="staff-header">
        <div>
          <div className="staff-brand">SHIFT</div>
          <h1>{employee.name}</h1>
          <p>오늘 근무 상태: {statusLabel}</p>
        </div>

        <button className="logout-btn" onClick={onLogout}>
          로그아웃
        </button>
      </header>

      <main className="staff-page">
        <section className="staff-card">
          <h2>오늘 근무</h2>

          {todaySchedule ? (
            <p className="schedule-text">
              예정: {WORK_TYPE_LABEL[todaySchedule.part] || todaySchedule.part} /{" "}
              {todaySchedule.planned_start}~{todaySchedule.planned_end}
            </p>
          ) : (
            <p className="muted">오늘 예정된 근무가 없습니다</p>
          )}

          <div className="work-grid">
            {["open", "middle", "close", "extra"].map((type) => (
              <button
                key={type}
                className={workType === type ? "active" : ""}
                onClick={() => setWorkType(type)}
                disabled={workTypeDisabled}
              >
                {WORK_TYPE_LABEL[type]}
              </button>
            ))}
          </div>

          <div className="status-box">{statusLabel}</div>

          <div className="action-area">
            {/* ✅ 로딩 중일 때 스피너 표시 */}
            {todayLoading ? (
              <div className="notice">근무 상태 확인 중...</div>
            ) : (
              <>
                {(!todayAttendance || isRejected) && (
                  <button className="primary-btn" onClick={onCheckIn} disabled={actionLoading}>
                    출근하기
                  </button>
                )}

                {isPending && <div className="notice">관리자 승인 대기 중입니다.</div>}

                {isWorking && (
                  <button
                    className="primary-btn dark"
                    onClick={onCheckOut}
                    disabled={actionLoading}
                  >
                    퇴근하기
                  </button>
                )}

                {isDone && <div className="done">오늘 근무 완료</div>}

                {isRejected && (
                  <div className="notice" style={{ marginTop: 8 }}>
                    출근이 거절되었습니다. 다시 출근해주세요.
                  </div>
                )}
              </>
            )}
          </div>

          {todayAttendance && (
            <div className="today-record">
              <span>출근 {formatTime(todayAttendance.check_in)}</span>
              <span>
                퇴근 {todayAttendance.check_out ? formatTime(todayAttendance.check_out) : "-"}
              </span>
            </div>
          )}
        </section>

        <section className="staff-card">
          <h2>이달 기록</h2>

          <div className="summary-grid">
            <div>
              <span>총 근무시간</span>
              <strong>{formatMinutes(stats.totalMin)}</strong>
            </div>
            <div>
              <span>지각</span>
              <strong>{stats.late}</strong>
            </div>
            <div>
              <span>조퇴</span>
              <strong>{stats.early}</strong>
            </div>
            <div>
              <span>초과</span>
              <strong>{stats.overtime}</strong>
            </div>
          </div>

          {records.length === 0 ? (
            <p className="muted" style={{ marginTop: 16 }}>
              이달 근무 기록이 없습니다
            </p>
          ) : (
            <ul className="record-list">
              {records.map((r, i) => (
                <li key={r.attendance_id || i}>
                  <span>{normalizeDate(r.date)}</span>
                  <span>{WORK_TYPE_LABEL[r.part] || r.part}</span>
                  <span>
                    {formatTime(r.check_in)} ~ {r.check_out ? formatTime(r.check_out) : "근무중"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
