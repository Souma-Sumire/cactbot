import Conditions from '../../../../../resources/conditions';
import { callOverlayHandler } from '../../../../../resources/overlay_plugin_api';
import { Responses } from '../../../../../resources/responses';
import ZoneId from '../../../../../resources/zone_id';
import { RaidbossData } from '../../../../../types/data';
import { PluginCombatantState } from '../../../../../types/event';
import { NetMatches } from '../../../../../types/net_matches';
import { TriggerSet } from '../../../../../types/trigger';

const mjMap: Record<string, string> = {
  BBC: '1麻',
  BBD: '2麻',
  BBE: '3麻',
  D7B: '4麻',
  1292: 'beta',
  1290: 'alpha',
};

type Phase = '第一次细胞' | '第二次细胞' | '麻将' | '麻将后';

export interface Data extends RaidbossData {
  sWeaponId: number | undefined;
  sBuffs: string[];
  sSpreadStack: NetMatches['GainsEffect'][];
  sWings: Record<string, string>;
  sMj?: { mj: string; sym: string };
  sPhase: Phase;
  sBalls: NetMatches['AddedCombatant'][];
  sBallsFirst: boolean;
  sBallsOver: boolean;
  sMjNikus: string[];
  sCombatantData: PluginCombatantState[];
}

const triggerSet: TriggerSet<Data> = {
  id: 'SoumaAacHeavyweightM4Savage',
  zoneId: ZoneId.AacHeavyweightM4Savage,
  zoneLabel: { en: 'M12S Souma特供版' },
  overrideTimelineFile: true,
  timeline: ``,
  initData: () => {
    return {
      sWeaponId: undefined,
      sBuffs: [],
      sSpreadStack: [],
      sMj: undefined,
      sWings: {},
      sPhase: '第一次细胞',
      sBalls: [],
      sBallsFirst: false,
      sBallsOver: false,
      sMjNikus: [],
      sCombatantData: [],
    };
  },
  triggers: [
    {
      id: 'souma r12s aoe B4D7',
      type: 'StartsUsing',
      netRegex: { id: 'B4D7', capture: false },
      response: Responses.bigAoe(),
    },
    {
      id: 'souma r12s 伸展',
      type: 'StartsUsing',
      netRegex: { id: 'B469', capture: false },
      delaySeconds: 4,
      promise: async (data) => {
        const add = (await callOverlayHandler({ call: 'getCombatants' })).combatants.find((v) =>
          v.BNpcID === 19196 && v.BNpcNameID === 14378 && v.WeaponId
        );
        if (!add) {
          throw new Error('没有找到武器');
        }
        data.sWeaponId = add.WeaponId;
      },
      infoText: (data, _matches, output) => {
        return data.sWeaponId === 5 ? output.right!() : output.left!();
      },
      outputStrings: {
        left: { en: '左侧安全' },
        right: { en: '右侧安全' },
      },
    },
    {
      id: 'souma r12s majiang',
      type: 'GainsEffect',
      netRegex: {
        effectId: [
          'BBC', // 1麻
          'BBD', // 2麻
          'BBE', // 3麻
          'D7B', // 4麻
          '1292', // beta
          '1290', // alpha
        ],
        capture: true,
      },
      condition: (data, matches) => {
        return matches.target === data.me;
      },
      run: (data, matches) => {
        const arr = data.sBuffs;
        arr.push(matches.effectId);
        if (arr.length === 2) {
          arr.sort((a, b) => parseInt(a, 16) - parseInt(b, 16));
          const mj = arr[0]!;
          const sym = arr[1]!;
          data.sMj = { mj: mjMap[mj]!, sym: sym === '1292' ? 'beta' : 'alpha' };
        }
      },
    },
    {
      id: 'souma r12s 麻将出发',
      type: 'GainsEffect',
      netRegex: { effectId: ['1292', '1290'], capture: true },
      condition: Conditions.targetIsYou(),
      delaySeconds: 0.5,
      durationSeconds: 40,
      suppressSeconds: 999,
      infoText: (data, _matches, output) => output[data.sMj!.mj + data.sMj!.sym]!(),
      outputStrings: {
        '1麻alpha': { en: '阿尔法1。记场地三塔，先出去再踩塔' },
        '2麻alpha': { en: '阿尔法2。记场地四塔，先出去再踩塔' },
        '3麻alpha': { en: '阿尔法3。记场地一塔，先踩塔再出去' },
        '4麻alpha': { en: '阿尔法4。记场地二塔，先踩塔再出去' },
        '1麻beta': { en: '贝塔1。内拉线 => 玩家三塔' },
        '2麻beta': { en: '贝塔2。内拉线 => 玩家四塔' },
        '3麻beta': { en: '贝塔3。玩家一塔 => 内拉线' },
        '4麻beta': { en: '贝塔4。玩家二塔 => 内拉线' },
      },
    },
    {
      id: 'souma r12s 麻将0',
      type: 'GainsEffect',
      netRegex: { effectId: ['1292', '1290'], capture: true },
      condition: Conditions.targetIsYou(),
      delaySeconds: (_data, matches) => parseFloat(matches.duration) - 0.5,
      suppressSeconds: 999,
      alertText: (data, _matches, output) => output[data.sMj!.sym]!(),
      outputStrings: {
        'alpha': { en: '出去！' },
        'beta': { en: '向内拉！' },
      },
    },
    {
      id: 'souma r12s 麻将34',
      type: 'GainsEffect',
      netRegex: { effectId: ['1292', '1290'], capture: true },
      condition: Conditions.targetIsYou(),
      delaySeconds: (_data, matches) => parseFloat(matches.duration) - 8,
      durationSeconds: 5,
      suppressSeconds: 999,
      alertText: (data, _matches, output) => {
        if (data.sMj?.mj === '3麻' || data.sMj?.mj === '4麻') {
          return output[data.sMj.sym]!();
        }
      },
      outputStrings: {
        'alpha': { en: '踩场地塔' },
        'beta': { en: '踩玩家塔' },
      },
    },
    {
      id: 'souma r12s 麻将12',
      type: 'GainsEffect',
      netRegex: { effectId: ['1292', '1290'], capture: true },
      condition: Conditions.targetIsYou(),
      delaySeconds: (_data, matches) => parseFloat(matches.duration) + 2,
      countdownSeconds: 7,
      durationSeconds: 7,
      suppressSeconds: 999,
      alertText: (data, _matches, output) => {
        if (data.sMj?.mj === '1麻' || data.sMj?.mj === '2麻') {
          return output[data.sMj.sym]!();
        }
      },
      outputStrings: {
        'alpha': { en: '准备场地塔' },
        'beta': { en: '准备玩家塔' },
      },
    },
    {
      id: 'souma r12s 麻将滚',
      type: 'GainsEffect',
      netRegex: { effectId: ['1292', '1290'], capture: true },
      condition: Conditions.targetIsYou(),
      delaySeconds: 50,
      suppressSeconds: 999,
      alarmText: (data, _matches, output) => {
        if (data.sMj?.sym === 'beta') {
          return output.text!();
        }
      },
      outputStrings: { text: { en: '快出去！' } },
    },
    {
      id: 'souma r12s 中期',
      type: 'StartsUsing',
      netRegex: { id: 'BEBE', capture: false },
      delaySeconds: 1,
      run: (data) => data.sPhase = '麻将',
    },
    {
      id: 'souma r12s 拘束',
      type: 'StartsUsing',
      netRegex: { id: 'B4B8', capture: false },
      delaySeconds: 1,
      run: (data) => data.sPhase = '麻将后',
    },
    {
      id: 'souma r12s ActorSetPos Tracker',
      type: 'ActorSetPos',
      netRegex: {
        id: '4[0-9A-Fa-f]{7}',
        heading: '-0.0001',
        x: [
          '85.0000',
          '96.0000',
          '104.0000',
          '115.0000',
        ],
        y: [
          '90.0000',
          '96.0000',
          '104.0000',
          '110.0000',
        ],
        capture: true,
      },
      condition: (data) => data.sPhase === '麻将',
      run: (data, matches) => {
        if (matches.x === '96.0000' && matches.y === '96.0000') {
          data.sMjNikus.push('内左上');
        }
        if (matches.x === '96.0000' && matches.y === '110.0000') {
          data.sMjNikus.push('内左下');
        }
        if (matches.x === '115.0000' && matches.y === '96.0000') {
          data.sMjNikus.push('外右上');
        }
        if (matches.x === '115.0000' && matches.y === '110.0000') {
          data.sMjNikus.push('外右下');
        }
        if (matches.x === '85.0000' && matches.y === '96.0000') {
          data.sMjNikus.push('外左上');
        }
        if (matches.x === '85.0000' && matches.y === '110.0000') {
          data.sMjNikus.push('外左下');
        }
        if (matches.x === '104.0000' && matches.y === '96.0000') {
          data.sMjNikus.push('内右上');
        }
        if (matches.x === '104.0000' && matches.y === '110.0000') {
          data.sMjNikus.push('内右下');
        }
      },
    },
    {
      id: 'souma r12s 细胞buff',
      type: 'GainsEffect',
      netRegex: {
        effectId: [
          '1299', // 分散
          '129A', // 分摊
        ],
        capture: true,
      },
      preRun: (data, matches) => {
        data.sSpreadStack.push(matches);
      },
    },
    {
      id: 'souma r12s 细胞buff判定',
      type: 'GainsEffect',
      netRegex: {
        effectId: [
          '1299', // 分散
          '129A', // 分摊
        ],
        capture: false,
      },
      delaySeconds: 0.5,
      durationSeconds: 16.5,
      countdownSeconds: 16.5,
      suppressSeconds: 30,
      alertText: (data, _matches, output) => {
        const buff = data.sSpreadStack.find((v) => v.target === data.me)?.effectId === '1299'
          ? 'spread'
          : 'stack';
        const buffStr = output[buff]!();
        if (data.sPhase === '第一次细胞') {
          data.sPhase = '第二次细胞';
          const countStr = output[data.sWings[data.me]!]!();
          return output.text!({
            buff: buffStr,
            count: countStr,
          });
        } else if (data.sPhase === '第二次细胞') {
          // return buffStr;
        }
      },
      run: (data) => {
        data.sSpreadStack.length = 0;
      },
      outputStrings: {
        '40C': '向前射',
        '40D': '向右射',
        '40E': '向后射',
        '40F': '向左射',
        'spread': { en: '稍后散开' },
        'stack': { en: '稍后分摊' },
        'text': { en: '${buff} + ${count}' },
      },
    },
    {
      id: 'souma r12s 小翅膀',
      type: 'GainsEffect',
      netRegex: {
        effectId: 'DE6',
        count: ['40C', '40D', '40E', '40F'],
        capture: true,
      },
      condition: Conditions.targetIsYou(),
      run: (data, matches) => {
        data.sWings[data.me] = matches.count;
      },
    },
    {
      id: 'souma r12s 球',
      type: 'AddedCombatant',
      netRegex: { npcNameId: '14378', npcBaseId: ['19200', '19201'], capture: true },
      preRun: (data, matches) => {
        data.sBalls.push(matches);
      },
      durationSeconds: 20,
      infoText: (data, _matches, output) => {
        if (data.sBallsOver || data.sBalls.length % 2 !== 0) {
          return;
        }
        const purples = data.sBalls.filter((v) => v.npcBaseId === '19200');
        if (purples.length > 0) {
          const purpleSide = parseFloat(purples[0]!.x) < 100 ? 'left' : 'right';
          if (data.role === 'dps') {
            data.sBallsOver = true;
            return output[purpleSide === 'left' ? 'right' : 'left']!();
          }
          // TH 1紫
          if (purples.length === 1) {
            data.sBallsFirst = true;
            return output[purpleSide]!();
          }
          // TH 2紫
          if (purples.length >= 2) {
            data.sBallsOver = true;
            const side = data.sBallsFirst ? '' : output[purpleSide]!();
            const ordered = data.sBalls.filter((v) =>
              purpleSide === 'left' ? parseFloat(v.x) < 100 : parseFloat(v.x) > 100
            ).map((v) => v.npcBaseId === '19200' ? output.t!() : output.h!()).join(
              '',
            );
            if (data.sBallsFirst) {
              return ordered;
            }
            return output.text!({
              side: side,
              ordered: ordered,
            });
          }
        }
      },
      outputStrings: {
        text: { en: '${side} ${ordered}' },
        t: { en: 'T' },
        h: { en: '奶' },
        left: { en: '左' },
        right: { en: '右' },
      },
    },
  ],
};

export default triggerSet;
