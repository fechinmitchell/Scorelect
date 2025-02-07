// src/components/GAAPitchComponents.js
import React from 'react';
import { Layer, Group, Rect, Line, Arc, Text, Circle, RegularPolygon } from 'react-konva';
import PropTypes from 'prop-types';


// -- Example function #1 --
export function translateShotToOneSide(shot, halfLineX, goalX, goalY) {
    const targetGoal = (shot.x || 0) <= halfLineX ? { x: 0, y: goalY } : { x: goalX, y: goalY };
    const dx = (shot.x || 0) - targetGoal.x;
    const dy = (shot.y || 0) - targetGoal.y;
    const distMeters = Math.sqrt(dx * dx + dy * dy);
    return { ...shot, distMeters };
  }

// -- Example function #2 --
export function translateShotToLeftSide(shot, halfLineX) {
    let newX = shot.x;
    if (shot.x > halfLineX) {
      newX = 2 * halfLineX - shot.x;
    }
    return { ...shot, x: newX };
  }

  function renderLegendOneSideShots(colors, stageWidth, stageHeight) {
    // 1) Define the legend items array
    const legendItems = [
      { label: 'Penalty Goal', color: '#FFFF00', hasWhiteBorder: true },
      { label: 'Goal', color: colors.goal, hasWhiteBorder: false },
      { label: 'Point', color: colors.point, hasWhiteBorder: false },
      { label: 'Miss', color: colors.miss, hasWhiteBorder: false },
      { label: 'SetPlay Score', color: colors.setPlayScore, hasWhiteBorder: true },
      { label: 'SetPlay Miss', color: colors.setPlayMiss, hasWhiteBorder: true },
    ];
  
    // 2) We'll define the size & positions for the legend box
    const itemHeight = 20;
    const legendWidth = 120;
    const legendHeight = legendItems.length * itemHeight + 10; 
    // We'll place it near bottom-right corner of the stage.
  
    return (
      <Layer>
        <Group x={stageWidth - legendWidth - 10} y={stageHeight - legendHeight - 10}>
          {/* Background box */}
          <Rect
            x={0}
            y={0}
            width={legendWidth}
            height={legendHeight}
            fill="rgba(0,0,0,0.5)"
            cornerRadius={5}
          />
          {legendItems.map((item, i) => {
            const yPos = i * itemHeight + 10;
            return (
              <Group key={i}>
                <Circle
                  x={15}
                  y={yPos}
                  radius={5}
                  fill={item.color}
                  stroke={item.hasWhiteBorder ? '#fff' : null}
                  strokeWidth={item.hasWhiteBorder ? 2 : 0}
                />
                <Text
                  x={30}
                  y={yPos - 6}
                  text={item.label}
                  fontSize={12}
                  fill="#fff"
                />
              </Group>
            );
          })}
        </Group>
      </Layer>
    );
  }
  
  export { renderLegendOneSideShots };

// -- Example function #3 --
export function getShotCategory(actionStr) {
    const a = (actionStr || '').toLowerCase().trim();
    if (a === 'penalty goal') return 'penaltyGoal';
    if (a === 'pen miss') return 'penaltyMiss';
  
    const knownSetPlayActions = [
      'free', 'missed free', 'fortyfive', 'offensive mark', 'penalty goal',
      'pen miss', 'free short', 'free wide', 'fortyfive short', 'fortyfive wide',
      'fortyfive post', 'free post', 'offensive mark short', 'offensive mark wide', 'mark wide'
    ];
    function isSetPlayScore(a) {
      return !(a.includes('wide') || a.includes('short') || a.includes('miss') || a.includes('post'));
    }
    if (knownSetPlayActions.some(sp => a === sp)) {
      return isSetPlayScore(a) ? 'setplay-score' : 'setplay-miss';
    }
    if (a === 'goal') return 'goal';
    const knownMisses = ['wide','goal miss','miss','block','blocked','post','short','pen miss'];
    if (knownMisses.some(m => a === m)) return 'miss';
    if (a === 'point') return 'point';
    return 'other';
  }

// -- Example function #4: Full pitch --
export function renderGAAPitch({
  canvasSizeMain,
  pitchColorState,
  lightStripeColorState,
  darkStripeColorState,
  lineColorState,
  xScale,
  yScale
}) {
    const numStripes = 10;
    const stripeWidth = canvasSizeMain.width / numStripes;
    return (
      <Layer>
                <Rect
                  x={0}
                  y={0}
                  width={canvasSizeMain.width}
                  height={canvasSizeMain.height}
                  fill={pitchColorState}
                />
        
                {Array.from({ length: numStripes }, (_, i) => (
                  <Rect
                    key={i}
                    x={i * stripeWidth}
                    y={0}
                    width={stripeWidth}
                    height={canvasSizeMain.height}
                    fill={i % 2 === 0 ? lightStripeColorState : darkStripeColorState}
                    opacity={0.3}
                  />
                ))}
        
                <Line 
                  points={[0, 0, canvasSizeMain.width, 0, canvasSizeMain.width, canvasSizeMain.height, 0, canvasSizeMain.height, 0, 0]} 
                  stroke={lineColorState} 
                  strokeWidth={2} 
                />
                <Line 
                  points={[canvasSizeMain.width, yScale * 40.75, xScale * 145.2, yScale * 40.75, xScale * 145.2, yScale * 47.25, canvasSizeMain.width, yScale * 47.25]} 
                  stroke={lineColorState} 
                  strokeWidth={2} 
                />
                <Line 
                  points={[0, yScale * 40.75, xScale * -0.2, yScale * 40.75, xScale * -0.2, yScale * 47.25, 0, yScale * 47.25]} 
                  stroke={lineColorState} 
                  strokeWidth={2} 
                />
                <Line 
                  points={[canvasSizeMain.width, yScale * 37, xScale * 140.5, yScale * 37, xScale * 140.5, yScale * 51, canvasSizeMain.width, yScale * 51]} 
                  stroke={lineColorState} 
                  strokeWidth={2} 
                />
                <Line 
                  points={[0, yScale * 37, xScale * 4.5, yScale * 37, xScale * 4.5, yScale * 51, 0, yScale * 51]} 
                  stroke={lineColorState} 
                  strokeWidth={2} 
                />
                <Line 
                  points={[0, yScale * 34.5, xScale * 13, yScale * 34.5, xScale * 13, yScale * 53.5, 0, yScale * 53.5]} 
                  stroke={lineColorState} 
                  strokeWidth={2} 
                />
                <Line 
                  points={[canvasSizeMain.width, yScale * 34.5, xScale * 132, yScale * 34.5, xScale * 132, yScale * 53.5, canvasSizeMain.width, yScale * 53.5]} 
                  stroke={lineColorState} 
                  strokeWidth={2} 
                />
                <Line 
                  points={[xScale * 72.5, yScale * 39, xScale * 72.5, yScale * 49]} 
                  stroke={lineColorState} 
                  strokeWidth={2} 
                />
                <Line 
                  points={[xScale * 11, yScale * 43.5, xScale * 11, yScale * 44.5]} 
                  stroke={lineColorState} 
                  strokeWidth={2} 
                />
                <Line 
                  points={[xScale * 134, yScale * 43.5, xScale * 134, yScale * 44.5]} 
                  stroke={lineColorState} 
                  strokeWidth={2} 
                />
                <Arc 
                  x={xScale * 125} 
                  y={yScale * 44} 
                  innerRadius={0} 
                  outerRadius={xScale * 13} 
                  angle={180} 
                  rotation={90} 
                  stroke={lineColorState} 
                  strokeWidth={2} 
                />
                <Arc 
                  x={xScale * 20} 
                  y={yScale * 44} 
                  innerRadius={0} 
                  outerRadius={xScale * 13} 
                  angle={180} 
                  rotation={270} 
                  stroke={lineColorState} 
                  strokeWidth={2} 
                />
                <Line 
                  points={[xScale * 13, 0, xScale * 13, canvasSizeMain.height]} 
                  stroke={lineColorState} 
                  strokeWidth={2} 
                />
                <Line 
                  points={[xScale * 132, 0, xScale * 132, canvasSizeMain.height]} 
                  stroke={lineColorState} 
                  strokeWidth={2} 
                />
                <Line 
                  points={[xScale * 20, 0, xScale * 20, canvasSizeMain.height]} 
                  stroke={lineColorState} 
                  strokeWidth={2} 
                />
                <Line 
                  points={[xScale * 125, 0, xScale * 125, canvasSizeMain.height]} 
                  stroke={lineColorState} 
                  strokeWidth={2} 
                />
                <Line 
                  points={[xScale * 45, 0, xScale * 45, canvasSizeMain.height]} 
                  stroke={lineColorState} 
                  strokeWidth={2} 
                />
                <Line 
                  points={[xScale * 100, 0, xScale * 100, canvasSizeMain.height]} 
                  stroke={lineColorState} 
                  strokeWidth={2} 
                />
                <Line 
                  points={[xScale * 65, 0, xScale * 65, canvasSizeMain.height]} 
                  stroke={lineColorState} 
                  strokeWidth={2} 
                />
                <Line 
                  points={[xScale * 80, 0, xScale * 80, canvasSizeMain.height]} 
                  stroke={lineColorState} 
                  strokeWidth={2} 
                />
          
                <Arc
                  x={xScale * 0}
                  y={yScale * 44}
                  innerRadius={xScale * 40}
                  outerRadius={xScale * 40}
                  angle={120}
                  rotation={300}
                  stroke={lineColorState}
                  strokeWidth={2}
                  closed={false}
                  lineCap="round"
                />
          
                <Arc
                  x={xScale * 145}
                  y={yScale * 44}
                  innerRadius={xScale * 40}
                  outerRadius={xScale * 40}
                  angle={120}
                  rotation={120}
                  stroke={lineColorState}
                  strokeWidth={2}
                  closed={false}
                  lineCap="round"
                />
          
                <Text 
                  text="SCORELECT.COM" 
                  x={xScale * 22.5} 
                  y={canvasSizeMain.height / 40.25} 
                  fontSize={canvasSizeMain.width / 60} 
                  fill="#D3D3D3" 
                  opacity={0.7} 
                  rotation={0} 
                  align="center" 
                />
                <Text 
                  text="SCORELECT.COM" 
                  x={canvasSizeMain.width - xScale * 22.5} 
                  y={canvasSizeMain.height / 1.02} 
                  fontSize={canvasSizeMain.width / 60} 
                  fill="#D3D3D3" 
                  opacity={0.7} 
                  rotation={180} 
                  align="center" 
                />
              </Layer>
    );
  }

renderGAAPitch.propTypes = {
  canvasSizeMain: PropTypes.object.isRequired,
  pitchColorState: PropTypes.string.isRequired,
  lightStripeColorState: PropTypes.string.isRequired,
  darkStripeColorState: PropTypes.string.isRequired,
  lineColorState: PropTypes.string.isRequired,
  xScale: PropTypes.number.isRequired,
  yScale: PropTypes.number.isRequired,
};

// -- Example function #5: One-sided pitch --
export function renderOneSidePitchShots({
  shots,
  colors,
  xScale,
  yScale,
  onShotClick,
  halfLineX,
  goalX,
  goalY
}) {
    const pitchWidth = 145;
    const pitchHeight = 88;
    // Do NOT re-declare halfLineX, goalX, or goalY here
    const numStripes = 10;
    const halfPitchWidthPx = xScale * halfLineX;
    const pitchHeightPx = yScale * pitchHeight;
  return (
    <Layer>
    {/* Black background for half pitch */}
    <Rect 
      x={0} 
      y={0} 
      width={halfPitchWidthPx} 
      height={pitchHeightPx} 
      fill="black" 
    />

    {/* White outer boundary and half-line markings */}
    <Rect 
      x={0} 
      y={0} 
      width={halfPitchWidthPx} 
      height={pitchHeightPx} 
      stroke="white" 
      strokeWidth={2} 
      fill="transparent" 
    />
    <Line 
      points={[halfPitchWidthPx, 0, halfPitchWidthPx, pitchHeightPx]} 
      stroke="white" 
      strokeWidth={2} 
    />

    <Line points={[xScale * 13, 0, xScale * 13, pitchHeightPx]} stroke="white" strokeWidth={2} />
    <Line points={[xScale * 20, 0, xScale * 20, pitchHeightPx]} stroke="white" strokeWidth={2} />
    <Line points={[xScale * 45, 0, xScale * 45, pitchHeightPx]} stroke="white" strokeWidth={2} />
    <Line points={[xScale * 65, 0, xScale * 65, pitchHeightPx]} stroke="white" strokeWidth={2} />
    <Arc x={xScale * 20} y={yScale * 44} innerRadius={0} outerRadius={xScale * 13} angle={180} rotation={270} stroke="white" strokeWidth={2} />
    <Line points={[xScale * 11, yScale * 43.5, xScale * 11, yScale * 44.5]} stroke="white" strokeWidth={2} />
    <Line points={[0, yScale * 37, xScale * 4.5, yScale * 37, xScale * 4.5, yScale * 51, 0, yScale * 51]} stroke="white" strokeWidth={2} />
    <Line points={[0, yScale * 34.5, xScale * 13, yScale * 34.5, xScale * 13, yScale * 53.5, 0, yScale * 53.5]} stroke="white" strokeWidth={2} />

    <Arc
      x={xScale * 0}
      y={yScale * 44}
      innerRadius={xScale * 40}    
      outerRadius={xScale * 40}
      angle={120}
      rotation={300}
      stroke="white"
      strokeWidth={2}
      closed={false}
      lineCap="round"
    />

    {/* Outer boundary around half pitch */}
    <Line 
      points={[0, 0, halfPitchWidthPx, 0, halfPitchWidthPx, pitchHeightPx, 0, pitchHeightPx, 0, 0]} 
      stroke="white" 
      strokeWidth={2} 
    />

    {/* Plot each translated shot on one side, now clickable */}
    {shots.map((shot, i) => {
      const mirroredShot = translateShotToLeftSide(shot, halfLineX);
      const translated = translateShotToOneSide(mirroredShot, halfLineX, goalX, goalY);
      const shotX = translated.x * xScale;
      const shotY = translated.y * yScale;
      const baseRadius = 5;
      const radius = baseRadius + (translated.xPoints ? translated.xPoints * 0.5 : 0);

      const category = getShotCategory(shot.action);
      let fillColor = 'black';
      let strokeColor = 'white';
      let strokeWidth = 2;

      if (category === 'penaltyGoal') {
        fillColor = 'yellow';      // 
        strokeColor = '#ffffff';    // white ring
        strokeWidth = 2;
      }
      

      if (category === 'goal') {
        fillColor = colors.goal || 'orange';
        strokeColor = null;
      } else if (category === 'point') {
        fillColor = colors.point || 'green';
        strokeColor = null;
      } else if (category === 'setplay-score') {
        fillColor = colors.setPlayScore || 'green';
      } else if (category === 'setplay-miss') {
        fillColor = colors.setPlayMiss || 'red';
      } else if (category === 'miss') {
        fillColor = colors.miss || 'red';
      }

      return (
        <Circle
          key={i}
          x={shotX}
          y={shotY}
          radius={radius}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={strokeColor ? strokeWidth : 0}
          opacity={0.85}
          // Handle click to open the same modal as the main pitch
          onClick={() => onShotClick(shot)}
        />
      );
    })}
  </Layer>
  );
}

renderOneSidePitchShots.propTypes = {
  shots: PropTypes.array.isRequired,
  colors: PropTypes.object.isRequired,
  xScale: PropTypes.number.isRequired,
  yScale: PropTypes.number.isRequired,
  onShotClick: PropTypes.func.isRequired,
  halfLineX: PropTypes.number.isRequired,
  goalX: PropTypes.number.isRequired,
  goalY: PropTypes.number.isRequired,
};
