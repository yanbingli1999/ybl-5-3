import type { HotZone, HotZoneFrame, HotZoneTracking } from '@shared/types';

function generateId(): string {
  return `hz_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
}

export class HotZoneDetector {
  private width: number;
  private height: number;
  private threshold: number;

  constructor(width: number, height: number, threshold: number) {
    this.width = width;
    this.height = height;
    this.threshold = threshold;
  }

  setThreshold(threshold: number): void {
    this.threshold = threshold;
  }

  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  detect(temperatureData: number[][], step: number): HotZoneFrame {
    const visited: boolean[][] = [];
    for (let y = 0; y < this.height; y++) {
      visited[y] = new Array(this.width).fill(false);
    }

    const hotZones: HotZone[] = [];

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (!visited[y][x] && temperatureData[y][x] >= this.threshold) {
          const zone = this.bfs(temperatureData, visited, x, y);
          if (zone) {
            hotZones.push(zone);
          }
        }
      }
    }

    hotZones.sort((a, b) => b.area - a.area);

    let totalArea = 0;
    for (const z of hotZones) {
      totalArea += z.area;
    }

    return {
      step,
      timestamp: Date.now(),
      hotZones,
      hotZoneCount: hotZones.length,
      totalArea,
    };
  }

  private bfs(
    temperatureData: number[][],
    visited: boolean[][],
    startX: number,
    startY: number
  ): HotZone | null {
    const cells: { x: number; y: number }[] = [];
    const queue: { x: number; y: number }[] = [];
    queue.push({ x: startX, y: startY });
    visited[startY][startX] = true;

    let sumX = 0;
    let sumY = 0;
    let sumTemp = 0;
    let maxTemp = -Infinity;

    const directions = [
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: -1, dy: -1 },
      { dx: 1, dy: -1 },
      { dx: -1, dy: 1 },
      { dx: 1, dy: 1 },
    ];

    while (queue.length > 0) {
      const { x, y } = queue.shift()!;
      const temp = temperatureData[y][x];

      cells.push({ x, y });
      sumX += x;
      sumY += y;
      sumTemp += temp;
      if (temp > maxTemp) maxTemp = temp;

      for (const { dx, dy } of directions) {
        const nx = x + dx;
        const ny = y + dy;
        if (
          nx >= 0 &&
          nx < this.width &&
          ny >= 0 &&
          ny < this.height &&
          !visited[ny][nx] &&
          temperatureData[ny][nx] >= this.threshold
        ) {
          visited[ny][nx] = true;
          queue.push({ x: nx, y: ny });
        }
      }
    }

    if (cells.length === 0) return null;

    const area = cells.length;
    const centerX = sumX / area;
    const centerY = sumY / area;
    const avgTemperature = sumTemp / area;

    return {
      id: generateId(),
      area,
      centerX,
      centerY,
      maxTemperature: maxTemp,
      avgTemperature,
      cells,
    };
  }
}

interface TrackedZone {
  trackId: string;
  lastCenterX: number;
  lastCenterY: number;
  firstStep: number;
  lastStep: number;
  areas: number[];
  maxTemperature: number;
}

export function buildTracking(
  frames: HotZoneFrame[],
  experimentId: string,
  threshold: number
): HotZoneTracking {
  const tracked: TrackedZone[] = [];
  let trackCounter = 0;

  for (const frame of frames) {
    const usedTrackIds = new Set<string>();

    for (const zone of frame.hotZones) {
      let bestTrack: TrackedZone | null = null;
      let bestDist = Infinity;

      for (const t of tracked) {
        if (usedTrackIds.has(t.trackId)) continue;
        const dist = Math.sqrt(
          Math.pow(zone.centerX - t.lastCenterX, 2) +
          Math.pow(zone.centerY - t.lastCenterY, 2)
        );
        if (dist < bestDist && dist < Math.max(zone.area, 5)) {
          bestDist = dist;
          bestTrack = t;
        }
      }

      if (bestTrack) {
        bestTrack.lastStep = frame.step;
        bestTrack.lastCenterX = zone.centerX;
        bestTrack.lastCenterY = zone.centerY;
        bestTrack.areas.push(zone.area);
        if (zone.maxTemperature > bestTrack.maxTemperature) {
          bestTrack.maxTemperature = zone.maxTemperature;
        }
        usedTrackIds.add(bestTrack.trackId);
      } else {
        const newTrack: TrackedZone = {
          trackId: `track_${trackCounter++}`,
          lastCenterX: zone.centerX,
          lastCenterY: zone.centerY,
          firstStep: frame.step,
          lastStep: frame.step,
          areas: [zone.area],
          maxTemperature: zone.maxTemperature,
        };
        tracked.push(newTrack);
        usedTrackIds.add(newTrack.trackId);
      }
    }
  }

  const trackedZones = tracked.map((t) => {
    const duration = t.lastStep - t.firstStep;
    const maxArea = Math.max(...t.areas);
    const avgArea = t.areas.reduce((a, b) => a + b, 0) / t.areas.length;
    return {
      trackId: t.trackId,
      firstStep: t.firstStep,
      lastStep: t.lastStep,
      duration,
      maxArea,
      avgArea,
      maxTemperature: t.maxTemperature,
    };
  });

  return {
    id: `trk_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`,
    experimentId,
    threshold,
    createdAt: Date.now(),
    frames,
    trackedZones,
  };
}

export default HotZoneDetector;
