import EmulatorCommon from '../EmulatorCommon';
import EventBus from '../EventBus';

import LineEvent from './network_log_converter/LineEvent';
import { LineEvent0x01 } from './network_log_converter/LineEvent0x01';
import { LineEvent260 } from './network_log_converter/LineEvent0x104';

export default class LogEventHandler extends EventBus {
  public currentFight: LineEvent[] = [];
  public currentZoneName = 'Unknown';
  public currentZoneId = '-1';
  public inCombat = false;

  parseLogs(logs: LineEvent[]): void {
    for (const lineObj of logs) {
      if (lineObj instanceof LineEvent0x01) {
        this.endFight();
        this.currentZoneId = lineObj.zoneId;
        this.currentZoneName = lineObj.zoneName;
        continue;
      }

      if (lineObj instanceof LineEvent260) {
        if (lineObj.inACTCombat === '1' && lineObj.inGameCombat === '1') {
          if (!this.inCombat) {
            this.inCombat = true;
            this.currentFight = [];
            this.currentFight.push(lineObj);
            lineObj.offset = 0;
            continue;
          }
        } else if (lineObj.inACTCombat === '0' && lineObj.inGameCombat === '0') {
          if (this.inCombat) {
            this.currentFight.push(lineObj);
            lineObj.offset = lineObj.timestamp - this.currentFightStart;
            this.endFight();
            continue;
          }
        }
      }

      if (!this.inCombat) {
        const startMatch = EmulatorCommon.matchStart(lineObj.networkLine);
        if (startMatch && startMatch.StartType !== 'Countdown') {
          this.inCombat = true;
          this.currentFight = [];
          this.currentFight.push(lineObj);
          lineObj.offset = 0;
          continue;
        }
      }

      if (this.inCombat) {
        this.currentFight.push(lineObj);
        lineObj.offset = lineObj.timestamp - this.currentFightStart;

        const res = EmulatorCommon.matchEnd(lineObj.networkLine);
        if (res) {
          this.endFight();
        }
      }
    }
  }

  private get currentFightStart(): number {
    return this.currentFight[0]?.timestamp ?? 0;
  }

  private get currentFightEnd(): number {
    return this.currentFight.slice(-1)[0]?.timestamp ?? 0;
  }

  endFight(): void {
    this.inCombat = false;
    if (this.currentFight.length < 2) {
      this.currentFight = [];
      return;
    }

    const start = new Date(this.currentFightStart).toISOString();
    const end = new Date(this.currentFightEnd).toISOString();

    console.debug(`Dispatching new fight
Start: ${start}
End: ${end}
Zone: ${this.currentZoneName}
Line Count: ${this.currentFight.length}
`);
    void this.dispatch(
      'fight',
      start.slice(0, 10),
      this.currentZoneId,
      this.currentZoneName,
      this.currentFight,
    );

    this.currentFight = [];
  }
}
