// Schedule.js
import React, { useState } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import './Schedule.css';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = momentLocalizer(moment);

const Schedule = () => {
  const [events, setEvents] = useState([]);

  const handleSelectSlot = ({ start, end }) => {
    const title = window.prompt('Enter Event Title');
    if (title) {
      setEvents([...events, { start, end, title }]);
    }
  };

  const handleSelectEvent = (event) => {
    if (window.confirm(`Delete event '${event.title}'?`)) {
      setEvents(events.filter((e) => e !== event));
    }
  };

  return (
    <div className="schedule-page">
      <Calendar
        localizer={localizer}
        events={events}
        selectable
        defaultView="week"
        onSelectSlot={handleSelectSlot}
        onSelectEvent={handleSelectEvent}
        style={{ height: 600 }}
      />
    </div>
  );
};

export default Schedule;
