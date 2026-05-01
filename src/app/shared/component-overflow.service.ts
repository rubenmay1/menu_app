import { Injectable, QueryList, ElementRef } from '@angular/core';

export interface OverflowThreshold {
  fromStage: number;
  maxChips: number;
}

/**
 * Component-scoped service (add to component `providers`) that progressively
 * hides tag chips when a row overflows. Uses scrollHeight vs clientHeight on a
 * line-clamped element as the overflow signal, incrementing the stage until the
 * row fits or the maxStage cap is reached.
 */
@Injectable()
export class ComponentOverflowService {
  readonly stages = new Map<string, number>();
  private pending = false;
  private scheduled = false;
  private maxStage = 6;
  private thresholds: OverflowThreshold[] = [];

  configure(maxStage: number, thresholds: OverflowThreshold[]): void {
    this.maxStage = maxStage;
    this.thresholds = [...thresholds].sort((a, b) => b.fromStage - a.fromStage);
  }

  init(ids: string[]): void {
    this.stages.clear();
    for (const id of ids) this.stages.set(id, 1);
    this.pending = true;
  }

  afterViewChecked(elements: QueryList<ElementRef>): void {
    if (!this.pending || this.scheduled) return;
    this.scheduled = true;
    setTimeout(() => {
      this.scheduled = false;
      let changed = false;
      for (const elRef of elements ?? []) {
        const el = elRef.nativeElement as HTMLElement;
        const id = el.getAttribute('data-item-id') ?? '';
        if (el.scrollHeight <= el.clientHeight + 1) continue;
        const stage = this.stages.get(id);
        if (stage === undefined || stage >= this.maxStage) continue;
        this.stages.set(id, stage + 1);
        changed = true;
      }
      if (!changed) this.pending = false;
    }, 0);
  }

  getStage(id: string): number {
    return this.stages.get(id) ?? 1;
  }

  getVisibleChipCount(id: string, total: number): number {
    const stage = this.stages.get(id) ?? 1;
    for (const t of this.thresholds) {
      if (stage >= t.fromStage) return Math.min(t.maxChips, total);
    }
    return total;
  }

  getOverflowCount(id: string, total: number): number {
    return Math.max(0, total - this.getVisibleChipCount(id, total));
  }
}
