import React, { useState, useMemo } from 'react';
import { Clock, Bookmark, Trash2, Play } from 'lucide-react';
import useSimulationStore from '../store/useSimulationStore';
import useSimulation from '../hooks/useSimulation';
import api from '../services/api';

export const Timeline: React.FC = () => {
  const {
    currentStep,
    totalSteps,
    temperatureHistory,
    snapshots,
    removeSnapshot,
    minTemp,
    maxTemp,
    hotZoneFrames,
    currentHotZoneTracking,
    showHotZones,
  } = useSimulationStore();

  const { goToStep, isRunning } = useSimulation();
  const [hoveredSnapshot, setHoveredSnapshot] = useState<string | null>(null);

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isRunning) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const targetStep = Math.floor(ratio * totalSteps);
    if (targetStep >= 0 && targetStep < temperatureHistory.length) {
      goToStep(targetStep);
    }
  };

  const handleSnapshotClick = (snapshot: typeof snapshots[0]) => {
    if (isRunning) return;
    if (snapshot.step < temperatureHistory.length) {
      goToStep(snapshot.step);
    }
  };

  const handleDeleteSnapshot = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.snapshots.delete(id);
      removeSnapshot(id);
    } catch (error) {
      console.error('删除快照失败:', error);
    }
  };

  const formatTime = (step: number) => {
    return `${(step * 0.1).toFixed(1)}s`;
  };

  const getSnapshotColor = (step: number) => {
    const temp = temperatureHistory[step]?.[Math.floor(useSimulationStore.getState().grid.height / 2)]?.[
      Math.floor(useSimulationStore.getState().grid.width / 2)
    ] ?? 25;
    const ratio = Math.max(0, Math.min(1, (temp - minTemp) / (maxTemp - minTemp)));
    
    if (ratio < 0.25) return 'bg-blue-600';
    if (ratio < 0.5) return 'bg-cyan-500';
    if (ratio < 0.75) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const marks = Array.from({ length: 11 }, (_, i) => ({
    step: Math.floor((i / 10) * totalSteps),
    label: `${(i * 10)}%`,
  }));

  const hotZoneTrend = useMemo(() => {
    const frames = currentHotZoneTracking ? currentHotZoneTracking.frames : hotZoneFrames;
    if (frames.length === 0) return null;
    const maxCount = Math.max(...frames.map((f) => f.hotZoneCount), 1);
    const maxArea = Math.max(...frames.map((f) => f.totalArea), 1);
    return { frames, maxCount, maxArea };
  }, [hotZoneFrames, currentHotZoneTracking]);

  return (
    <div className="h-32 bg-slate-900/95 backdrop-blur-sm border-t border-slate-700 px-6 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-300">
          <Clock className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium">时间轴</span>
          {hotZoneTrend && showHotZones && (
            <div className="flex items-center gap-3 ml-4">
              <div className="flex items-center gap-1 text-xs">
                <span className="w-3 h-3 rounded-sm bg-orange-500/60" />
                <span className="text-slate-400">热区数量</span>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <span className="w-3 h-3 rounded-sm bg-pink-500/40" />
                <span className="text-slate-400">总面积</span>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Bookmark className="w-4 h-4 text-purple-400" />
          <span className="text-sm text-slate-400">{snapshots.length} 个快照</span>
        </div>
      </div>

      <div
        className="relative h-10 bg-slate-800 rounded-lg cursor-pointer group overflow-hidden"
        onClick={handleTimelineClick}
      >
        {hotZoneTrend && showHotZones && (
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            preserveAspectRatio="none"
            viewBox="0 0 100 40"
          >
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(236, 72, 153, 0.35)" />
                <stop offset="100%" stopColor="rgba(236, 72, 153, 0.02)" />
              </linearGradient>
            </defs>
            {(() => {
              const n = hotZoneTrend.frames.length;
              if (n < 2) return null;
              let areaPath = '';
              let countPath = '';
              for (let i = 0; i < n; i++) {
                const f = hotZoneTrend.frames[i];
                const x = (f.step / Math.max(totalSteps - 1, 1)) * 100;
                const yArea = 38 - (f.totalArea / hotZoneTrend.maxArea) * 34;
                const yCount = 38 - (f.hotZoneCount / hotZoneTrend.maxCount) * 34;
                if (i === 0) {
                  areaPath = `M ${x} 38 L ${x} ${yArea}`;
                  countPath = `M ${x} ${yCount}`;
                } else {
                  areaPath += ` L ${x} ${yArea}`;
                  countPath += ` L ${x} ${yCount}`;
                }
              }
              areaPath += ' L 100 38 Z';
              return (
                <>
                  <path d={areaPath} fill="url(#areaGrad)" />
                  <path
                    d={countPath}
                    fill="none"
                    stroke="rgba(249, 115, 22, 0.85)"
                    strokeWidth="1.2"
                    vectorEffect="non-scaling-stroke"
                  />
                </>
              );
            })()}
          </svg>
        )}

        <div
          className="absolute h-full bg-gradient-to-r from-blue-600/30 to-green-600/30 rounded-lg transition-all"
          style={{ width: `${(currentStep / totalSteps) * 100}%` }}
        />
        
        {marks.map((mark) => (
          <div
            key={mark.step}
            className="absolute top-0 h-full w-px bg-slate-600/50"
            style={{ left: `${(mark.step / totalSteps) * 100}%` }}
          >
            <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs text-slate-500">
              {mark.label}
            </span>
          </div>
        ))}

        {snapshots.map((snapshot) => (
          <div
            key={snapshot.id}
            className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 border-slate-900 cursor-pointer transition-all hover:scale-125 flex items-center justify-center ${
              hoveredSnapshot === snapshot.id ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 z-10' : ''
            } ${getSnapshotColor(snapshot.step)}`}
            style={{ left: `calc(${(snapshot.step / totalSteps) * 100}% - 10px)` }}
            onClick={(e) => {
              e.stopPropagation();
              handleSnapshotClick(snapshot);
            }}
            onMouseEnter={() => setHoveredSnapshot(snapshot.id)}
            onMouseLeave={() => setHoveredSnapshot(null)}
          >
            <Play className="w-2.5 h-2.5 text-white" fill="white" />
            
            {hoveredSnapshot === snapshot.id && (
              <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 shadow-xl whitespace-nowrap z-20">
                <div className="text-xs font-medium text-white">{snapshot.name}</div>
                <div className="text-xs text-slate-400">
                  第 {snapshot.step} 步 · {formatTime(snapshot.step)}
                </div>
                <button
                  onClick={(e) => handleDeleteSnapshot(snapshot.id, e)}
                  className="mt-1 w-full flex items-center justify-center gap-1 text-xs text-red-400 hover:text-red-300"
                >
                  <Trash2 className="w-3 h-3" />
                  删除
                </button>
              </div>
            )}
          </div>
        ))}

        <div
          className="absolute top-0 w-1 h-full bg-white rounded-full shadow-lg shadow-white/50 transition-all z-10"
          style={{ left: `${(currentStep / totalSteps) * 100}%` }}
        />
      </div>

      <div className="flex justify-between text-xs text-slate-500">
        <span>第 0 步</span>
        <span className="text-blue-400 font-medium">
          当前: 第 {currentStep} 步 ({formatTime(currentStep)})
        </span>
        <span>第 {totalSteps} 步</span>
      </div>
    </div>
  );
};

export default Timeline;
