import { Injectable } from '@angular/core';
import { SharedPlanData, SharedPlanRecord } from '../plan/plan.models';

const STORAGE_KEY = 'shared-plan-history';

export interface SharedPlanGroup {
  label: string;
  records: SharedPlanRecord[];
}

@Injectable({ providedIn: 'root' })
export class SharedPlansService {
  private records: SharedPlanRecord[] = this.load();

  private load(): SharedPlanRecord[] {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as SharedPlanRecord[];
    } catch {
      return [];
    }
  }

  private save(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.records));
  }

  getAll(): SharedPlanRecord[] {
    return [...this.records].sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  }

  add(data: SharedPlanData): void {
    if (data.guid && this.records.some(r => r.guid === data.guid)) return;
    const guid = data.guid ?? crypto.randomUUID();
    this.records.push({
      guid,
      year: data.year,
      isoWeek: data.isoWeek,
      addedAt: new Date().toISOString(),
      data: { ...data, guid },
    });
    this.save();
  }

  delete(guid: string): void {
    this.records = this.records.filter(r => r.guid !== guid);
    this.save();
  }

  getGroups(): SharedPlanGroup[] {
    const sorted = this.getAll();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const buckets: Record<string, SharedPlanRecord[]> = {};

    for (const record of sorted) {
      const added = new Date(record.addedAt);
      const addedDay = new Date(added.getFullYear(), added.getMonth(), added.getDate()).getTime();
      const diffDays = Math.floor((todayStart - addedDay) / 86400000);

      let label: string;
      if (diffDays === 0) {
        label = 'Today';
      } else if (diffDays <= 6) {
        label = 'This week';
      } else if (diffDays <= 13) {
        label = 'Last week';
      } else if (diffDays <= 30) {
        label = 'Last month';
      } else if (diffDays <= 365) {
        label = 'Last year';
      } else {
        label = 'Older';
      }

      if (!buckets[label]) buckets[label] = [];
      buckets[label].push(record);
    }

    const order = ['Today', 'This week', 'Last week', 'Last month', 'Last year', 'Older'];
    return order.filter(l => buckets[l]).map(l => ({ label: l, records: buckets[l] }));
  }
}
