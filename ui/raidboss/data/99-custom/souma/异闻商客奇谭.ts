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

export interface Data extends RaidbossData {
  zoos: Zoo[];
  zoosCombatants: NetMatches['AddedCombatant'][];
  zoosResult: string[];
}

const center = {
  boss1: {
    x: 375,
    y: 530,
  },
};

// 510   = 0
// ---
// 514   = 1
// 522   = 2
// [530] = 3
// 538   = 4
// 546   = 5
// ---
// 550   = 6

// 355=0 | 359=1 367=2 [375]=3 383=4 391=5 | 395=6
const getPos = (x: number, y: number): { t: 'x' | 'y'; n: number } => {
  let t;
  let i;
  if (x <= 357 || x >= 393) {
    t = 'y';
    i = [510, 514, 522, 530, 538, 546, 550].reduce((t, v, i) => {
      const abs = Math.abs(v - y);
      return abs < t.a ? ({ n: v, a: abs, i: i }) : t;
    }, { n: -Infinity, a: Infinity, i: -Infinity }).i;
  } else if (y <= 512 || y >= 548) {
    t = 'x';
    i = [355, 359, 367, 375, 383, 391, 395].reduce((t, v, i) => {
      const abs = Math.abs(v - x);
      return abs < t.a ? ({ n: v, a: abs, i: i }) : t;
    }, { n: -Infinity, a: Infinity, i: -Infinity }).i;
  } else {
    throw new Error('未知的动物坐标');
  }
  if (i === -Infinity) {
    throw new Error('错误的动物坐标');
  }
  return {
    t: t as 'x' | 'y',
    n: i,
  };
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

const triggerSet: TriggerSet<Data> = {
  id: 'AnotherMerchantsTale',
  zoneId: ZoneId.AnotherMerchantsTale,
  // timelineFile: '???.txt',
  initData: () => {
    return {
      zoos: [],
      zoosCombatants: [],
      zoosResult: [],
    };
  },
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
      run: (data) => data.zoos.length = 0,
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
      },
      durationSeconds: 20,
      infoText: (data, _matches, output) => {
        if (data.zoos.length === 4) {
          const 马 = data.zoosCombatants.filter((v) => v.npcBaseId === '19098');
          const 龟 = data.zoosCombatants.filter((v) => v.npcBaseId === '19099');
          const 蟹 = data.zoosCombatants.filter((v) => v.npcBaseId === '19100');
          const 豚 = data.zoosCombatants.filter((v) => v.npcBaseId === '19101');
          const 鸟 = data.zoosCombatants.filter((v) => v.npcBaseId === '19102');
          const 马pos = 马.map((v) => getPos(parseFloat(v.x), parseFloat(v.y)));
          const 龟pos = 龟.map((v) => getPos(parseFloat(v.x), parseFloat(v.y)));
          const 蟹pos = 蟹.map((v) => getPos(parseFloat(v.x), parseFloat(v.y)));
          const 豚dir = Math.abs(parseFloat(豚[0]!.x) - center.boss1.x) <= 3 ? '南北' : '东西';
          const 鸟dir = Math.abs(parseFloat(鸟[0]!.x) - center.boss1.x) <= 3 ? '南北' : '东西';
          const fn = {
            x: (map: number[][], n: number) => {
              for (let i = 0; i < map.length; i++) {
                map[i]![n] = 1;
              }
            },
            y: (map: number[][], n: number) => {
              for (let i = 0; i < map[n]!.length; i++) {
                map[n]![i] = 1;
              }
            },
          };
          data.zoos.map((z) => {
            if (z === '豚' || z === '鸟') {
              const dir = z === '豚' ? 豚dir : 鸟dir;
              data.zoosResult.push(
                dir === '东西'
                  ? '■↖■↗■\n■■■■■\n■■■■■\n■■■■■\n■↙■↘■'
                  : '■■■■■\n↖■■■↗\n■■■■■\n↙■■■↘\n■■■■■',
              );
            } else if (z === '蟹' || z === '马' || z === '龟') {
              const pos = {
                '蟹': 蟹pos,
                '马': 马pos,
                '龟': 龟pos,
              }[z];
              const map = Array.from({ 'length': 5 }, () => {
                return Array.from({ 'length': 5 }).fill(0);
              }) as number[][];
              pos.map((p) => {
                fn[p.t](map, p.n - 1);
              });
              data.zoosResult.push(
                map.map((y) => y.map((x) => x ? '■' : '□').join('')).join('\n'),
              );
            } else {
              throw new Error('不可能');
            }
            const lastIdx = data.zoosResult.length - 1;
            const centerChar = data.zoosResult[lastIdx]![14] === '■' ? '★' : '☆';
            data.zoosResult[lastIdx] = data.zoosResult[lastIdx]!.slice(0, 14) + centerChar +
              data.zoosResult[lastIdx]!.slice(15);
          });

          return data.zoos.map((v) => output[v]!()).join('');
        }
      },
      outputStrings: {
        '豚': { en: '豚' },
        '蟹': { en: '蟹' },
        '鸟': { en: '鸟' },
        '马': { en: '马' },
        '龟': { en: '龟' },
      },
    },
    {
      id: 'souma 人鱼达莉娅 呼唤家臣提示1',
      type: 'StartsUsing',
      netRegex: { id: 'B2CB', capture: false },
      delaySeconds: 14,
      durationSeconds: 6.2,
      soundVolume: 0.3,
      // eslint-disable-next-line rulesdir/cactbot-output-strings
      alertText: (data) => data.zoosResult[0] ?? '??',
      tts: null,
    },
    {
      id: 'souma 人鱼达莉娅 呼唤家臣提示2',
      type: 'StartsUsing',
      netRegex: { id: 'B2CB', capture: false },
      delaySeconds: 20.3,
      durationSeconds: 3,
      soundVolume: 0.3,
      // eslint-disable-next-line rulesdir/cactbot-output-strings
      alertText: (data) => data.zoosResult[1] ?? '??',
      tts: null,
    },
    {
      id: 'souma 人鱼达莉娅 呼唤家臣提示3',
      type: 'StartsUsing',
      netRegex: { id: 'B2CB', capture: false },
      delaySeconds: 23.3,
      durationSeconds: 3,
      soundVolume: 0.3,
      // eslint-disable-next-line rulesdir/cactbot-output-strings
      alertText: (data) => data.zoosResult[2] ?? '??',
      tts: null,
    },
    {
      id: 'souma 人鱼达莉娅 呼唤家臣提示4',
      type: 'StartsUsing',
      netRegex: { id: 'B2CB', capture: false },
      delaySeconds: 26.3,
      durationSeconds: 3,
      soundVolume: 0.3,
      // eslint-disable-next-line rulesdir/cactbot-output-strings
      alertText: (data) => data.zoosResult[3] ?? '??',
      tts: null,
      run: (data) => data.zoosResult.length = 0,
    },
    {
      id: 'souma 人鱼达莉娅 Add',
      type: 'AddedCombatant',
      netRegex: {
        npcBaseId: [
          '19098', // 马
          '19100', // 蟹
          '19101', // 豚
          '19102', // 鸟
        ],
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
