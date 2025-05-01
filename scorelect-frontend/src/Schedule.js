// src/Schedule.js
import React, { useEffect, useState } from 'react';
import { Calendar, momentLocalizer, Views } from 'react-big-calendar';
import moment from 'moment';
import { RRule } from 'rrule';
import { v4 as uuidv4 } from 'uuid';
import Swal from 'sweetalert2';
import {
  Email as EmailIcon,
  CloudDownload,
  CloudUpload,
} from '@mui/icons-material';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './Schedule.css';

/* ----- corrected path: utils is inside src ----- */
import {
  getUserId,
  saveUserData,
  getUserData,
  getPlayers,
  backupData,
  restoreData,
  clearUserData,
} from './storage';

/* ------------- calendar localisation ------------- */
const localizer = momentLocalizer(moment);

/* ===================================================
   SMALL REUSABLE COMPONENTS
=================================================== */
const Modal = ({ isOpen, title, children, actions, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close-button" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-content">{children}</div>
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>
  );
};

const AgendaItem = ({ event }) => {
  const dateStr = moment(event.start).format('ddd, MMM D');
  const timeStr = `${moment(event.start).format('h:mm A')} – ${moment(
    event.end
  ).format('h:mm A')}`;
  return (
    <div className="agenda-item">
      <div className="agenda-item-date">
        <span className="agenda-date">{dateStr}</span>
        <span className="agenda-time">{timeStr}</span>
      </div>
      <h4 className="agenda-item-title">{event.title}</h4>
    </div>
  );
};

const Agenda = ({ events, selectedDate }) => {
  const list = events
    .filter(
      (e) =>
        moment(e.start).startOf('day') >=
        moment(selectedDate).startOf('day').subtract(1, 'day')
    )
    .sort((a, b) => a.start - b.start);
  return (
    <div className="agenda-container">
      <div className="agenda-header">
        <h3>Upcoming Events</h3>
        <span className="agenda-date-label">
          {moment(selectedDate).format('MMMM D, YYYY')}
        </span>
      </div>
      <div className="agenda-content">
        {list.length ? (
          <div className="agenda-list">
            {list.map((ev) => (
              <AgendaItem key={ev.id} event={ev} />
            ))}
          </div>
        ) : (
          <div className="no-events">
            <div className="no-events-icon">📅</div>
            <p>No upcoming events</p>
            <span>Click on the calendar to add an event</span>
          </div>
        )}
      </div>
    </div>
  );
};

/* ===================================================
   EMAIL-SCHEDULE MODAL
=================================================== */
const ScheduleEmailDialog = ({
  isOpen,
  onClose,
  events,
  players,
  currentDate,
}) => {
  /* --- state --- */
  const [range, setRange] = useState('week');
  const [cStart, setCStart] = useState(
    moment(currentDate).format('YYYY-MM-DD')
  );
  const [cEnd, setCEnd] = useState(
    moment(currentDate).add(1, 'month').format('YYYY-MM-DD')
  );
  const [selected, setSelected] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [warnNoEvents, setWarnEvents] = useState(false);
  const [warnNoPlayers, setWarnPlayers] = useState(false);

  /* --- helpers --- */
  const filteredEvents = () => {
    let start = new Date();
    let end;
    if (range === 'week') {
      end = moment().add(7, 'days').toDate();
    } else if (range === 'month') {
      end = moment().add(1, 'month').toDate();
    } else {
      start = moment(cStart).toDate();
      end = moment(cEnd).toDate();
    }
    return events.filter((e) => e.start >= start && e.start <= end);
  };

  const togglePlayer = (id) =>
    setSelected(
      selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]
    );

  const sendEmails = () => {
    const list = filteredEvents();
    if (!list.length) {
      setWarnEvents(true);
      return;
    }
    if (!selected.length) {
      setWarnPlayers(true);
      return;
    }
    /* format body */
    const body =
      'Team Schedule\n\n' +
      list
        .sort((a, b) => a.start - b.start)
        .map(
          (e) =>
            `${moment(e.start).format('dddd, MMM D, YYYY')}\n` +
            `${moment(e.start).format('h:mm A')} – ${moment(e.end).format(
              'h:mm A'
            )}\n${e.title}\n`
        )
        .join('\n') +
      '\nThis schedule is subject to change.';
    /* mailto */
    const emails = players
      .filter((p) => selected.includes(p.id))
      .map((p) => p.email)
      .join(',');
    const subject =
      range === 'week'
        ? 'Team Schedule (Next Week)'
        : range === 'month'
        ? 'Team Schedule (Next Month)'
        : `Team Schedule (${moment(cStart).format('MMM D')}–${moment(cEnd).format(
            'MMM D, YYYY'
          )})`;
    window.location.href = `mailto:?bcc=${emails}&subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
    onClose();
  };

  /* --- render --- */
  return (
    <Modal
      isOpen={isOpen}
      title="Email Schedule to Players"
      onClose={onClose}
      actions={
        <>
          <button className="modal-button cancel-button" onClick={onClose}>
            Cancel
          </button>
          <button className="modal-button save-button" onClick={sendEmails}>
            Send Emails
          </button>
        </>
      }
    >
      <div className="email-schedule-form">
        {/* DATE RANGE --------------------------- */}
        <div className="form-section">
          <h3 className="section-title">Select Date Range</h3>
          {['week', 'month', 'custom'].map((r) => (
            <div key={r} className="radio-option">
              <input
                type="radio"
                id={r}
                name="dr"
                value={r}
                checked={range === r}
                onChange={(e) => setRange(e.target.value)}
              />
              <label htmlFor={r}>
                {r === 'week'
                  ? 'Next Week'
                  : r === 'month'
                  ? 'Next Month'
                  : 'Custom Range'}
              </label>
            </div>
          ))}

          {range === 'custom' && (
            <div className="custom-date-range">
              <div className="form-group">
                <label htmlFor="cs">Start</label>
                <input
                  id="cs"
                  type="date"
                  value={cStart}
                  onChange={(e) => setCStart(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="ce">End</label>
                <input
                  id="ce"
                  type="date"
                  value={cEnd}
                  min={cStart}
                  onChange={(e) => setCEnd(e.target.value)}
                />
              </div>
            </div>
          )}
          {warnNoEvents && (
            <div className="warning-message">
              No events in the selected range.
            </div>
          )}
        </div>

        {/* PLAYERS --------------------------- */}
        <div className="form-section">
          <h3 className="section-title">Select Players</h3>
          {players.length ? (
            <>
              <div className="select-all-option">
                <input
                  type="checkbox"
                  id="selall"
                  checked={selectAll}
                  onChange={() => {
                    setSelectAll(!selectAll);
                    setSelected(!selectAll ? players.map((p) => p.id) : []);
                  }}
                />
                <label htmlFor="selall">Select All Players</label>
              </div>
              <div className="players-list">
                {players.map((p) => (
                  <div key={p.id} className="player-option">
                    <input
                      type="checkbox"
                      id={`p${p.id}`}
                      checked={selected.includes(p.id)}
                      onChange={() => togglePlayer(p.id)}
                    />
                    <label htmlFor={`p${p.id}`}>
                      {p.name} ({p.position})
                    </label>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="no-players-message">
              No players available. Add players in the roster first.
            </div>
          )}
          {warnNoPlayers && (
            <div className="warning-message">Select at least one player.</div>
          )}
        </div>
      </div>
    </Modal>
  );
};

/* ===================================================
   MAIN COMPONENT
=================================================== */
const Schedule = () => {
  const userId = getUserId();

  /* ---------- state ---------- */
  const [userData, setUserDataState] = useState({
    events: [],
    agendaNotes: '',
  });
  const [players, setPlayers] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [savedFeedback, setSavedFeedback] = useState(false);

  /* modal state (add / edit / details) */
  const [modalOpen, setModalOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    startDate: null,
    startTime: '',
    endTime: '',
    recurrence: 'none',
    recurrenceEndDate: null,
    id: null,
  });
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [errorMessage, setError] = useState('');

  /* email dialog */
  const [emailOpen, setEmailOpen] = useState(false);

  /* ---------- load schedule & players ---------- */
  useEffect(() => {
    setUserDataState(getUserData(userId));
    setPlayers(getPlayers(userId));
  }, [userId]);

  /* ---------- auto-hide “saved” toast ---------- */
  useEffect(() => {
    if (!savedFeedback) return;
    const t = setTimeout(() => setSavedFeedback(false), 3000);
    return () => clearTimeout(t);
  }, [savedFeedback]);

  /* ---------- wrap writes ---------- */
  const commit = (data) => {
    setUserDataState(data);
    saveUserData(userId, data);
    setSavedFeedback(true);
  };

  /* =================================================
     BACKUP / RESTORE
  ================================================= */
  const doBackup = () => {
    backupData(userId);
    Swal.fire({
      icon: 'success',
      title: 'Backup downloaded!',
      timer: 1500,
      showConfirmButton: false,
      customClass: { popup: 'modern-swal-popup', title: 'modern-swal-title' },
    });
  };

  const doRestore = () => {
    const fileInput = Object.assign(document.createElement('input'), {
      type: 'file',
      accept: 'application/json',
      style: 'display:none',
    });
    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const ok = restoreData(JSON.parse(ev.target.result), userId);
          if (!ok) throw new Error();
          setUserDataState(getUserData(userId));
          setPlayers(getPlayers(userId));
          Swal.fire({
            icon: 'success',
            title: 'Data restored!',
            timer: 1500,
            showConfirmButton: false,
            customClass: {
              popup: 'modern-swal-popup',
              title: 'modern-swal-title',
            },
          });
        } catch {
          Swal.fire({
            icon: 'error',
            title: 'Invalid backup file.',
            customClass: {
              popup: 'modern-swal-popup',
              title: 'modern-swal-title',
            },
          });
        }
      };
      reader.readAsText(file);
    };
    document.body.appendChild(fileInput);
    fileInput.click();
    document.body.removeChild(fileInput);
  };

  /* =================================================
     EVENT CRUD
  ================================================= */
  const openAddModal = (slotInfo) => {
    /* round times */
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes() >= 30 ? 30 : 0;
    setNewEvent({
      title: '',
      startDate: slotInfo ? slotInfo.start : new Date(),
      startTime: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
      endTime: `${String(m === 30 ? h + 1 : h).padStart(2, '0')}:${String(
        m === 30 ? 0 : 30
      ).padStart(2, '0')}`,
      recurrence: 'none',
      recurrenceEndDate: null,
      id: null,
    });
    setError('');
    setModalOpen(true);
  };

  const buildEventsFromForm = () => {
    const { title, startDate, startTime, endTime, recurrence, recurrenceEndDate } =
      newEvent;
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const startDT = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate(),
      sh,
      sm
    );
    const endDT = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate(),
      eh,
      em
    );
    if (endDT <= startDT) {
      setError('End time must be after start time.');
      return null;
    }
    let evs = [];
    if (recurrence !== 'none') {
      const rule = new RRule({
        freq:
          recurrence === 'daily'
            ? RRule.DAILY
            : recurrence === 'weekly'
            ? RRule.WEEKLY
            : RRule.MONTHLY,
        dtstart: startDT,
        until: recurrenceEndDate,
      });
      evs = rule.all().map((d) => ({
        start: d,
        end: new Date(d.getTime() + (endDT - startDT)),
        title,
        id: uuidv4(),
      }));
    } else {
      evs = [{ start: startDT, end: endDT, title, id: uuidv4() }];
    }
    return evs;
  };

  const addEvent = () => {
    const evs = buildEventsFromForm();
    if (!evs) return;
    commit({ ...userData, events: [...userData.events, ...evs] });
    setModalOpen(false);
    Swal.fire({
      icon: 'success',
      title: 'Event added!',
      timer: 1500,
      showConfirmButton: false,
      customClass: { popup: 'modern-swal-popup', title: 'modern-swal-title' },
    });
  };

  const updateEvent = () => {
    const { id } = newEvent;
    const evs = buildEventsFromForm();
    if (!evs) return;
    const [updated] = evs; // editing = single occurrence
    commit({
      ...userData,
      events: userData.events.map((e) => (e.id === id ? updated : e)),
    });
    setModalOpen(false);
    Swal.fire({
      icon: 'success',
      title: 'Event updated!',
      timer: 1500,
      showConfirmButton: false,
      customClass: { popup: 'modern-swal-popup', title: 'modern-swal-title' },
    });
  };

  const deleteEvent = () => {
    Swal.fire({
      icon: 'warning',
      title: 'Delete this event?',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      customClass: {
        popup: 'modern-swal-popup',
        title: 'modern-swal-title',
        confirmButton: 'modern-swal-delete-button',
      },
    }).then((r) => {
      if (r.isConfirmed) {
        commit({
          ...userData,
          events: userData.events.filter((e) => e.id !== selectedEvent.id),
        });
        setDetailsOpen(false);
      }
    });
  };

  const resetSchedule = () => {
    Swal.fire({
      icon: 'warning',
      title: 'Reset entire schedule?',
      text: 'This will remove ALL events.',
      showCancelButton: true,
      confirmButtonText: 'Reset',
      customClass: {
        popup: 'modern-swal-popup',
        title: 'modern-swal-title',
        confirmButton: 'modern-swal-delete-button',
      },
    }).then((r) => {
      if (r.isConfirmed) {
        clearUserData(userId);
        setUserDataState({ events: [], agendaNotes: '' });
      }
    });
  };

  /* =================================================
     RENDER
  ================================================= */
  const eventStyleGetter = ({ start }) => {
    const h = new Date(start).getHours();
    const bg =
      h < 12 ? '#4361ee' : h < 17 ? '#3a0ca3' : '#7209b7';
    return {
      style: {
        backgroundColor: bg,
        borderRadius: 8,
        color: '#fff',
        border: 'none',
        fontWeight: 500,
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
      },
    };
  };

  const formats = {
    dateFormat: 'D',
    dayFormat: 'ddd D',
    monthHeaderFormat: 'MMMM YYYY',
    weekdayFormat: 'dddd',
    dayHeaderFormat: 'dddd, MMMM D, YYYY',
    dayRangeHeaderFormat: ({ start, end }, culture, l) =>
      `${l.format(start, 'MMMM D', culture)} – ${l.format(end, 'D, YYYY', culture)}`,
  };

  return (
    <div className="schedule-page">
      {/* HEADER -------------------------------------------------- */}
      <header className="app-header">
        <h1 className="app-title">Team Schedule</h1>
        {savedFeedback && (
          <div className="save-feedback">Changes saved!</div>
        )}
        <div className="schedule-actions">
          <button
            className="action-button backup-button"
            onClick={doBackup}
          >
            <CloudDownload className="button-icon" />
            Backup
          </button>
          <button
            className="action-button restore-button"
            onClick={doRestore}
          >
            <CloudUpload className="button-icon" />
            Restore
          </button>
        </div>
      </header>

      {/* MAIN LAYOUT ------------------------------------------- */}
      <div className="schedule-container">
        {/* CALENDAR */}
        <div className="calendar-container">
          <Calendar
            localizer={localizer}
            events={userData.events}
            startAccessor="start"
            endAccessor="end"
            selectable
            longPressThreshold={10}
            defaultView={Views.MONTH}
            views={['month', 'week', 'day', 'agenda']}
            date={currentDate}
            onNavigate={setCurrentDate}
            onSelectSlot={openAddModal}
            onSelectEvent={(e) => {
              setSelectedEvent(e);
              setDetailsOpen(true);
            }}
            eventPropGetter={eventStyleGetter}
            formats={formats}
          />
        </div>

        {/* SIDEBAR */}
        <div className="sidebar-schedule">
          <Agenda events={userData.events} selectedDate={currentDate} />

          <div className="sidebar-actions">
            <button
              className="action-button save-button"
              onClick={() => commit(userData)}
            >
              💾 Save Schedule
            </button>
            <button
              className="action-button reset-button"
              onClick={resetSchedule}
            >
              🗑️ Reset
            </button>
          </div>

          <button
            className="email-schedule-button"
            onClick={() => setEmailOpen(true)}
          >
            <EmailIcon className="email-icon" />
            Email schedule to players
          </button>
        </div>
      </div>

      {/* ADD / EDIT EVENT MODAL -------------------------------- */}
      <Modal
        isOpen={modalOpen}
        title={newEvent.id ? 'Edit Event' : 'Add New Event'}
        onClose={() => setModalOpen(false)}
        actions={
          <>
            <button
              className="modal-button cancel-button"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </button>
            <button
              className="modal-button save-button"
              onClick={newEvent.id ? updateEvent : addEvent}
            >
              {newEvent.id ? 'Update Event' : 'Add Event'}
            </button>
          </>
        }
      >
        {errorMessage && <div className="error-message">{errorMessage}</div>}

        {/* TITLE */}
        <div className="form-group">
          <label>Title</label>
          <input
            type="text"
            value={newEvent.title}
            onChange={(e) =>
              setNewEvent({ ...newEvent, title: e.target.value })
            }
          />
        </div>

        {/* TIMES */}
        <div className="form-row">
          <div className="form-group">
            <label>Start</label>
            <input
              type="time"
              value={newEvent.startTime}
              onChange={(e) =>
                setNewEvent({ ...newEvent, startTime: e.target.value })
              }
            />
          </div>
          <div className="form-group">
            <label>End</label>
            <input
              type="time"
              value={newEvent.endTime}
              onChange={(e) =>
                setNewEvent({ ...newEvent, endTime: e.target.value })
              }
            />
          </div>
        </div>

        {/* RECURRENCE (only when adding) */}
        {!newEvent.id && (
          <>
            <div className="form-group">
              <label>Recurrence</label>
              <select
                value={newEvent.recurrence}
                onChange={(e) =>
                  setNewEvent({ ...newEvent, recurrence: e.target.value })
                }
              >
                <option value="none">None</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            {newEvent.recurrence !== 'none' && (
              <div className="form-group">
                <label>Recurrence End</label>
                <input
                  type="date"
                  value={
                    newEvent.recurrenceEndDate
                      ? moment(newEvent.recurrenceEndDate).format('YYYY-MM-DD')
                      : ''
                  }
                  min={moment(newEvent.startDate).format('YYYY-MM-DD')}
                  onChange={(e) =>
                    setNewEvent({
                      ...newEvent,
                      recurrenceEndDate: new Date(e.target.value),
                    })
                  }
                />
              </div>
            )}
          </>
        )}
      </Modal>

      {/* EVENT DETAILS MODAL ----------------------------------- */}
      {selectedEvent && (
        <Modal
          isOpen={detailsOpen}
          title="Event Details"
          onClose={() => setDetailsOpen(false)}
          actions={
            <>
              <button
                className="modal-button delete-button"
                onClick={deleteEvent}
              >
                Delete
              </button>
              <button
                className="modal-button edit-button"
                onClick={() => {
                  setNewEvent({
                    title: selectedEvent.title,
                    startDate: selectedEvent.start,
                    startTime: moment(selectedEvent.start).format('HH:mm'),
                    endTime: moment(selectedEvent.end).format('HH:mm'),
                    recurrence: 'none',
                    recurrenceEndDate: null,
                    id: selectedEvent.id,
                  });
                  setDetailsOpen(false);
                  setModalOpen(true);
                }}
              >
                Edit
              </button>
            </>
          }
        >
          <div className="event-details">
            <h3>{selectedEvent.title}</h3>
            <div className="event-detail-row">
              <span className="detail-label">Date:</span>
              <span className="detail-value">
                {moment(selectedEvent.start).format('dddd, MMMM D, YYYY')}
              </span>
            </div>
            <div className="event-detail-row">
              <span className="detail-label">Time:</span>
              <span className="detail-value">
                {moment(selectedEvent.start).format('h:mm A')} –{' '}
                {moment(selectedEvent.end).format('h:mm A')}
              </span>
            </div>
            <div className="event-detail-row">
              <span className="detail-label">Duration:</span>
              <span className="detail-value">
                {moment
                  .duration(moment(selectedEvent.end).diff(selectedEvent.start))
                  .asHours()
                  .toFixed(1)}{' '}
                hrs
              </span>
            </div>
          </div>
        </Modal>
      )}

      {/* EMAIL DIALOG ----------------------------------------- */}
      <ScheduleEmailDialog
        isOpen={emailOpen}
        onClose={() => setEmailOpen(false)}
        events={userData.events}
        players={players}
        currentDate={currentDate}
      />
    </div>
  );
};

export default Schedule;
