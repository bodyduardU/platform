import { Injectable, OnDestroy } from '@angular/core';
import { Store } from '@ngrx/store';
import { Subscription } from 'rxjs';

import { EffectSources } from './effect_sources';

@Injectable({ providedIn: 'root' })
export class EffectsRunner implements OnDestroy {
  private effectsSubscription: Subscription | null = null;

  get isStarted(): boolean {
    return !!this.effectsSubscription;
  }

  constructor(
    private effectSources: EffectSources,
    private store: Store<any>
  ) {}

  start() {
    if (!this.effectsSubscription) {
      this.effectsSubscription = this.effectSources
        .toActions()
        .subscribe(this.store);
    }
  }

  ngOnDestroy() {
    if (this.effectsSubscription) {
      this.effectsSubscription.unsubscribe();
      this.effectsSubscription = null;
    }
  }
}
