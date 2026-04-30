import { Component, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { AlertController, Platform } from '@ionic/angular';
import { Share } from '@capacitor/share';
import { DbService } from '../shared/db.service';
import { DropboxService } from '../shared/dropbox.service';

@Component({
  selector: 'app-settings',
  standalone: false,
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
})
export class SettingsPage implements OnDestroy {

  isSyncing = false;
  isRestoring = false;
  isConnecting = false;
  isConnected = false;
  resetStep: 0 | 1 | 2 = 0;

  private subs: Subscription[] = [];
  private backButtonSub: Subscription | null = null;

  constructor(
    private db: DbService,
    private dropbox: DropboxService,
    private alertCtrl: AlertController,
    private platform: Platform,
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

  onResetStart(): void { this.resetStep = 1; }
  onResetConfirmFirst(): void { this.resetStep = 2; }
  onResetCancel(): void { this.resetStep = 0; }

  onResetConfirm(): void {
    this.db.resetAll();
    this.resetStep = 0;
  }

  async shareTagsAndMeals(): Promise<void> {
    const data = this.db.exportTagsAndMeals();
    const json = JSON.stringify(data);
    const b64 = btoa(encodeURIComponent(json));
    const url = `menu-app://import?data=${encodeURIComponent(b64)}`;
    try {
      await Share.share({
        title: 'Menu Tags & Meals',
        text: url,
        dialogTitle: 'Share Tags & Meals',
      });
    } catch {
      // user cancelled share dialog — no-op
    }
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
