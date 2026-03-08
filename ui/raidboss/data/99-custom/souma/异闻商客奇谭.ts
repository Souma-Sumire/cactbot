import Conditions from '../../../../../resources/conditions';
import { Responses } from '../../../../../resources/responses';
import { Directions } from '../../../../../resources/util';
import ZoneId from '../../../../../resources/zone_id';
import { RaidbossData } from '../../../../../types/data';
import { NetMatches } from '../../../../../types/net_matches';
import { TriggerSet } from '../../../../../types/trigger';

type Phase = 'BOSS1-P1' | 'BOSS1-P2' | 'BOSS1-P3';

const bossPhaseId: Record<string, Phase> = {
  'B31C': 'BOSS1-P3',
};

type Zoo = '蟹' | '鸟' | '马' | '豚' | '龟';

const actorControlData: Record<string, Zoo> = {
  'AB8': '蟹',
  'ABA': '鸟',
  'AB5': '马',
  'AB9': '豚',
  'AB7': '龟',
};

// npcBaseId => Zoo 名称
const npcBaseIdToZoo: Record<string, Zoo> = {
  '19098': '马',
  '19099': '龟',
  '19100': '蟹',
  '19101': '豚',
  '19102': '鸟',
};

export interface Data extends RaidbossData {
  zoos: Zoo[];
  zoosCombatants: NetMatches['AddedCombatant'][];
  zoosResult: string[];
  phase: Phase;
}

const boss1Center = { x: 375, y: 530 };

// 510=0 | 514=1  522=2  [530]=3  538=4  546=5 | 550=6
const Y_GRID = [510, 514, 522, 530, 538, 546, 550] as const;
// 355=0 | 359=1  367=2  [375]=3  383=4  391=5 | 395=6
const X_GRID = [355, 359, 367, 375, 383, 391, 395] as const;

/** 在有序坐标数组中找与目标值最近的项，返回其索引 */
const findNearest = (grid: readonly number[], val: number): number => {
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < grid.length; i++) {
    const dist = Math.abs(grid[i]! - val);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  return bestIdx;
};

const getPos = (x: number, y: number): { t: 'x' | 'y'; n: number } => {
  if (x <= 357 || x >= 393) {
    return { t: 'y', n: findNearest(Y_GRID, y) };
  }
  if (y <= 512 || y >= 548) {
    return { t: 'x', n: findNearest(X_GRID, x) };
  }
  throw new Error('未知的动物坐标');
};

const CENTER_CHAR_OFFSET = 14;

const boss1Debuffs: Record<string, string> = {
  '871': '前',
  '872': '后',
  '873': '左',
  '874': '右',
};

const makeZooGrid = (positions: { t: 'x' | 'y'; n: number }[]): string => {
  const grid: number[][] = Array.from({ length: 5 }, () => new Array<number>(5).fill(0));

  for (const { t, n } of positions) {
    const idx = n - 1; //
    if (t === 'y') {
      for (let col = 0; col < 5; col++)
        grid[idx]![col] = 1;
    } else {
      for (let row = 0; row < 5; row++)
        grid[row]![idx] = 1;
    }
  }

  let result = grid.map((row) => row.map((v) => (v ? '■' : '□')).join('')).join('\n');
  const centerChar = result[CENTER_CHAR_OFFSET] === '■' ? '★' : '☆';
  result = result.slice(0, CENTER_CHAR_OFFSET) + centerChar + result.slice(CENTER_CHAR_OFFSET + 1);
  return result;
};

const FIXED_PATTERNS: Record<'东西' | '南北', string> = {
  '东西': '■↖■↗■\n■■■■■\n■■■■■\n■■■■■\n■↙■↘■',
  '南北': '■■■■■\n↖■■■↗\n■■■■■\n↙■■■↘\n■■■■■',
};

const getZooDir = (combatant: NetMatches['AddedCombatant']): '南北' | '东西' =>
  Math.abs(parseFloat(combatant.x) - boss1Center.x) <= 3 ? '南北' : '东西';

const computeZoosResult = (data: Data): void => {
  const byZoo = (name: Zoo) =>
    data.zoosCombatants.filter((v) => npcBaseIdToZoo[v.npcBaseId] === name);
  const posOf = (name: Zoo) => byZoo(name).map((v) => getPos(parseFloat(v.x), parseFloat(v.y)));
  for (const zoo of data.zoos.slice(-4)) {
    if (zoo === '豚' || zoo === '鸟') {
      data.zoosResult.push(
        FIXED_PATTERNS[
          getZooDir(data.zoosCombatants.filter((v) => npcBaseIdToZoo[v.npcBaseId] === zoo)[0]!)
        ],
      );
    } else {
      data.zoosResult.push(makeZooGrid(posOf(zoo)));
    }
  }
};

type SingSafe = '内' | '外' | '斜';

const getSafe = (str: string): SingSafe => {
  const flat = str.replaceAll('\n', '');
  if (flat.at(7) === '□') {
    return '内';
  }
  if (flat.at(2) === '□') {
    return '外';
  }
  if (flat.at(1) === '□' || flat.at(3) === '□') {
    return '斜';
  }
  throw new Error('unknown safe');
};

const headMarkerData = {
  // Offsets: 01:51, 03:46
  // Vfx Path: bahamut_wyvn_glider_target_02tm
  '0014': '0014',
  // Offsets: 00:43, 00:49
  // Vfx Path: lockon3_t0h
  '0016': '0016',
  // Offsets: 03:06
  // Vfx Path: m0561tag_a0t
  '00B9': '00B9',
} as const;

const hintTriggerConfigs = [
  { id: '呼唤家臣1', netRegex: { id: 'B2CB' }, delay: 14, duration: 6.2, idx: 0 },
  { id: '呼唤家臣2', netRegex: { id: 'B2CB' }, delay: 20.3, duration: 3, idx: 1 },
  { id: '呼唤家臣3', netRegex: { id: 'B2CB' }, delay: 23.3, duration: 3, idx: 2 },
  { id: '呼唤家臣4', netRegex: { id: 'B2CB' }, delay: 26.3, duration: 3, idx: 3 },
] as const;

type HintTrigger = (typeof hintTriggerConfigs)[number];

const makeHintTrigger = ({ id, netRegex, delay, duration, idx }: HintTrigger) =>
  ({
    id: `${id}`,
    type: 'StartsUsing',
    netRegex: netRegex,
    delaySeconds: delay,
    durationSeconds: duration,
    suppressSeconds: 9999,
    soundVolume: 0.3,
    // eslint-disable-next-line rulesdir/cactbot-output-strings
    alertText: (data: Data) => data.zoosResult[idx] ?? '??',
    tts: null,
  }) as const;

const triggerSet: TriggerSet<Data> = {
  id: 'AnotherMerchantsTale',
  zoneId: ZoneId.AnotherMerchantsTale,
  // timelineFile: '???.txt',
  initData: () => ({
    zoos: [],
    zoosCombatants: [],
    zoosResult: [],
    phase: 'BOSS1-P1',
  }),
  triggers: [
    {
      id: 'souma 人鱼达莉娅 阶段控制',
      type: 'StartsUsing',
      netRegex: { id: Object.keys(bossPhaseId), capture: true },
      run: (data, matches) => {
        data.phase = bossPhaseId[matches.id]!;
      },
    },
    {
      id: 'souma 人鱼达莉娅 尖声坠刺',
      type: 'StartsUsing',
      netRegex: { id: 'B32E', capture: false },
      response: Responses.aoe(),
    },
    {
      id: 'souma 人鱼达莉娅 呼唤家臣 B2CB',
      type: 'StartsUsing',
      netRegex: { id: 'B2CB', capture: false },
      run: (data) => {
        // data.zoos.length = 0;
        data.zoosResult.length = 0;
        data.zoosCombatants.length = 0;
      },
    },
    {
      id: 'souma 人鱼达莉娅 Actor Control',
      type: 'ActorControlExtra',
      netRegex: {
        category: '00B8',
        param1: Object.keys(actorControlData),
      },
      preRun: (data, matches) => {
        data.zoos.push(actorControlData[matches.param1]!);
        if (data.zoos.length % 4 === 0)
          computeZoosResult(data);
      },
      durationSeconds: 20,
      infoText: (data, _matches, output) => {
        if (data.zoos.length % 4 === 0) {
          if (data.phase === 'BOSS1-P1')
            return data.zoos.slice(-4).map((v) => output[v]!()).join('');
          if (data.phase === 'BOSS1-P3') {
            const s1: SingSafe = getSafe(data.zoosResult[0]!);
            const s2: SingSafe = getSafe(data.zoosResult[1]!);
            const s3: SingSafe = getSafe(data.zoosResult[2]!);
            return output.p3!({
              s1: output[s1]!(),
              s2: output[s2]!(),
              s3: output[s3]!(),
              s4: output[s1]!(),
            });
          }
        }
      },
      outputStrings: {
        '豚': { en: '豚' },
        '蟹': { en: '蟹' },
        '鸟': { en: '鸟' },
        '马': { en: '马' },
        '龟': { en: '龟' },
        '内': { en: '内' },
        '外': { en: '外' },
        '斜': { en: '斜' },
        'p3': { en: '${s1}→${s2}→${s3}→${s4}' },
      },
    },
    {
      id: 'souma 人鱼达莉娅 和声重奏曲',
      type: 'StartsUsing',
      netRegex: { id: 'B314' },
      preRun: (data) => {
        if (data.zoos.length % 4 === 0) {
          computeZoosResult(data);
        }
      },
      durationSeconds: 10,
      infoText: (data, _matches, output) => {
        if (data.zoos.length % 4 === 0) {
          const s1: SingSafe = getSafe(data.zoosResult[0]!);
          const s2: SingSafe = getSafe(data.zoosResult[1]!);
          const s3: SingSafe = getSafe(data.zoosResult[2]!);
          return output.p3!({
            s1: output[s1]!(),
            s2: output[s2]!(),
            s3: output[s3]!(),
            s4: output[s1]!(),
          });
        }
      },
      outputStrings: {
        '豚': { en: '豚' },
        '蟹': { en: '蟹' },
        '鸟': { en: '鸟' },
        '马': { en: '马' },
        '龟': { en: '龟' },
        '内': { en: '内' },
        '外': { en: '外' },
        '斜': { en: '斜' },
        'p3': { en: '${s1}→${s2}→${s3}→${s4}' },
      },
    },
    ...hintTriggerConfigs.map(makeHintTrigger),
    {
      id: 'souma 人鱼达莉娅 Add',
      type: 'AddedCombatant',
      netRegex: {
        npcBaseId: Object.keys(npcBaseIdToZoo),
      },
      preRun: (data, matches) => {
        data.zoosCombatants.push(matches);
      },
    },
    {
      id: 'souma 人鱼达莉娅 Headmarker Spread 00B9',
      type: 'HeadMarker',
      netRegex: { id: headMarkerData['00B9'], capture: true },
      suppressSeconds: 5,
      response: Responses.spread(),
    },
    // {
    //   id: 'souma 人鱼达莉娅 水中漫歌',
    //   type: 'StartsUsing',
    //   netRegex: { id: ['B30F', 'B310', 'B311', 'B312', 'B313'], capture: false },
    //   infoText: (_data, _matches, output) => output.text!(),
    //   outputStrings: {
    //     text: {
    //       en: 'Custom Text',
    //     },
    //   },
    // },
    {
      id: 'souma 人鱼达莉娅 激涌的洋流',
      type: 'StartsUsingExtra',
      netRegex: { id: 'B32A', capture: true },
      delaySeconds: 3,
      // 只报1分整与4分30秒的这2次
      suppressSeconds: 180,
      infoText: (_data, matches, output) => {
        // N = 0, NE = 1, ..., NW = 7
        const hdg = Directions.hdgTo8DirNum(parseFloat(matches.heading)) as 1 | 3 | 5 | 7;
        const safe = [1, 5].includes(hdg) ? '右下/左上' : '右上/左下';
        return output[safe]!();
      },
      outputStrings: {
        '右下/左上': { en: '先去2、4' },
        '右上/左下': { en: '先去1、3' },
      },
    },
    {
      id: 'souma 人鱼达莉娅 迷人的指令',
      type: 'StartsUsing',
      netRegex: { id: 'B325', capture: false },
      response: Responses.aoe(),
    },
    {
      id: 'souma 人鱼达莉娅 移动命令',
      type: 'GainsEffect',
      netRegex: { effectId: Object.keys(boss1Debuffs) },
      condition: Conditions.targetIsYou(),
      durationSeconds: (_data, matches) => parseFloat(matches.duration),
      countdownSeconds: (_data, matches) => parseFloat(matches.duration),
      infoText: (_data, matches, output) => {
        return output[boss1Debuffs[matches.effectId]!]!();
      },
      outputStrings: {
        '前': { en: '向前' },
        '后': { en: '向后' },
        '左': { en: '向左' },
        '右': { en: '向右' },
      },
    },
    // {
    //   id: 'souma 人鱼达莉娅 空中漫游 B315',
    //   type: 'StartsUsing',
    //   netRegex: { id: 'B315', capture: false },
    //   infoText: (_data, _matches, output) => output.text!(),
    //   outputStrings: {
    //     text: {
    //       en: 'Custom Text',
    //     },
    //   },
    // },
    // {
    //   id: 'souma 人鱼达莉娅 沉没的宝藏 B319',
    //   type: 'StartsUsing',
    //   netRegex: { id: 'B319', capture: false },
    //   infoText: (_data, _matches, output) => output.text!(),
    //   outputStrings: {
    //     text: {
    //       en: 'Custom Text',
    //     },
    //   },
    // },
    // {
    //   id: 'souma 人鱼达莉娅 和声重奏曲 B314',
    //   type: 'StartsUsing',
    //   netRegex: { id: 'B314', capture: false },
    //   infoText: (_data, _matches, output) => output.text!(),
    //   outputStrings: {
    //     text: {
    //       en: 'Custom Text',
    //     },
    //   },
    // },
  ],
};

export default triggerSet;
