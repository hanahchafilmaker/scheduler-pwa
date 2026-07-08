import React, { useState, useMemo, useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import useApi from '../../shared/hooks/useApi';
import { getApprovalStatusLabel } from '../../shared/hooks/useApi';

const STATUS_COLORS = {
  approved: '#16a34a',
  pending: '#d97706',
  rejected: '#dc2626',
};

const STATUS_LABEL_FALLBACK = {
  approved: '확정',
  pending: '검토중',
  rejected: '거절',
};

export default function MonthlyCalendar({ employeeId }) {
  const [date, setDate] = useState(new Date()); // 현재 보고 있는 달 (데이터 fetch 기준)
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedEvents, setSelectedEvents] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const calendarRef = useRef(null);

  const { monthAttendance, loading, error } = useApi({
    employeeId: employeeId || '',
    month: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
  });

  // FullCalendar는 자체 내부 날짜를 갖고 있어서, 커스텀 이전/다음 버튼으로
  // date state가 바뀔 때마다 캘린더가 보여주는 달도 명시적으로 맞춰줘야 합니다.
  // (헤더의 prev/next 기본 버튼은 아예 숨기고 이 커스텀 버튼만 남겨서,
  //  "화면 달"과 "로드된 데이터 달"이 어긋나는 문제를 원천적으로 없앴습니다.)
  useEffect(() => {
    calendarRef.current?.getApi().gotoDate(date);
  }, [date]);

  const statusLabel = (status) =>
    getApprovalStatusLabel ? getApprovalStatusLabel(status) : STATUS_LABEL_FALLBACK[status] || status || '-';

  const calendarEvents = useMemo(() => {
    if (!monthAttendance || monthAttendance.length === 0) return [];

    const formatTime = (time) => (time ? String(time).padStart(5, '0') : '-');

    return monthAttendance.map((att) => {
      const status = att.approval_status || 'pending';
      const color = STATUS_COLORS[status] || '#9ca3af';
      const startTime = formatTime(att.check_in);
      const endTime = formatTime(att.check_out);

      return {
        title: `${att.part || ''} ${startTime}~${endTime}`,
        start: att.date,
        end: att.date,
        allDay: true,
        extendedProps: {
          ...att,
          statusColor: color,
          statusText: statusLabel(status),
        },
      };
    });
  }, [monthAttendance]);

  const handleDateClick = (info) => {
    const clickedDate = info.dateStr;
    setSelectedDate(clickedDate);
    setSelectedEvents(calendarEvents.filter((e) => e.start === clickedDate));
    setModalOpen(true);
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
  };

  const goToMonth = (offset) => {
    setDate((prev) => {
      const next = new Date(prev);
      next.setMonth(next.getMonth() + offset);
      return next;
    });
  };

  return (
    <div className="mcal">
      <div className="mcal-card">
        <header className="mcal-header">
          <h2 className="mcal-title">월간 근태 달력</h2>
          <div className="mcal-nav">
            <button type="button" className="mcal-nav-btn" onClick={() => goToMonth(-1)} aria-label="이전 달">
              ‹
            </button>
            <span className="mcal-month-label">
              {date.getFullYear()}년 {date.getMonth() + 1}월
            </span>
            <button type="button" className="mcal-nav-btn" onClick={() => goToMonth(1)} aria-label="다음 달">
              ›
            </button>
          </div>
        </header>

        <div className="mcal-legend">
          {Object.entries(STATUS_COLORS).map(([key, color]) => (
            <span className="mcal-legend-item" key={key}>
              <span className="mcal-legend-dot" style={{ backgroundColor: color }} />
              {statusLabel(key)}
            </span>
          ))}
        </div>

        {loading && <div className="mcal-status-line mcal-loading">불러오는 중...</div>}
        {error && <div className="mcal-status-line mcal-error">오류: {error}</div>}

        <div className="mcal-grid">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            initialDate={date}
            headerToolbar={false}
            events={calendarEvents}
            dateClick={handleDateClick}
            dayMaxEventRows={3}
            weekends
            eventContent={(arg) => (
              <div className="mcal-event-chip">
                <span
                  className="mcal-event-dot"
                  style={{ backgroundColor: arg.event.extendedProps.statusColor }}
                />
                <span className="mcal-event-text">{arg.event.title}</span>
              </div>
            )}
          />
        </div>
      </div>

      {modalOpen && selectedDate && (
        <div className="mcal-modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="mcal-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mcal-modal-header">
              <h3>{formatDate(selectedDate)} 근무 내역</h3>
              <button type="button" className="mcal-icon-btn" onClick={() => setModalOpen(false)} aria-label="닫기">
                ✕
              </button>
            </div>

            <div className="mcal-modal-body">
              {selectedEvents.length === 0 ? (
                <p className="mcal-modal-empty">해당 날짜에 근무 기록이 없습니다.</p>
              ) : (
                <ul className="mcal-event-list">
                  {selectedEvents.map((event, index) => (
                    <li className="mcal-event-item" key={index}>
                      <div className="mcal-event-item-top">
                        <span
                          className="mcal-status-pill"
                          style={{
                            backgroundColor: `${event.extendedProps.statusColor}1a`,
                            color: event.extendedProps.statusColor,
                          }}
                        >
                          {event.extendedProps.statusText}
                        </span>
                        <span className="mcal-event-time">{event.title}</span>
                      </div>
                      <dl className="mcal-event-details">
                        <div>
                          <dt>직원</dt>
                          <dd>{event.extendedProps.name || '-'}</dd>
                        </div>
                        <div>
                          <dt>참고사항</dt>
                          <dd>{event.extendedProps.memo || '-'}</dd>
                        </div>
                      </dl>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}