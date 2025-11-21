/**
 * PlotService - Converts parser output into three.js scene elements
 */

import type { ChannelId, MachineId, PlotResponse, PlotSegment } from '@core/types';

/**
 * PlotService manages plot data and caching for three.js rendering
 */
export class PlotService {
  private plotCache = new Map<string, PlotResponse>();

  /**
   * Get cache key for a channel/machine combination
   */
  private getCacheKey(channelId: ChannelId, machineId: MachineId): string {
    return `${channelId}:${machineId}`;
  }

  /**
   * Store plot data in cache
   */
  setPlotData(channelId: ChannelId, machineId: MachineId, plotData: PlotResponse): void {
    const key = this.getCacheKey(channelId, machineId);
    this.plotCache.set(key, plotData);
  }

  /**
   * Get plot data from cache
   */
  getPlotData(channelId: ChannelId, machineId: MachineId): PlotResponse | undefined {
    const key = this.getCacheKey(channelId, machineId);
    return this.plotCache.get(key);
  }

  /**
   * Clear plot data for a channel
   */
  clearChannel(channelId: ChannelId): void {
    const keysToDelete: string[] = [];

    for (const key of this.plotCache.keys()) {
      if (key.startsWith(`${channelId}:`)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.plotCache.delete(key);
    }
  }

  /**
   * Clear all plot data
   */
  clearAll(): void {
    this.plotCache.clear();
  }

  /**
   * Get segments for a specific tool
   */
  getSegmentsByTool(channelId: ChannelId, machineId: MachineId, toolNumber: number): PlotSegment[] {
    const plotData = this.getPlotData(channelId, machineId);
    if (!plotData) {
      return [];
    }

    return plotData.segments.filter((seg) => seg.toolNumber === toolNumber);
  }

  /**
   * Get segments up to a specific line number (for timeline sync)
   */
  getSegmentsUpToLine(
    channelId: ChannelId,
    machineId: MachineId,
    lineNumber: number
  ): PlotSegment[] {
    const plotData = this.getPlotData(channelId, machineId);
    if (!plotData) {
      return [];
    }

    return plotData.segments.filter((seg) => seg.lineNumber <= lineNumber);
  }

  /**
   * Calculate bounding box for plot data
   */
  calculateBounds(plotData: PlotResponse) {
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;

    for (const segment of plotData.segments) {
      for (const point of segment.points) {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        minZ = Math.min(minZ, point.z);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
        maxZ = Math.max(maxZ, point.z);
      }
    }

    return {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ },
      center: {
        x: (minX + maxX) / 2,
        y: (minY + maxY) / 2,
        z: (minZ + maxZ) / 2,
      },
      size: {
        x: maxX - minX,
        y: maxY - minY,
        z: maxZ - minZ,
      },
    };
  }

  /**
   * Get statistics about the plot
   */
  getPlotStatistics(channelId: ChannelId, machineId: MachineId) {
    const plotData = this.getPlotData(channelId, machineId);
    if (!plotData) {
      return null;
    }

    const tools = new Set<number>();
    let totalPoints = 0;
    const segmentTypes = new Map<string, number>();

    for (const segment of plotData.segments) {
      tools.add(segment.toolNumber);
      totalPoints += segment.points.length;

      const count = segmentTypes.get(segment.type) || 0;
      segmentTypes.set(segment.type, count + 1);
    }

    return {
      totalSegments: plotData.segments.length,
      totalPoints,
      uniqueTools: tools.size,
      tools: Array.from(tools),
      segmentTypes: Object.fromEntries(segmentTypes),
      bounds: plotData.metadata.bounds,
      totalDistance: plotData.metadata.totalDistance,
      totalTime: plotData.metadata.totalTime,
    };
  }

  /**
   * Dispose of the service
   */
  dispose(): void {
    this.clearAll();
  }
}
