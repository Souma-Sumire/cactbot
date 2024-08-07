import TimerBar from '../../../resources/timerbar';
import TimerBox from '../../../resources/timerbox';
import { JobDetail } from '../../../types/event';
import { ResourceBox } from '../bars';
import { ComboTracker } from '../combo_tracker';
import { kAbility } from '../constants';
import { computeBackgroundColorFrom } from '../utils';

import { BaseComponent, ComponentInterface } from './base';

export class DRKComponent extends BaseComponent {
  bloodBox: ResourceBox;
  darksideBox: TimerBox;
  comboTimer: TimerBar;
  bloodWeapon: TimerBox;
  saltedEarth: TimerBox;
  livingShadow: TimerBox;

  constructor(o: ComponentInterface) {
    super(o);
    this.bloodBox = this.bars.addResourceBox({
      classList: ['drk-color-blood'],
    });

    this.darksideBox = this.bars.addProcBox({
      fgColor: 'drk-color-darkside',
      threshold: 10,
    });

    this.comboTimer = this.bars.addTimerBar({
      id: 'drk-timers-combo',
      fgColor: 'combo-color',
    });

    this.bloodWeapon = this.bars.addProcBox({
      id: 'drk-procs-bloodweapon',
      fgColor: 'drk-color-bloodweapon',
    });

    this.saltedEarth = this.bars.addProcBox({
      id: 'drk-procs-saltedearth',
      fgColor: 'drk-color-saltedearth',
    });

    this.livingShadow = this.bars.addProcBox({
      id: 'drk-procs-livingshadow',
      fgColor: 'drk-color-livingshadow',
    });

    this.reset();
  }

  override onStatChange({ gcdSkill }: { gcdSkill: number }): void {
    this.bloodWeapon.valuescale = gcdSkill;
    this.bloodWeapon.threshold = gcdSkill + 1;
    this.saltedEarth.valuescale = gcdSkill;
    this.saltedEarth.threshold = gcdSkill + 1;
    this.livingShadow.valuescale = gcdSkill;
    this.livingShadow.threshold = gcdSkill + 1;
  }

  override onJobDetailUpdate(jobDetail: JobDetail['DRK']): void {
    const blood = jobDetail.blood;
    if (this.bloodBox.innerText !== blood.toString()) {
      this.bloodBox.innerText = blood.toString();
      const p = this.bloodBox.parentNode;
      if (blood < 50) {
        p.classList.add('low');
        p.classList.remove('pulse');
      } else if (blood < 80) {
        p.classList.remove('low');
        p.classList.remove('pulse');
      } else {
        p.classList.remove('low');
        p.classList.add('pulse');
      }
    }

    const seconds = jobDetail.darksideMilliseconds / 1000.0;
    if (!this.darksideBox.duration || seconds > this.darksideBox.value)
      this.darksideBox.duration = seconds;
  }

  override onCombo(skill: string, combo: ComboTracker): void {
    this.comboTimer.duration = 0;
    if (combo.isFinalSkill)
      return;
    if (skill)
      this.comboTimer.duration = this.comboDuration;
  }

  override onUseAbility(id: string): void {
    switch (id) {
      case kAbility.BloodWeapon:
      case kAbility.Delirium:
        this.bloodWeapon.duration = 60;
        break;
      case kAbility.SaltedEarth:
        this.saltedEarth.duration = 90;
        break;
      case kAbility.LivingShadow:
        this.livingShadow.duration = 120;
        break;
    }
  }

  override reset(): void {
    this.comboTimer.duration = 0;
    this.bloodWeapon.duration = 0;
    this.saltedEarth.duration = 0;
    this.livingShadow.duration = 0;
    this.darksideBox.duration = 0;
  }
}

export class DRK6xComponent extends BaseComponent {
  bloodBox: ResourceBox;
  darksideBox: TimerBox;
  comboTimer: TimerBar;
  bloodWeapon: TimerBox;
  delirium: TimerBox;
  livingShadow: TimerBox;
  tid1 = 0;

  constructor(o: ComponentInterface) {
    super(o);
    this.bloodBox = this.bars.addResourceBox({
      classList: ['drk-color-blood'],
    });

    this.darksideBox = this.bars.addProcBox({
      fgColor: 'drk-color-darkside',
      threshold: 10,
    });

    this.comboTimer = this.bars.addTimerBar({
      id: 'drk-timers-combo',
      fgColor: 'combo-color',
    });

    this.bloodWeapon = this.bars.addProcBox({
      id: 'drk-procs-bloodweapon',
      fgColor: 'drk-color-bloodweapon',
    });

    this.delirium = this.bars.addProcBox({
      id: 'drk-procs-delirium',
      fgColor: 'drk-color-delirium',
    });

    this.livingShadow = this.bars.addProcBox({
      id: 'drk-procs-livingshadow',
      fgColor: 'drk-color-livingshadow',
    });

    this.reset();
  }

  override onStatChange({ gcdSkill }: { gcdSkill: number }): void {
    this.bloodWeapon.valuescale = gcdSkill;
    this.bloodWeapon.threshold = gcdSkill + 1;
    this.delirium.valuescale = gcdSkill;
    this.delirium.threshold = gcdSkill + 1;
    this.livingShadow.valuescale = gcdSkill;
    this.livingShadow.threshold = gcdSkill * 4 + 1;
  }

  override onJobDetailUpdate(jobDetail: JobDetail['DRK']): void {
    const blood = jobDetail.blood;
    if (this.bloodBox.innerText !== blood.toString()) {
      this.bloodBox.innerText = blood.toString();
      const p = this.bloodBox.parentNode;
      if (blood < 50) {
        p.classList.add('low');
        p.classList.remove('mid');
      } else if (blood < 90) {
        p.classList.remove('low');
        p.classList.add('mid');
      } else {
        p.classList.remove('low');
        p.classList.remove('mid');
      }
    }

    const seconds = jobDetail.darksideMilliseconds / 1000.0;
    if (!this.darksideBox.duration || seconds > this.darksideBox.value)
      this.darksideBox.duration = seconds;
  }

  override onCombo(skill: string, combo: ComboTracker): void {
    this.comboTimer.duration = 0;
    if (combo.isFinalSkill)
      return;
    if (skill)
      this.comboTimer.duration = this.comboDuration;
  }

  override onUseAbility(id: string): void {
    switch (id) {
      case kAbility.BloodWeapon: {
        this.bloodWeapon.duration = 60;
        break;
      }
      case kAbility.Delirium:
        this.delirium.duration = 60;
        break;
      case kAbility.LivingShadow:
        this.livingShadow.duration = 120;
        break;
    }
  }

  override reset(): void {
    this.comboTimer.duration = 0;
    this.bloodWeapon.duration = 0;
    this.bloodWeapon.threshold = this.player.gcdSkill * 2;
    this.bloodWeapon.fg = computeBackgroundColorFrom(this.bloodWeapon, 'drk-color-bloodweapon');
    this.delirium.duration = 0;
    this.livingShadow.duration = 0;
    this.darksideBox.duration = 0;
    window.clearTimeout(this.tid1);
  }
}
