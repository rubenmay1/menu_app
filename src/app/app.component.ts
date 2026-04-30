import { Component, NgZone, OnInit } from '@angular/core';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { AlertController, Platform } from '@ionic/angular';
import { Tag } from './tags/tag.model';
import { Meal } from './meals/meal.model';
import { DbService } from './shared/db.service';
import { DropboxService } from './shared/dropbox.service';

interface TutorialStep {
  readonly selector: string;
  readonly text: string;
  readonly radius: number;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  { selector: 'ion-tab-button[tab="plan"]',     text: 'Plan and select your meals for each day',      radius: 40 },
  { selector: '.day-name',                       text: 'Long press to customise your meal types',      radius: 44 },
  { selector: 'ion-tab-button[tab="shopping"]', text: 'View and check off ingredients for your plan', radius: 40 },
  { selector: 'ion-tab-button[tab="meals"]',    text: 'Create and edit different custom meals',        radius: 40 },
  { selector: 'ion-tab-button[tab="tags"]',     text: 'Create and edit tags used to filter meals',    radius: 40 },
];

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
  syncPromptVisible = false;
  syncPromptMessage = '';
  importPromptVisible = false;
  importPromptMessage = '';
  private pendingImportData: { tags: Tag[]; meals: Meal[] } | null = null;

  tutorialVisible = false;
  tutorialText = '';
  spotlight = { cx: 0, cy: 0, r: 0 };
  tutorialTextTop: string | null = null;
  tutorialTextBottom: string | null = null;

  private tutorialStep = 0;
  private tutorialResolve: (() => void) | null = null;

  constructor(
    private readonly db: DbService,
    private dropbox: DropboxService,
    private alertCtrl: AlertController,
    private ngZone: NgZone,
    private platform: Platform,
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

        if (!localStorage.getItem('tutorial-completed')) {
          await this.runTutorial();
        }

        if (this.dropbox.isConnected()) {
          this.showSyncPrompt();
        } else if (this.dropbox.shouldPromptConnect()) {
          this.connectPromptVisible = true;
        }
      }, 400);
    }, 1600);

    this.platform.backButton.subscribeWithPriority(20, (processNextHandler) => {
      if (this.syncPromptVisible) { this.onSyncSkip(); }
      else if (this.importPromptVisible) { this.onImportCancel(); }
      else if (this.connectPromptVisible) { this.onConnectLater(); }
      else { processNextHandler(); }
    });

    App.addListener('appUrlOpen', (data) => {
      this.ngZone.run(async () => {
        if (data.url.startsWith('menu-app://dropbox-callback')) {
          try {
            await this.dropbox.handleCallback(data.url);
          } catch (e: unknown) {
            await this.showError(e);
          }
        } else if (data.url.startsWith('menu-app://import')) {
          this.handleImportUrl(data.url);
        }
      });
    });
  }

  // ---- Tutorial ----

  advanceTutorial(): void {
    const next = this.tutorialStep + 1;
    if (next >= TUTORIAL_STEPS.length) {
      this.endTutorial();
    } else {
      this.tutorialStep = next;
      this.applyTutorialStep(next);
    }
  }

  private runTutorial(): Promise<void> {
    return new Promise(resolve => {
      this.tutorialResolve = resolve;
      this.tutorialStep = 0;
      this.applyTutorialStep(0);
      this.tutorialVisible = true;
    });
  }

  private applyTutorialStep(index: number): void {
    const step = TUTORIAL_STEPS[index];
    const el = document.querySelector(step.selector);
    if (!el) {
      this.advanceTutorial();
      return;
    }
    const rect = el.getBoundingClientRect();
    const cx = Math.round(rect.left + rect.width / 2);
    const cy = Math.round(rect.top + rect.height / 2);
    this.spotlight = { cx, cy, r: step.radius };
    this.tutorialText = step.text;

    const gap = 28;
    if (cy < window.innerHeight * 0.55) {
      this.tutorialTextTop = `${cy + step.radius + gap}px`;
      this.tutorialTextBottom = null;
    } else {
      this.tutorialTextTop = null;
      this.tutorialTextBottom = `${window.innerHeight - cy + step.radius + gap}px`;
    }
  }

  private endTutorial(): void {
    this.tutorialVisible = false;
    localStorage.setItem('tutorial-completed', '1');
    this.tutorialResolve?.();
    this.tutorialResolve = null;
  }

  // ---- Dropbox ----

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

  private showSyncPrompt(): void {
    const last = this.dropbox.getLastSyncTime();
    this.syncPromptMessage = last
      ? `Last backed up: ${last.toLocaleString()}`
      : 'You have not backed up yet.';
    this.syncPromptVisible = true;
  }

  onSyncBackUp(): void {
    this.syncPromptVisible = false;
    this.runBackgroundSync();
  }

  onSyncSkip(): void {
    this.syncPromptVisible = false;
  }

  // ---- Import ----

  private handleImportUrl(url: string): void {
    try {
      const params = new URL(url).searchParams;
      const encoded = params.get('data');
      if (!encoded) return;
      const json = decodeURIComponent(atob(decodeURIComponent(encoded)));
      const data = JSON.parse(json) as { tags: Tag[]; meals: Meal[] };
      if (!Array.isArray(data.tags) || !Array.isArray(data.meals)) return;
      const tagCount = data.tags.length;
      const mealCount = data.meals.length;
      this.pendingImportData = data;
      this.importPromptMessage = `Import ${tagCount} tag${tagCount !== 1 ? 's' : ''} and ${mealCount} meal${mealCount !== 1 ? 's' : ''}? Existing items with the same name will be overwritten.`;
      this.importPromptVisible = true;
    } catch {
      // malformed URL — ignore
    }
  }

  onImportConfirm(): void {
    if (this.pendingImportData) {
      this.db.importTagsAndMeals(this.pendingImportData);
    }
    this.importPromptVisible = false;
    this.pendingImportData = null;
  }

  onImportCancel(): void {
    this.importPromptVisible = false;
    this.pendingImportData = null;
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
