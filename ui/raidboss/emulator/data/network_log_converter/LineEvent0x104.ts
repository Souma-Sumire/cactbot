import logDefinitions from '../../../../../resources/netlog_defs';

import LineEvent from './LineEvent';
import LogRepository from './LogRepository';

const fields = logDefinitions.InCombat.fields;

// InCombat event (type 260 / 0x104)
export class LineEvent0x104 extends LineEvent {
  public readonly inACTCombat: string;
  public readonly inGameCombat: string;
  public readonly isACTChanged: string;
  public readonly isGameChanged: string;

  constructor(repo: LogRepository, networkLine: string, parts: string[]) {
    super(repo, networkLine, parts);

    this.inACTCombat = parts[fields.inACTCombat] ?? '0';
    this.inGameCombat = parts[fields.inGameCombat] ?? '0';
    this.isACTChanged = parts[fields.isACTChanged] ?? '0';
    this.isGameChanged = parts[fields.isGameChanged] ?? '0';
  }
}

export class LineEvent260 extends LineEvent0x104 {}
