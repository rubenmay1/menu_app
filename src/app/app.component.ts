import { Component, OnInit } from '@angular/core';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { AlertController } from '@ionic/angular';
import { DbService } from './shared/db.service';
import { DropboxService } from './shared/dropbox.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {

  splashVisible = true;
  splashHiding = false;
  connectPromptVisible = false;

  constructor(
    private readonly db: DbService,
    private dropbox: DropboxService,
    private alertCtrl: AlertController,
  ) {}

  async ngOnInit(): Promise<void> {
    await this.db.initialize();

    if (!Capacitor.isNativePlatform() && window.location.pathname === '/dropbox-callback') {
      try {
        await this.dropbox.handleCallback(window.location.href);
      } catch (e: unknown) {
        await this.showError(e);
      }
    }

    setTimeout(() => {
      this.splashHiding = true;
      setTimeout(async () => {
        this.splashVisible = false;
        await new Promise<void>(r => setTimeout(r, 200));
        if (this.dropbox.isConnected()) {
          await this.showSyncPrompt();
        } else if (this.dropbox.shouldPromptConnect()) {
          this.connectPromptVisible = true;
        }
      }, 400);
    }, 1600);

    App.addListener('appUrlOpen', async (data) => {
      if (data.url.startsWith('menu-app://dropbox-callback')) {
        try {
          await this.dropbox.handleCallback(data.url);
        } catch (e: unknown) {
          await this.showError(e);
        }
      }
    });
  }

  onConnectNow(): void {
    this.connectPromptVisible = false;
    this.runBackgroundConnect();
  }

  onConnectLater(): void {
    this.connectPromptVisible = false;
  }

  onConnectDismiss(): void {
    this.connectPromptVisible = false;
    this.dropbox.dismissConnectPrompt();
  }

  private async showSyncPrompt(): Promise<void> {
    const last = this.dropbox.getLastSyncTime();
    const message = last
      ? `Last backed up: ${last.toLocaleString()}`
      : 'You have not backed up yet.';
    const alert = await this.alertCtrl.create({
      header: 'Sync to Dropbox?',
      message,
      buttons: [
        { text: 'Skip', role: 'cancel' },
        {
          text: 'Back up now',
          handler: () => {
            this.runBackgroundSync();
          },
        },
      ],
    });
    await alert.present();
  }

  private runBackgroundConnect(): void {
    this.dropbox.connect().catch(async (e: unknown) => {
      await this.showError(e);
    });
  }

  private runBackgroundSync(): void {
    this.dropbox.sync().catch(async (e: unknown) => {
      await this.showError(e);
    });
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
