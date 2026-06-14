import Conditions from '../../../../../resources/conditions';
import Outputs from '../../../../../resources/outputs';
import { callOverlayHandler } from '../../../../../resources/overlay_plugin_api';
import { Responses } from '../../../../../resources/responses';
import { Directions } from '../../../../../resources/util';
import { RaidbossData } from '../../../../../types/data';
import { PluginCombatantState } from '../../../../../types/event';
import { Matches } from '../../../../../types/net_matches';
import { Output, TriggerSet } from '../../../../../types/trigger';

console.log('绝妖星已加载，开发成本原因，默认报的标点为1A2，其他标点需自己改。');

type Phase = 'p1-1a' | 'p1-1b' | 'p1-2' | 'p1-3' | 'p2' | 'p3';
const phases: { [id: string]: Phase } = {
  'BAB9': 'p1-3',
  'C24C': 'p2', // Ultimate Embrace, God Kefka
  'C3F7': 'p3', // Aero III Assault (from Kefka), Chaos and Exdeath
};

// const centerX = 100;
// const centerY = 100;

const p2OutputStirngs = {
  扇形组: '左', // 如果不是固定扇形右，就改成“扇形组的”
  钢铁组: '右', // 如果不是固定钢铁右，就改成“钢铁组的”
  第1轮踩塔TN: '1轮 ${gimmick} 踩${lr}塔',
  第1轮闲人TN: '1轮 闲人 ${lr}引导',
  第1轮DPS分摊: '1轮 分摊 踩${lr}塔',
  第1轮DPS其他: '1轮 ${lr}边看搭档',
  第1轮TN自由: '1轮 ${lr}边看搭档',
  第2到8轮踩塔单: '${i}轮 (单${gimmick}) 踩塔',
  第2到8轮踩塔双: '${i}轮 (双${gimmick}) 踩塔',
  第2到8轮引导: '${i}轮 塔外引导',
  第2到8轮引导tank: '${i}轮 ←左塔外',
  第2到8轮引导healer: '${i}轮 ←左塔外',
  第2到8轮引导dps: '${i}轮 右塔外→',
  第2到8轮超级跳: '${i}轮 闲人 去超级跳',
  第2到8轮踩塔分摊: '${i}轮 分摊 踩塔 （另一个分摊是${player}）',
  分摊: '分摊',
  钢铁: '钢铁',
  扇形: '扇形',

  打法1234: '5轮 闲人 中间挂机',
  打法1238: '8轮 闲人 去超级跳',
  打法1458: '8轮 闲人 去超级跳',
};

const getP2 = (data: Data, _matches: Matches, output: Output) => {
  let me: { target: string; buff: string; role: 'dps' | 'tank' | 'healer' } | undefined;
  let stack: { target: string; buff: string; role: 'dps' | 'tank' | 'healer' } | undefined;
  for (let i = 0; i <= data.p2count; i++) {
    if (me === undefined) {
      me = data.p2hm[data.p2count - i - 1]?.find((v) => v.target === data.me);
    }

    if (stack === undefined && me) {
      stack = data.p2hm[data.p2count - i - 1]?.find((v) =>
        v.buff === '分摊' && v.target !== data.me &&
        ({ tank: 'tn', healer: 'tn', dps: 'dps' }[v.role] ===
          { tank: 'tn', healer: 'tn', dps: 'dps' }[me!.role])
      );
    }
    if (me) {
      break;
    }
  }

  const towerCount = data.p2count;
  const groupA = data.p2第一轮踩塔人.includes(data.me);
  const ab = data.triggerSetConfig.p2一运打法.split('');
  const goTower = (groupA && ab.includes(towerCount.toString())) ||
    (!groupA && !ab.includes(towerCount.toString()));

  const doubleTurn = {
    '1234': [2, 4, 5, 6],
    '1238': [2, 4, 6, 8],
    '1458': [2, 4, 6, 8],
  };

  const isDoubleTurn = doubleTurn[data.triggerSetConfig.p2一运打法].includes(towerCount);

  if (me === undefined) {
    console.error(data.me, ' is undefined', data.p2hm);
    return 'Error';
  }

  if (data.p2count === 1) {
    const roleGimmick = data.p2hm[0]!.find((v) => v.buff !== '分摊' && v.role === data.role)!;
    const lr = output[`${roleGimmick.buff}组`]!();
    // 第一轮
    if (data.role === 'tank' || data.role === 'healer') {
      const gimmick = output[me.buff]!();
      if (data.triggerSetConfig.p2一运搭档打法 === 'free' && me.buff !== '分摊') {
        data.p2报过了 = true;
        return output.第1轮TN自由!({ gimmick, lr });
      }
      const inTower = Boolean(me.buff === '分摊' || (stack && stack.role === data.role));
      data.p2报过了 = true;
      return output[inTower ? '第1轮踩塔TN' : '第1轮闲人TN']!({ gimmick, lr });
    }
    if (data.role === 'dps') {
      if (me.buff === '分摊') {
        data.p2报过了 = true;
        return output.第1轮DPS分摊!({ lr });
      }
      data.p2报过了 = true;
      return output['第1轮DPS其他']!({ gimmick: output[me.buff]!(), lr: lr });
    }
  }

  if (data.p2BuffCount[data.me] === 0) {
    if (ab.join('') === '1234' && data.p2count === 5) {
      data.p2报过了 = true;
      return output.打法1234!();
    }
    if (ab.join('') === '1238' && data.p2count === 8) {
      data.p2报过了 = true;
      return output.打法1238!();
    }
    if (ab.join('') === '1458' && data.p2count === 8) {
      data.p2报过了 = true;
      return output.打法1458!();
    }
  }

  const spjp = ['2', '4', '6', '8'];
  const goSpjp = spjp.includes(towerCount.toString());
  // 2-8轮
  if (goTower) {
    // 踩塔，每一轮
    data.p2报过了 = true;
    if (me.buff === '分摊') {
      const otherStack = data.p2hm[towerCount - 1]!.find((v) =>
        v.buff === '分摊' && v.target !== data.me
      )!;
      return output.第2到8轮踩塔分摊!({ i: towerCount, player: otherStack.target });
    }
    return output[`第2到8轮踩塔${isDoubleTurn ? '双' : '单'}`]!({
      i: towerCount,
      gimmick: output[me.buff]!(),
    });
  }
  if (!goSpjp) {
    // 不踩塔，奇数轮，引导
    data.p2报过了 = true;
    // // 没buff的人按照TN左DPS右引导
    if (
      data.p2BuffCount[data.me] === 0 &&
      data.triggerSetConfig.p2一运打法 === '1234' &&
      data.triggerSetConfig.p2一运1234打法没debuff的闲人怎么决定去哪个塔引导 === 'TN左DPS右'
    ) {
      return output[`第2到8轮引导${data.role}`]!({ i: towerCount });
    }
    // }
    return output.第2到8轮引导!({ i: towerCount, gimmick: output[me.buff]!() });
  }
  // 不踩塔，偶数轮，超级跳
  data.p2报过了 = true;
  return output.第2到8轮超级跳!({ i: towerCount });
};

export interface Data extends RaidbossData {
  readonly triggerSetConfig: {
    p1击退加真假火冰打法: '正攻' | 'TN左DPS右';
    p2一运打法: '1238' | '1234' | '1458';
    p2一运搭档打法: 'same' | 'free';
    p2一运1234打法没debuff的闲人怎么决定去哪个塔引导: 'TN左DPS右';
    // p2一运1238打法4567的闲人怎么决定去哪个塔引导: 'TN左DPS右';
  };
  // General
  phase: Phase | 'unknown';
  假冰: boolean;
  假雷: boolean;
  假火: boolean;
  p1Tethers: string[];
  p1毒: string[];
  p1Cannon: string[];
  p1IsTether: boolean;
  combatantData: PluginCombatantState[];
  p1放石头: boolean;
  p1Arrow: { a: string; s: number }[];
  p1石头count: number;
  p1收集: { sourceId: string; target: string }[];
  p3究极冲击波hdg: number[];
  eyeTowerIds: string[];
  fakeEyeTowerIds: string[];
  p2未来过去count: number;
  purpleTowerIds: string[];
  yellowTowerIds: string[];
  p2hm: { [key: string]: { target: string; buff: string; role: 'dps' | 'tank' | 'healer' }[] };
  p2count: number;
  p2第一轮踩塔人: string[];
  p2BuffCount: { [key: string]: number };
  p2报过了: boolean;
  p3buffs: { [key: string]: { name: string; duration: number }[] };
  p3jjcjb: {
    c1: number;
    c2: number;
    clk: '顺' | '逆';
  } | undefined;
  p4真假: {
    '新生艾克斯迪司': boolean[];
    '卡奥斯': boolean[];
  };
  p4count: {
    '新生艾克斯迪司': number;
    '卡奥斯': number;
  };
  p4CastCount: number;
  p4buffs: {
    [key: string]: {
      name: string;
      tf: string;
      gimmick: string;
      time: number;
      count: number;
      bossCount: number;
    }[];
  };
  p4Text: {
    [key: string]: string;
  };
}

const headMarkerData = {
  'tankbuster': '00DA',
  'spread': '007F',
  'stack': '0080',

  '假火': '02A1',
  '真火': '02A2',
  '假冰': '02A3',
  '真冰': '02A4',
  '假雷': '02A5',
  '真雷': '02A6',

  '分摊': '02CB',
  '钢铁': '02CC',
  '扇形': '02CD',
} as const;

const arrowBuffs = {
  '13D7': '上',
  '13D8': '下',
  '13D9': '右',
  '13DA': '左',

  '130C': '上',
  '130D': '下',
  '130E': '右',
  '130F': '左',
};
type P3Boss = '卡奥斯' | '新生艾克斯迪司';
const p3buff: {
  [key: string]: { name: string };
} = {
  '640': { name: '混沌之炎' },
  '641': { name: '混沌之水' },
  '642': { name: '混沌之风' },
  '643': { name: '混沌之逆风' },
};
const p3mj: {
  [key: string]: number;
} = {
  '0150': 1,
  '0151': 2,
  '0152': 3,
  '0153': 4,
  '01B5': 5,
  '01B6': 6,
  '01B7': 7,
  '01B8': 8,
};
const p4buff: {
  [key: string]: { name: string; true: string; false: string; source: P3Boss };
} = {
  '15A8': { name: '叉形闪电', true: '雷分散', false: '水分摊', source: '新生艾克斯迪司' },
  '15A9': { name: '水属性压缩', true: '水分摊', false: '雷分散', source: '新生艾克斯迪司' },
  '15A7': { name: '诅咒之嚎', true: '背对眼', false: '面对眼', source: '新生艾克斯迪司' },
  '15AA': { name: '加速度炸弹', true: '停手', false: '移动', source: '新生艾克斯迪司' },
  '15AB': { name: '混沌之炎', true: '钢铁', false: '月环', source: '卡奥斯' },
  '15AC': { name: '混沌之水', true: '月环', false: '钢铁', source: '卡奥斯' },
  // ?为什么有2个ID
  '1558': { name: '超越死亡', true: '死超', false: '亚拉戈', source: '新生艾克斯迪司' },
  '566': { name: '超越死亡', true: '死超', false: '亚拉戈', source: '新生艾克斯迪司' },
  // ?为什么亚拉戈就1个ID
  '1C6': { name: '亚拉戈领域', true: '亚拉戈', false: '死超', source: '新生艾克斯迪司' },
  // ?为什么有2个ID
  '1317': { name: '生者之伤', true: '吃蓝', false: '吃紫', source: '新生艾克斯迪司' },
  '15A5': { name: '生者之伤', true: '吃蓝', false: '吃紫', source: '新生艾克斯迪司' },
  // ?为什么有2个ID
  '1318': { name: '死者之伤', true: '吃紫', false: '吃蓝', source: '新生艾克斯迪司' },
  '15A6': { name: '死者之伤', true: '吃紫', false: '吃蓝', source: '新生艾克斯迪司' },
};

const triggerSet: TriggerSet<Data> = {
  id: 'DancingMadUltimate',
  zoneId: 1363,
  config: [
    {
      id: 'p1击退加真假火冰打法',
      name: {
        en: 'p1击退加真假火冰打法',
      },
      type: 'select',
      options: {
        en: {
          '正攻（被击退的去下半场）': '正攻',
          '职能固定（不推荐！）未测试': 'TN左DPS右',
          // '正攻（报双安全区）未测试': '双安全区',
        },
      },
      default: '正攻',
    },
    {
      id: 'p2一运打法',
      name: {
        en: 'p2一运打法',
      },
      type: 'select',
      options: {
        en: {
          '1238': '1238',
          '1234（TLB）': '1234',
          '1458 未测试': '1458',
        },
      },
      default: '1238',
    },
    {
      id: 'p2一运搭档打法',
      name: {
        en: 'p2一运决定自己是否踩塔的方法',
      },
      type: 'select',
      options: {
        en: {
          'TH同职能、DPS自己看': 'same',
          '全都自己看': 'free',
        },
      },
      default: 'same',
    },
    {
      id: 'p2一运1234打法没debuff的闲人怎么决定去哪个塔引导',
      name: {
        en: 'p2一运1234打法没debuff的闲人怎么决定去哪个塔引导',
      },
      comment: { en: '其他打法我不知道，我们团是这么打的。' },
      type: 'select',
      options: {
        en: {
          'TN左DPS右': 'TN左DPS右',
        },
      },
      default: 'TN左DPS右',
    },
    // {
    //   id: 'p2一运1238打法4567的闲人怎么决定去哪个塔引导',
    //   name: {
    //     en: 'p2一运1238打法4567的闲人怎么决定去哪个塔引导',
    //   },
    //   comment: { en: '其他打法我不知道，我们团是这么打的。' },
    //   type: 'select',
    //   options: {
    //     en: {
    //       'TN左DPS右': 'TN左DPS右',
    //     },
    //   },
    //   default: 'TN左DPS右',
    // },
  ],
  overrideTimelineFile: true,
  timeline: `
hideall "--Reset--"
hideall "--sync--"

0.0 "--Reset--" ActorControl { command: "4000000F" } window 0,100000 jump 0

0.0 "--sync--" InCombat { inGameCombat: "1" } window 0,1

# P1
15.2 "恶狠狠毁荡 1",
18.3 "恶狠狠毁荡 2",
37.9 "呼啦啦爆炎",
42.1 "波动炮",
45.9 "爆炸",
49.4 "连环环陷阱",
62.4 "制裁之光",
65.6 "超驱动 1",
67.7 "超驱动 2",
69.8 "超驱动 3",
87.2 "重力弹",
91.2 "岩石弹",
97.1 "恶狠狠毁荡",
100.2 "恶狠狠毁荡",
105.7 "重力弹",
109.7 "岩石弹",
118 "连环环陷阱",
120.7 "强重力",
123.6 "强重力",
132.2 "制裁之光",
135.4 "超驱动 1",
137.5 "超驱动 2",
139.6 "超驱动 3",
159.3 "唰啦啦传送 1",
162.2 "唰啦啦传送 2",
167.7 "连环环陷阱",
173.3 "睡魔的神气",
173.4 "圣母的神气",
186.4 "圣母颂",
187 "呼啦啦爆炎",

# P2
220.1 "终末双腕",
235.3 "遗弃末世",
248.5 "光之波动",
249.2 "咏唱危机",
258.1 "过去/未来终结",
258.6 "光之波动",
259.2 "咏唱危机",
269.6 "光之波动",
270.2 "咏唱危机",
279.2 "过去/未来终结",
279.7 "光之波动",
280.2 "咏唱危机",
290.6 "光之波动",
291.3 "咏唱危机",
300.4 "过去/未来终结",
300.7 "光之波动",
301.2 "咏唱危机",
311.6 "光之波动",
312.3 "咏唱危机",
321.5 "过去/未来终结",
321.7 "光之波动",
322.3 "咏唱危机",
342.1 "制裁之光",
370.7 "破坏之翼",
377.8 "终末双腕",

# P3
450.5 "深层痛楚",
469.6 "混沌之炎",
479.1 "暴雷 1",
482.1 "暴雷 2",
497.6 "海啸",
507.9 "究极冲击波 x3",
512.1 "本影爆碎",
513.9 "究极冲击波 x3",
519 "龙卷风",
519.9 "究极冲击波 x4",
537.6 "暴雷 1",
540.7 "暴雷 2",
554.8 "暴雷 1",
557.8 "暴雷 2",
567.4 "地震 1",
571.9 "地震 2",
578.6 "重冲击",
585.9 "无之波动",
593 "无之波动",
596.3 "暴雷 1",
599.3 "暴雷 2",
609 "冲击波",
616.5 "无之波动",
618.1 "地震",
621.5 "无之波动",
623.2 "地震",
626.7 "无之波动",
628.3 "地震",
637.6 "暴雷",
640.6 "暴雷",
650.8 "无之波动",
652.5 "地震",
655.9 "无之波动",
657.5 "地震",
660.9 "无之波动",
662.5 "地震",
672 "白洞",
677.1 "重冲击",
684.3 "无之波动",
685.9 "地震",
691.3 "无之波动",
692.9 "地震",
705.8 "轰击",
706.1 "轰隆隆跺脚",
707.5 "轰隆隆跺脚",
708.7 "轰隆隆跺脚",
710 "轰隆隆跺脚",
711.4 "轰击",

# P4
755.5 "大十字",
760.7 "烈焰",
770.5 "大十字",
775.6 "海啸",
785.5 "大十字",
798.1 "死者暗黑光",
798.2 "生者暗黑光",
801.9 "死亡波涛",
806.6 "死亡波纹",
806.7 "死亡落雷",
815.7 "死亡尖叫",
824.6 "扑腾腾究极",
831.6 "死亡落雷",
831.7 "死亡波纹",
839.6 "死亡尖叫",
863.6 "扑腾腾究极",

# P5
902.8 "连续究极 x2",
907.7 "魔击 x3",
910.9 "魔击",
914 "魔击",
920.3 "混沌洪水 x4",
933.3 "神圣",
933.3 "核爆",
936.5 "混沌核爆",
936.6 "神圣",
940 "混沌神圣",
940 "核爆扩散",
944.6 "魔击 x2",
963.3 "三星",
969.3 "三星",
975.4 "三星",
984.8 "连续究极 x2",
989.7 "魔击 x2",
1016.3 "混沌涡旋",
1025.4 "神圣",
1025.4 "核爆",
1028.6 "混沌核爆",
1028.7 "神圣",
1032.1 "核爆扩散",
1032.1 "混沌神圣",
1036.7 "魔击 x3",
1054.3 "遗弃末世",
1059.4 "遗弃末狱",
1062.5 "遗弃末世",
1067.5 "遗弃末狱",
1070.6 "遗弃末世",
1075.7 "遗弃末狱",
1078.7 "遗弃末世",
1083.8 "遗弃末狱",

`,
  initData: () => {
    return {
      phase: 'p1-1a',
      假冰: false,
      假火: false,
      假雷: false,
      p1Tethers: [],
      p1毒: [],
      p1Cannon: [],
      combatantData: [],
      p1放石头: false,
      p1Arrow: [],
      p1石头count: 1,
      p3究极冲击波hdg: [],
      p1收集: [],
      eyeTowerIds: [],
      fakeEyeTowerIds: [],
      p2未来过去count: 0,
      purpleTowerIds: [],
      yellowTowerIds: [],
      p2hm: {},
      p2count: 1,
      p2第一轮踩塔人: [],
      p2BuffCount: {},
      p2报过了: false,
      p3buffs: {},
      p3jjcjb: undefined,
      p4真假: {
        '新生艾克斯迪司': [],
        '卡奥斯': [],
      },
      p4count: {
        '新生艾克斯迪司': 0,
        '卡奥斯': 0,
      },
      p4CastCount: 0,
      p4buffs: {},
      p4Text: {},
      p1IsTether: false,
    };
  },
  triggers: [
    {
      id: 'DMU Phase Tracker',
      type: 'StartsUsing',
      netRegex: { id: Object.keys(phases) },
      run: (data, matches) => data.phase = phases[matches.id] ?? 'unknown',
    },
    {
      id: 'DMU Phase P1 Tracker',
      type: 'StartsUsing',
      netRegex: { id: 'BCF2' },
      run: (data) => {
        if (data.phase === 'p1-1a') {
          return;
        } else if (data.phase === 'p1-1b') {
          data.phase = 'p1-2';
        } else if (data.phase === 'p1-2') {
          data.phase = 'p1-3';
        }
      },
    },
    {
      id: 'DMU P1 Graven Image Collect',
      // Tower entity actions
      // The CombatantMemory Add lines are added prior to combat
      // OverlayPlugin can retrieve the matching BNpcID
      // However, these entities seem to always spawn in the same order and the
      // first tower is the highest ID and the towers are in sequential order
      // These are the BNpcID values:
      // 1EBFBB (2015163) => Wave Cannon entity (blue)
      // 1EBFBC (2015164) => Gravitational Wave entity (purple)
      // 1EBFBD (2015165) => Intemperate Will entity (yellow)
      // 1EBFBE (2015166) => Indolent Will entity (eye)
      // 1EBFBF (2015167) => Ave Maria entity (fake eye)
      // There are two of each, they are added at start of fight
      type: 'ActorControlExtra',
      netRegex: { category: '019D', param1: '40', param2: '80', capture: true },
      preRun: (data, matches) => {
        const id = parseInt(matches.id, 16);
        // const blueTowers = [id, id - 1]; // First tower is blue and highest ID
        const purpleTowers = [id - 2, id - 4]; // Next are in pair with yellow
        const yellowTowers = [id - 3, id - 5];
        const eyeTowers = [id - 7, id - 9]; // Next are in paire with fake
        const fakeEyeTowers = [id - 6, id - 8];

        const toStringId = (id: number): string => {
          return id.toString(16).toUpperCase();
        };
        // data.blueTowerIds = blueTowers.map((id) => toStringId(id));
        data.purpleTowerIds = purpleTowers.map((id) => toStringId(id));
        data.yellowTowerIds = yellowTowers.map((id) => toStringId(id));
        data.eyeTowerIds = eyeTowers.map((id) => toStringId(id));
        data.fakeEyeTowerIds = fakeEyeTowers.map((id) => toStringId(id));
      },
      suppressSeconds: 99999,
    },
    {
      id: 'DMU P1 恶狠狠毁荡',
      type: 'StartsUsing',
      netRegex: { id: 'C403' },
      response: Responses.tankBuster(),
    },
    {
      id: 'DMU P1 tether',
      type: 'Tether',
      netRegex: { id: '002D' },
      condition: (data) => data.phase === 'p1-1a',
      preRun: (data, matches) => {
        data.p1Tethers.push(matches.target);
      },
      delaySeconds: 0.5,
      durationSeconds: 6,
      infoText: (data, _matches, output) => {
        if (data.p1Tethers.length !== 0) {
          if (data.p1Tethers.includes(data.me)) {
            data.p1Tethers = [];
            data.p1IsTether = true;
            return output.tetherOnYou!();
          }
          data.p1Tethers = [];
          data.p1IsTether = false;
          return output.idle!();
        }
      },
      outputStrings: {
        tetherOnYou: { en: '击退' },
        idle: { en: '无' },
      },
    },
    {
      id: 'DMU 真假',
      type: 'HeadMarker',
      netRegex: {
        id: [
          headMarkerData.假冰,
          headMarkerData.真冰,
          headMarkerData.假火,
          headMarkerData.真火,
          headMarkerData.假雷,
          headMarkerData.真雷,
        ],
        capture: true,
      },
      preRun: (data, matches) => {
        if (matches.id === headMarkerData.假冰) {
          data.假冰 = true;
        } else if (matches.id === headMarkerData.真冰) {
          data.假冰 = false;
        } else if (matches.id === headMarkerData.假火) {
          data.假火 = true;
        } else if (matches.id === headMarkerData.真火) {
          data.假火 = false;
        } else if (matches.id === headMarkerData.假雷) {
          data.假雷 = true;
        } else if (matches.id === headMarkerData.真雷) {
          data.假雷 = false;
        }
      },
      delaySeconds: 5,
      run: (data) => {
        data.假冰 = false;
        data.假火 = false;
      },
    },
    {
      id: 'DMU 连环环陷阱',
      type: 'GainsEffect',
      netRegex: { effectId: '13D6' },
      preRun: (data, matches) => {
        data.p1毒.push(matches.target);
      },
    },
    {
      id: 'DMU 连环环陷阱L',
      type: 'LosesEffect',
      netRegex: { effectId: '13D6' },
      preRun: (data, matches) => {
        data.p1毒 = data.p1毒.filter((name) => name !== matches.target);
      },
    },
    {
      id: 'DMU 连环环陷阱预兆',
      type: 'GainsEffect',
      netRegex: { effectId: '13D6' },
      delaySeconds: (_data, matches) => parseFloat(matches.duration) - 3.5,
      suppressSeconds: 1,
      countdownSeconds: 3.5,
      response: (data, _matches, output) => {
        if (data.phase === 'p1-1a') {
          data.phase = 'p1-1b';
        }
        if (data.p1毒.includes(data.me))
          return { alarmText: output.text!() };
        return { alertText: output.idle!() };
      },
      outputStrings: {
        text: { en: '传毒（出去）' },
        idle: { en: '吃毒' },
      },
    },
    {
      id: 'DMU 头标',
      type: 'HeadMarker',
      netRegex: { id: [headMarkerData.stack, headMarkerData.spread] },
      delaySeconds: (data) => data.phase === 'p1-1a' ? (data.p1IsTether ? 1.65 : 0.5) : 0.5,
      durationSeconds: 6,
      suppressSeconds: 1,
      alertText: (data, matches, output) => {
        if (data.phase === 'p1-3') {
          if (
            (!data.假火 && matches.id === headMarkerData.stack) ||
            (data.假火 && matches.id === headMarkerData.spread)
          )
            return output[`${data.假雷 ? '假雷' : '真雷'}分摊`]!();
          return output[`${data.假雷 ? '假雷' : '真雷'}分散`]!();
        }
        if (
          (!data.假火 && matches.id === headMarkerData.stack) ||
          (data.假火 && matches.id === headMarkerData.spread)
        )
          return output.stack!();
        return output.spread!();
      },
      outputStrings: {
        stack: { en: '分摊' },
        spread: { en: '散开散开！' },
        假雷分摊: { en: '危险区+分摊' },
        真雷分摊: { en: '安全区+分摊' },
        假雷分散: { en: '危险区+散开' },
        真雷分散: { en: '安全区+散开' },
      },
    },
    {
      id: 'DMU P1 真假雷',
      type: 'StartsUsingExtra',
      netRegex: { id: ['BA98', 'BA9E'] },
      condition: (data) => data.phase === 'p1-1a',
      durationSeconds: 6,
      suppressSeconds: 1,
      infoText: (data, matches, output) => {
        const dirNum = Directions.hdgTo8DirNum(parseFloat(matches.heading));
        const rr = [1, 7, 3, 5];
        const [n1, n2] = ([(dirNum + 2) % 8, (dirNum + 4 + 2) % 8].sort((a, b) => {
          return rr.indexOf(a) - rr.indexOf(b);
        })) as [
          number,
          number,
        ];
        if (data.triggerSetConfig.p1击退加真假火冰打法 === 'TN左DPS右') {
          return output[
            `${'TN左DPS右'}${Directions.outputFrom8DirNum([5, 7].includes(n1) ? n1 : n2)}`
          ]!();
        }
        if (data.triggerSetConfig.p1击退加真假火冰打法 === '正攻') {
          const n = (data.p1IsTether ? [3, 5] : [1, 7]).includes(n1) ? n1 : n2;
          const nn = {
            3: 1,
            5: 7,
            1: 1,
            7: 7,
          }[n]!;
          return output[
            `${'正攻'}${Directions.outputFrom8DirNum(nn)}${nn !== n ? '击退' : ''}`
          ]!();
        }
        // if (data.triggerSetConfig.p1击退加真假火冰打法 === '双安全区') {
        //   return output.text!({
        //     dir1: output[Directions.outputFrom8DirNum(n1)]!(),
        //     dir2: output[Directions.outputFrom8DirNum(n2)]!(),
        //   });
        // }
      },
      outputStrings: {
        text: { en: '${dir1}${dir2}' },
        dirNE: { en: '二' },
        dirSE: { en: '三' },
        dirSW: { en: '四' },
        dirNW: { en: '一' },

        正攻dirNE: { en: '右上' },
        正攻dirNE击退: { en: '右上击退' },
        正攻dirSE: { en: '右下' },
        正攻dirSW: { en: '左下' },
        正攻dirNW: { en: '左上' },
        正攻dirNW击退: { en: '左上击退' },

        TN左DPS右dirNE: { en: '右上' },
        TN左DPS右dirSE: { en: '右下' },
        TN左DPS右dirSW: { en: '左下' },
        TN左DPS右dirNW: { en: '左上' },
      },
    },
    {
      id: 'DMU P1 真假雷冰',
      type: 'StartsUsing',
      netRegex: { id: 'BA94' },
      condition: (data) => data.phase === 'p1-1b',
      delaySeconds: 0.25,
      infoText: (data, _matches, output) => {
        return output[
          `${data.假冰 ? '假' : '真'}冰${data.假雷 ? '假' : '真'}雷`
        ]!();
      },
      outputStrings: {
        '真冰真雷': { en: '都躲开' },
        '真冰假雷': { en: '吃直条' },
        '假冰真雷': { en: '吃扇形' },
        '假冰假雷': { en: '都吃' },
      },
    },
    {
      id: 'DMU 制裁之光',
      type: 'StartsUsing',
      netRegex: { id: 'C622' },
      response: (data) => {
        if (data.role === 'tank' || data.role === 'healer') {
          return { alertText: '大AoE伤害！ => 死刑x3' };
        }
        return { infoText: '大AoE伤害！' };
      },
    },
    {
      id: 'DMU P1 Wave Cannon',
      type: 'Ability',
      netRegex: { id: 'BAA8' },
      condition: (data) => data.phase === 'p1-1a',
      preRun: (data, matches) => {
        if (matches.type === '21') {
          data.p1Cannon.push(matches.target);
        }
        if (matches.type === '22' && (+matches.targetCount === (+matches.targetIndex + 1))) {
          data.p1Cannon.push(matches.target);
        }
      },
      response: (data, _matches, output) => {
        if (data.p1Cannon.length === 4) {
          if (data.p1Cannon.includes(data.me)) {
            data.p1Cannon = [];
            return { infoText: output.avoid!() };
          }
          data.p1Cannon = [];
          return { alertText: output.tower!() };
        }
      },
      outputStrings: {
        avoid: { en: '躲开' },
        tower: { en: '踩塔' },
      },
    },
    {
      id: 'DMU P1 神像2 连线',
      type: 'Tether',
      netRegex: { id: '002D' },
      condition: (data, matches) => data.phase === 'p1-2' && matches.target === data.me,
      durationSeconds: 7,
      promise: async (data, matches) => {
        data.combatantData = [];
        data.combatantData = (await callOverlayHandler({
          call: 'getCombatants',
          ids: [parseInt(matches.sourceId, 16)],
        })).combatants;
      },
      response: (data, _matches, output) => {
        const x = data.combatantData[0]!.PosX;
        if (x < 110) {
          data.p1放石头 = false;
          // 放黑洞
          return {
            infoText: output.placeBlackHole!(),
          };
        }
        // 放石头
        data.p1放石头 = true;
        return { alertText: output.placeRock!() };
      },
      outputStrings: {
        placeBlackHole: { en: '黑洞' },
        placeRock: { en: '石头' },
      },
    },
    {
      id: 'DMU P1 神像2 连线++',
      type: 'Tether',
      netRegex: { id: '002D' },
      condition: (data, matches) => data.phase === 'p1-2' && matches.target === data.me,
      delaySeconds: 2,
      durationSeconds: 4,
      suppressSeconds: 60,
      infoText: (data, _matches, output) => {
        return data.假冰 ? output.假冰!() : output.真冰!();
      },
      outputStrings: {
        假冰: { en: '吃扇形' },
        真冰: { en: '不吃' },
      },
    },
    {
      id: 'DMU P1 神像2 连线~',
      type: 'Tether',
      netRegex: { id: '002D' },
      condition: (data) => data.phase === 'p1-2',
      delaySeconds: (data) => data.p1石头count === 1 ? 6 : 8.5,
      response: (data, matches, output) => {
        if (matches.target === data.me) {
          data.p1石头count++;
          return data.p1放石头 ? { alarmText: output.placeRock!() } : { infoText: output.mid!() };
        }
      },
      outputStrings: {
        placeRock: { en: '出去放石头' },
        mid: { en: '中间' },
      },
    },
    {
      id: 'DMU P1 神像3',
      type: 'GainsEffect',
      netRegex: { 'effectId': Object.keys(arrowBuffs) },
      condition: Conditions.targetIsYou(),
      durationSeconds: 10,
      infoText: (data, matches, output) => {
        data.p1Arrow.push({
          a: arrowBuffs[matches.effectId as keyof typeof arrowBuffs],
          s: parseFloat(matches.duration),
        });
        if (data.p1Arrow.length === 2) {
          // const r = ['左', '右', '上', '下'];
          const a = data.p1Arrow.sort((a, b) => a.s - b.s);
          return output.text!({
            a1: output[a[0]!.a]!(),
            a2: output[a[1]!.a]!(),
          });
        }
      },
      outputStrings: {
        'text': '${a1} + ${a2}',
        '上': '上',
        '下': '下',
        '左': '左',
        '右': '右',
      },
    },
    {
      id: 'DMU P1 神像3 连线收集',
      type: 'Tether',
      netRegex: { id: '002D' },
      condition: (data) => data.phase === 'p1-3',
      preRun: (data, matches) => {
        data.p1收集.push({ sourceId: matches.sourceId, target: matches.target });
      },
    },
    {
      id: 'DMU P1 神像3 连线',
      type: 'Tether',
      netRegex: { id: '002D' },
      condition: (data) => data.phase === 'p1-3',
      delaySeconds: 3,
      durationSeconds: 7,
      promise: async (data) => {
        data.combatantData = [];
        data.combatantData = (await callOverlayHandler({
          call: 'getCombatants',
        })).combatants;
      },
      response: (data, matches, output) => {
        if (matches.target === data.me) {
          const id = data.p1收集.find((v) => v.target === data.me)!.sourceId;
          const x = data.combatantData.find((v) => v.ID === parseInt(id, 16))!.PosX;
          if (x < 100) {
            return { alertText: output.a!() };
          }
          return { infoText: output.b!() };
        }
      },
      outputStrings: {
        a: { en: '去外面' },
        b: { en: '在里面' },
      },
    },
    {
      id: 'DMU P1 Ave Maria',
      // BAB3 Ave Maria
      // The animation is visible ~9.89s before cast goes off, however
      // When animation becomes visible, the players will be asleep or
      // confused for another ~3.4s. Once the debuff ends the players have
      // ~6.4s to turn character
      type: 'ActorControlExtra',
      netRegex: { category: '019D', param1: '40', param2: '80', capture: true },
      condition: (data, matches) => data.fakeEyeTowerIds.includes(matches.id),
      durationSeconds: 10,
      countdownSeconds: 10,
      alarmText: (_data, _matches, output) => output.lookAt!(),
      outputStrings: {
        lookAt: {
          en: 'Look At Statue',
          cn: '看神像',
        },
      },
    },
    {
      id: 'DMU P1 Indolent Will',
      // BAB4 Indolent Will
      type: 'ActorControlExtra',
      netRegex: { category: '019D', param1: '40', param2: '80', capture: true },
      condition: (data, matches) => data.eyeTowerIds.includes(matches.id),
      durationSeconds: 10,
      countdownSeconds: 10,
      alarmText: (_data, _matches, output) => output.lookAway!(),
      outputStrings: {
        lookAway: {
          en: 'Look Away From Statue',
          cn: '背对神像',
        },
      },
    },
    {
      id: 'DMU P1 Impertinent Will',
      type: 'ActorControlExtra',
      netRegex: { category: '019D', param1: '40', param2: '80', capture: true },
      condition: (data, matches) => data.yellowTowerIds.includes(matches.id),
      alertText: (_data, _matches, output) => output.goWest!(),
      outputStrings: {
        goWest: Outputs.getLeftAndWest,
      },
    },
    {
      id: 'DMU P1 Gravitational Wave',
      type: 'ActorControlExtra',
      netRegex: { category: '019D', param1: '40', param2: '80', capture: true },
      condition: (data, matches) => data.purpleTowerIds.includes(matches.id),
      alertText: (_data, _matches, output) => output.goEast!(),
      outputStrings: {
        goEast: Outputs.getRightAndEast,
      },
    },
    {
      id: 'DMU P2 双腕',
      type: 'StartsUsing',
      netRegex: { id: 'C24C' },
      response: Responses.sharedTankBuster(),
    },
    {
      id: 'DMU P2 遗弃末世',
      type: 'StartsUsing',
      netRegex: { id: 'BABC' },
      response: Responses.bigAoe(),
    },
    {
      id: 'DMU P2 未来终结',
      type: 'StartsUsing',
      netRegex: { id: 'BAD2' },
      preRun: (data) => {
        data.p2未来过去count++;
      },
      delaySeconds: 7,
      durationSeconds: (data) => data.p2未来过去count === 4 ? 10 : 5,
      alarmText: (data, _matches, output) => {
        if (data.p2未来过去count === 4) {
          return output.text4!();
        }
        return output.text!();
      },
      outputStrings: {
        text: '未来，塔对面，对面',
        text4: '未来，要穿，要穿',
      },
    },
    {
      id: 'DMU P2 过去终结',
      type: 'StartsUsing',
      netRegex: { id: 'BAD3' },
      preRun: (data) => {
        data.p2未来过去count++;
      },
      delaySeconds: 7,
      durationSeconds: (data) => data.p2未来过去count === 4 ? 10 : 5,
      alarmText: (data, _matches, output) => {
        if (data.p2未来过去count === 4) {
          return output.text4!();
        }
        return output.text!();
      },
      outputStrings: {
        text: '过去，塔中间，中间',
        text4: '过去，留原地，原地',
      },
    },
    {
      id: 'DMU P2 HM',
      type: 'HeadMarker',
      netRegex: {
        id: [
          headMarkerData.分摊,
          headMarkerData.钢铁,
          headMarkerData.扇形,
        ],
      },
      preRun: (data, matches) => {
        data.p2hm[data.p2count - 1] ??= [];
        data.p2hm[data.p2count - 1]!.push({
          target: matches.target,
          buff: {
            [headMarkerData.分摊]: '分摊',
            [headMarkerData.钢铁]: '钢铁',
            [headMarkerData.扇形]: '扇形',
          }[matches.id]!,
          role: data.party.nameToRole_[matches.target] as 'dps' | 'tank' | 'healer',
        });
      },
    },
    {
      id: 'DMU P2 第一轮踩塔',
      type: 'Ability',
      netRegex: { id: 'BABE' },
      preRun: (data, matches) => {
        if (data.p2第一轮踩塔人.length >= 4) {
          return;
        }
        data.p2第一轮踩塔人.push(matches.target);
      },
    },
    {
      id: 'DMU P2 踩塔计数',
      type: 'Ability',
      netRegex: { id: 'BABE' },
      preRun: (data) => {
        data.p2count++;
        data.p2报过了 = false;
      },
      suppressSeconds: 1,
    },
    {
      id: 'DMU P2 事',
      type: 'GainsEffect',
      netRegex: {
        effectId: '13DB',
      },
      preRun: (data, matches) => {
        data.p2BuffCount[matches.target] = Number(matches.count);
      },
    },
    {
      id: 'DMU P2 没事干了',
      type: 'LosesEffect',
      netRegex: {
        effectId: '13DB',
      },
      preRun: (data, matches) => {
        data.p2BuffCount[matches.target] = 0;
      },
      delaySeconds: (data) => data.triggerSetConfig.p2一运打法 === '1234' ? 6 : 0.25,
      infoText: (data, matches, output) => {
        if (data.p2count === 9) {
          return;
        }
        if (data.p2报过了) {
          return;
        }
        return getP2(data, matches, output);
      },
      outputStrings: {
        ...p2OutputStirngs,
      },
    },
    {
      id: 'DMU P2 HM判',
      comment: {
        en: '为了尽量适配所有打法 + 尽量不引入职能分配悬浮窗。第一轮DPS请自己判断是否进塔……',
      },
      type: 'HeadMarker',
      netRegex: {
        id: [
          headMarkerData.分摊,
          headMarkerData.钢铁,
          headMarkerData.扇形,
        ],
      },
      delaySeconds: (data) => {
        return [3, 5, 7].includes(data.p2count) ? 5 : 0.25;
      },
      durationSeconds: 10,
      suppressSeconds: 1,
      infoText: (data, matches, output) => {
        if (data.p2报过了) {
          return;
        }
        return getP2(data, matches, output);
      },
      outputStrings: {
        ...p2OutputStirngs,
      },
    },
    {
      id: 'DMU P2 Light of Judgment',
      type: 'StartsUsing',
      netRegex: { id: 'BABD', capture: false },
      response: Responses.bigAoe('alert'),
    },
    {
      id: 'DMU P2 Single Wing of Destruction',
      // BACD Wings of Destruction, Left wing highlight
      // BACE Wingso of Desctruction, Right wing highlight
      // Halfroom cleaves
      type: 'StartsUsing',
      netRegex: { id: ['BACD', 'BACE'], capture: true },
      infoText: (_data, matches, output) => {
        if (matches.id === 'BACD')
          return output.right!();
        return output.left!();
      },
      outputStrings: {
        right: Outputs.right,
        left: Outputs.left,
      },
    },
    {
      id: 'DMU P2 Wings of Destruction',
      type: 'StartsUsing',
      netRegex: { id: 'C487', capture: false },
      response: (data, _matches, output) => {
        // cactbot-builtin-response
        output.responseOutputStrings = {
          maxMeleeAvoidTanks: {
            en: 'Max Melee: Avoid Tanks',
            cn: '最大近战距离，避开坦克',
          },
          wingsBeNearFar: {
            en: 'Wings: Be Near/Far',
            cn: '双翅膀：近或远',
          },
        };
        if (data.role === 'tank')
          return { alertText: output.wingsBeNearFar!() };
        return { infoText: output.maxMeleeAvoidTanks!() };
      },
    },
    {
      id: 'DMU P2 Aero III Assault',
      // Knockback from boss that can't be resisted
      // Applies 306 Down for the Count
      type: 'StartsUsing',
      netRegex: { id: 'C3F7', capture: false },
      response: Responses.getUnder('alert'),
    },
    {
      id: 'DMU P3 debuff',
      type: 'StartsUsing',
      netRegex: { id: ['C2E2', 'C2E3'] },
      suppressSeconds: 1,
      infoText: (_data, _matches, output) => output.text!(),
      outputStrings: {
        text: '获取防火墙',
      },
    },
    {
      id: 'DMU P3 深层痛楚',
      type: 'StartsUsing',
      netRegex: { id: 'BAF2' },
      response: Responses.aoe(),
    },
    {
      id: 'DMU P3-1 debuff',
      type: 'GainsEffect',
      netRegex: {
        effectId: Object.keys(p3buff),
      },
      preRun: (data, matches) => {
        data.p3buffs[matches.target] ??= [];
        data.p3buffs[matches.target]!.push({
          name: p3buff[matches.effectId]!.name,
          duration: parseFloat(matches.duration),
        });
      },
    },
    {
      id: 'DMU P3-1 debuff 风',
      type: 'GainsEffect',
      netRegex: {
        effectId: ['642', '643'],
      },
      condition: (data, matches) => {
        return data.phase === 'p3' && matches.target === data.me;
      },
      delaySeconds: 68 - 10,
      durationSeconds: 10,
      suppressSeconds: 300,
      countdownSeconds: 7,
      response: (_data, matches, output) => {
        // console.warn(_data.me, matches.effect, matches.effectId);
        // return {};
        return {
          [matches.id === '643' ? 'infoText' : 'alertText']: output[matches.effectId]!(),
        };
      },
      outputStrings: {
        '643': '面向艾克斯迪斯',
        '642': '背对BOSS',
      },
    },
    {
      id: 'DMU P3-1 debuff 水火',
      type: 'GainsEffect',
      netRegex: {
        effectId: ['640', '641'],
      },
      condition: (data, matches) => {
        // console.warn(data.phase);
        return data.phase === 'p3' && matches.target === data.me;
      },
      delaySeconds: 0.5,
      durationSeconds: (_data, matches) => {
        return parseFloat(matches.duration);
      },
      suppressSeconds: 200,
      countdownSeconds: (_data, matches) => {
        return parseFloat(matches.duration);
      },
      infoText: (_data, matches, output) => {
        return output[
          `${parseFloat(matches.duration) > 60 ? '长' : '短'}${
            matches.effectId === '640' ? '火' : '水'
          }`
        ]!();
      },
      outputStrings: {
        长火: '长火',
        短火: '短火',
        长水: '长水',
        短水: '短水',
      },
    },
    {
      id: 'DMU P3 究极冲击波',
      type: 'AbilityExtra',
      netRegex: { id: 'BAE3' },
      preRun: (data, matches) => {
        data.p3究极冲击波hdg.push(parseFloat(matches.heading));
      },
      durationSeconds: 20,
      alertText: (data, _matches, output) => {
        if (data.p3究极冲击波hdg.length === 2) {
          const [c1, c2] = data.p3究极冲击波hdg as [number, number];
          const dir1 = Directions.hdgTo8DirNum(c1);
          const dir2 = Directions.hdgTo8DirNum(c2);
          const start = Directions.outputFrom8DirNum(dir1);
          const clock = (dir2 - dir1 === 1) || (dir2 === 0 && dir1 === 7);
          const clk = clock ? '顺' : '逆';
          data.p3jjcjb = {
            c1,
            c2,
            clk,
          };
          return output.text!({
            start: output[start]!(),
            clk: output[clk]!(),
          });
        }
      },
      outputStrings: {
        text: '${start} ${clk}',
        顺: '逆←',
        逆: '顺→',
        dirNW: '1',
        dirN: 'A',
        dirNE: '2',
        dirE: 'B',
        dirSE: '3',
        dirS: 'C',
        dirSW: '4',
        dirW: 'D',
        unknown: 'unknown',
      },
    },
    {
      id: 'DMU P3 MJ',
      type: 'HeadMarker',
      netRegex: { id: Object.keys(p3mj), capture: true },
      condition: (data, matches) => data.phase === 'p3' && matches.target === data.me,
      durationSeconds: 12,
      infoText: (data, matches, output) => {
        const n = p3mj[matches.id]!;
        // 这里的clk没取反，是boss的冲锋顺序，所以下面的判断是!==
        const { c1, clk } = data.p3jjcjb!;
        const dir1 = Directions.hdgTo8DirNum(c1);
        const p = (clk !== '顺' ? +1 : -1);
        const g = dir1 * 2 + p + (2 * (n - 1)) * p;
        const r = (g + 16) % 16;
        const [a1, a2] = [
          Directions.outputFrom8DirNum(((r - 1 + 16) % 16) / 2),
          Directions.outputFrom8DirNum(((r + 1) % 16) / 2),
        ];
        const r1 = output[a1]!();
        const r2 = output[a2]!();
        // console.log(
        //   `${data.me}:${n}麻,${dir1}${clk}，g=${g},r1=${r1},r2=${r2},去${r1}/${r2}`,
        // );
        return output.text!({ n, r1, r2 });
      },
      outputStrings: {
        text: '${n}麻，去 ${r1}${r2}之间',
        dirNW: '1',
        dirN: 'A',
        dirNE: '2',
        dirE: 'B',
        dirSE: '3',
        dirS: 'C',
        dirSW: '4',
        dirW: 'D',
      },
    },
    {
      id: 'DMU P3 暴雷钢铁',
      type: 'StartsUsing',
      netRegex: { id: 'BB12', capture: false },
      condition: (data) => data.phase === 'p3',
      durationSeconds: 1,
      infoText: (_data, _matches, output) => {
        return output.text!();
      },
      outputStrings: {
        text: '远离艾克斯迪斯',
      },
    },
    {
      id: 'DMU P3 暴雷死刑',
      type: 'StartsUsing',
      netRegex: { id: 'BB09', capture: true },
      condition: (data) => data.phase === 'p3',
      countdownSeconds: 4.5,
      response: Responses.tankBuster(),
    },
    {
      id: 'DMU P3 暴雷死刑2',
      type: 'StartsUsing',
      netRegex: { id: 'BB09', capture: true },
      condition: (data) => data.phase === 'p3',
      delaySeconds: 4.5,
      countdownSeconds: 3,
      response: Responses.tankBuster(),
    },
    {
      id: 'DMU P3 纬度聚爆',
      type: 'StartsUsing',
      netRegex: { id: 'BAFE', capture: false },
      condition: (data) => data.phase === 'p3',
      infoText: (_data, _matches, output) => output.text!(),
      outputStrings: { text: '去前后' },
    },
    {
      id: 'DMU P3 经度聚爆',
      type: 'StartsUsing',
      netRegex: { id: 'BAFD', capture: false },
      condition: (data) => data.phase === 'p3',
      infoText: (_data, _matches, output) => output.text!(),
      outputStrings: { text: '去左右' },
    },
    {
      id: 'DMU P3 闪亮亮耳光BAE6',
      type: 'StartsUsing',
      netRegex: { id: 'BAE6', capture: false },
      condition: (data) => data.phase === 'p3',
      alertText: (_data, _matches, output) => output.text!(),
      outputStrings: { text: '右分摊' },
    },
    {
      id: 'DMU P3 闪亮亮耳光BAE7',
      type: 'StartsUsing',
      netRegex: { id: 'BAE7', capture: false },
      condition: (data) => data.phase === 'p3',
      alertText: (_data, _matches, output) => output.text!(),
      outputStrings: { text: '左职能刀' },
    },
    {
      id: 'DMU P3 本色出演的你',
      type: 'StartsUsing',
      netRegex: { id: ['BAEC', 'BAED'], capture: false },
      condition: (data) => data.phase === 'p3',
      suppressSeconds: 1,
      alertText: (_data, _matches, output) => output.text!(),
      outputStrings: { text: '去两侧' },
    },
    {
      id: 'DMU P3 诅咒赦令',
      type: 'StartsUsing',
      netRegex: { id: 'BB01', capture: false },
      condition: (data) => data.phase === 'p3',
      infoText: (_data, _matches, output) => output.text!(),
      outputStrings: { text: '去背后' },
    },
    {
      id: 'DMU P4 真假大十字',
      type: 'GainsEffect',
      // 45F = 卡奥斯 假
      // 460 = 卡奥斯 真
      // 461 = 新生艾克斯迪司 假
      // 462 = 新生艾克斯迪司 真
      netRegex: { effectId: '808' },
      condition: (data) => data.phase === 'p3',
      delaySeconds: (data) => data.p4真假.新生艾克斯迪司.length === 3 ? 0 : 3,
      run: (data, matches) => {
        data.p4真假[['45F', '460'].includes(matches.count) ? '卡奥斯' : '新生艾克斯迪司'].push(
          [
            '460',
            '462',
          ].includes(matches.count),
        );
      },
    },
    {
      id: 'DMU P4 BUFF 判定前提示',
      type: 'GainsEffect',
      netRegex: { effectId: Object.keys(p4buff), capture: true },
      condition: (data, matches) => {
        return data.phase === 'p3' && matches.target === data.me &&
          !['生者之伤', '死者之伤', '亚拉戈领域', '超越死亡'].includes(p4buff[matches.effectId]!.name);
      },
      delaySeconds: (data, matches, output) => {
        const buff = p4buff[matches.effectId]!;
        const source = buff.source;
        const sourceTF = data.p4真假[source][data.p4count[source] - 1];
        // console.warn(
        //   data.me,
        //   matches.timestamp,
        //   source,
        //   data.p4真假[source][data.p4count[source] - 1],
        // );
        const gimmick = buff[sourceTF ? 'true' : 'false'];
        const { timestamp, target, duration, effectId } = matches;
        data.p4Text[`${timestamp}|${target}|${duration}|${effectId}`] = output[gimmick]!();
        return parseFloat(duration) - 5.5;
      },
      durationSeconds: 5.5,
      countdownSeconds: 5.5,
      infoText: (data, matches, output) => {
        const { timestamp, target, duration, effectId } = matches;
        const i = data.p4buffs[data.me]!.findIndex((v) =>
          v.name === p4buff[matches.effectId]!.name
        );
        const d = data.p4buffs[data.me]![i];
        const g = d!.time;
        const pre = data.p4buffs[data.me]![i - 1];
        if (pre) {
          const diff = Math.abs(pre.time - g);
          // 如果这次机制与上一个机制时间小于3秒，则这次机制不报
          if (diff <= 3)
            return undefined;
        }
        const next = data.p4buffs[data.me]![i + 1];
        if (next === undefined) {
          return;
        }
        const nextDiff = Math.abs(next.time - g);
        // 如果这次机制与下一个机制小于3秒，则一起报下一个机制
        if (nextDiff <= 3) {
          return output[d!.gimmick]!() + output.plus!() + output[next.gimmick]!();
        }
        return data.p4Text[`${timestamp}|${target}|${duration}|${effectId}`];
      },
      outputStrings: {
        plus: { en: ' + ' },
        雷分散: { en: '雷分散' },
        水分摊: { en: '水分摊' },
        背对眼: { en: '背对' },
        面对眼: { en: '面对' },
        停手: { en: '静剑' },
        移动: { en: '动剑' },
        钢铁: { en: '放钢铁后出去' },
        月环: { en: '放月环等buff' },
      },
    },
    {
      id: 'DMU P4 BUFF 长时间提示',
      type: 'GainsEffect',
      netRegex: { effectId: Object.keys(p4buff), capture: false },
      condition: (data) => data.phase === 'p3',
      delaySeconds: 0.25,
      durationSeconds: (data) => {
        data.p4CastCount++;
        return [3, 3, 3, 3, 30][data.p4CastCount];
      },
      suppressSeconds: 1,
      response: (data, _matches, output) => {
        if (data.p4CastCount > 5)
          return {};
        if (data.p4CastCount <= 4) {
          return {
            infoText: output.n1t4!({
              text: data.p4buffs[data.me]!.filter((v) => v.count === data.p4CastCount).map((v) =>
                output[v.gimmick]!()
              ).join(output.join1!()),
            }),
            tts: null,
          };
        }
        let text = '';
        const b = data.p4buffs[data.me]!.filter((v) =>
          !['生者之伤', '死者之伤', '亚拉戈领域', '超越死亡'].includes(v.name)
        );
        b.map((v, i) => {
          text += output[v.gimmick]!();
          if ((Math.abs((b[i + 1]?.time ?? 0) - v.time)) <= 3) {
            text += output.plus!();
          } else {
            text += output.join5!();
          }
        });
        text = text.replace(new RegExp(`${output.join5!()}$`), '');
        return { alarmText: output.text5!({ text }), tts: null };
      },
      outputStrings: {
        雷分散: { en: '雷分散' },
        水分摊: { en: '水分摊' },
        背对眼: { en: '背对' },
        面对眼: { en: '面对' },
        停手: { en: '静剑' },
        移动: { en: '动剑' },
        钢铁: { en: '放钢铁' },
        月环: { en: '放月环' },
        plus: { en: '+' },
        join1: { en: '、' },
        join5: { en: '→' },
        n1t4: '${text}',
        text5: '${text}',
      },
    },
    {
      id: 'DMU P4 大十字',
      type: 'StartsUsing',
      netRegex: { id: 'BB14' },
      delaySeconds: 2,
      run: (data) => data.p4count.新生艾克斯迪司++,
    },
    {
      id: 'DMU P4 烈焰/海啸',
      type: 'StartsUsing',
      netRegex: { id: ['BB1E', 'BB20', 'BB1F', 'BB21'] },
      delaySeconds: 2,
      suppressSeconds: 1,
      run: (data) => data.p4count.卡奥斯++,
    },
    {
      id: 'DMU P4 BUFF',
      type: 'GainsEffect',
      netRegex: { effectId: Object.keys(p4buff) },
      run: (data, matches) => {
        if (data.phase !== 'p3')
          return false;
        const buff = p4buff[matches.effectId]!;
        const source = buff.source;
        const sourceTF = data.p4真假[source][data.p4count[source] - 1];
        const gimmick = buff[sourceTF ? 'true' : 'false'];
        (data.p4buffs[matches.target] ??= []).push({
          name: buff.name,
          tf: sourceTF ? '真' : '假',
          gimmick: gimmick,
          // duration: parseFloat(matches.duration),
          time: (new Date(matches.timestamp).getTime() / 1000) + parseFloat(matches.duration),
          count: data.p4CastCount,
          bossCount: data.p4count[source],
        });
        data.p4buffs[matches.target]!.sort((a, b) => a.time - b.time);
        // return matches.target === data.me;
      },
    },
    {
      id: 'DMU P4 无之泛滥',
      type: 'StartsUsing',
      netRegex: {
        id: [
          'C3A1',
          'C3A2',
          'C392',
          'C393',
        ],
      },
      // C3A1左紫右蓝（假的？）（猜的）
      // C3A2左蓝右紫（假的）
      // C392左紫右蓝（真的）
      // C393左蓝右紫（真的）
      delaySeconds: 0.5,
      alertText: (data, matches, output) => {
        data.p4count.新生艾克斯迪司++;
        const tf = data.p4真假['新生艾克斯迪司'][3];
        const me = data.p4buffs[data.me]!.find((v) => v.name === '生者之伤' || v.name === '死者之伤')!;
        // me已经处理过真假
        let eat = me.gimmick === '吃蓝' ? '蓝' : '紫';
        const st = data.p4buffs[data.me]!.find((v) => v.name === '超越死亡' || v.name === '亚拉戈领域')!;
        if (st === undefined) {
          console.warn(data.me, data.p4buffs[data.me]?.slice());
        }
        if (st.gimmick === '死超')
          eat = eat === '蓝' ? '紫' : '蓝';
        if (tf)
          eat = eat === '蓝' ? '紫' : '蓝';

        const see = (matches.id === 'C392' || matches.id === 'C3A1') ? ['紫', '蓝'] : ['蓝', '紫'];
        const index = see.findIndex((v) => v === eat);
        const dir = index === 0 ? 'left' : 'right';
        return output[dir]!({ c: eat, tf: output[tf ? 'real' : 'fake']!() });
      },
      outputStrings: {
        left: '<=左 吃${tf}${c}色',
        right: '右=> 吃${tf}${c}色',
        real: '真的',
        fake: '假的',
      },
    },
  ],
};

export default triggerSet;
