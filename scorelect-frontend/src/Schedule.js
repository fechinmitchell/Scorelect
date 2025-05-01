// Schedule.js - Complete file with email functionality
import React, { useState, useEffect } from 'react';
import { Calendar, momentLocalizer, Views } from 'react-big-calendar';
import moment from 'moment';
import { RRule } from 'rrule';
import { v4 as uuidv4 } from 'uuid';
import Swal from 'sweetalert2';
import { Email } from '@mui/icons-material';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './Schedule.css';

// Initialize moment localizer
const localizer = momentLocalizer(moment);

/**
 * Modal Component
 * Modern, animated modal dialog
 */
const Modal = ({ isOpen, title, children, actions, onClose }) => {
  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (onClose) onClose();
  };

  const handleContainerClick = (e) => {
    e.stopPropagation();
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-container" onClick={handleContainerClick}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close-button" onClick={onClose}>×</button>
        </div>
        <div className="modal-content">{children}</div>
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>
  );
};

/**
 * AgendaItem Component
 * Individual event item in the agenda view
 */
const AgendaItem = ({ event }) => {
  const eventDate = moment(event.start).format('ddd, MMM D');
  const startTime = moment(event.start).format('h:mm A');
  const endTime = moment(event.end).format('h:mm A');
  
  return (
    <div className="agenda-item">
      <div className="agenda-item-date">
        <span className="agenda-date">{eventDate}</span>
        <span className="agenda-time">{startTime} - {endTime}</span>
      </div>
      <h4 className="agenda-item-title">{event.title}</h4>
    </div>
  );
};

/**
 * Agenda Component
 * Displays upcoming events in a modern card layout
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
      <div className="agenda-header">
        <h3>Upcoming Events</h3>
        <span className="agenda-date-label">{moment(selectedDate).format('MMMM D, YYYY')}</span>
      </div>
      <div className="agenda-content">
        {sortedEvents.length === 0 ? (
          <div className="no-events">
            <div className="no-events-icon">📅</div>
            <p>No upcoming events</p>
            <span>Click on the calendar to add an event</span>
          </div>
        ) : (
          <div className="agenda-list">
            {sortedEvents.map(event => (
              <AgendaItem key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * ScheduleEmailDialog Component
 * Modal for selecting date range and players to email the schedule
 */
const ScheduleEmailDialog = ({ 
  isOpen, 
  onClose, 
  events, 
  players, 
  currentDate 
}) => {
  // Initialize state
  const [selectedRange, setSelectedRange] = useState('week');
  const [customStartDate, setCustomStartDate] = useState(moment(currentDate).format('YYYY-MM-DD'));
  const [customEndDate, setCustomEndDate] = useState(moment(currentDate).add(1, 'month').format('YYYY-MM-DD'));
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [showNoEventsWarning, setShowNoEventsWarning] = useState(false);
  const [showNoPlayersWarning, setShowNoPlayersWarning] = useState(false);

  // Filter events based on selected date range
  const getFilteredEvents = () => {
    let start = new Date();
    let end;

    if (selectedRange === 'week') {
      end = new Date();
      end.setDate(end.getDate() + 7);
    } else if (selectedRange === 'month') {
      end = new Date();
      end.setMonth(end.getMonth() + 1);
    } else if (selectedRange === 'custom') {
      start = new Date(customStartDate);
      end = new Date(customEndDate);
    }

    return events.filter(event => {
      const eventDate = new Date(event.start);
      return eventDate >= start && eventDate <= end;
    });
  };
  
  // Handle player selection change
  const handlePlayerSelectionChange = (playerId) => {
    if (selectedPlayers.includes(playerId)) {
      setSelectedPlayers(selectedPlayers.filter(id => id !== playerId));
    } else {
      setSelectedPlayers([...selectedPlayers, playerId]);
    }
  };
  
  // Handle select all players
  const handleSelectAllPlayers = () => {
    if (selectAll) {
      setSelectedPlayers([]);
    } else {
      setSelectedPlayers(players.map(player => player.id));
    }
    setSelectAll(!selectAll);
  };
  
  // Handle range selection change
  const handleRangeChange = (event) => {
    setSelectedRange(event.target.value);
  };
  
  // Handle sending emails
  const handleSendEmails = () => {
    const filteredEvents = getFilteredEvents();
    
    // Check if there are any events in the selected range
    if (filteredEvents.length === 0) {
      setShowNoEventsWarning(true);
      return;
    }
    
    // Check if any players are selected
    if (selectedPlayers.length === 0) {
      setShowNoPlayersWarning(true);
      return;
    }
    
    // Format events for email
    const emailBody = formatEventsForEmail(filteredEvents);
    
    // Get selected player emails
    const selectedEmails = players
      .filter(player => selectedPlayers.includes(player.id))
      .map(player => player.email);
    
    // Generate subject line based on date range
    let subject = 'Team Schedule: ';
    if (selectedRange === 'week') {
      subject += 'Upcoming Week';
    } else if (selectedRange === 'month') {
      subject += 'Upcoming Month';
    } else {
      subject += `${moment(customStartDate).format('MMM D')} - ${moment(customEndDate).format('MMM D, YYYY')}`;
    }
    
    // Create mailto URL
    const mailtoUrl = `mailto:?bcc=${selectedEmails.join(',')}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;
    
    // Open email client
    window.location.href = mailtoUrl;
    
    // Close the dialog
    onClose();
  };
  
  // Format events for email body
  const formatEventsForEmail = (events) => {
    const sortedEvents = [...events].sort((a, b) => new Date(a.start) - new Date(b.start));
    
    let emailBody = 'Team Schedule\n\n';
    
    sortedEvents.forEach(event => {
      const eventDate = moment(event.start).format('dddd, MMMM D, YYYY');
      const startTime = moment(event.start).format('h:mm A');
      const endTime = moment(event.end).format('h:mm A');
      
      emailBody += `${eventDate}\n`;
      emailBody += `${startTime} - ${endTime}\n`;
      emailBody += `${event.title}\n\n`;
    });
    
    emailBody += '\nThis schedule is subject to change. Please check the team app for the most up-to-date information.';
    
    return emailBody;
  };
  
  return (
    <Modal
      isOpen={isOpen}
      title="Email Schedule to Players"
      onClose={onClose}
      actions={
        <>
          <button
            className="modal-button cancel-button"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="modal-button save-button"
            onClick={handleSendEmails}
          >
            Send Emails
          </button>
        </>
      }
    >
      <div className="email-schedule-form">
        <div className="form-section">
          <h3 className="section-title">Select Date Range</h3>
          <div className="date-range-options">
            <div className="radio-option">
              <input
                type="radio"
                id="week"
                name="dateRange"
                value="week"
                checked={selectedRange === 'week'}
                onChange={handleRangeChange}
              />
              <label htmlFor="week">Next Week</label>
            </div>
            
            <div className="radio-option">
              <input
                type="radio"
                id="month"
                name="dateRange"
                value="month"
                checked={selectedRange === 'month'}
                onChange={handleRangeChange}
              />
              <label htmlFor="month">Next Month</label>
            </div>
            
            <div className="radio-option">
              <input
                type="radio"
                id="custom"
                name="dateRange"
                value="custom"
                checked={selectedRange === 'custom'}
                onChange={handleRangeChange}
              />
              <label htmlFor="custom">Custom Range</label>
            </div>
          </div>
          
          {selectedRange === 'custom' && (
            <div className="custom-date-range">
              <div className="form-group">
                <label htmlFor="start-date">Start Date</label>
                <input
                  id="start-date"
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  min={moment().format('YYYY-MM-DD')}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="end-date">End Date</label>
                <input
                  id="end-date"
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  min={customStartDate}
                />
              </div>
            </div>
          )}
          
          {showNoEventsWarning && (
            <div className="warning-message">
              No events found in the selected date range.
            </div>
          )}
        </div>
        
        <div className="form-section">
          <h3 className="section-title">Select Players</h3>
          {players.length > 0 ? (
            <>
              <div className="select-all-option">
                <input
                  type="checkbox"
                  id="select-all"
                  checked={selectAll}
                  onChange={handleSelectAllPlayers}
                />
                <label htmlFor="select-all">Select All Players</label>
              </div>
              
              <div className="players-list">
                {players.map((player) => (
                  <div key={player.id} className="player-option">
                    <input
                      type="checkbox"
                      id={`player-${player.id}`}
                      checked={selectedPlayers.includes(player.id)}
                      onChange={() => handlePlayerSelectionChange(player.id)}
                    />
                    <label htmlFor={`player-${player.id}`}>
                      {player.name} ({player.position})
                    </label>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="no-players-message">
              No players available. Please add players in the Team Roster.
            </div>
          )}
          
          {showNoPlayersWarning && (
            <div className="warning-message">
              Please select at least one player.
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

/**
 * Schedule Component
 * Main component managing the calendar, events, and data persistence.
 */
const Schedule = () => {
  // Get or generate unique user ID
  const getUserId = () => {
    let userId = localStorage.getItem('userId');
    if (!userId) {
      userId = uuidv4();
      localStorage.setItem('userId', userId);
    }
    return userId;
  };
  
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
  const [savedFeedback, setSavedFeedback] = useState(false);
  
  // State for email functionality
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [players, setPlayers] = useState([]);

  // Load user data from localStorage when component mounts
  useEffect(() => {
    const data = getUserData(userId);
    setUserData(data);
  }, [userId]);

  // Load players from localStorage
  useEffect(() => {
    const loadPlayers = () => {
      const storedPlayers = localStorage.getItem(`players_${userId}`);
      if (storedPlayers) {
        setPlayers(JSON.parse(storedPlayers));
      }
    };
    
    loadPlayers();
    // Set up an interval to check for player changes
    const playersInterval = setInterval(loadPlayers, 5000);
    
    return () => clearInterval(playersInterval);
  }, [userId]);

  // Show save feedback for 3 seconds
  useEffect(() => {
    if (savedFeedback) {
      const timer = setTimeout(() => {
        setSavedFeedback(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [savedFeedback]);

  // Storage utility functions
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

  // Handle saving the schedule
  const handleSaveSchedule = () => {
    try {
      saveUserData(userId, userData);
      setSavedFeedback(true);
    } catch (error) {
      console.error('Error saving schedule:', error);
      Swal.fire({
        title: 'Error',
        text: 'Failed to save your schedule.',
        icon: 'error',
        confirmButtonText: 'OK',
        customClass: {
          popup: 'modern-swal-popup',
          title: 'modern-swal-title',
          confirmButton: 'modern-swal-confirm-button',
        }
      });
    }
  };

  // Handle selecting a time slot
  const handleSelectSlot = (slotInfo) => {
    console.log('Slot selected:', slotInfo); // Debug log
    
    // Initialize with date and current hour, rounded to nearest half hour
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const roundedMinute = currentMinute >= 30 ? 30 : 0;
    
    // Default end time is 1 hour after start
    const endHour = roundedMinute === 30 ? currentHour + 1 : currentHour;
    const endMinute = roundedMinute === 30 ? 0 : 30;

    setNewEventData({
      title: '',
      startDate: slotInfo.start,
      startTime: `${currentHour.toString().padStart(2, '0')}:${roundedMinute.toString().padStart(2, '0')}`,
      endTime: `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`,
      recurrence: 'none',
      recurrenceEndDate: null,
      id: null,
    });
    
    setErrorMessage('');
    setModalOpen(true);
  };

  // Handle email dialog
  const handleOpenEmailDialog = () => {
    setEmailDialogOpen(true);
  };

  const handleCloseEmailDialog = () => {
    setEmailDialogOpen(false);
  };

  // Handle closing modals
  const handleCloseModal = () => {
    setModalOpen(false);
    setErrorMessage('');
  };

  const handleCloseEventDetailsModal = () => {
    setEventDetailsOpen(false);
    setSelectedEvent(null);
  };

  // Handle adding a new event
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
      setErrorMessage('Please select an end date for recurring events.');
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
        id: uuidv4(),
      }));
    } else {
      newEvents = [
        {
          start: startDateTime,
          end: endDateTime,
          title,
          id: uuidv4(),
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
    
    Swal.fire({
      title: 'Event Added',
      text: 'Your event has been added successfully!',
      icon: 'success',
      timer: 2000,
      showConfirmButton: false,
      customClass: {
        popup: 'modern-swal-popup',
        title: 'modern-swal-title',
      }
    });
  };

  // Handle selecting an existing event
  const handleSelectEvent = event => {
    setSelectedEvent(event);
    setEventDetailsOpen(true);
  };

  // Handle deleting an event
  const handleDeleteEvent = () => {
    Swal.fire({
      title: 'Delete Event',
      text: 'Are you sure you want to delete this event?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      customClass: {
        popup: 'modern-swal-popup',
        title: 'modern-swal-title',
        confirmButton: 'modern-swal-delete-button',
        cancelButton: 'modern-swal-cancel-button',
      }
    }).then((result) => {
      if (result.isConfirmed) {
        setUserData(prevData => ({
          ...prevData,
          events: prevData.events.filter(e => e.id !== selectedEvent.id),
        }));
        setSelectedEvent(null);
        setEventDetailsOpen(false);
        
        Swal.fire({
          title: 'Deleted',
          text: 'Your event has been deleted.',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false,
          customClass: {
            popup: 'modern-swal-popup',
            title: 'modern-swal-title',
          }
        });
      }
    });
  };

  // Handle editing an existing event
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

  // Handle updating an existing event
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
    
    Swal.fire({
      title: 'Updated',
      text: 'Your event has been updated.',
      icon: 'success',
      timer: 2000,
      showConfirmButton: false,
      customClass: {
        popup: 'modern-swal-popup',
        title: 'modern-swal-title',
      }
    });
  };

  // Format events for the agenda
  const getAgendaEvents = () => {
    return userData.events.map(event => ({
      ...event,
      start: event.start,
      end: event.end,
    }));
  };

  // Handle resetting the schedule
  const handleResetSchedule = () => {
    Swal.fire({
      title: 'Reset Schedule',
      text: 'Are you sure you want to reset your schedule? This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Reset',
      cancelButtonText: 'Cancel',
      customClass: {
        popup: 'modern-swal-popup',
        title: 'modern-swal-title',
        confirmButton: 'modern-swal-delete-button',
        cancelButton: 'modern-swal-cancel-button',
      }
    }).then((result) => {
      if (result.isConfirmed) {
        setUserData({ events: [], agendaNotes: "" });
        clearUserData(userId);
        
        Swal.fire({
          title: 'Reset Complete',
          text: 'Your schedule has been reset.',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false,
          customClass: {
            popup: 'modern-swal-popup',
            title: 'modern-swal-title',
          }
        });
      }
    });
  };

  // Custom event styling for the calendar
  const eventStyleGetter = (event) => {
    const eventTime = new Date(event.start).getHours();
    
    // Different colors based on time of day
    let backgroundColor;
    if (eventTime < 12) {
      backgroundColor = '#4361ee'; // Morning - blue
    } else if (eventTime < 17) {
      backgroundColor = '#3a0ca3'; // Afternoon - purple
    } else {
      backgroundColor = '#7209b7'; // Evening - dark purple
    }
    
    return {
      style: {
        backgroundColor,
        borderRadius: '8px',
        opacity: 0.95,
        color: '#fff',
        border: 'none',
        fontWeight: '500',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
      }
    };
  };

  // Custom date header format
  const formats = {
    dateFormat: 'D',
    dayFormat: 'ddd D',
    monthHeaderFormat: 'MMMM YYYY',
    weekdayFormat: 'dddd',
    dayHeaderFormat: 'dddd, MMMM D, YYYY',
    dayRangeHeaderFormat: ({ start, end }, culture, localizer) =>
      localizer.format(start, 'MMMM D', culture) + ' – ' + 
      localizer.format(end, 'D, YYYY', culture),
  };

  return (
    <div className="schedule-page">
      <header className="app-header">
        <h1 className="app-title">Team Schedule</h1>
        {savedFeedback && <div className="save-feedback">Changes saved successfully!</div>}
      </header>
      
      <div className="schedule-container">
        {/* Calendar Section */}
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
            onNavigate={date => setCurrentDate(date)}
            onSelectSlot={handleSelectSlot}
            onSelectEvent={handleSelectEvent}
            eventPropGetter={eventStyleGetter}
            formats={formats}
          />
        </div>

        {/* Sidebar - using sidebar-schedule to avoid conflicts */}
        <div className="sidebar-schedule">
          <Agenda events={getAgendaEvents()} selectedDate={currentDate} />
          
          <div className="sidebar-actions">
            <button
              className="action-button save-button"
              onClick={handleSaveSchedule}
              title="Save your schedule"
            >
              <span className="button-icon">💾</span>
              <span className="button-text">Save Schedule</span>
            </button>
            
            <button
              className="action-button reset-button"
              onClick={handleResetSchedule}
              title="Reset your schedule"
            >
              <span className="button-icon">🗑️</span>
              <span className="button-text">Reset Schedule</span>
            </button>
          </div>
          
          <button
            className="email-schedule-button"
            onClick={handleOpenEmailDialog}
            title="Email schedule to players"
          >
            <span className="email-icon">📧</span>
            <span>Email Schedule to Players</span>
          </button>
        </div>
      </div>

      {/* Add/Edit Event Modal */}
      <Modal
        isOpen={modalOpen}
        title={newEventData.id ? 'Edit Event' : 'Add New Event'}
        onClose={handleCloseModal}
        actions={
          <>
            <button
              className="modal-button cancel-button"
              onClick={handleCloseModal}
            >
              Cancel
            </button>
            <button
              className="modal-button save-button"
              onClick={newEventData.id ? handleUpdateEvent : handleAddEvent}
            >
              {newEventData.id ? 'Update Event' : 'Add Event'}
            </button>
          </>
        }
      >
        {errorMessage && <div className="error-message">{errorMessage}</div>}
        
        <div className="form-group">
          <label htmlFor="event-title">Event Title</label>
          <input
            id="event-title"
            type="text"
            value={newEventData.title}
            onChange={e => setNewEventData({ ...newEventData, title: e.target.value })}
            placeholder="Enter event title"
            autoFocus
          />
        </div>
        
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="start-time">Start Time</label>
            <input
              id="start-time"
              type="time"
              value={newEventData.startTime}
              onChange={e => setNewEventData({ ...newEventData, startTime: e.target.value })}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="end-time">End Time</label>
            <input
              id="end-time"
              type="time"
              value={newEventData.endTime}
              onChange={e => setNewEventData({ ...newEventData, endTime: e.target.value })}
            />
          </div>
        </div>
        
        {!newEventData.id && (
          <>
            <div className="form-group">
              <label htmlFor="recurrence">Recurrence</label>
              <select
                id="recurrence"
                value={newEventData.recurrence}
                onChange={e => setNewEventData({ ...newEventData, recurrence: e.target.value })}
              >
                <option value="none">None</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            
            {newEventData.recurrence !== 'none' && (
              <div className="form-group">
                <label htmlFor="recurrence-end">Recurrence End Date</label>
                <input
                  id="recurrence-end"
                  type="date"
                  value={
                    newEventData.recurrenceEndDate
                      ? moment(newEventData.recurrenceEndDate).format('YYYY-MM-DD')
                      : ''
                  }
                  onChange={e => setNewEventData({
                    ...newEventData,
                    recurrenceEndDate: new Date(e.target.value),
                  })}
                  min={moment(newEventData.startDate).format('YYYY-MM-DD')}
                />
              </div>
            )}
          </>
        )}
      </Modal>

      {/* Event Details Modal */}
      {selectedEvent && (
        <Modal
          isOpen={eventDetailsOpen}
          title="Event Details"
          onClose={handleCloseEventDetailsModal}
          actions={
            <>
              <button
                className="modal-button delete-button"
                onClick={handleDeleteEvent}
              >
                Delete
              </button>
              <button
                className="modal-button edit-button"
                onClick={handleEditEvent}
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
              <span className="detail-value">{moment(selectedEvent.start).format('dddd, MMMM D, YYYY')}</span>
            </div>
            
            <div className="event-detail-row">
              <span className="detail-label">Time:</span>
              <span className="detail-value">
                {moment(selectedEvent.start).format('h:mm A')} - {moment(selectedEvent.end).format('h:mm A')}
              </span>
            </div>
            
            <div className="event-detail-row">
              <span className="detail-label">Duration:</span>
              <span className="detail-value">
                {moment.duration(moment(selectedEvent.end).diff(selectedEvent.start)).asHours().toFixed(1)} hours
              </span>
            </div>
          </div>
        </Modal>
      )}
      
      {/* Email Schedule Dialog */}
      <ScheduleEmailDialog
        isOpen={emailDialogOpen}
        onClose={handleCloseEmailDialog}
        events={userData.events}
        players={players}
        currentDate={currentDate}
      />
    </div>
  );
};

export default Schedule;