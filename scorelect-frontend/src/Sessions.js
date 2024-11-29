// Sessions.js
import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Rect, Line, Circle, Arc, Text, Image as KonvaImage, Group } from 'react-konva';
import useImage from 'use-image';
import './Sessions.css';
import coneImg from './images/cone.png';
import ballImg from './images/ball.png';
import playerImg from './images/player.png';

import { Modal, Button, Form } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';

const Sessions = () => {
  // State for selected pitch
  const [selectedPitch, setSelectedPitch] = useState('Soccer');

  // Define canvas size
  const [canvasSize, setCanvasSize] = useState({ width: 1000, height: 531 });

  // Define colors
  const pitchColor = '#006400';       // Dark green
  const lightStripeColor = '#228B22'; // Light green
  const darkStripeColor = '#006400';  // Dark green
  const lineColor = '#FFFFFF';        // White lines
  const courtColor = '#F4A460';       // Tan color for basketball court

  // Define scaling factors
  let xScale, yScale;

  // Adjust scaling based on selected pitch
  switch (selectedPitch) {
    case 'Soccer':
      xScale = canvasSize.width / 105;
      yScale = canvasSize.height / 68;
      break;
    case 'GAA':
      xScale = canvasSize.width / 145;
      yScale = canvasSize.height / 90;
      break;
    case 'American Football':
      xScale = canvasSize.width / 120;
      yScale = canvasSize.height / 53.3;
      break;
    case 'Basketball':
      xScale = canvasSize.width / 94;
      yScale = canvasSize.height / 50;
      break;
    default:
      xScale = 1;
      yScale = 1;
  }

  // State for interactive objects
  const [objects, setObjects] = useState([]);
  const [selectedTool, setSelectedTool] = useState(null);
  const [selectedObjectId, setSelectedObjectId] = useState(null);
  const stageRef = useRef();

  // Drill explanation text
  const [drillExplanation, setDrillExplanation] = useState('');

  // Use the imported images with useImage
  const [coneImage] = useImage(coneImg);
  const [ballImage] = useImage(ballImg);
  const [playerImage] = useImage(playerImg);

  // Modal state
  const [showModal, setShowModal] = useState(false);

  // Function to add new object
  const addObject = (type) => {
    setSelectedTool(type);
  };

  // Function to handle click on the pitch
  const handlePitchClick = (e) => {
    const stage = e.target.getStage();
    const pointerPosition = stage.getPointerPosition();
    const id = Date.now(); // Unique ID for each object

    if (selectedTool) {
      const defaultSize = 25; // Default size for new objects
      const newObject = {
        id,
        type: selectedTool,
        x: pointerPosition.x,
        y: pointerPosition.y,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        size: defaultSize, // Include size property
        label: '',
        color: selectedTool === 'player' ? '#000000' : null, // Default color for players
        // Additional properties based on object type
        ...(selectedTool === 'line' && { points: [pointerPosition.x, pointerPosition.y, pointerPosition.x + 50, pointerPosition.y + 50] }),
        ...(selectedTool === 'square' && { width: 50, height: 50 }),
        ...(selectedTool === 'player' && { number: '' }),
      };
      setObjects([...objects, newObject]);
      setSelectedTool(null);
    }
  };

  // Function to handle object selection
  const handleSelectObject = (id) => {
    setSelectedObjectId(id);
    setShowModal(true);
  };

  // Function to handle object drag
  const handleDragObject = (e, id) => {
    const updatedObjects = objects.map(obj => {
      if (obj.id === id) {
        return {
          ...obj,
          x: e.target.x(),
          y: e.target.y(),
        };
      }
      return obj;
    });
    setObjects(updatedObjects);
  };

  // Function to handle object transform
  const handleTransformObject = (e, id) => {
    const node = e.target;
    const updatedObjects = objects.map(obj => {
      if (obj.id === id) {
        return {
          ...obj,
          x: node.x(),
          y: node.y(),
          scaleX: node.scaleX(),
          scaleY: node.scaleY(),
          rotation: node.rotation(),
        };
      }
      return obj;
    });
    setObjects(updatedObjects);
  };

  // Function to delete selected object
  const handleDeleteObject = () => {
    setObjects(objects.filter(obj => obj.id !== selectedObjectId));
    setSelectedObjectId(null);
    setShowModal(false); // Close the modal after deleting
  };

  // Function to download the canvas as an image
  const handleDownload = () => {
    const uri = stageRef.current.toDataURL({ pixelRatio: 2 });
    // Create a link and trigger download
    const link = document.createElement('a');
    link.download = 'training_session.png';
    link.href = uri;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

    // JSX-based renderSoccerPitch function for React rendering
    const renderSoccerPitch = () => {
        const numStripes = 10;
        const stripeWidth = canvasSize.width / numStripes;

        return (
        <Layer>
            {/* Pitch Background */}
            <Rect x={0} y={0} width={canvasSize.width} height={canvasSize.height} fill={pitchColor} />

            {/* Stripes */}
            {Array.from({ length: numStripes }, (_, i) => (
            <Rect
                key={i}
                x={i * stripeWidth}
                y={0}
                width={stripeWidth}
                height={canvasSize.height}
                fill={i % 2 === 0 ? lightStripeColor : darkStripeColor}
                opacity={0.3} // Adjust opacity for subtlety
            />
            ))}

            {/* Side and Goal Lines */}
            <Line points={[0, 0, canvasSize.width, 0, canvasSize.width, canvasSize.height, 0, canvasSize.height, 0, 0]} stroke={lineColor} strokeWidth={2} />

            {/* Goals */}
            <Line points={[canvasSize.width, yScale * 30.34, xScale * 105, yScale * 30.34, xScale * 105, yScale * 37.66, canvasSize.width, yScale * 37.66]} stroke={lineColor} strokeWidth={2} />
            <Line points={[0, yScale * 30.34, xScale * 0, yScale * 30.34, xScale * 0, yScale * 37.66, 0, yScale * 37.66]} stroke={lineColor} strokeWidth={2} />

            {/* 6-yard Boxes */}
            <Line points={[0, yScale * 23.1, xScale * 5.5, yScale * 23.1, xScale * 5.5, yScale * 44.9, 0, yScale * 44.9]} stroke={lineColor} strokeWidth={2} />
            <Line points={[canvasSize.width, yScale * 23.1, xScale * 99.5, yScale * 23.1, xScale * 99.5, yScale * 44.9, canvasSize.width, yScale * 44.9]} stroke={lineColor} strokeWidth={2} />

            {/* Penalty Areas */}
            <Line points={[0, yScale * 14, xScale * 16.5, yScale * 14, xScale * 16.5, yScale * 54, 0, yScale * 54]} stroke={lineColor} strokeWidth={2} />
            <Line points={[canvasSize.width, yScale * 14, xScale * 88.5, yScale * 14, xScale * 88.5, yScale * 54, canvasSize.width, yScale * 54]} stroke={lineColor} strokeWidth={2} />

            {/* Penalty Spots */}
            <Circle x={xScale * 11} y={yScale * 34} radius={xScale * 0.4} fill={lineColor} />
            <Circle x={xScale * 94} y={yScale * 34} radius={xScale * 0.4} fill={lineColor} />

            {/* Halfway Line */}
            <Line points={[xScale * 52.5, 0, xScale * 52.5, canvasSize.height]} stroke={lineColor} strokeWidth={2} />

            {/* Center Circle */}
            <Circle x={xScale * 52.5} y={yScale * 34} radius={xScale * 9.15} stroke={lineColor} strokeWidth={2} />

            {/* Corner Arcs */}
            <Arc x={xScale * 0} y={yScale * 0} innerRadius={0} outerRadius={xScale * 1} angle={90} rotation={0} stroke={lineColor} strokeWidth={2} />
            <Arc x={xScale * 0} y={yScale * 68} innerRadius={0} outerRadius={xScale * 1} angle={90} rotation={270} stroke={lineColor} strokeWidth={2} />
            <Arc x={xScale * 105} y={yScale * 0} innerRadius={0} outerRadius={xScale * 1} angle={90} rotation={90} stroke={lineColor} strokeWidth={2} />
            <Arc x={xScale * 105} y={yScale * 68} innerRadius={0} outerRadius={xScale * 1} angle={90} rotation={180} stroke={lineColor} strokeWidth={2} />

            {/* Penalty Arcs */}
            <Arc x={xScale * 94} y={yScale * 34} innerRadius={xScale * 9.15} outerRadius={xScale * 9.15} angle={105} rotation={127.5} stroke={lineColor} strokeWidth={2} />
            <Arc x={xScale * 11} y={yScale * 34} innerRadius={xScale * 9.15} outerRadius={xScale * 9.15} angle={105} rotation={307.5} stroke={lineColor} strokeWidth={2} />

            {/* "SCORELECT" in the End Zones */}
            <Text text="SCORELECT.COM" x={xScale * 22.5} y={canvasSize.height / 40.25} fontSize={canvasSize.width / 50} fill="#D3D3D3" opacity={0.7} align="center" />
            <Text text="SCORELECT.COM" x={canvasSize.width - xScale * 22.5} y={canvasSize.height / 1.02} fontSize={canvasSize.width / 50} fill="#D3D3D3" opacity={0.7} rotation={180} align="center" />
        </Layer>
        );
    }; 


    const renderGAAPitch = () => {
        const numStripes = 10;
        const stripeWidth = canvasSize.width / numStripes;
    
        return (
          <Layer>
            {/* Pitch Background */}
            <Rect
              x={0}
              y={0}
              width={canvasSize.width}
              height={canvasSize.height}
              fill={pitchColor}
            />
    
            {/* Stripes */}
            {Array.from({ length: numStripes }, (_, i) => (
              <Rect
                key={i}
                x={i * stripeWidth}
                y={0}
                width={stripeWidth}
                height={canvasSize.height}
                fill={i % 2 === 0 ? lightStripeColor : darkStripeColor}
                opacity={0.3} // Adjust opacity for subtlety
              />
            ))}
          <Line points={[0, 0, canvasSize.width, 0, canvasSize.width, canvasSize.height, 0, canvasSize.height, 0, 0]} stroke={lineColor} strokeWidth={2} />
          <Line points={[canvasSize.width, yScale * 40.75, xScale * 145.2, yScale * 40.75, xScale * 145.2, yScale * 47.25, canvasSize.width, yScale * 47.25]} stroke={lineColor} strokeWidth={2} />
          <Line points={[0, yScale * 40.75, xScale * -0.2, yScale * 40.75, xScale * -0.2, yScale * 47.25, 0, yScale * 47.25]} stroke={lineColor} strokeWidth={2} />
          <Line points={[canvasSize.width, yScale * 37, xScale * 139, yScale * 37, xScale * 139, yScale * 51, canvasSize.width, yScale * 51]} stroke={lineColor} strokeWidth={2} />
          <Line points={[0, yScale * 37, xScale * 6, yScale * 37, xScale * 6, yScale * 51, 0, yScale * 51]} stroke={lineColor} strokeWidth={2} />
          <Line points={[0, yScale * 34.5, xScale * 14, yScale * 34.5, xScale * 14, yScale * 53.5, 0, yScale * 53.5]} stroke={lineColor} strokeWidth={2} />
          <Line points={[canvasSize.width, yScale * 34.5, xScale * 131, yScale * 34.5, xScale * 131, yScale * 53.5, canvasSize.width, yScale * 53.5]} stroke={lineColor} strokeWidth={2} />
          <Line points={[xScale * 72.5, yScale * 39, xScale * 72.5, yScale * 49]} stroke={lineColor} strokeWidth={2} />
          <Line points={[xScale * 11, yScale * 43.5, xScale * 11, yScale * 44.5]} stroke={lineColor} strokeWidth={2} />
          <Line points={[xScale * 134, yScale * 43.5, xScale * 134, yScale * 44.5]} stroke={lineColor} strokeWidth={2} />
          <Arc x={xScale * 124} y={yScale * 44} innerRadius={0} outerRadius={xScale * 12} angle={180} rotation={90} stroke={lineColor} strokeWidth={2} />
          <Arc x={xScale * 21} y={yScale * 44} innerRadius={0} outerRadius={xScale * 12} angle={180} rotation={270} stroke={lineColor} strokeWidth={2} />
          <Line points={[xScale * 14, 0, xScale * 14, canvasSize.height]} stroke={lineColor} strokeWidth={2} />
          <Line points={[xScale * 131, 0, xScale * 131, canvasSize.height]} stroke={lineColor} strokeWidth={2} />
          <Line points={[xScale * 21, 0, xScale * 21, canvasSize.height]} stroke={lineColor} strokeWidth={2} />
          <Line points={[xScale * 124, 0, xScale * 124, canvasSize.height]} stroke={lineColor} strokeWidth={2} />
          <Line points={[xScale * 45, 0, xScale * 45, canvasSize.height]} stroke={lineColor} strokeWidth={2} />
          <Line points={[xScale * 100, 0, xScale * 100, canvasSize.height]} stroke={lineColor} strokeWidth={2} />
          <Line points={[xScale * 65, 0, xScale * 65, canvasSize.height]} stroke={lineColor} strokeWidth={2} />
          <Line points={[xScale * 80, 0, xScale * 80, canvasSize.height]} stroke={lineColor} strokeWidth={2} />
    
          {/* "SCORELECT" in the end zones */}
          <Text text="SCORELECT.COM" x={xScale * 22.5} y={canvasSize.height / 40.25} fontSize={canvasSize.width / 60} fill="#D3D3D3" opacity={0.7} rotation={0} align="center" />
          <Text text="SCORELECT.COM" x={canvasSize.width - xScale * 22.5} y={canvasSize.height / 1.02} fontSize={canvasSize.width / 60} fill="#D3D3D3" opacity={0.7} rotation={180} align="center" />
     
          </Layer>
        );
      };
    

  const renderFootballField = () => (
    <Layer>
      <Rect x={0} y={0} width={canvasSize.width} height={canvasSize.height} fill={pitchColor} />

      {/* Side and goal lines */}
      <Line points={[0, 0, canvasSize.width, 0, canvasSize.width, canvasSize.height, 0, canvasSize.height, 0, 0]} stroke={lineColor} strokeWidth={2} />

      {/* End zones */}
      <Rect x={0} y={0} width={xScale * 10} height={canvasSize.height} fill="#FF0000" opacity={0.3} />
      <Rect x={canvasSize.width - xScale * 10} y={0} width={xScale * 10} height={canvasSize.height} fill="#FF0000" opacity={0.3} />

      {/* "SCORELECT" in the end zones */}
      <Text text="SCORELECT.COM" x={xScale * 2.5} y={canvasSize.height / 1.07} fontSize={canvasSize.width / 22.5} fill="#FFF" rotation={-90} align="center" />
      <Text text="SCORELECT.COM" x={canvasSize.width - xScale * 2.5} y={canvasSize.height / 14} fontSize={canvasSize.width / 22.5} fill="#FFF" rotation={90} align="center" />

      {/* Yard lines */}
      {[...Array(11)].map((_, i) => (
        <Line key={i} points={[xScale * (10 + i * 10), 0, xScale * (10 + i * 10), canvasSize.height]} stroke={lineColor} strokeWidth={2} />
      ))}

      {/* Hash marks */}
      {[...Array(11)].map((_, i) => (
        <>
          <Line key={`left-${i}`} points={[xScale * (10 + i * 10), yScale * 23.5, xScale * (10 + i * 10), yScale * 29.8]} stroke={lineColor} strokeWidth={2} />
          <Line key={`right-${i}`} points={[xScale * (10 + i * 10), yScale * 53.3 - yScale * 23.5, xScale * (10 + i * 10), yScale * 53.3 - yScale * 29.8]} stroke={lineColor} strokeWidth={2} />
        </>
      ))}

      {/* Yard line numbers */}
      {Array.from({ length: 4 }, (_, i) => (
        <>
          {/* Left side */}
          <Text key={`left-${i}`} text={`${10 + i * 10}`} x={xScale * (19.6 + i * 10) - canvasSize.width / 100} y={yScale * 3} fontSize={canvasSize.width / 40} fill={lineColor} align="center" />
          <Text key={`left-${i}-bottom`} text={`${10 + i * 10}`} x={xScale * (19.6 + i * 10) - canvasSize.width / 100} y={canvasSize.height - yScale * 4} fontSize={canvasSize.width / 40} fill={lineColor} align="center" />
          {/* Right side */}
          <Text key={`right-${i}`} text={`${10 + i * 10}`} x={canvasSize.width - xScale * (20.4 + i * 10) - canvasSize.width / 100} y={yScale * 3} fontSize={canvasSize.width / 40} fill={lineColor} align="center" />
          <Text key={`right-${i}-bottom`} text={`${10 + i * 10}`} x={canvasSize.width - xScale * (20.4 + i * 10) - canvasSize.width / 100} y={canvasSize.height - yScale * 4} fontSize={canvasSize.width / 40} fill={lineColor} align="center" />
        </>
      ))}

      {/* 50 yard line */}
      <Text text="50" x={canvasSize.width / 2.0175 - canvasSize.width / 100} y={yScale * 3} fontSize={canvasSize.width / 40} fill={lineColor} align="center" />
      <Text text="50" x={canvasSize.width / 2.0175 - canvasSize.width / 100} y={canvasSize.height - yScale * 4} fontSize={canvasSize.width / 40} fill={lineColor} align="center" />
    </Layer>
  );

// JSX-based renderBasketballCourt function for React rendering
const renderBasketballCourt = () => (
    <Layer>
      <Rect x={0} y={0} width={canvasSize.width} height={canvasSize.height} fill={courtColor} />
  
      {/* Court background */}
      <Rect x={0} y={0} width={canvasSize.width} height={canvasSize.height} fill={courtColor} />

      {/* Playing surface outline */}
      <Line points={[
        0, 0,
        canvasSize.width, 0,
        canvasSize.width, canvasSize.height,
        0, canvasSize.height,
        0, 0
      ]} stroke={lineColor} strokeWidth={2} />

      {/* Center circle */}
      <Circle 
        x={canvasSize.width / 2} 
        y={canvasSize.height / 2} 
        radius={xScale * 6} 
        stroke={lineColor} 
        strokeWidth={2} 
      />

      {/* Center line */}
      <Line points={[
        canvasSize.width / 2, 0,
        canvasSize.width / 2, canvasSize.height
      ]} stroke={lineColor} strokeWidth={2} />

      {/* Three-point arcs */}
      <Arc
        x={xScale * 4.92}
        y={canvasSize.height / 2}
        innerRadius={xScale * 23.75}
        outerRadius={xScale * 23.75}
        angle={135}
        rotation={292.5}
        stroke={lineColor}
        strokeWidth={2}
      />
      <Arc
        x={canvasSize.width - (xScale * 4.92)}
        y={canvasSize.height / 2}
        innerRadius={xScale * 23.75}
        outerRadius={xScale * 23.75}
        angle={135}
        rotation={112.5}
        stroke={lineColor}
        strokeWidth={2}
      />

      {/* Free throw circles */}
      <Circle 
        x={xScale * 19} 
        y={canvasSize.height / 2} 
        radius={xScale * 6} 
        stroke={lineColor} 
        strokeWidth={2} 
      />
      <Circle 
        x={canvasSize.width - (xScale * 19)} 
        y={canvasSize.height / 2} 
        radius={xScale * 6} 
        stroke={lineColor} 
        strokeWidth={2} 
      />

      {/* Free throw lanes */}
      <Line points={[
        0, yScale * 19,
        xScale * 19, yScale * 19,
        xScale * 19, canvasSize.height - (yScale * 19),
        0, canvasSize.height - (yScale * 19),
        0, yScale * 19
      ]} stroke={lineColor} strokeWidth={2} />
      <Line points={[
        canvasSize.width, yScale * 19,
        canvasSize.width - (xScale * 19), yScale * 19,
        canvasSize.width - (xScale * 19), canvasSize.height - (yScale * 19),
        canvasSize.width, canvasSize.height - (yScale * 19),
        canvasSize.width, yScale * 19
      ]} stroke={lineColor} strokeWidth={2} />

      {/* Outside Free throw lanes */}
      <Line points={[
        0, yScale * 17,
        xScale * 19, yScale * 17,
        xScale * 19, canvasSize.height - (yScale * 17),
        0, canvasSize.height - (yScale * 17),
        0, yScale * 17
      ]} stroke={lineColor} strokeWidth={2} />
      <Line points={[
        canvasSize.width, yScale * 17,
        canvasSize.width - (xScale * 19), yScale * 17,
        canvasSize.width - (xScale * 19), canvasSize.height - (yScale * 17),
        canvasSize.width, canvasSize.height - (yScale * 17),
        canvasSize.width, yScale * 17
      ]} stroke={lineColor} strokeWidth={2} />

      {/* Baselines */}
      <Line points={[
        xScale * 14, yScale * 3,
        0, yScale * 3
      ]} stroke={lineColor} strokeWidth={2} />
      <Line points={[
        xScale * 14, canvasSize.height - (yScale * 3),
        0, canvasSize.height - (yScale * 3)
      ]} stroke={lineColor} strokeWidth={2} />
      <Line points={[
        canvasSize.width - (xScale * 14), yScale * 3,
        canvasSize.width, yScale * 3
      ]} stroke={lineColor} strokeWidth={2} />
      <Line points={[
        canvasSize.width - (xScale * 14), canvasSize.height - (yScale * 3),
        canvasSize.width, canvasSize.height - (yScale * 3)
      ]} stroke={lineColor} strokeWidth={2} />

      {/* "SCORELECT" on the court */}
      <Text text="SCORELECT.COM" x={xScale * 22.5} y={canvasSize.height / 40.25} fontSize={canvasSize.width / 50} fill="#D3D3D3" opacity={0.7} rotation={0} align="center" />
      <Text text="SCORELECT.COM" x={canvasSize.width - xScale * 22.5} y={canvasSize.height / 1.02} fontSize={canvasSize.width / 50} fill="#D3D3D3" opacity={0.7} rotation={180} align="center" />

    </Layer>

    
  );

  // Function to render the selected pitch
  const renderPitch = () => {
    switch (selectedPitch) {
      case 'Soccer':
        return renderSoccerPitch();
      case 'GAA':
        return renderGAAPitch();
      case 'American Football':
        return renderFootballField();
      case 'Basketball':
        return renderBasketballCourt();
      default:
        return null;
    }
  };

  // Helper function to render interactive objects
    const renderObjects = () => {
        return objects.map(obj => {
        switch (obj.type) {
            case 'cone':
            case 'ball':
            return (
                <Group
                key={obj.id}
                x={obj.x}
                y={obj.y}
                draggable
                onClick={() => handleSelectObject(obj.id)}
                onTap={() => handleSelectObject(obj.id)}
                onDragEnd={(e) => handleDragObject(e, obj.id)}
                onTransformEnd={(e) => handleTransformObject(e, obj.id)}
                rotation={obj.rotation}
                scaleX={obj.scaleX}
                scaleY={obj.scaleY}
                >
                {obj.label && (
                    <Text
                    text={obj.label}
                    fontSize={obj.size / 2}
                    fill="black"
                    x={-obj.size / 2} // Center the text horizontally
                    y={-obj.size - (obj.size / 8)} // Position the text above the cone
                    width={obj.size} // Set the width to align the text
                    align="center"
                    />
                )}
                <KonvaImage
                    image={obj.type === 'cone' ? coneImage : ballImage}
                    x={0}
                    y={0}
                    offsetX={obj.size / 2}
                    offsetY={obj.size / 2}
                    width={obj.size}
                    height={obj.size}
                />
                </Group>
            );
            case 'player':
            return (
                <Group
                key={obj.id}
                x={obj.x}
                y={obj.y}
                draggable
                onClick={() => handleSelectObject(obj.id)}
                onTap={() => handleSelectObject(obj.id)}
                onDragEnd={(e) => handleDragObject(e, obj.id)}
                onTransformEnd={(e) => handleTransformObject(e, obj.id)}
                rotation={obj.rotation}
                scaleX={obj.scaleX}
                scaleY={obj.scaleY}
                >
                {obj.label && (
                    <Text
                    text={obj.label}
                    fontSize={obj.size / 2}
                    fill="black"
                    x={-obj.size / 2}
                    y={-obj.size - (obj.size / 2)}
                    width={obj.size}
                    align="center"
                    />
                )}
                <Circle
                    radius={obj.size / 2}
                    fill={obj.color || 'black'}
                />
                {obj.number && (
                    <Text
                    text={obj.number}
                    fontSize={obj.size / 2}
                    fill="white"
                    align="center"
                    verticalAlign="middle"
                    offsetX={-obj.size / 4}
                    offsetY={-obj.size / 4}
                    />
                )}
                </Group>
            );
            case 'line':
            return (
                <Line
                key={obj.id}
                points={obj.points}
                stroke={obj.color || 'black'}
                strokeWidth={obj.size || 1}
                draggable
                onClick={() => handleSelectObject(obj.id)}
                onTap={() => handleSelectObject(obj.id)}
                onDragEnd={(e) => handleDragObject(e, obj.id)}
                onTransformEnd={(e) => handleTransformObject(e, obj.id)}
                />
            );
            case 'square':
            return (
                <Rect
                key={obj.id}
                x={obj.x}
                y={obj.y}
                width={obj.width}
                height={obj.height}
                fill={obj.color || 'transparent'}
                stroke="black"
                strokeWidth={2}
                draggable
                onClick={() => handleSelectObject(obj.id)}
                onTap={() => handleSelectObject(obj.id)}
                onDragEnd={(e) => handleDragObject(e, obj.id)}
                onTransformEnd={(e) => handleTransformObject(e, obj.id)}
                />
            );
            // Add cases for other object types if needed
            default:
            return null;
        }
        });
    }; 

  // Modal state variables
  const selectedObject = objects.find(obj => obj.id === selectedObjectId);

  const [modalLabel, setModalLabel] = useState('');
  const [modalSize, setModalSize] = useState(25);
  const [modalColor, setModalColor] = useState('#000000');

  useEffect(() => {
    if (selectedObject) {
      setModalLabel(selectedObject.label || '');
      setModalSize(selectedObject.size || 25);
      setModalColor(selectedObject.color || '#000000');
    }
  }, [selectedObject]);

  const handleModalSubmit = (e) => {
    e.preventDefault();
    const updatedObjects = objects.map(obj => {
      if (obj.id === selectedObjectId) {
        return {
          ...obj,
          label: modalLabel,
          size: modalSize,
          color: modalColor,
        };
      }
      return obj;
    });
    setObjects(updatedObjects);
    setShowModal(false);
    setSelectedObjectId(null);
  };

  const handleModalCancel = () => {
    setShowModal(false);
    setSelectedObjectId(null);
  };

  return (
    <div className="sessions-page">
      <h1 className="sessions-title">Training Sessions</h1>
      <div className="toolbar">
        <label htmlFor="pitch-select">Select Pitch:</label>
        <select
          id="pitch-select"
          value={selectedPitch}
          onChange={(e) => setSelectedPitch(e.target.value)}
        >
          <option value="Soccer">Soccer</option>
          <option value="GAA">GAA</option>
          <option value="American Football">American Football</option>
          <option value="Basketball">Basketball</option>
        </select>

        {/* Object selection buttons */}
        <div className="object-buttons">
          <button onClick={() => addObject('cone')}>Add Cone</button>
          <button onClick={() => addObject('ball')}>Add Ball</button>
          <button onClick={() => addObject('player')}>Add Player</button>
          <button onClick={() => addObject('line')}>Add Line</button>
          <button onClick={() => addObject('square')}>Add Square</button>
          {/* Add more objects as needed */}
        </div>

        {/* Remove the Delete button from the toolbar */}
        {/* Download button */}
        <button onClick={handleDownload}>Download Session</button>
      </div>

      {/* Modal */}
      {showModal && selectedObject && (
        <Modal
          show={showModal}
          onHide={handleModalCancel}
          centered
          dialogClassName="custom-modal"
        >
          <Modal.Header closeButton>
            <Modal.Title>
              Edit {selectedObject.type.charAt(0).toUpperCase() + selectedObject.type.slice(1)}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form onSubmit={handleModalSubmit}>
              {/* Size Input */}
              <Form.Group controlId="modal-size">
                <Form.Label>Size:</Form.Label>
                <Form.Control
                  type="number"
                  value={modalSize}
                  onChange={(e) => setModalSize(parseInt(e.target.value, 10))}
                />
              </Form.Group>

              {/* Label Input */}
              {(selectedObject.type === 'cone' ||
                selectedObject.type === 'ball' ||
                selectedObject.type === 'player') && (
                <Form.Group controlId="modal-label">
                  <Form.Label>Text Above Image:</Form.Label>
                  <Form.Control
                    type="text"
                    value={modalLabel}
                    onChange={(e) => setModalLabel(e.target.value)}
                  />
                </Form.Group>
              )}

              {/* Color Input */}
              {selectedObject.type === 'player' && (
                <Form.Group controlId="modal-color">
                  <Form.Label>Color:</Form.Label>
                  <Form.Control
                    type="color"
                    value={modalColor}
                    onChange={(e) => setModalColor(e.target.value)}
                  />
                </Form.Group>
              )}

              {/* Modal Footer with Delete button */}
              <Modal.Footer>
                <Button variant="danger" onClick={handleDeleteObject}>
                  Delete
                </Button>
                <Button variant="secondary" onClick={handleModalCancel}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit">
                  Save
                </Button>
              </Modal.Footer>
            </Form>
          </Modal.Body>
        </Modal>
      )}

      <div className="pitch-container">
        <Stage
          width={canvasSize.width}
          height={canvasSize.height}
          onClick={handlePitchClick}
          ref={stageRef}
        >
          {renderPitch()}
          <Layer>
            {renderObjects()}
          </Layer>
        </Stage>
      </div>

      {/* Drill explanation text box */}
      <div className="drill-explanation">
        <h2>Drill Explanation:</h2>
        <textarea
          value={drillExplanation}
          onChange={(e) => setDrillExplanation(e.target.value)}
          rows={5}
          cols={80}
          placeholder="Describe the drill here..."
        />
      </div>
    </div>
  );
};

export default Sessions;