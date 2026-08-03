import { isLang, Lang } from '../../../../resources/languages';
import { UnreachableCode } from '../../../../resources/not_reached';
import PetNamesByLang from '../../../../resources/pet_names';
import EmulatorCommon, { MatchEndInfo, MatchStartInfo } from '../EmulatorCommon';

import CombatantTracker from './CombatantTracker';
import LogEventHandler from './LogEventHandler';
import LineEvent, { isLineEventSource, isLineEventTarget } from './network_log_converter/LineEvent';
import { LineEvent260 } from './network_log_converter/LineEvent0x104';
import LogRepository from './network_log_converter/LogRepository';
import NetworkLogConverter from './NetworkLogConverter';

const isPetName = (name: string, language?: Lang) => {
  if (language)
    return PetNamesByLang[language].includes(name);

  for (const lang in PetNamesByLang) {
    if (!isLang(lang))
      throw new UnreachableCode();
    if (PetNamesByLang[lang].includes(name))
      return true;
  }

  return false;
};

const isValidTimestamp = (timestamp: number) => {
  return timestamp > 0 && timestamp < Number.MAX_SAFE_INTEGER;
};

export default class Encounter {
  private static readonly encounterVersion = 5;
  public id?: number;
  version: number;
  initialOffset = Number.MAX_SAFE_INTEGER;
  endStatus = 'Unknown';
  startStatus = 'Unknown';
  private engageAt = Number.MAX_SAFE_INTEGER;
  private firstPlayerAbility = Number.MAX_SAFE_INTEGER;
  private firstEnemyAbility = Number.MAX_SAFE_INTEGER;
  firstLineIndex = 0;
  combatantTracker?: CombatantTracker;
  startTimestamp = 0;
  endTimestamp = 0;
  duration = 0;
  tzOffsetMillis = 0;
  playbackOffset = 0;
  language: Lang = 'en';
  initialTimestamp = Number.MAX_SAFE_INTEGER;

  constructor(
    public encounterDay: string,
    public encounterZoneId: string,
    public encounterZoneName: string,
    public logLines: LineEvent[],
  ) {
    this.version = Encounter.encounterVersion;
  }

  initialize(): void {
    const startStatuses = new Set<string>();
    let firstInCombatLine: LineEvent260 | undefined;

    for (const line of this.logLines) {
      this.tzOffsetMillis = line.tzOffsetMillis;

      if (line instanceof LineEvent260) {
        if (
          firstInCombatLine === undefined && line.inACTCombat === '1' && line.inGameCombat === '1'
        )
          firstInCombatLine = line;
      }

      let res: MatchStartInfo | MatchEndInfo | undefined = EmulatorCommon.matchStart(
        line.networkLine,
      );
      if (res) {
        if (res.StartType)
          startStatuses.add(res.StartType);
        const startIn = parseInt(res.StartIn);
        if (startIn >= 0)
          this.engageAt = Math.min(line.timestamp + startIn, this.engageAt);
      } else {
        res = EmulatorCommon.matchEnd(line.networkLine);
        if (res) {
          if (res.EndType)
            this.endStatus = res.EndType;
        } else if (isLineEventSource(line) && isLineEventTarget(line)) {
          if (
            line.id.startsWith('1') ||
            line.id.startsWith('4') && isPetName(line.name, this.language)
          ) {
            // Player or pet ability
            if (line.targetId.startsWith('4') && !isPetName(line.targetName, this.language)) {
              // Targetting non player or pet
              this.firstPlayerAbility = Math.min(this.firstPlayerAbility, line.timestamp);
            }
          } else if (line.id.startsWith('4') && !isPetName(line.name, this.language)) {
            // Non-player ability
            if (line.targetId.startsWith('1') || isPetName(line.targetName, this.language)) {
              // Targetting player or pet
              this.firstEnemyAbility = Math.min(this.firstEnemyAbility, line.timestamp);
            }
          }
        }
      }
      const matchedLang = res?.language;
      if (isLang(matchedLang))
        this.language = matchedLang;
    }

    this.combatantTracker = new CombatantTracker(this.logLines, this.language);
    this.startTimestamp = this.combatantTracker.firstTimestamp;
    this.endTimestamp = this.combatantTracker.lastTimestamp;
    this.duration = this.endTimestamp - this.startTimestamp;

    if (firstInCombatLine !== undefined) {
      this.firstLineIndex = firstInCombatLine.index;
      this.initialTimestamp = firstInCombatLine.timestamp;
      this.initialOffset = Math.max(0, this.initialTimestamp - this.startTimestamp);
    } else {
      if (this.initialOffset === Number.MAX_SAFE_INTEGER) {
        if (this.engageAt < Number.MAX_SAFE_INTEGER)
          this.initialOffset = Math.max(0, this.engageAt - this.startTimestamp);
        else if (this.firstPlayerAbility < Number.MAX_SAFE_INTEGER)
          this.initialOffset = Math.max(0, this.firstPlayerAbility - this.startTimestamp);
        else if (this.firstEnemyAbility < Number.MAX_SAFE_INTEGER)
          this.initialOffset = Math.max(0, this.firstEnemyAbility - this.startTimestamp);
        else
          this.initialOffset = 0;
      }
      this.initialTimestamp = this.startTimestamp + this.initialOffset;
    }

    for (const line of this.logLines) {
      line.offset = line.timestamp - this.initialTimestamp;
    }

    const firstLine = this.logLines[this.firstLineIndex];

    if (firstLine && firstLine.offset !== undefined)
      this.playbackOffset = firstLine.offset;

    this.startStatus = [...startStatuses].sort().join(', ');
  }

  shouldPersistFight(): boolean {
    return isValidTimestamp(this.firstPlayerAbility) && isValidTimestamp(this.firstEnemyAbility);
  }

  upgrade(version: number): boolean {
    if (Encounter.encounterVersion <= version)
      return false;

    const repo = new LogRepository();
    const converter = new NetworkLogConverter();
    const parsedLines = converter.convertLines(
      this.logLines.map((l) => l.networkLine),
      repo,
    );

    const localLogHandler = new LogEventHandler();
    let updatedLines: LineEvent[] = [];
    localLogHandler.on(
      'fight',
      (_day: string, _zoneId: string, _zoneName: string, lines: LineEvent[]) => {
        updatedLines = lines;
      },
    );
    localLogHandler.parseLogs(parsedLines);
    localLogHandler.endFight();

    if (updatedLines.length > 0)
      this.logLines = updatedLines;
    else
      this.logLines = parsedLines;

    this.version = Encounter.encounterVersion;
    this.initialize();

    return true;
  }
}
