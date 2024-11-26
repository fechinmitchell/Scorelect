// Schedule.js
import React, { useState, useEffect } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import { RRule } from 'rrule';
import './Schedule.css';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = momentLocalizer(moment);

const Modal = ({ isOpen, onClose, onSubmit, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>{title}</h2>
        <div className="modal-content">{children}</div>
        <div className="modal-actions">
          <button className="modal-button" onClick={onClose}>
            Cancel
          </button>
          <button className="modal-button" onClick={onSubmit}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

const Schedule = () => {
  const [events, setEvents] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [newEventData, setNewEventData] = useState({
    title: '',
    startDate: null,
    startTime: '',
    endTime: '',
    recurrence: 'none',
    recurrenceEndDate: null,
  });
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventDetailsOpen, setEventDetailsOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Load events from localStorage on component mount
  useEffect(() => {
    const savedEvents = JSON.parse(localStorage.getItem('events'));
    if (savedEvents) {
      setEvents(savedEvents);
    }
  }, []);

  // Save events to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('events', JSON.stringify(events));
  }, [events]);

  const handleSelectSlot = ({ start }) => {
    setNewEventData({
      title: '',
      startDate: start,
      startTime: '',
      endTime: '',
      recurrence: 'none',
      recurrenceEndDate: null,
    });
    setErrorMessage('');
    setModalOpen(true);
  };

  const handleAddEvent = () => {
    const {
      title,
      startDate,
      startTime,
      endTime,
      recurrence,
      recurrenceEndDate,
    } = newEventData;

    // Input validation
    if (!title || !startTime || !endTime) {
      setErrorMessage('Please fill in all required fields.');
      return;
    }

    if (recurrence !== 'none' && !recurrenceEndDate) {
      setErrorMessage('Please select an end date for the recurrence.');
      return;
    }

    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);

    const startDateTime = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate(),
      startHour,
      startMinute
    );
    const endDateTime = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate(),
      endHour,
      endMinute
    );

    if (endDateTime <= startDateTime) {
      setErrorMessage('End time must be after start time.');
      return;
    }

    let newEvents = [];

    if (recurrence !== 'none') {
      const ruleOptions = {
        freq:
          recurrence === 'daily'
            ? RRule.DAILY
            : recurrence === 'weekly'
            ? RRule.WEEKLY
            : RRule.MONTHLY,
        dtstart: startDateTime,
        until: recurrenceEndDate,
      };

      const rule = new RRule(ruleOptions);
      const dates = rule.all();

      newEvents = dates.map((date) => ({
        start: date,
        end: new Date(date.getTime() + (endDateTime - startDateTime)),
        title,
        id: Date.now() + Math.random(), // Unique ID
      }));
    } else {
      newEvents = [
        {
          start: startDateTime,
          end: endDateTime,
          title,
          id: Date.now() + Math.random(), // Unique ID
        },
      ];
    }

    setEvents([...events, ...newEvents]);
    setNewEventData({
      title: '',
      startDate: null,
      startTime: '',
      endTime: '',
      recurrence: 'none',
      recurrenceEndDate: null,
    });
    setModalOpen(false);
  };

  const handleSelectEvent = (event) => {
    setSelectedEvent(event);
    setEventDetailsOpen(true);
  };

  const handleDeleteEvent = () => {
    setEvents(events.filter((e) => e.id !== selectedEvent.id));
    setSelectedEvent(null);
    setEventDetailsOpen(false);
  };

  const handleEditEvent = () => {
    setNewEventData({
      title: selectedEvent.title,
      startDate: selectedEvent.start,
      startTime: moment(selectedEvent.start).format('HH:mm'),
      endTime: moment(selectedEvent.end).format('HH:mm'),
      recurrence: 'none', // Simplification for editing
      recurrenceEndDate: null,
      id: selectedEvent.id,
    });
    setEventDetailsOpen(false);
    setModalOpen(true);
  };

  const handleUpdateEvent = () => {
    const {
      title,
      startDate,
      startTime,
      endTime,
      id,
    } = newEventData;

    // Input validation
    if (!title || !startTime || !endTime) {
      setErrorMessage('Please fill in all required fields.');
      return;
    }

    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);

    const startDateTime = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate(),
      startHour,
      startMinute
    );
    const endDateTime = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate(),
      endHour,
      endMinute
    );

    if (endDateTime <= startDateTime) {
      setErrorMessage('End time must be after start time.');
      return;
    }

    const updatedEvents = events.map((event) =>
      event.id === id
        ? { ...event, title, start: startDateTime, end: endDateTime }
        : event
    );

    setEvents(updatedEvents);
    setNewEventData({
      title: '',
      startDate: null,
      startTime: '',
      endTime: '',
      recurrence: 'none',
      recurrenceEndDate: null,
      id: null,
    });
    setModalOpen(false);
  };

  return (
    <div className="schedule-page">
      <h1 className="schedule-title">Team Schedule</h1>
      <div className="calendar-container">
        <Calendar
          localizer={localizer}
          events={events}
          selectable
          defaultView="month"
          views={['month', 'week', 'day', 'agenda']}
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          style={{ height: 600 }}
          className="calendar"
          eventPropGetter={(event) => ({
            style: {
              backgroundColor: '#007bff',
              color: '#fff',
              borderRadius: '4px',
              border: 'none',
            },
          })}
        />
      </div>

      {/* Modal for adding/editing event */}
      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setErrorMessage('');
        }}
        onSubmit={newEventData.id ? handleUpdateEvent : handleAddEvent}
        title={newEventData.id ? 'Edit Event' : 'Add Event'}
      >
        {errorMessage && <p className="error-message">{errorMessage}</p>}
        <label>
          Event Title:
          <input
            type="text"
            value={newEventData.title}
            onChange={(e) =>
              setNewEventData({ ...newEventData, title: e.target.value })
            }
          />
        </label>
        <label>
          Start Time:
          <input
            type="time"
            value={newEventData.startTime}
            onChange={(e) =>
              setNewEventData({ ...newEventData, startTime: e.target.value })
            }
          />
        </label>
        <label>
          End Time:
          <input
            type="time"
            value={newEventData.endTime}
            onChange={(e) =>
              setNewEventData({ ...newEventData, endTime: e.target.value })
            }
          />
        </label>
        {!newEventData.id && ( // Only show recurrence options when adding a new event
          <>
            <label>
              Recurrence:
              <select
                value={newEventData.recurrence}
                onChange={(e) =>
                  setNewEventData({ ...newEventData, recurrence: e.target.value })
                }
              >
                <option value="none">None</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
            {newEventData.recurrence !== 'none' && (
              <label>
                Recurrence End Date:
                <input
                  type="date"
                  value={
                    newEventData.recurrenceEndDate
                      ? moment(newEventData.recurrenceEndDate).format('YYYY-MM-DD')
                      : ''
                  }
                  onChange={(e) =>
                    setNewEventData({
                      ...newEventData,
                      recurrenceEndDate: new Date(e.target.value),
                    })
                  }
                />
              </label>
            )}
          </>
        )}
      </Modal>

      {/* Modal for event details */}
      {selectedEvent && (
        <Modal
          isOpen={eventDetailsOpen}
          onClose={() => {
            setEventDetailsOpen(false);
            setSelectedEvent(null);
          }}
          onSubmit={() => {}}
          title="Event Details"
        >
          <p>
            <strong>Title:</strong> {selectedEvent.title}
          </p>
          <p>
            <strong>Start:</strong>{' '}
            {moment(selectedEvent.start).format('MMMM Do YYYY, h:mm A')}
          </p>
          <p>
            <strong>End:</strong>{' '}
            {moment(selectedEvent.end).format('MMMM Do YYYY, h:mm A')}
          </p>
          <div className="modal-actions">
            <button
              className="modal-button"
              onClick={() => {
                setEventDetailsOpen(false);
                setSelectedEvent(null);
              }}
            >
              Close
            </button>
            <button className="modal-button" onClick={handleEditEvent}>
              Edit
            </button>
            <button className="modal-button" onClick={handleDeleteEvent}>
              Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Schedule;
