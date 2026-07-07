import React, { useState, useMemo, useEffect } from 'react';
import { FullCalendar } from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useApi } from '../hooks/useApi';
import { getApprovalStatusLabel } from '../hooks/useApi';

const STATUS_COLORS = {
  approved: '#10b981', // green
  pending: '#f59e0b',  // amber
  rejected: '#ef4444', // red
};

export default function MonthlyCalendar({ employeeId }) {
  const [date, setDate] = useState(new Date()); // current month
  const [events, setEvents] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedEvents, setSelectedEvents] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);

  const { monthAttendance, loading, error } = useApi({
    employeeId: employeeId || '',
    month: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
  });

  // Transform attendance data to FullCalendar events
  const calendarEvents = useMemo(() => {
    if (!monthAttendance || monthAttendance.length === 0) return [];

    return monthAttendance.map((att) => {
      // Determine status from approval_status (normalized string: 'approved', 'rejected', 'pending')
      const status = att.approval_status || 'pending';
      const color = STATUS_COLORS[status] || '#6b7280'; // default gray

      // Format time for display
      const formatTime = (time) => {
        if (!time) return '-';
        return String(time).padStart(5, '0'); // HH:mm
      };

      const startTime = formatTime(att.check_in);
      const endTime = formatTime(att.check_out);

      return {
        title: `${att.part || ''} ${startTime} ~ ${endTime}`,
        start: att.date, // YYYY-MM-DD
        end: att.date, // same day (exclusive end in FullCalendar: next day)
        allDay: true, // we'll show as all-day bar but time in title
        backgroundColor: color,
        borderColor: color,
        textColor: '#fff',
        extendedProps: {
          ...att,
          statusText: getAttendanceStatusLabel(status),
        },
      };
    });
  }, [monthAttendance]);

  // Update events when monthAttendance changes
  useEffect(() => {
    setEvents(calendarEvents);
  }, [calendarEvents]);

  // Handle date click (day cell)
  const handleDateClick = (info) => {
    const clickedDate = info.dateStr; // 'YYYY-MM-DD'
    setSelectedDate(clickedDate);
    // Filter events for this date
    const dayEvents = events.filter((e) => e.start === clickedDate);
    setSelectedEvents(dayEvents);
    setModalOpen(true);
  };

  // Format date for display
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
  };

  return (
    <div className="monthly-calendar">
      <div className="calendar-header">
        <h2>월간 근태 달력</h2>
        <div className="calendar-nav">
          <button
            onClick={() => {
              const prev = new Date(date);
              prev.setMonth(prev.getMonth() - 1);
              setDate(prev);
            }}
          >
            ◀ 이전 월
          </button>
          <span>{`${date.getFullYear()}년 ${date.getMonth() + 1}월`}</span>
          <button
            onClick={() => {
              const next = new Date(date);
              next.setMonth(next.getMonth() + 1);
              setDate(next);
            }}
          >
            다음 월 ▶
          </button>
        </div>
      </div>

      {/* Loading and error states */}
      {loading && <div className="loading">로드 중...</div>}
      {error && <div className="error">오류: {error}</div>}

      {/* Calendar */}
      <div className="calendar-container">
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView='dayGridMonth'
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: '',
          }}
          events={events}
          dateClick={handleDateClick}
          eventDisplay='block'
          selectable={false}
          editable={false}
          weekend={true}
        />
      </div>

      {/* Legend */}
      <div className="legend">
        <div className="legend-item">
          <span className="color-box" style={{ backgroundColor: STATUS_COLORS.approved }}></span>
          <span>확정 (승인 완료)</span>
        </div>
        <div className="legend-item">
          <span className="color-box" style={{ backgroundColor: STATUS_COLORS.pending }}></span>
          <span>검토중 (승인 대기)</span>
        </div>
        <div className="legend-item">
          <span className="color-box" style={{ backgroundColor: STATUS_COLORS.rejected }}></span>
          <span>거절</span>
        </div>
      </div>

      {/* Modal */}
      {modalOpen && selectedDate && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{formatDate(selectedDate)} 근무 내역</h3>
              <button onClick={() => setModalOpen(false)} className="close-btn">×</button>
            </div>
            <div className="modal-body">
              {selectedEvents.length === 0 ? (
                <p>해당 날짜에 근무 기록이 없습니다.</p>
              ) : (
                <ul className="event-list">
                  {selectedEvents.map((event, index) => (
                    <li key={index} className="event-item">
                      <div className="event-time">
                        {event.title}
                      </div>
                      <div className="event-details">
                        <span className="label">상태:</span>
                        <span className="value">{event.extendedProps.statusText}</span>
                      </div>
                      <div className="event-details">
                        <span className="label">직원:</span>
                        <span className="value">{event.extendedProps.name || '-'}</span>
                      </div>
                      <div className="event-details">
                        <span className="label">참고사항:</span>
                        <span className="value">
                          {event.extendedProps.memo || '-'}
                        </span>
                      </div>
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

// Helper function to get status label (Korean)
function getAttendanceStatusLabel(status) {
  switch (status) {
    case 'approved':
      return '확정';
    case 'rejected':
      return '거절';
    case 'pending':
      return '검토중';
    default:
      return status || '-';
  }
}