
import React, { useState, useRef } from 'react';
import { Stage, Layer, Line } from 'react-konva';

interface DrawingCanvasProps {
  width: number;
  height: number;
  onDraw: (lines: any[]) => void;
  lines: any[];
}

const DrawingCanvas: React.FC<DrawingCanvasProps> = ({ width, height, onDraw, lines }) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const stageRef = useRef<any>(null);

  const handleMouseDown = () => {
    setIsDrawing(true);
    const pos = stageRef.current.getPointerPosition();
    onDraw([...lines, { points: [pos.x, pos.y] }]);
  };

  const handleMouseMove = () => {
    if (!isDrawing) {
      return;
    }
    const pos = stageRef.current.getPointerPosition();
    let lastLine = lines[lines.length - 1];
    lastLine.points = lastLine.points.concat([pos.x, pos.y]);
    lines.splice(lines.length - 1, 1, lastLine);
    onDraw(lines.concat());
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  return (
    <Stage
      width={width}
      height={height}
      onMouseDown={handleMouseDown}
      onMousemove={handleMouseMove}
      onMouseup={handleMouseUp}
      ref={stageRef}
      style={{ position: 'absolute', top: 0, left: 0, zIndex: 10 }}
    >
      <Layer>
        {lines.map((line, i) => (
          <Line key={i} points={line.points} stroke="red" strokeWidth={5} tension={0.5} lineCap="round" />
        ))}
      </Layer>
    </Stage>
  );
};

export default DrawingCanvas;
