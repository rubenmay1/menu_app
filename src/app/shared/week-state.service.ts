import { Injectable } from '@angular/core';
import { getISOWeek, getISOWeekYear } from './week-utils';

@Injectable({ providedIn: 'root' })
export class WeekStateService {
  private _year: number;
  private _isoWeek: number;

  constructor() {
    const today = new Date();
    this._year = getISOWeekYear(today);
    this._isoWeek = getISOWeek(today);
  }

  get year(): number { return this._year; }
  get isoWeek(): number { return this._isoWeek; }

  setWeek(year: number, isoWeek: number): void {
    this._year = year;
    this._isoWeek = isoWeek;
  }
}
