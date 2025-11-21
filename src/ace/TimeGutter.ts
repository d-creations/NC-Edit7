export class TimeGutter {
  private times: Map<number, number> = new Map(); // line -> time (seconds)

  getWidth(_session: any, _lastLineNumber: number, config: any) {
    return 6 * config.characterWidth; // Approximate width
  }

  getText(_session: any, row: number) {
    const time = this.times.get(row);
    return time !== undefined ? time.toFixed(1) : '';
  }

  updateTimes(times: Map<number, number> | Record<string, number>) {
    if (times instanceof Map) {
      this.times = times;
    } else {
      this.times = new Map();
      Object.entries(times).forEach(([line, time]) => {
        this.times.set(parseInt(line, 10), time);
      });
    }
  }
}
