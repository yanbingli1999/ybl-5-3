import React, { useState, useMemo } from 'react';
import {
  X,
  Thermometer,
  Play,
  Save,
  Trash2,
  Eye,
  EyeOff,
  Target,
  Layers,
  MapPin,
  Clock,
  BarChart3,
} from 'lucide-react';
import useSimulationStore from '../store/useSimulationStore';
import { HotZoneDetector, buildTracking } from '../engine/HotZoneDetector';
import api from '../services/api';
import type { HotZoneFrame, HotZoneTracking } from '@shared/types';

export const HotZonePanel: React.FC = () => {
  const {
    grid,
    temperatureHistory,
    totalSteps,
    currentExperimentId,
    hotZoneThreshold,
    hotZoneFrames,
    hotZoneTrackings,
    currentHotZoneTracking,
    showHotZones,
    showHotZonePanel,
    setHotZoneThreshold,
    setHotZoneFrames,
    setHotZoneTrackings,
    setCurrentHotZoneTracking,
    setShowHotZones,
    setShowHotZonePanel,
    addHotZoneTracking,
    removeHotZoneTracking,
  } = useSimulationStore();

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);

  const currentFrame = useMemo(() => {
    if (!currentHotZoneTracking && hotZoneFrames.length === 0) return null;
    if (currentHotZoneTracking) {
      const step = useSimulationStore.getState().currentStep;
      return currentHotZoneTracking.frames.find(f => f.step === step) || currentHotZoneTracking.frames[0] || null;
    }
    const step = useSimulationStore.getState().currentStep;
    return hotZoneFrames.find(f => f.step === step) || hotZoneFrames[hotZoneFrames.length - 1] || null;
  }, [currentHotZoneTracking, hotZoneFrames]);

  const runAnalysis = async () => {
    if (temperatureHistory.length === 0) return;
    setIsAnalyzing(true);
    setProgress(0);

    const detector = new HotZoneDetector(grid.width, grid.height, hotZoneThreshold);
    const frames: HotZoneFrame[] = [];

    const stepSize = Math.max(1, Math.floor(temperatureHistory.length / 100));
    for (let i = 0; i < temperatureHistory.length; i++) {
      const frame = detector.detect(temperatureHistory[i], i);
      frames.push(frame);
      if (i % stepSize === 0) {
        setProgress(Math.floor((i / temperatureHistory.length) * 100));
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    setHotZoneFrames(frames);
    setCurrentHotZoneTracking(null);
    setProgress(100);
    setIsAnalyzing(false);
  };

  const saveTracking = async () => {
    if (!currentExperimentId) {
      alert('请先保存实验！');
      return;
    }
    const frames = currentHotZoneTracking ? currentHotZoneTracking.frames : hotZoneFrames;
    if (frames.length === 0) return;

    const tracking: HotZoneTracking = buildTracking(frames, currentExperimentId, hotZoneThreshold);
    try {
      await api.hotZoneTrackings.create(tracking);
      addHotZoneTracking(tracking);
      setCurrentHotZoneTracking(tracking);
    } catch (error) {
      console.error('保存热区追踪失败:', error);
    }
  };

  const loadTracking = async (tracking: HotZoneTracking) => {
    try {
      const detail = await api.hotZoneTrackings.getDetail(tracking.id);
      setCurrentHotZoneTracking(detail);
      setHotZoneThreshold(detail.threshold);
      setHotZoneFrames(detail.frames);
    } catch (error) {
      console.error('加载热区追踪失败:', error);
    }
  };

  const deleteTracking = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.hotZoneTrackings.delete(id);
      removeHotZoneTracking(id);
      if (currentHotZoneTracking?.id === id) {
        setCurrentHotZoneTracking(null);
      }
    } catch (error) {
      console.error('删除热区追踪失败:', error);
    }
  };

  const formatTime = (step: number) => `${(step * 0.1).toFixed(1)}s`;

  if (!showHotZonePanel) return null;

  return (
    <div className="absolute top-4 right-4 w-96 max-h-[calc(100vh-12rem)] bg-slate-900/95 backdrop-blur-sm border border-slate-700 rounded-2xl shadow-2xl overflow-hidden z-30 flex flex-col">
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-orange-400" />
          <h3 className="text-lg font-bold text-slate-100">热区追踪</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowHotZones(!showHotZones)}
            className={`p-2 rounded-lg transition-all ${showHotZones ? 'bg-orange-500/20 text-orange-400' : 'text-slate-400 hover:bg-slate-800'}`}
            title={showHotZones ? '隐藏热区' : '显示热区'}
          >
            {showHotZones ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setShowHotZonePanel(false)}
            className="p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200 rounded-lg transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Thermometer className="w-4 h-4 text-red-400" />
            <span className="text-sm font-semibold text-slate-300">温度阈值</span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-400">
              <span>阈值温度</span>
              <span className="font-mono text-orange-400">{hotZoneThreshold}°C</span>
            </div>
            <input
              type="range"
              min="30"
              max="200"
              value={hotZoneThreshold}
              onChange={(e) => setHotZoneThreshold(Number(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={runAnalysis}
            disabled={isAnalyzing || temperatureHistory.length === 0}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-orange-500/90 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-all text-sm font-medium"
          >
            {isAnalyzing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                分析中 {progress}%
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                分析全部快照
              </>
            )}
          </button>
          <button
            onClick={saveTracking}
            disabled={(hotZoneFrames.length === 0 && !currentHotZoneTracking)}
            className="flex items-center justify-center gap-2 px-3 py-2.5 bg-green-500/90 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-all text-sm font-medium"
          >
            <Save className="w-4 h-4" />
            保存
          </button>
        </div>

        {isAnalyzing && (
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-500 to-red-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {currentFrame && currentFrame.hotZoneCount > 0 && (
          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700 space-y-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-semibold text-slate-300">当前步统计</span>
              <span className="text-xs text-slate-500">第 {currentFrame.step} 步</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-900/50 rounded-lg p-2">
                <div className="text-xs text-slate-500">热区数量</div>
                <div className="text-lg font-bold text-orange-400 font-mono">{currentFrame.hotZoneCount}</div>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-2">
                <div className="text-xs text-slate-500">总面积</div>
                <div className="text-lg font-bold text-red-400 font-mono">{currentFrame.totalArea}</div>
              </div>
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {currentFrame.hotZones.slice(0, 5).map((zone, idx) => (
                <div key={zone.id} className="flex items-center justify-between bg-slate-900/50 rounded-lg px-2 py-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3 h-3 text-orange-400" />
                    <span className="text-slate-300">#{idx + 1}</span>
                    <span className="text-slate-500">({zone.centerX.toFixed(0)}, {zone.centerY.toFixed(0)})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Layers className="w-3 h-3 text-slate-500" />
                    <span className="text-slate-300 font-mono">{zone.area}</span>
                    <span className="text-orange-400 font-mono">{zone.maxTemperature.toFixed(0)}°</span>
                  </div>
                </div>
              ))}
              {currentFrame.hotZones.length > 5 && (
                <div className="text-xs text-slate-500 text-center py-1">
                  还有 {currentFrame.hotZones.length - 5} 个热区...
                </div>
              )}
            </div>
          </div>
        )}

        {currentHotZoneTracking && currentHotZoneTracking.trackedZones.length > 0 && (
          <div className="bg-slate-800/50 rounded-xl p-3 border border-yellow-500/30 space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-semibold text-slate-300">持续追踪 ({currentHotZoneTracking.trackedZones.length})</span>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {currentHotZoneTracking.trackedZones.map((tz) => (
                <div key={tz.trackId} className="bg-slate-900/50 rounded-lg px-2 py-1.5 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-yellow-400">{tz.trackId}</span>
                    <span className="text-slate-400">{tz.duration} 步</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-[10px] text-slate-500">
                    <div>第{tz.firstStep}-{tz.lastStep}步</div>
                    <div>最大{tz.maxArea}格</div>
                    <div className="text-orange-400">{tz.maxTemperature.toFixed(0)}°C</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {hotZoneTrackings.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-semibold text-slate-300">历史追踪记录</div>
            <div className="space-y-1.5">
              {hotZoneTrackings.map((trk) => (
                <div
                  key={trk.id}
                  onClick={() => loadTracking(trk)}
                  className={`flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2 text-xs cursor-pointer border transition-all group ${
                    currentHotZoneTracking?.id === trk.id
                      ? 'border-orange-500/50 bg-orange-500/10'
                      : 'border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="text-slate-300 flex items-center gap-2">
                      <Thermometer className="w-3 h-3 text-orange-400" />
                      阈值 {trk.threshold}°C
                    </div>
                    <div className="text-slate-500">
                      {trk.frames.length} 帧 · {trk.trackedZones.length} 个追踪
                    </div>
                  </div>
                  <button
                    onClick={(e) => deleteTracking(trk.id, e)}
                    className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded text-red-400 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {hotZoneFrames.length > 0 && !currentHotZoneTracking && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 text-xs text-blue-300">
            分析完成！共 {hotZoneFrames.length} 帧。点击「保存」按钮将追踪结果保存到当前实验。
          </div>
        )}

        {temperatureHistory.length === 0 && (
          <div className="text-center py-6 text-slate-500 text-sm">
            <Target className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>先运行模拟，生成时间轴数据</p>
            <p className="text-xs mt-1">然后设置阈值并开始分析</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default HotZonePanel;
