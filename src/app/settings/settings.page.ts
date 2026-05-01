import { Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';
import { AlertController, Platform } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { DbService } from '../shared/db.service';
import { DropboxService } from '../shared/dropbox.service';
import { PreferenceService } from '../shared/preference.service';
import { Tag } from '../tags/tag.model';
import { Meal } from '../meals/meal.model';

@Component({
  selector: 'app-settings',
  standalone: false,
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
})
export class SettingsPage implements OnDestroy {

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  isSyncing = false;
  isRestoring = false;
  isConnecting = false;
  isConnected = false;
  resetStep: 0 | 1 | 2 = 0;

  private subs: Subscription[] = [];
  private backButtonSub: Subscription | null = null;

  get showPlan(): boolean   { return this.prefs.showPlan; }
  get showList(): boolean   { return this.prefs.showList; }
  get showShared(): boolean { return this.prefs.showShared; }
  get showMeals(): boolean  { return this.prefs.showMeals; }
  get showTags(): boolean   { return this.prefs.showTags; }

  constructor(
    private db: DbService,
    private dropbox: DropboxService,
    private alertCtrl: AlertController,
    private platform: Platform,
    private prefs: PreferenceService,
  ) {
    this.subs.push(
      this.dropbox.connecting$.subscribe(v => { this.isConnecting = v; }),
      this.dropbox.connected$.subscribe(v => { this.isConnected = v; }),
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  ionViewWillEnter(): void {
    this.backButtonSub = this.platform.backButton.subscribeWithPriority(10, (processNextHandler) => {
      if (this.resetStep > 0) {
        this.onResetCancel();
      } else {
        processNextHandler();
      }
    });
  }

  ionViewWillLeave(): void {
    this.backButtonSub?.unsubscribe();
    this.backButtonSub = null;
  }

  get lastSyncLabel(): string {
    const t = this.dropbox.getLastSyncTime();
    return t ? t.toLocaleString() : 'Never synced';
  }

  async connectDropbox(): Promise<void> {
    try {
      await this.dropbox.connect();
    } catch (e: unknown) {
      await this.showError(e);
    }
  }

  async syncNow(): Promise<void> {
    this.isSyncing = true;
    try {
      await this.dropbox.sync();
    } catch (e: unknown) {
      await this.showError(e);
    } finally {
      this.isSyncing = false;
    }
  }

  async restoreNow(): Promise<void> {
    const confirm = await this.alertCtrl.create({
      header: 'Restore from Dropbox?',
      message: 'This will overwrite all local data with your last Dropbox backup. This cannot be undone.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Restore',
          role: 'destructive',
          handler: () => { this.runRestore(); },
        },
      ],
    });
    await confirm.present();
  }

  private runRestore(): void {
    this.isRestoring = true;
    this.dropbox.restore()
      .catch(async (e: unknown) => { await this.showError(e); })
      .finally(() => { this.isRestoring = false; });
  }

  async disconnect(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Disconnect Dropbox',
      message: 'Remove the Dropbox connection? Your local data is not affected.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Disconnect',
          role: 'destructive',
          handler: () => { this.dropbox.disconnect(); },
        },
      ],
    });
    await alert.present();
  }

  onShowPlanChange(event: Event): void   { this.prefs.showPlan   = (event as CustomEvent).detail.checked; }
  onShowListChange(event: Event): void   { this.prefs.showList   = (event as CustomEvent).detail.checked; }
  onShowSharedChange(event: Event): void { this.prefs.showShared = (event as CustomEvent).detail.checked; }
  onShowMealsChange(event: Event): void  { this.prefs.showMeals  = (event as CustomEvent).detail.checked; }
  onShowTagsChange(event: Event): void   { this.prefs.showTags   = (event as CustomEvent).detail.checked; }

  get frozenThresholdWeeks(): number { return this.prefs.frozenThresholdWeeks; }
  incrementFrozenThreshold(): void { this.prefs.frozenThresholdWeeks = this.prefs.frozenThresholdWeeks + 1; }
  decrementFrozenThreshold(): void { this.prefs.frozenThresholdWeeks = this.prefs.frozenThresholdWeeks - 1; }

  onResetStart(): void { this.resetStep = 1; }
  onResetConfirmFirst(): void { this.resetStep = 2; }
  onResetCancel(): void { this.resetStep = 0; }

  onResetConfirm(): void {
    this.db.resetAll();
    this.resetStep = 0;
  }

  async exportTagsAndMeals(): Promise<void> {
    const data = this.db.exportTagsAndMeals();
    const json = JSON.stringify(data, null, 2);
    const filename = 'menu-tags-meals.json';
    if (Capacitor.isNativePlatform()) {
      try {
        const { uri } = await Filesystem.writeFile({
          path: filename,
          data: json,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });
        await Share.share({ title: 'Menu Tags & Meals', files: [uri], dialogTitle: 'Share Tags & Meals' });
      } catch {
        // user cancelled share dialog - no-op
      }
    } else {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  triggerImport(): void {
    this.fileInput.nativeElement.click();
  }

  async onImportFileSelected(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text) as { tags: Tag[]; meals: Meal[] };
      const r = this.db.importTagsAndMeals(data);
      const alert = await this.alertCtrl.create({
        header: 'Import Complete',
        message: `Tags: ${r.tagsAdded} added, ${r.tagsOverwritten} updated. Meals: ${r.mealsAdded} added, ${r.mealsOverwritten} updated.`,
        buttons: ['OK'],
      });
      await alert.present();
    } catch {
      const alert = await this.alertCtrl.create({
        header: 'Import Failed',
        message: 'Could not read the file. Make sure it is a valid Menu export.',
        buttons: ['OK'],
      });
      await alert.present();
    }
    (event.target as HTMLInputElement).value = '';
  }

  private async showError(e: unknown): Promise<void> {
    const msg = e instanceof Error ? e.message : 'An unexpected error occurred.';
    const alert = await this.alertCtrl.create({
      header: 'Dropbox Error',
      message: msg,
      buttons: ['OK'],
    });
    await alert.present();
  }
}
