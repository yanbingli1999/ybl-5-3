import React from 'react';
import { Play, Pause, RotateCcw, SkipForward, Save, Camera, Target } from 'lucide-react';
import useSimulationStore from '../store/useSimulationStore';
import useSimulation from '../hooks/useSimulation';
import api from '../services/api';
import type { TemperatureSnapshot } from '@shared/types';

export const ControlBar: React.FC = () => {
  const {
    currentStep,
    totalSteps,
    currentTemperature,
    currentExperimentId,
    addSnapshot,
    showHotZonePanel,
    setShowHotZonePanel,
    hotZoneFrames,
    currentHotZoneTracking,
    showHotZones,
    setShowHotZones,
    temperatureHistory,
  } = useSimulationStore();

  const { play, pause, reset, stepForward, isRunning, isPaused, isFinished, isIdle } = useSimulation();

  const generateId = () => `snap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const handleSaveSnapshot = async () => {
    const snapshot: TemperatureSnapshot = {
      id: generateId(),
      experimentId: currentExperimentId || 'default',
      step: currentStep,
      timestamp: Date.now(),
      temperatureData: currentTemperature.map(row => [...row]),
      name: `第 ${currentStep} 步`,
    };

    try {
      await api.snapshots.create(snapshot);
      addSnapshot(snapshot);
    } catch (error) {
      console.error('保存快照失败:', error);
    }
  };

  const handleSaveExperiment = async () => {
    const state = useSimulationStore.getState();
    const history = state.temperatureHistory;
    const step = state.currentStep;
    const config = {
      id: currentExperimentId || generateId(),
      name: `实验 ${new Date().toLocaleString('zh-CN')}`,
      createdAt: Date.now(),
      grid: state.grid,
      materialId: state.materialId,
      boundaryConditions: state.boundaryConditions,
      initialHeatSources: state.initialHeatSources,
      totalSteps: state.totalSteps,
      timeStep: state.timeStep,
      runtimeState: {
        temperatureHistory: history.map(frame => frame.map(row => [...row])),
        currentStep: step,
      },
    };

    try {
      if (!currentExperimentId) {
        await api.experiments.create(config);
        state.setCurrentExperimentId(config.id);
        state.setExperiments([
          ...state.experiments,
          config,
        ]);
      } else {
        await api.experiments.update(currentExperimentId, config);
        state.setExperiments(
          state.experiments.map(exp => (exp.id === currentExperimentId ? config : exp))
        );
      }
    } catch (error) {
      console.error('保存实验失败:', error);
    }
  };

  const formatTime = (step: number) => {
    const time = step * 0.1;
    return `${time.toFixed(1)}s`;
  };

  return (
    <div className="h-20 bg-slate-900/95 backdrop-blur-sm border-t border-slate-700 px-6 flex items-center justify-between gap-6">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 bg-slate-800 rounded-xl p-1">
          {isIdle || isPaused || isFinished ? (
            <button
              onClick={play}
              className="w-12 h-12 flex items-center justify-center bg-green-500 hover:bg-green-400 text-white rounded-xl transition-all hover:scale-105 shadow-lg shadow-green-500/30"
              title="播放"
            >
              <Play className="w-5 h-5 ml-0.5" />
            </button>
          ) : (
            <button
              onClick={pause}
              className="w-12 h-12 flex items-center justify-center bg-yellow-500 hover:bg-yellow-400 text-white rounded-xl transition-all hover:scale-105 shadow-lg shadow-yellow-500/30"
              title="暂停"
            >
              <Pause className="w-5 h-5" />
            </button>
          )}
          
          <button
            onClick={stepForward}
            disabled={isRunning}
            className="w-12 h-12 flex items-center justify-center bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-all hover:scale-105"
            title="单步执行"
          >
            <SkipForward className="w-5 h-5" />
          </button>
          
          <button
            onClick={reset}
            className="w-12 h-12 flex items-center justify-center bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all hover:scale-105"
            title="重置"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveSnapshot}
            className="flex items-center gap-2 px-4 py-2.5 bg-purple-500/90 hover:bg-purple-500 text-white rounded-xl transition-all hover:scale-105 shadow-lg shadow-purple-500/20 text-sm font-medium"
          >
            <Camera className="w-4 h-4" />
            保存快照
          </button>
          <button
            onClick={handleSaveExperiment}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-500/90 hover:bg-blue-500 text-white rounded-xl transition-all hover:scale-105 shadow-lg shadow-blue-500/20 text-sm font-medium"
          >
            <Save className="w-4 h-4" />
            保存实验
          </button>
          <div className="h-8 w-px bg-slate-700" />
          <button
            onClick={() => setShowHotZones(!showHotZones)}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all hover:scale-105 text-sm font-medium ${
              showHotZones
                ? 'bg-orange-500/90 hover:bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
            }`}
            title={showHotZones ? '隐藏热区' : '显示热区'}
          >
            <Target className="w-4 h-4" />
            {showHotZones ? '热区开' : '热区关'}
          </button>
          <button
            onClick={() => setShowHotZonePanel(!showHotZonePanel)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all hover:scale-105 text-sm font-medium ${
              showHotZonePanel
                ? 'bg-pink-500/90 hover:bg-pink-500 text-white shadow-lg shadow-pink-500/20'
                : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
            }`}
          >
            <Target className="w-4 h-4" />
            热区追踪
            {(hotZoneFrames.length > 0 || currentHotZoneTracking) && (
              <span className="ml-0.5 w-2 h-2 rounded-full bg-white animate-pulse" />
            )}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-8">
        <div className="text-center">
          <div className="text-xs text-slate-400 font-medium">当前步数</div>
          <div className="text-2xl font-bold text-white font-mono">
            {currentStep} <span className="text-sm text-slate-500">/ {totalSteps}</span>
          </div>
        </div>
        
        <div className="w-px h-10 bg-slate-700" />
        
        <div className="text-center">
          <div className="text-xs text-slate-400 font-medium">模拟时间</div>
          <div className="text-2xl font-bold text-cyan-400 font-mono">
            {formatTime(currentStep)}
          </div>
        </div>
        
        <div className="w-px h-10 bg-slate-700" />
        
        <div className="text-center">
          <div className="text-xs text-slate-400 font-medium">状态</div>
          <div className={`text-lg font-bold ${
            isRunning ? 'text-green-400' :
            isPaused ? 'text-yellow-400' :
            isFinished ? 'text-purple-400' :
            'text-slate-400'
          }`}>
            {isRunning ? '运行中' : isPaused ? '已暂停' : isFinished ? '已完成' : '待命'}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="w-48 h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 via-green-500 to-yellow-500 transition-all duration-100"
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          />
        </div>
        <span className="text-xs text-slate-400 font-mono min-w-12">
          {((currentStep / totalSteps) * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
};

export default ControlBar;
