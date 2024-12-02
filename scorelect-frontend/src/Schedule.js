// Schedule.js
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Calendar, momentLocalizer, Views } from 'react-big-calendar';
import moment from 'moment';
import { RRule } from 'rrule';
import './Schedule.css';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { saveUserData, getUserData, clearUserData } from './storage'; // Import utility functions
import Swal from 'sweetalert2'; // For user-friendly alerts

const localizer = momentLocalizer(moment);

// Modal Component
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

// Agenda Component
const Agenda = ({ events, selectedDate }) => {
  // Filter events based on selected date range
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

const Schedule = ({ userId, userType }) => { // **Added userType as a prop**
  console.log('Schedule Component Props:', { userId, userType }); // Debugging line

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

  // **Added State Variable for Reset Confirmation Modal**
  const [showResetModal, setShowResetModal] = useState(false);

  // Load user data from localStorage on component mount
  useEffect(() => {
    if (userId) {
      const data = getUserData(userId);
      setUserData(data);
    }
  }, [userId]);

  // **Optional: Auto-Save for Premium Users**
  useEffect(() => {
    if (userType === 'premium' && userId) {
      saveUserData(userId, userData);
      console.log('Auto-saved schedule for premium user:', userId);
    }
  }, [userData, userId, userType]);

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
  };

  const handleSelectEvent = event => {
    setSelectedEvent(event);
    setEventDetailsOpen(true);
  };

  const handleDeleteEvent = () => {
    setUserData(prevData => ({
      ...prevData,
      events: prevData.events.filter(e => e.id !== selectedEvent.id),
    }));
    setSelectedEvent(null);
    setEventDetailsOpen(false);
    Swal.fire('Deleted!', 'The event has been deleted.', 'success');
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
  };

  // Helper function to format events for agenda
  const getAgendaEvents = () => {
    return userData.events.map(event => ({
      ...event,
      start: event.start,
      end: event.end,
    }));
  };

  // **Added Functions for Reset Confirmation Modal**

  const confirmReset = () => {
    setUserData({ events: [], agendaNotes: "" });
    clearUserData(userId);
    setShowResetModal(false);
    Swal.fire('Reset!', 'Your schedule has been reset.', 'success');
  };

  const cancelReset = () => {
    setShowResetModal(false);
  };

  // Function to reset the schedule
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

  /**
   * Handles saving the schedule explicitly.
   */
  const handleSaveSchedule = () => {
    if (userType !== 'premium') {
      Swal.fire(
        'Upgrade Required',
        'Please upgrade to a premium account to save your schedule.',
        'warning'
      );
      return;
    }

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
            {userType === 'premium' && (
              <button className="save-schedule-button" onClick={handleSaveSchedule}>
                Save Schedule
              </button>
            )}
            <button className="reset-button" onClick={handleResetSchedule}>
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
              <button className="schedule-modal-button edit-button" onClick={handleEditEvent}>
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

      {/* **Added Reset Confirmation Modal** */}
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

// Define PropTypes for better type checking and to ensure required props are passed
Schedule.propTypes = {
  userId: PropTypes.string.isRequired,
  userType: PropTypes.string.isRequired, // e.g., 'free', 'premium'
};

export default Schedule;
