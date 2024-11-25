// Sessions.js
import React, { useState, useRef } from 'react';
import { Stage, Layer, Line, Circle } from 'react-konva';
import { Html } from 'react-konva-utils';
import html2canvas from 'html2canvas';
import './Sessions.css';

const Sessions = () => {
  const [elements, setElements] = useState([]);
  const [mode, setMode] = useState('cone'); // 'cone' or 'line'
  const stageRef = useRef();
  const [description, setDescription] = useState('');

  const handleClick = (e) => {
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();

    if (mode === 'cone') {
      setElements([
        ...elements,
        {
          type: 'cone',
          x: point.x,
          y: point.y,
          id: elements.length,
        },
      ]);
    } else if (mode === 'line') {
      if (elements.length > 0 && elements[elements.length - 1].type === 'line' && !elements[elements.length - 1].finished) {
        // Add point to existing line
        const updatedElements = elements.slice();
        const line = updatedElements[updatedElements.length - 1];
        line.points = line.points.concat([point.x, point.y]);
        setElements(updatedElements);
      } else {
        // Start a new line
        setElements([
          ...elements,
          {
            type: 'line',
            points: [point.x, point.y],
            id: elements.length,
            finished: false,
          },
        ]);
      }
    }
  };

  const handleMouseUp = () => {
    if (mode === 'line') {
      const updatedElements = elements.slice();
      const line = updatedElements[updatedElements.length - 1];
      line.finished = true;
      setElements(updatedElements);
    }
  };

  const handleDownload = () => {
    html2canvas(stageRef.current.getStage().container()).then((canvas) => {
      const link = document.createElement('a');
      link.download = 'training-session.png';
      link.href = canvas.toDataURL();
      link.click();
    });
  };

  return (
    <div className="sessions-page">
      <div className="toolbar">
        <button onClick={() => setMode('cone')}>Add Cone</button>
        <button onClick={() => setMode('line')}>Draw Line</button>
        <button onClick={handleDownload}>Download as Image</button>
      </div>
      <div className="editor">
        <Stage
          width={800}
          height={400}
          onClick={handleClick}
          onMouseUp={handleMouseUp}
          ref={stageRef}
          style={{ border: '1px solid grey' }}
        >
          <Layer>
            {/* Pitch Background */}
            <rect x={0} y={0} width={800} height={400} fill="#77dd77" />
            {/* Elements */}
            {elements.map((el) => {
              if (el.type === 'cone') {
                return (
                  <Circle key={el.id} x={el.x} y={el.y} radius={10} fill="orange" />
                );
              } else if (el.type === 'line') {
                return (
                  <Line
                    key={el.id}
                    points={el.points}
                    stroke="white"
                    strokeWidth={5}
                    lineCap="round"
                    lineJoin="round"
                  />
                );
              }
              return null;
            })}
          </Layer>
        </Stage>
      </div>
      <div className="description">
        <h3>Training Description</h3>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the training session here..."
        />
      </div>
    </div>
  );
};

export default Sessions;
