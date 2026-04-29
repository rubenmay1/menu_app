import { Component, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { AlertController } from '@ionic/angular';
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

  private connectSub: Subscription;

  constructor(
    public dropbox: DropboxService,
    private alertCtrl: AlertController,
  ) {
    this.connectSub = this.dropbox.connecting$.subscribe(v => { this.isConnecting = v; });
  }

  ngOnDestroy(): void {
    this.connectSub.unsubscribe();
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
