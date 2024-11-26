import React, { useState } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
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
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

const Schedule = () => {
  const [events, setEvents] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [eventToAdd, setEventToAdd] = useState(null);
  const [eventToDelete, setEventToDelete] = useState(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const handleSelectSlot = ({ start, end }) => {
    setEventToAdd({ start, end });
    setModalOpen(true);
  };

  const handleAddEvent = () => {
    if (newEventTitle) {
      setEvents([...events, { ...eventToAdd, title: newEventTitle }]);
      setNewEventTitle('');
      setEventToAdd(null);
      setModalOpen(false);
    }
  };

  const handleSelectEvent = (event) => {
    setEventToDelete(event);
    setConfirmDeleteOpen(true);
  };

  const handleDeleteEvent = () => {
    setEvents(events.filter((e) => e !== eventToDelete));
    setEventToDelete(null);
    setConfirmDeleteOpen(false);
  };

  return (
    <div className="schedule-page">
      <h1 className="schedule-title">Team Schedule</h1>
      <div className="calendar-container">
        <Calendar
          localizer={localizer}
          events={events}
          selectable
          defaultView="week"
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

      {/* Modal for adding event */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleAddEvent}
        title="Add Event"
      >
        <input
          type="text"
          placeholder="Event Title"
          value={newEventTitle}
          onChange={(e) => setNewEventTitle(e.target.value)}
        />
      </Modal>

      {/* Modal for confirming delete */}
      <Modal
        isOpen={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onSubmit={handleDeleteEvent}
        title="Delete Event"
      >
        <p>Are you sure you want to delete event '{eventToDelete?.title}'?</p>
      </Modal>
    </div>
  );
};

export default Schedule;
