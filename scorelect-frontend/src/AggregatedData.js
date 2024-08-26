import React from 'react';
import './AggregatedData.css';

const AggregatedData = ({ data }) => {
  return (
    <div className="aggregated-data">
      {Object.keys(data).map((team) => (
        <div key={team} className="team-data">
          <h3>{team}</h3>
          <div className="team-stats">
            {Object.keys(data[team]).map((action) => (
              <div key={action} className="action-data">
                <span className="action-name">{action}:</span>
                <span className="action-count">{data[team][action]}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default AggregatedData;
