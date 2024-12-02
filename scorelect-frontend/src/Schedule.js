// Schedule.js
import React, { useState, useEffect } from 'react';
import { Calendar, momentLocalizer, Views } from 'react-big-calendar';
import moment from 'moment';
import { RRule } from 'rrule';
import { v4 as uuidv4 } from 'uuid'; // UUID generator
import Swal from 'sweetalert2'; // For user-friendly alerts
import './Schedule.css';
import 'react-big-calendar/lib/css/react-big-calendar.css';

// Initialize moment localizer
const localizer = momentLocalizer(moment);

/**
 * Modal Component
 * Handles displaying modal dialogs.
 */
const Modal = ({ isOpen, title, children, actions }) => {
  if (!isOpen) return null;

  return (
    <div className="schedule-modal-overlay">
      <div className="schedule-modal">
        <h2>{title}</h2>
        <div className="schedule-modal-content">{children}</div>
        {actions && <div className="schedule-modal-actions">{actions}</div>}
      </div>
    </div>
  );
};

/**
 * Agenda Component
 * Displays a list of events for the selected date, including the event date.
 */
const Agenda = ({ events, selectedDate }) => {
  // Filter events based on selected date and after
  const filteredEvents = events.filter(event => {
    const eventDate = moment(event.start).startOf('day');
    const selected = moment(selectedDate).startOf('day');
    return eventDate.isSame(selected, 'day') || eventDate.isAfter(selected, 'day');
  });

  // Sort events chronologically
  const sortedEvents = filteredEvents.sort((a, b) => a.start - b.start);

  return (
    <div className="agenda-container">
      <h3 className="agenda-title">Agenda</h3>
      {sortedEvents.length === 0 ? (
        <p className="no-events">No events for this day.</p>
      ) : (
        <ul className="agenda-list">
          {sortedEvents.map(event => (
            <li key={event.id} className="agenda-item">
              {/* Display Event Date */}
              <span className="event-date">
                {moment(event.start).format('MMMM Do YYYY')}
              </span>
              <span className="event-time">
                {moment(event.start).format('HH:mm')} - {moment(event.end).format('HH:mm')}
              </span>
              <span className="event-title">{event.title}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/**
 * Schedule Component
 * Main component managing the calendar, events, and data persistence.
 */
const Schedule = () => {
  /**
   * Generates or retrieves a unique user ID from localStorage.
   * This ensures each user has their own unique schedule.
   */
  const getUserId = () => {
    let userId = localStorage.getItem('userId');
    if (!userId) {
      userId = uuidv4();
      localStorage.setItem('userId', userId);
      console.log('Generated new userId:', userId);
    } else {
      console.log('Retrieved existing userId:', userId);
    }
    return userId;
  };

  // Retrieve or generate userId
  const userId = getUserId();

  // Initialize state variables
  const [userData, setUserData] = useState({ events: [], agendaNotes: "" });
  const [modalOpen, setModalOpen] = useState(false);
  const [newEventData, setNewEventData] = useState({
    title: '',
    startDate: null,
    startTime: '',
    endTime: '',
    recurrence: 'none',
    recurrenceEndDate: null,
    id: null,
  });
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventDetailsOpen, setEventDetailsOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());

  // State for reset confirmation modal
  const [showResetModal, setShowResetModal] = useState(false);

  /**
   * Storage Utility Functions
   * Handles saving, retrieving, and clearing user data in localStorage.
   */
  const saveUserData = (userId, data) => {
    localStorage.setItem(`userData_${userId}`, JSON.stringify(data));
  };

  const getUserData = (userId) => {
    const data = localStorage.getItem(`userData_${userId}`);
    return data ? JSON.parse(data) : { events: [], agendaNotes: "" };
  };

  const clearUserData = (userId) => {
    localStorage.removeItem(`userData_${userId}`);
  };

  /**
   * Load user data from localStorage when component mounts.
   */
  useEffect(() => {
    const data = getUserData(userId);
    setUserData(data);
    console.log('User data loaded:', data);
  }, [userId]);

  /**
   * Handles saving the schedule to localStorage.
   */
  const handleSaveSchedule = () => {
    console.log('Attempting to save schedule for userId:', userId);
    if (!userId) {
      Swal.fire('Error', 'User not authenticated.', 'error');
      return;
    }

    try {
      saveUserData(userId, userData);
      console.log('Schedule saved:', userData);
      Swal.fire('Success', 'Your schedule has been saved successfully!', 'success');
    } catch (error) {
      console.error('Error saving schedule:', error);
      Swal.fire('Error', 'Failed to save your schedule.', 'error');
    }
  };

  /**
   * Handles selecting a time slot to add a new event.
   */
  const handleSelectSlot = ({ start }) => {
    setNewEventData({
      title: '',
      startDate: start,
      startTime: '',
      endTime: '',
      recurrence: 'none',
      recurrenceEndDate: null,
      id: null,
    });
    setErrorMessage('');
    setModalOpen(true);
  };

  /**
   * Handles adding a new event to the schedule.
   */
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

      newEvents = dates.map(date => ({
        start: date,
        end: new Date(date.getTime() + (endDateTime - startDateTime)),
        title,
        id: uuidv4(), // Unique ID using UUID
      }));
    } else {
      newEvents = [
        {
          start: startDateTime,
          end: endDateTime,
          title,
          id: uuidv4(), // Unique ID using UUID
        },
      ];
    }

    setUserData(prevData => ({
      ...prevData,
      events: [...prevData.events, ...newEvents],
    }));

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
    Swal.fire('Success', 'Event added successfully!', 'success');
  };

  /**
   * Handles selecting an existing event to view details.
   */
  const handleSelectEvent = event => {
    setSelectedEvent(event);
    setEventDetailsOpen(true);
  };

  /**
   * Handles deleting an event from the schedule.
   */
  const handleDeleteEvent = () => {
    setUserData(prevData => ({
      ...prevData,
      events: prevData.events.filter(e => e.id !== selectedEvent.id),
    }));
    setSelectedEvent(null);
    setEventDetailsOpen(false);
    Swal.fire('Deleted!', 'The event has been deleted.', 'success');
  };

  /**
   * Handles editing an existing event.
   */
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

  /**
   * Handles updating an existing event after editing.
   */
  const handleUpdateEvent = () => {
    const { title, startDate, startTime, endTime, id } = newEventData;

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

    const updatedEvents = userData.events.map(event =>
      event.id === id
        ? { ...event, title, start: startDateTime, end: endDateTime }
        : event
    );

    setUserData(prevData => ({
      ...prevData,
      events: updatedEvents,
    }));

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
    Swal.fire('Success', 'Event updated successfully!', 'success');
  };

  /**
   * Formats events for the Agenda component.
   */
  const getAgendaEvents = () => {
    return userData.events.map(event => ({
      ...event,
      start: event.start,
      end: event.end,
    }));
  };

  /**
   * Confirms resetting the schedule.
   */
  const confirmReset = () => {
    setUserData({ events: [], agendaNotes: "" });
    clearUserData(userId);
    setShowResetModal(false);
    Swal.fire('Reset!', 'Your schedule has been reset.', 'success');
  };

  /**
   * Cancels the reset action.
   */
  const cancelReset = () => {
    setShowResetModal(false);
  };

  /**
   * Initiates the reset schedule process with confirmation.
   */
  const handleResetSchedule = () => {
    Swal.fire({
      title: 'Are you sure?',
      text: 'Do you want to reset your schedule? This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, reset it!',
      cancelButtonText: 'Cancel',
    }).then((result) => {
      if (result.isConfirmed) {
        confirmReset();
      }
    });
  };

  return (
    <div className="schedule-page">
      <h1 className="schedule-title">Team Schedule</h1>
      <div className="schedule-container">
        {/* Calendar Section */}
        <div className="calendar-container">
          <Calendar
            localizer={localizer}
            events={userData.events}
            selectable
            longPressThreshold={10}
            defaultView={Views.MONTH}
            views={['month', 'week', 'day', 'agenda']}
            date={currentDate}
            onNavigate={date => setCurrentDate(date)}
            onSelectSlot={handleSelectSlot}
            onSelectEvent={handleSelectEvent}
            style={{ height: 'calc(100vh - 200px)', width: '100%' }}
            className="calendar"
            eventPropGetter={event => ({
              style: {
                backgroundColor: '#007bff',
                color: '#fff',
                borderRadius: '4px',
                border: 'none',
              },
            })}
            formats={{
              agendaDateFormat: (date, culture, localizer) =>
                localizer.format(date, 'MMM DD, YYYY'),
              agendaTimeFormat: 'hh:mm A',
            }}
          />
        </div>

        {/* Agenda Sidebar */}
        <div className="agenda-and-reset">
          <Agenda events={getAgendaEvents()} selectedDate={currentDate} />
          <div className="button-group">
            {/* "Save Schedule" button */}
            <button
              className="save-schedule-button"
              onClick={handleSaveSchedule}
              aria-label="Save your schedule"
            >
              Save Schedule
            </button>
            {/* "Reset Schedule" button */}
            <button
              className="reset-button"
              onClick={handleResetSchedule}
              aria-label="Reset your schedule"
            >
              Reset Schedule
            </button>
          </div>
        </div>
      </div>

      {/* Modal for adding/editing event */}
      <Modal
        isOpen={modalOpen}
        title={newEventData.id ? 'Edit Event' : 'Add Event'}
        actions={
          <>
            <button
              className="schedule-modal-button cancel-button"
              onClick={() => {
                setModalOpen(false);
                setErrorMessage('');
              }}
            >
              Cancel
            </button>
            <button
              className="schedule-modal-button modal-save-button"
              onClick={newEventData.id ? handleUpdateEvent : handleAddEvent}
            >
              Save
            </button>
          </>
        }
      >
        {errorMessage && <p className="error-message">{errorMessage}</p>}
        <label>
          Event Title:
          <input
            type="text"
            value={newEventData.title}
            onChange={e =>
              setNewEventData({ ...newEventData, title: e.target.value })
            }
            placeholder="Enter event title"
          />
        </label>
        <label>
          Start Time:
          <input
            type="time"
            value={newEventData.startTime}
            onChange={e =>
              setNewEventData({ ...newEventData, startTime: e.target.value })
            }
          />
        </label>
        <label>
          End Time:
          <input
            type="time"
            value={newEventData.endTime}
            onChange={e =>
              setNewEventData({ ...newEventData, endTime: e.target.value })
            }
          />
        </label>
        {!newEventData.id && (
          // Only show recurrence options when adding a new event
          <>
            <label>
              Recurrence:
              <select
                value={newEventData.recurrence}
                onChange={e =>
                  setNewEventData({
                    ...newEventData,
                    recurrence: e.target.value,
                  })
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
                      ? moment(newEventData.recurrenceEndDate).format(
                          'YYYY-MM-DD'
                        )
                      : ''
                  }
                  onChange={e =>
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
          title="Event Details"
          actions={
            <>
              <button
                className="schedule-modal-button close-button"
                onClick={() => {
                  setEventDetailsOpen(false);
                  setSelectedEvent(null);
                }}
              >
                Close
              </button>
              <button
                className="schedule-modal-button edit-button"
                onClick={handleEditEvent}
              >
                Edit
              </button>
              <button
                className="schedule-modal-button delete-button"
                onClick={handleDeleteEvent}
              >
                Delete
              </button>
            </>
          }
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
        </Modal>
      )}

      {/* Modal for Reset Confirmation */}
      <Modal
        isOpen={showResetModal}
        title="Reset Schedule"
        actions={
          <>
            <button
              className="schedule-modal-button cancel-button"
              onClick={cancelReset}
            >
              No
            </button>
            <button
              className="schedule-modal-button confirm-button"
              onClick={confirmReset}
            >
              Yes
            </button>
          </>
        }
      >
        <p>Are you sure you want to reset your schedule? This action cannot be undone.</p>
      </Modal>
    </div>
  );
};

export default Schedule;
