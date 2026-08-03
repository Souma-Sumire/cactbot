import DTFuncs from '../../../../resources/datetime';
import { UnreachableCode } from '../../../../resources/not_reached';
import SFuncs from '../../../../resources/stringhandlers';
import Util from '../../../../resources/util';
import AnalyzedEncounter, { PerspectiveTrigger } from '../data/AnalyzedEncounter';
import RaidEmulator from '../data/RaidEmulator';
import { cloneSafe, getTemplateChild, querySelectorSafe } from '../EmulatorCommon';
import EventBus from '../EventBus';

import Tooltip from './Tooltip';

const jobOrder = [
  'PLD',
  'WAR',
  'DRK',
  'GNB',
  'WHM',
  'SCH',
  'AST',
  'SGE',
  'MNK',
  'DRG',
  'NIN',
  'SAM',
  'RPR',
  'VPR',
  'BRD',
  'MCH',
  'DNC',
  'BLM',
  'SMN',
  'RDM',
  'PCT',
  'BLU',
] as const;

type JobOrderType = typeof jobOrder[number];

const isJobOrder = (job?: string): job is JobOrderType => {
  return jobOrder.includes(job as JobOrderType);
};

type PartyInfo = {
  $rootElem: HTMLElement;
  $iconElem: HTMLElement;
  $hpElem: HTMLElement;
  $hpLabelElem: HTMLElement;
  $hpProgElem: HTMLElement;
  $mpElem: HTMLElement;
  $mpLabelElem: HTMLElement;
  $mpProgElem: HTMLElement;
  $nameElem: HTMLElement;
  id: string;
  $triggerElem: HTMLElement;
};

type PartyInfoMap = {
  [id: string]: PartyInfo;
};

type CollapseParams = {
  time: string;
  name?: string;
  classes: string[];
  $obj: HTMLElement;
  icon?: string;
  text?: string;
  onclick?: CallableFunction;
};

export default class EmulatedPartyInfo extends EventBus {
  private $partyInfo: HTMLElement;
  private $triggerInfo: HTMLElement;
  private $triggerHideSkippedCheckbox: HTMLInputElement;
  private $triggerHideCollectCheckbox: HTMLInputElement;
  private $triggerHideGeneralCheckbox: HTMLInputElement;
  private $triggerBar: HTMLElement;
  private latestDisplayedState: number;
  private currentPerspective?: string;
  private updateTriggerState: () => void;
  private $triggerItemTemplate: HTMLElement;
  private $playerInfoRowTemplate: HTMLElement;
  private $playerTriggerInfoTemplate: HTMLElement;
  private $jsonViewerTemplate: HTMLElement;
  private $wrapCollapseTemplate: HTMLElement;
  private tooltips: Tooltip[] = [];
  private triggerBars: HTMLElement[] = [];
  private displayedParty: PartyInfoMap = {};
  private $partyTabBar: HTMLElement;
  private memberGroupMap: { [id: string]: number } = {};

  constructor(private emulator: RaidEmulator) {
    super();
    this.$partyInfo = querySelectorSafe(document, '.party-info-column .party');
    this.$partyTabBar = querySelectorSafe(document, '.party-info-column .party-tab-bar');
    this.$triggerInfo = querySelectorSafe(document, '.trigger-info-column');
    const skipped = querySelectorSafe(document, '.triggerHideSkipped');
    if (!(skipped instanceof HTMLInputElement))
      throw new UnreachableCode();
    this.$triggerHideSkippedCheckbox = skipped;
    const collector = querySelectorSafe(document, '.triggerHideCollector');
    if (!(collector instanceof HTMLInputElement))
      throw new UnreachableCode();
    this.$triggerHideCollectCheckbox = collector;
    const general = querySelectorSafe(document, '.triggerHideGeneral');
    if (!(general instanceof HTMLInputElement))
      throw new UnreachableCode();
    this.$triggerHideGeneralCheckbox = general;
    this.$triggerBar = querySelectorSafe(document, '.player-triggers');
    this.latestDisplayedState = 0;

    // @TODO: Maybe this could be dynamic in scale, or possibly show at least one of each role?
    for (let i = 0; i < 8; ++i)
      this.triggerBars[i] = querySelectorSafe(this.$triggerBar, `.player${i.toString()}`);

    emulator.on('tick', (_currentLogTime, lastLogLineTime: number) => {
      if (lastLogLineTime) {
        this.updatePartyInfo(emulator, lastLogLineTime);
        this.latestDisplayedState = Math.max(this.latestDisplayedState, lastLogLineTime);
      }
    });
    emulator.on('currentEncounterChanged', (encounter: AnalyzedEncounter) => {
      this.resetPartyInfo(encounter);
    });

    emulator.on('preSeek', () => {
      this.latestDisplayedState = 0;
    });
    emulator.on('postSeek', (time: number) => {
      this.updatePartyInfo(emulator, time);
      this.latestDisplayedState = Math.max(this.latestDisplayedState, time);
    });
    this.updateTriggerState = () => {
      if (this.$triggerHideSkippedCheckbox.checked)
        this.hideNonExecutedTriggers();
      else
        this.showNonExecutedTriggers();
      if (this.$triggerHideCollectCheckbox.checked)
        this.hideCollectorTriggers();
      else
        this.showCollectorTriggers();
      if (this.$triggerHideGeneralCheckbox.checked)
        this.hideGeneralTriggers();
      else
        this.showGeneralTriggers();
    };
    this.$triggerHideSkippedCheckbox.addEventListener('change', this.updateTriggerState);
    this.$triggerHideCollectCheckbox.addEventListener('change', this.updateTriggerState);
    this.$triggerHideGeneralCheckbox.addEventListener('change', this.updateTriggerState);

    this.$triggerItemTemplate = getTemplateChild(document, 'template.trigger-item');
    this.$playerInfoRowTemplate = getTemplateChild(document, 'template.player-info-row');
    this.$playerTriggerInfoTemplate = getTemplateChild(document, 'template.playerTriggerInfo');
    this.$jsonViewerTemplate = getTemplateChild(document, 'template.jsonViewer');
    this.$wrapCollapseTemplate = getTemplateChild(document, 'template.wrapCollapse');
  }

  hideNonExecutedTriggers(): void {
    this.$triggerInfo.querySelectorAll('.trigger-not-executed').forEach((n) => {
      n.classList.add('d-none');
    });
  }

  showNonExecutedTriggers(): void {
    this.$triggerInfo.querySelectorAll('.trigger-not-executed').forEach((n) => {
      n.classList.remove('d-none');
    });
  }

  hideCollectorTriggers(): void {
    this.$triggerInfo.querySelectorAll('.trigger-no-output').forEach((n) => {
      n.classList.add('d-none');
    });
  }

  showCollectorTriggers(): void {
    this.$triggerInfo.querySelectorAll('.trigger-no-output').forEach((n) => {
      n.classList.remove('d-none');
    });
  }

  hideGeneralTriggers(): void {
    this.$triggerInfo.querySelectorAll('.trigger-general').forEach((n) => {
      n.classList.add('d-none');
    });
  }

  showGeneralTriggers(): void {
    this.$triggerInfo.querySelectorAll('.trigger-general').forEach((n) => {
      n.classList.remove('d-none');
    });
  }

  updatePartyInfo(emulator: RaidEmulator, timestamp: number): void {
    const enc = emulator.currentEncounter;
    if (!enc)
      throw new UnreachableCode();
    for (const id in this.displayedParty)
      this.updateCombatantInfo(enc, id, timestamp);
  }

  resetPartyInfo(encounter: AnalyzedEncounter): void {
    const enc = encounter.encounter;
    const tracker = enc.combatantTracker;
    if (!tracker)
      throw new UnreachableCode();
    this.tooltips.map((tt: Tooltip) => {
      tt.delete();
      return null;
    });
    this.tooltips = [];
    this.currentPerspective = undefined;
    this.displayedParty = {};
    this.latestDisplayedState = 0;
    this.$partyInfo.innerHTML = '';
    this.$partyTabBar.innerHTML = '';
    this.memberGroupMap = {};
    this.$triggerBar.querySelectorAll('.trigger-item').forEach((n) => {
      n.remove();
    });
    // 按 8 人切分为真实小队组，保持小队成员归属，再在小队内部单独按职业排序
    const partyGroups: string[][] = [];
    const rawMembers = [...tracker.partyMembers];
    while (rawMembers.length > 0) {
      const group = rawMembers.splice(0, 8);
      group.sort((l, r) => {
        const a = enc.combatantTracker?.combatants[l];
        const b = enc.combatantTracker?.combatants[r];
        if (!a || !b)
          return 0;
        const aJob = Util.jobEnumToJob(a.nextState(0).Job ?? 0);
        const bJob = Util.jobEnumToJob(b.nextState(0).Job ?? 0);
        if (!isJobOrder(aJob) || !isJobOrder(bJob))
          return 0;
        return EmulatedPartyInfo.jobOrder.indexOf(aJob) - EmulatedPartyInfo.jobOrder.indexOf(bJob);
      });
      partyGroups.push(group);
    }

    const membersToDisplay: string[] = [];
    for (const [gIdx, group] of partyGroups.entries()) {
      for (const id of group) {
        membersToDisplay.push(id);
        this.memberGroupMap[id] = gIdx;
      }
    }

    document.querySelectorAll('.playerTriggerInfo').forEach((n) => {
      n.remove();
    });

    if (membersToDisplay.length > 8) {
      this.$partyTabBar.classList.remove('d-none');
      const groupCount = partyGroups.length;
      for (let g = 0; g < groupCount; ++g) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-outline-light';
        btn.textContent = String.fromCharCode(65 + g);
        btn.addEventListener('click', () => {
          this.switchPartyTab(g);
        });
        this.$partyTabBar.append(btn);
      }
    } else {
      this.$partyTabBar.classList.add('d-none');
    }

    for (const [i, id] of membersToDisplay.entries()) {
      const obj = this.getPartyInfoObjectFor(encounter, id);
      const bar = this.triggerBars[i];
      const combatant = tracker.combatants[id];
      const perspective = encounter.perspectives[id];
      if (!combatant || !perspective)
        throw new UnreachableCode();
      const firstState = combatant.nextState(0);
      this.displayedParty[id] = obj;
      this.$partyInfo.append(obj.$rootElem);
      this.$triggerInfo.append(obj.$triggerElem);
      if (bar !== undefined) {
        bar.classList.remove('tank');
        bar.classList.remove('healer');
        bar.classList.remove('dps');
        if (firstState.Job) {
          bar.classList.add(
            Util.jobToRole(Util.jobEnumToJob(firstState.Job)),
          );
        }
        // Trigger bars will be populated on demand when perspective is selected.
      }
    }

    if (membersToDisplay.length > 8) {
      this.switchPartyTab(0);
    }

    this.updateTriggerState();

    const toDisplay = membersToDisplay[0];
    if (toDisplay === undefined)
      throw new UnreachableCode();

    void this.selectPerspective(toDisplay);
  }

  private switchPartyTab(groupIndex: number): void {
    const buttons = this.$partyTabBar.querySelectorAll('button');
    buttons.forEach((btn, idx) => {
      if (idx === groupIndex) {
        btn.classList.add('active', 'btn-primary');
        btn.classList.remove('btn-outline-light');
      } else {
        btn.classList.remove('active', 'btn-primary');
        btn.classList.add('btn-outline-light');
      }
    });

    for (const id in this.displayedParty) {
      const partyObj = this.displayedParty[id];
      if (!partyObj)
        continue;
      const gIdx = this.memberGroupMap[id];
      if (gIdx === groupIndex)
        partyObj.$rootElem.classList.remove('d-none');
      else
        partyObj.$rootElem.classList.add('d-none');
    }
  }

  async selectPerspective(id: string): Promise<void> {
    if (id === this.currentPerspective)
      return;

    const enc = this.emulator.currentEncounter;
    if (!enc)
      return;

    const combatant = enc.encounter.combatantTracker?.combatants[id];
    if (!combatant?.nextState(0).Job)
      return;

    const display = this.displayedParty[id];

    if (!display)
      throw new UnreachableCode();

    this.currentPerspective = id;

    // Lazily analyze this perspective on demand
    await enc.ensureAnalyzed(id);

    // Refresh trigger info and trigger bar after analysis
    this.refreshTriggerInfoFor(enc, id, display);

    this.$triggerInfo.querySelectorAll('.playerTriggerInfo').forEach((r) =>
      r.classList.add('d-none')
    );
    display.$triggerElem.classList.remove('d-none');
    this.$partyInfo.querySelectorAll('.player-info-row').forEach((r) => {
      r.classList.remove('border');
      r.classList.remove('border-success');
    });
    display.$rootElem.classList.add('border');
    display.$rootElem.classList.add('border-success');
    this.updateTriggerState();
    void this.dispatch('selectPerspective', id);
  }

  private refreshTriggerInfoFor(
    encounter: AnalyzedEncounter,
    id: string,
    display: PartyInfo,
  ): void {
    // Replace trigger info element with fresh content
    const newTriggerElem = this.getTriggerInfoObjectFor(encounter, id);
    newTriggerElem.setAttribute('data-id', id);
    display.$triggerElem.replaceWith(newTriggerElem);
    display.$triggerElem = newTriggerElem;

    // Populate trigger bar for this perspective
    const perspective = encounter.perspectives[id];
    if (!perspective)
      return;

    const memberIndex = encounter.encounter.combatantTracker?.partyMembers.indexOf(id);
    if (memberIndex === undefined || memberIndex < 0)
      return;
    const bar = this.triggerBars[memberIndex];
    if (!bar)
      return;

    // Clear existing trigger items in this bar
    bar.querySelectorAll('.trigger-item').forEach((n) => n.remove());

    const trimmedDuration = encounter.encounter.duration - encounter.encounter.initialOffset;
    for (const trigger of perspective.triggers) {
      if (
        !trigger.status.executed ||
        trigger.resolvedOffset > encounter.encounter.duration ||
        trigger.resolvedOffset < encounter.encounter.initialOffset
      )
        continue;

      const $e = cloneSafe(this.$triggerItemTemplate);
      const adjustedOffset = trigger.resolvedOffset - encounter.encounter.initialOffset;
      $e.style.left = `${(adjustedOffset / trimmedDuration * 100).toString()}%`;
      const triggerId = trigger.triggerHelper.trigger.id ?? 'Unknown Trigger';
      this.tooltips.push(new Tooltip($e, 'bottom', triggerId));
      bar.append($e);
    }
  }

  updateCombatantInfo(encounter: AnalyzedEncounter, id: string, stateID: number): void {
    if (!stateID || stateID <= this.latestDisplayedState)
      return;

    const combatant = encounter.encounter.combatantTracker?.combatants[id];
    if (!combatant)
      throw new UnreachableCode();

    const state = combatant.getState(stateID);
    if (state === undefined)
      throw new UnreachableCode();

    const display = this.displayedParty[id];

    if (!display)
      throw new UnreachableCode();

    const hpProg = state.CurrentHP / state.MaxHP * 100;
    let hpLabel = `${state.CurrentHP}/${state.MaxHP}`;
    hpLabel = SFuncs.leftExtendStr(hpLabel, state.MaxHP.toString().length * 2 + 1, ' ');
    display.$hpProgElem.style.width = `${hpProg}%`;
    display.$hpLabelElem.textContent = hpLabel;

    const mpProg = state.CurrentMP / state.MaxMP * 100;
    let mpLabel = `${state.CurrentMP}/${state.MaxMP}`;
    mpLabel = SFuncs.leftExtendStr(mpLabel, state.MaxMP.toString().length * 2 + 1, ' ');
    display.$mpProgElem.style.width = `${mpProg}%`;
    display.$mpLabelElem.textContent = mpLabel;
  }

  getPartyInfoObjectFor(encounter: AnalyzedEncounter, id: string): PartyInfo {
    const $e = cloneSafe(this.$playerInfoRowTemplate);
    const $hp = querySelectorSafe($e, '.hp');
    const $mp = querySelectorSafe($e, '.mp');
    const $name = querySelectorSafe($e, '.player-name');
    const ret = {
      $rootElem: $e,
      $iconElem: querySelectorSafe($e, '.jobicon'),
      $hpElem: $hp,
      $hpLabelElem: querySelectorSafe($hp, '.label'),
      $hpProgElem: querySelectorSafe($hp, '.progress-bar'),
      $mpElem: $mp,
      $mpLabelElem: querySelectorSafe($mp, '.label'),
      $mpProgElem: querySelectorSafe($mp, '.progress-bar'),
      $nameElem: $name,
      id: id,
      $triggerElem: this.getTriggerInfoObjectFor(encounter, id),
    };

    const combatant = encounter.encounter.combatantTracker?.combatants[id];
    if (!combatant)
      throw new UnreachableCode();
    const firstState = combatant.nextState(0);
    ret.$rootElem.classList.add((Util.jobEnumToJob(firstState.Job ?? 0) || '').toLowerCase());
    this.tooltips.push(new Tooltip(ret.$rootElem, 'left', firstState.Name ?? ''));
    $name.innerHTML = firstState.Name ?? '';
    ret.$rootElem.addEventListener('click', () => {
      void this.selectPerspective(id);
    });
    ret.$triggerElem.setAttribute('data-id', id);
    return ret;
  }

  getTriggerInfoObjectFor(encounter: AnalyzedEncounter, id: string): HTMLElement {
    const $ret = cloneSafe(this.$playerTriggerInfoTemplate);
    const $container = querySelectorSafe($ret, '.d-flex.flex-column');

    const per = encounter.perspectives[id];

    if (!per)
      throw new UnreachableCode();

    const $initDataViewer = cloneSafe(this.$jsonViewerTemplate);
    $initDataViewer.textContent = per.initialData
      ? JSON.stringify(per.initialData, null, 2)
      : '(Data cloning disabled for memory optimization)';

    $container.append(this._wrapCollapse({
      time: '00:00',
      name: 'Initial Data',
      classes: ['data'],
      $obj: $initDataViewer,
    }));

    const $triggerContainer = querySelectorSafe($container, '.d-flex.flex-column');

    for (const trigger of per.triggers.sort((l, r) => l.resolvedOffset - r.resolvedOffset)) {
      const $triggerDataViewer = cloneSafe(this.$jsonViewerTemplate);
      $triggerDataViewer.textContent = JSON.stringify(
        {
          triggerId: trigger.triggerHelper.trigger.id,
          responseType: trigger.status.responseType,
          responseLabel: trigger.status.responseLabel,
          executed: trigger.status.executed,
          condition: trigger.status.condition,
          delay: trigger.status.delay,
          resolvedOffset: trigger.resolvedOffset,
          matches: trigger.triggerHelper.matches,
          logLine: {
            networkLine: trigger.logLine.networkLine,
            convertedLine: trigger.logLine.convertedLine,
          },
        },
        null,
        2,
      );
      const triggerText = trigger.status.responseLabel;
      const type = trigger.status.responseType;
      const $trigger = this._wrapCollapse({
        time: this.getTriggerResolvedLabelTime(trigger),
        name: trigger.triggerHelper.trigger.id,
        icon: this.getTriggerLabelIcon(trigger),
        text: triggerText,
        classes: type !== undefined ? [type] : [],
        $obj: $triggerDataViewer,
      });
      if (trigger.status.executed)
        $trigger.classList.add('trigger-executed');
      else
        $trigger.classList.add('trigger-not-executed');

      if (triggerText === undefined)
        $trigger.classList.add('trigger-no-output');
      else
        $trigger.classList.add('trigger-output');

      // Could instead map the trigger via ID back to the trigger set and then check the zone info
      // on the trigger set, but that's a lot of extra effort and overhead.
      if (trigger.triggerHelper.trigger.filename !== '00-misc/general.ts')
        $trigger.classList.add('trigger-not-general');
      else
        $trigger.classList.add('trigger-general');

      $triggerContainer.append($trigger);
    }

    $container.append($triggerContainer);

    const $finalDataViewer = cloneSafe(this.$jsonViewerTemplate);

    $finalDataViewer.textContent = JSON.stringify(per.finalData, null, 2);

    $container.append(this._wrapCollapse({
      time: DTFuncs.timeToString(
        encounter.encounter.duration - encounter.encounter.initialOffset,
        false,
      ),
      name: 'Final Data',
      classes: ['data'],
      $obj: $finalDataViewer,
    }));

    return $ret;
  }

  getTriggerLabelIcon(trigger: PerspectiveTrigger): string | undefined {
    const type = trigger.status.responseType;

    switch (type) {
      case 'info':
        return 'info';
      case 'alert':
        return 'bell';
      case 'alarm':
        return 'exclamation';
      case 'tts':
        return 'bullhorn';
      case 'audiofile':
        return 'volume-up';
    }

    return undefined;
  }

  getTriggerFiredLabelTime(trigger: PerspectiveTrigger): string {
    return DTFuncs.timeToString(
      trigger.logLine.offset,
      false,
    );
  }

  getTriggerResolvedLabelTime(trigger: PerspectiveTrigger): string {
    return DTFuncs.timeToString(
      trigger.resolvedOffset,
      false,
    );
  }

  _wrapCollapse(params: CollapseParams): HTMLElement {
    const $ret = cloneSafe(this.$wrapCollapseTemplate);
    const $button = querySelectorSafe($ret, '.btn');
    const $time = querySelectorSafe($ret, '.trigger-label-time');
    const $name = querySelectorSafe($ret, '.trigger-label-name');
    const $icon = querySelectorSafe($ret, '.trigger-label-icon');
    const $text = querySelectorSafe($ret, '.trigger-label-text');

    if (params.name === undefined)
      $name.parentNode?.removeChild($name);
    else
      $name.textContent = params.name;

    if (params.time === undefined)
      $time.parentNode?.removeChild($time);
    else
      $time.textContent = params.time;

    if (params.text === undefined)
      $text.parentNode?.removeChild($text);
    else
      $text.textContent = params.text;

    if (params.icon === undefined)
      $icon.parentNode?.removeChild($icon);
    else
      $icon.innerHTML = `<i class="fa fa-${params.icon}" aria-hidden="true"></i>`;

    if (Array.isArray(params.classes))
      params.classes.forEach((c) => $button.classList.add(`triggertype-${c}`));

    const $wrapper = querySelectorSafe($ret, '.wrap-collapse-wrapper');
    $button.addEventListener('click', () => {
      if ($wrapper.classList.contains('d-none'))
        $wrapper.classList.remove('d-none');
      else
        $wrapper.classList.add('d-none');
      typeof params.onclick === 'function' && params.onclick();
    });
    $wrapper.append(params.$obj);
    return $ret;
  }

  static jobOrder = jobOrder;
}
