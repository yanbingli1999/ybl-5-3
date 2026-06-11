import { useRef, useEffect, useCallback } from 'react';
import { temperatureToColor, drawColorBar } from '../engine/ColorMap';
import useSimulationStore from '../store/useSimulationStore';

interface RenderOptions {
  showGrid?: boolean;
  showCellValues?: boolean;
  showColorBar?: boolean;
}

const HOTZONE_COLORS = [
  'rgba(249, 115, 22, 0.9)',
  'rgba(239, 68, 68, 0.9)',
  'rgba(219, 39, 119, 0.9)',
  'rgba(168, 85, 247, 0.9)',
  'rgba(59, 130, 246, 0.9)',
];

export function useHeatRenderer(canvasRef: React.RefObject<HTMLCanvasElement>, options: RenderOptions = {}) {
  const {
    grid,
    currentTemperature,
    minTemp,
    maxTemp,
    hoveredCell,
    boundaryConditions,
    showHotZones,
    currentStep,
    hotZoneFrames,
    currentHotZoneTracking,
    hotZoneThreshold,
  } = useSimulationStore();

  const {
    showGrid = true,
    showCellValues = false,
    showColorBar = true,
  } = options;

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentTemperature) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height, cellSize } = grid;
    const canvasWidth = width * cellSize;
    const canvasHeight = height * cellSize;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const temp = currentTemperature[y]?.[x] ?? 25;
        ctx.fillStyle = temperatureToColor(temp, minTemp, maxTemp);
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }

    if (showHotZones) {
      const frames = currentHotZoneTracking ? currentHotZoneTracking.frames : hotZoneFrames;
      const frame = frames.find((f) => f.step === currentStep);

      if (frame && frame.hotZones.length > 0) {
        for (let zIdx = 0; zIdx < frame.hotZones.length; zIdx++) {
          const zone = frame.hotZones[zIdx];
          const color = HOTZONE_COLORS[zIdx % HOTZONE_COLORS.length];

          const cellSet = new Set<string>();
          for (const c of zone.cells) {
            cellSet.add(`${c.x},${c.y}`);
          }

          for (const c of zone.cells) {
            const isBoundary =
              !cellSet.has(`${c.x - 1},${c.y}`) ||
              !cellSet.has(`${c.x + 1},${c.y}`) ||
              !cellSet.has(`${c.x},${c.y - 1}`) ||
              !cellSet.has(`${c.x},${c.y + 1}`);

            if (isBoundary) {
              ctx.strokeStyle = color;
              ctx.lineWidth = 1.5;
              ctx.strokeRect(
                c.x * cellSize + 0.5,
                c.y * cellSize + 0.5,
                cellSize - 1,
                cellSize - 1
              );
            }
          }

          if (cellSize >= 6) {
            const cx = zone.centerX * cellSize + cellSize / 2;
            const cy = zone.centerY * cellSize + cellSize / 2;
            const r = Math.min(4, cellSize * 0.35);

            ctx.beginPath();
            ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,0.95)';
            ctx.fill();

            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fillStyle = color.replace('0.9', '1');
            ctx.fill();

            if (zone.area >= 15 && cellSize >= 10) {
              ctx.font = 'bold 9px JetBrains Mono, monospace';
              ctx.fillStyle = '#fff';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'bottom';
              ctx.fillText(`${zone.area}`, cx, cy - r - 2);
            }
          }
        }

        ctx.fillStyle = 'rgba(249, 115, 22, 0.12)';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      } else if (currentStep === 0) {
        ctx.strokeStyle = `rgba(249, 115, 22, 0.25)`;
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1;
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const temp = currentTemperature[y]?.[x] ?? 25;
            if (temp >= hotZoneThreshold) {
              ctx.strokeRect(
                x * cellSize + 0.5,
                y * cellSize + 0.5,
                cellSize - 1,
                cellSize - 1
              );
            }
          }
        }
        ctx.setLineDash([]);
      }
    }

    if (showGrid && cellSize >= 6) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 0.5;
      
      for (let x = 0; x <= width; x++) {
        ctx.beginPath();
        ctx.moveTo(x * cellSize, 0);
        ctx.lineTo(x * cellSize, canvasHeight);
        ctx.stroke();
      }
      
      for (let y = 0; y <= height; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * cellSize);
        ctx.lineTo(canvasWidth, y * cellSize);
        ctx.stroke();
      }
    }

    ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)';
    ctx.lineWidth = 3;
    ctx.strokeRect(1, 1, canvasWidth - 2, canvasHeight - 2);

    if (boundaryConditions.type === 'dirichlet') {
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.textAlign = 'center';
      
      ctx.fillText(`${boundaryConditions.top.toFixed(0)}°C`, canvasWidth / 2, 14);
      ctx.fillText(`${boundaryConditions.bottom.toFixed(0)}°C`, canvasWidth / 2, canvasHeight - 4);
      
      ctx.save();
      ctx.translate(14, canvasHeight / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(`${boundaryConditions.left.toFixed(0)}°C`, 0, 0);
      ctx.restore();
      
      ctx.save();
      ctx.translate(canvasWidth - 14, canvasHeight / 2);
      ctx.rotate(Math.PI / 2);
      ctx.fillText(`${boundaryConditions.right.toFixed(0)}°C`, 0, 0);
      ctx.restore();
    }

    if (hoveredCell && showCellValues) {
      const { x, y } = hoveredCell;
      if (x >= 0 && x < width && y >= 0 && y < height) {
        const temp = currentTemperature[y]?.[x] ?? 25;
        
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(
          x * cellSize + 1,
          y * cellSize + 1,
          cellSize - 2,
          cellSize - 2
        );

        if (cellSize >= 20) {
          ctx.font = 'bold 11px JetBrains Mono, monospace';
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(
            `${temp.toFixed(1)}°`,
            x * cellSize + cellSize / 2,
            y * cellSize + cellSize / 2
          );
        }
      }
    }

    if (showColorBar) {
      const barWidth = 200;
      const barHeight = 16;
      const barX = canvasWidth - barWidth - 16;
      const barY = canvasHeight - barHeight - 16;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(barX - 8, barY - 28, barWidth + 16, barHeight + 40);

      drawColorBar(ctx, barX, barY, barWidth, barHeight, minTemp, maxTemp);

      ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.textAlign = 'left';
      ctx.fillText(`${minTemp.toFixed(0)}°C`, barX, barY - 8);
      ctx.textAlign = 'right';
      ctx.fillText(`${maxTemp.toFixed(0)}°C`, barX + barWidth, barY - 8);
      ctx.textAlign = 'center';
      ctx.fillText('温度 (°C)', barX + barWidth / 2, barY + barHeight + 14);

      if (showHotZones) {
        const thresholdY = barY - barHeight - 2;
        const ratio = Math.max(0, Math.min(1, (hotZoneThreshold - minTemp) / (maxTemp - minTemp)));
        const tx = barX + ratio * barWidth;
        ctx.beginPath();
        ctx.moveTo(tx - 4, thresholdY);
        ctx.lineTo(tx + 4, thresholdY);
        ctx.lineTo(tx, thresholdY + 6);
        ctx.closePath();
        ctx.fillStyle = '#f97316';
        ctx.fill();
        ctx.font = '9px JetBrains Mono, monospace';
        ctx.fillStyle = '#f97316';
        ctx.textAlign = 'center';
        ctx.fillText(`${hotZoneThreshold}°`, tx, thresholdY - 2);
      }
    }
  }, [
    canvasRef,
    grid,
    currentTemperature,
    minTemp,
    maxTemp,
    hoveredCell,
    boundaryConditions,
    showGrid,
    showCellValues,
    showColorBar,
    showHotZones,
    currentStep,
    hotZoneFrames,
    currentHotZoneTracking,
    hotZoneThreshold,
  ]);

  useEffect(() => {
    render();
  }, [render]);

  return { render };
}

export default useHeatRenderer;
