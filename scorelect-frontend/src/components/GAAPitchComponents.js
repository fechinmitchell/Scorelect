import React from 'react';
import { Layer, Group, Rect, Line, Arc, Text, Circle } from 'react-konva';
import PropTypes from 'prop-types';

// Utility Functions (unchanged)
// In GAAPitchComponents.js, update this function:
export const translateShotToOneSide = (shot, halfLineX, goalX, goalY) => {
  // Make a copy of the shot to avoid mutating the original
  const result = { ...shot };
  
  // Parse coordinates or use defaults
  const x = parseFloat(shot.x) || 0;
  const y = parseFloat(shot.y) || 0;
  
  // Determine which side the shot is from based on X position
  const isLeftSide = x <= halfLineX;
  
  // If the shot is from the right side (past the halfway line),
  // we need to mirror its X coordinate to show it on the left side
  if (!isLeftSide) {
    result.x = 2 * halfLineX - x;
    result.originalSide = 'Right';
  } else {
    result.originalSide = 'Left';
  }
  
  // Calculate distance to goal
  // For shots from the left side, the goal is at (0, goalY)
  const dx = result.x - 0;  // Distance from x to left goal (at x=0)
  const dy = result.y - goalY;
  result.distMeters = Math.sqrt(dx * dx + dy * dy);
  
  return result;
};

export function translateShotToLeftSide(shot, halfLineX) {
  let newX = shot.x;
  if (shot.x > halfLineX) {
    newX = 2 * halfLineX - shot.x;
  }
  return { ...shot, x: newX };
}

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
  const knownMisses = ['wide', 'goal miss', 'miss', 'block', 'blocked', 'post', 'short', 'pen miss'];
  if (knownMisses.some(m => a === m)) return 'miss';
  if (a === 'point') return 'point';
  return 'other';
}

// Updated Legend Rendering
export function renderLegendOneSideShots(colors, stageWidth, stageHeight) {
  const legendItems = [
    { label: 'Penalty Goal', color: colors['penalty goal'], hasWhiteBorder: true },
    { label: 'Goal', color: colors.goal, hasWhiteBorder: false },
    { label: 'Point', color: colors.point, hasWhiteBorder: false },
    { label: 'Miss', color: colors.miss, hasWhiteBorder: false },
    { label: 'SetPlay Score', color: typeof colors.setplayscore === 'object' ? colors.setplayscore.fill : colors.setplayscore, hasWhiteBorder: true },
    { label: 'SetPlay Miss', color: typeof colors.setplaymiss === 'object' ? colors.setplaymiss.fill : colors.setplaymiss, hasWhiteBorder: true },
  ];

  const itemHeight = 20;
  const legendWidth = 120;
  const legendHeight = legendItems.length * itemHeight + 10;

  return (
    <Layer>
      <Group x={stageWidth - legendWidth - 10} y={stageHeight - legendHeight - 10}>
        <Rect x={0} y={0} width={legendWidth} height={legendHeight} fill="rgba(0,0,0,0.5)" cornerRadius={5} />
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
              <Text x={30} y={yPos - 6} text={item.label} fontSize={12} fill="#fff" />
            </Group>
          );
        })}
      </Group>
    </Layer>
  );
}

// Full Pitch Rendering (unchanged)
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
      <Rect x={0} y={0} width={canvasSizeMain.width} height={canvasSizeMain.height} fill={pitchColorState} />
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
      <Line points={[0, 0, canvasSizeMain.width, 0, canvasSizeMain.width, canvasSizeMain.height, 0, canvasSizeMain.height, 0, 0]} stroke={lineColorState} strokeWidth={2} />
      <Line points={[canvasSizeMain.width, yScale * 40.75, xScale * 145.2, yScale * 40.75, xScale * 145.2, yScale * 47.25, canvasSizeMain.width, yScale * 47.25]} stroke={lineColorState} strokeWidth={2} />
      <Line points={[0, yScale * 40.75, xScale * -0.2, yScale * 40.75, xScale * -0.2, yScale * 47.25, 0, yScale * 47.25]} stroke={lineColorState} strokeWidth={2} />
      <Line points={[canvasSizeMain.width, yScale * 37, xScale * 140.5, yScale * 37, xScale * 140.5, yScale * 51, canvasSizeMain.width, yScale * 51]} stroke={lineColorState} strokeWidth={2} />
      <Line points={[0, yScale * 37, xScale * 4.5, yScale * 37, xScale * 4.5, yScale * 51, 0, yScale * 51]} stroke={lineColorState} strokeWidth={2} />
      <Line points={[0, yScale * 34.5, xScale * 13, yScale * 34.5, xScale * 13, yScale * 53.5, 0, yScale * 53.5]} stroke={lineColorState} strokeWidth={2} />
      <Line points={[canvasSizeMain.width, yScale * 34.5, xScale * 132, yScale * 34.5, xScale * 132, yScale * 53.5, canvasSizeMain.width, yScale * 53.5]} stroke={lineColorState} strokeWidth={2} />
      <Line points={[xScale * 72.5, yScale * 39, xScale * 72.5, yScale * 49]} stroke={lineColorState} strokeWidth={2} />
      <Line points={[xScale * 11, yScale * 43.5, xScale * 11, yScale * 44.5]} stroke={lineColorState} strokeWidth={2} />
      <Line points={[xScale * 134, yScale * 43.5, xScale * 134, yScale * 44.5]} stroke={lineColorState} strokeWidth={2} />
      <Arc x={xScale * 125} y={yScale * 44} innerRadius={0} outerRadius={xScale * 13} angle={180} rotation={90} stroke={lineColorState} strokeWidth={2} />
      <Arc x={xScale * 20} y={yScale * 44} innerRadius={0} outerRadius={xScale * 13} angle={180} rotation={270} stroke={lineColorState} strokeWidth={2} />
      <Line points={[xScale * 13, 0, xScale * 13, canvasSizeMain.height]} stroke={lineColorState} strokeWidth={2} />
      <Line points={[xScale * 132, 0, xScale * 132, canvasSizeMain.height]} stroke={lineColorState} strokeWidth={2} />
      <Line points={[xScale * 20, 0, xScale * 20, canvasSizeMain.height]} stroke={lineColorState} strokeWidth={2} />
      <Line points={[xScale * 125, 0, xScale * 125, canvasSizeMain.height]} stroke={lineColorState} strokeWidth={2} />
      <Line points={[xScale * 45, 0, xScale * 45, canvasSizeMain.height]} stroke={lineColorState} strokeWidth={2} />
      <Line points={[xScale * 100, 0, xScale * 100, canvasSizeMain.height]} stroke={lineColorState} strokeWidth={2} />
      <Line points={[xScale * 65, 0, xScale * 65, canvasSizeMain.height]} stroke={lineColorState} strokeWidth={2} />
      <Line points={[xScale * 80, 0, xScale * 80, canvasSizeMain.height]} stroke={lineColorState} strokeWidth={2} />
      <Arc x={xScale * 0} y={yScale * 44} innerRadius={xScale * 40} outerRadius={xScale * 40} angle={120} rotation={300} stroke={lineColorState} strokeWidth={2} closed={false} lineCap="round" />
      <Arc x={xScale * 145} y={yScale * 44} innerRadius={xScale * 40} outerRadius={xScale * 40} angle={120} rotation={120} stroke={lineColorState} strokeWidth={2} closed={false} lineCap="round" />
      <Text text="SCORELECT.COM" x={xScale * 22.5} y={canvasSizeMain.height / 40.25} fontSize={canvasSizeMain.width / 60} fill="#D3D3D3" opacity={0.7} rotation={0} align="center" />
      <Text text="SCORELECT.COM" x={canvasSizeMain.width - xScale * 22.5} y={canvasSizeMain.height / 1.02} fontSize={canvasSizeMain.width / 60} fill="#D3D3D3" opacity={0.7} rotation={180} align="center" />
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

// Updated One-Sided Pitch Rendering
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
  const halfPitchWidthPx = xScale * halfLineX;
  const pitchHeightPx = yScale * pitchHeight;

  return (
    <Layer>
      {/* Black background for half pitch */}
      <Rect x={0} y={0} width={halfPitchWidthPx} height={pitchHeightPx} fill="black" />
      {/* White outer boundary and half-line markings */}
      <Rect x={0} y={0} width={halfPitchWidthPx} height={pitchHeightPx} stroke="white" strokeWidth={2} fill="transparent" />
      <Line points={[halfPitchWidthPx, 0, halfPitchWidthPx, pitchHeightPx]} stroke="white" strokeWidth={2} />
      <Line points={[xScale * 13, 0, xScale * 13, pitchHeightPx]} stroke="white" strokeWidth={2} />
      <Line points={[xScale * 20, 0, xScale * 20, pitchHeightPx]} stroke="white" strokeWidth={2} />
      <Line points={[xScale * 45, 0, xScale * 45, pitchHeightPx]} stroke="white" strokeWidth={2} />
      <Line points={[xScale * 65, 0, xScale * 65, pitchHeightPx]} stroke="white" strokeWidth={2} />
      <Arc x={xScale * 20} y={yScale * 44} innerRadius={0} outerRadius={xScale * 13} angle={180} rotation={270} stroke="white" strokeWidth={2} />
      <Line points={[xScale * 11, yScale * 43.5, xScale * 11, yScale * 44.5]} stroke="white" strokeWidth={2} />
      <Line points={[0, yScale * 37, xScale * 4.5, yScale * 37, xScale * 4.5, yScale * 51, 0, yScale * 51]} stroke="white" strokeWidth={2} />
      <Line points={[0, yScale * 34.5, xScale * 13, yScale * 34.5, xScale * 13, yScale * 53.5, 0, yScale * 53.5]} stroke="white" strokeWidth={2} />
      <Arc x={xScale * 0} y={yScale * 44} innerRadius={xScale * 40} outerRadius={xScale * 40} angle={120} rotation={300} stroke="white" strokeWidth={2} closed={false} lineCap="round" />
      <Line points={[0, 0, halfPitchWidthPx, 0, halfPitchWidthPx, pitchHeightPx, 0, pitchHeightPx, 0, 0]} stroke="white" strokeWidth={2} />

      {/* Plot each translated shot */}
      {shots.map((shot, i) => {
        const mirroredShot = translateShotToLeftSide(shot, halfLineX);
        const translated = translateShotToOneSide(mirroredShot, halfLineX, goalX, goalY);
        const shotX = translated.x * xScale;
        const shotY = translated.y * yScale;
        const baseRadius = 5;
        const radius = baseRadius + (translated.xPoints ? translated.xPoints * 0.5 : 0);

        // Use renderType directly from shot (set in GAAAnalysisDashboard)
        const renderType = shot.renderType || 'miss';
        const color = colors[renderType];
        let fillColor = 'black';
        let strokeColor = null;
        let strokeWidth = 0;

        // Handle both string and object colors
        if (typeof color === 'object') {
          fillColor = color.fill || 'black';
          strokeColor = color.stroke || null;
          strokeWidth = strokeColor ? 2 : 0;
        } else {
          fillColor = color || 'black';
        }

        // Override for specific cases if needed
        if (renderType === 'penalty goal') {
          fillColor = colors['penalty goal'] || 'yellow';
          strokeColor = '#ffffff';
          strokeWidth = 2;
        }
        
        // Special override for free kicks 
        const action = (shot.action || '').toLowerCase().trim();
        if (action === 'free') {
          fillColor = '#39FF14'; // Bright green
          strokeColor = '#ffffff'; // White
          strokeWidth = 2;
        }
        
        // Handle forced color from upper components
        if (shot._forcedColor && shot.color) {
          fillColor = shot.color.fill || fillColor;
          strokeColor = shot.color.stroke || strokeColor;
          strokeWidth = shot.color.strokeWidth || strokeWidth;
        }

        return (
          <Circle
            key={i}
            x={shotX}
            y={shotY}
            radius={radius}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            opacity={0.85}
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