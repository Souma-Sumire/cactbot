import { Responses } from '../../../../../resources/responses';
import { Directions } from '../../../../../resources/util';
import ZoneId from '../../../../../resources/zone_id';
import { RaidbossData } from '../../../../../types/data';
import { NetMatches } from '../../../../../types/net_matches';
import { TriggerSet } from '../../../../../types/trigger';

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
  data.zoosResult = [];

  const byZoo = (name: Zoo) =>
    data.zoosCombatants.filter((v) => npcBaseIdToZoo[v.npcBaseId] === name);

  const posOf = (name: Zoo) => byZoo(name).map((v) => getPos(parseFloat(v.x), parseFloat(v.y)));

  for (const zoo of data.zoos) {
    if (zoo === '豚' || zoo === '鸟') {
      data.zoosResult.push(FIXED_PATTERNS[getZooDir(byZoo(zoo)[0]!)]);
    } else {
      data.zoosResult.push(makeZooGrid(posOf(zoo)));
    }
  }
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
  { suffix: '1', delay: 14, duration: 6.2, idx: 0, cleanup: false },
  { suffix: '2', delay: 20.3, duration: 3, idx: 1, cleanup: false },
  { suffix: '3', delay: 23.3, duration: 3, idx: 2, cleanup: false },
  { suffix: '4', delay: 26.3, duration: 3, idx: 3, cleanup: true },
] as const;

type HintTrigger = (typeof hintTriggerConfigs)[number];

const makeHintTrigger = ({ suffix, delay, duration, idx, cleanup }: HintTrigger) =>
  ({
    id: `souma 人鱼达莉娅 呼唤家臣提示${suffix}`,
    type: 'StartsUsing',
    netRegex: { id: 'B2CB', capture: false },
    delaySeconds: delay,
    durationSeconds: duration,
    soundVolume: 0.3,
    // eslint-disable-next-line rulesdir/cactbot-output-strings
    alertText: (data: Data) => data.zoosResult[idx] ?? '??',
    tts: null,
    ...(cleanup ? { run: (data: Data) => (data.zoosResult.length = 0) } : {}),
  }) as const;

const triggerSet: TriggerSet<Data> = {
  id: 'AnotherMerchantsTale',
  zoneId: ZoneId.AnotherMerchantsTale,
  // timelineFile: '???.txt',
  initData: () => ({
    zoos: [],
    zoosCombatants: [],
    zoosResult: [],
  }),
  triggers: [
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
        data.zoos.length = 0;
        data.zoosResult.length = 0;
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
        if (data.zoos.length === 4)
          computeZoosResult(data);
      },
      durationSeconds: 20,
      infoText: (data, _matches, output) => {
        if (data.zoos.length === 4)
          return data.zoos.map((v) => output[v]!()).join('');
      },
      outputStrings: {
        '豚': { en: '豚' },
        '蟹': { en: '蟹' },
        '鸟': { en: '鸟' },
        '马': { en: '马' },
        '龟': { en: '龟' },
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
      delaySeconds: 2.4,
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
