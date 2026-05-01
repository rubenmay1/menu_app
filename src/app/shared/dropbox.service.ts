import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { DbService } from './db.service';

// Replace with the App Key from your Dropbox developer console.
// Register menu-app://dropbox-callback as an allowed redirect URI there too.
const APP_KEY = 'c2gx8hvu56vfmym';
const NATIVE_REDIRECT_URI = 'menu-app://dropbox-callback';

const LS_TOKEN = 'dropbox-access-token';
const LS_REFRESH = 'dropbox-refresh-token';
const LS_VERIFIER = 'dropbox-code-verifier';
const LS_LAST_SYNC = 'dropbox-last-sync';
const LS_CONNECT_DISMISSED = 'dropbox-connect-dismissed';
const BACKUP_PATH = '/menu-backup.json';

@Injectable({ providedIn: 'root' })
export class DropboxService {

  private readonly connectingSubject = new BehaviorSubject<boolean>(false);
  readonly connecting$: Observable<boolean> = this.connectingSubject.asObservable();
  private connectTimeout: ReturnType<typeof setTimeout> | null = null;

  private readonly connectedSubject = new BehaviorSubject<boolean>(false);
  readonly connected$: Observable<boolean> = this.connectedSubject.asObservable();

  constructor(private db: DbService) {
    this.connectedSubject.next(this.isConnected());
  }

  private get redirectUri(): string {
    return Capacitor.isNativePlatform()
      ? NATIVE_REDIRECT_URI
      : `${window.location.origin}/dropbox-callback`;
  }

  isConnected(): boolean {
    return !!(localStorage.getItem(LS_TOKEN) || localStorage.getItem(LS_REFRESH));
  }

  getLastSyncTime(): Date | null {
    const val = localStorage.getItem(LS_LAST_SYNC);
    return val ? new Date(val) : null;
  }

  shouldPromptConnect(): boolean {
    return !this.isConnected() && !localStorage.getItem(LS_CONNECT_DISMISSED);
  }

  dismissConnectPrompt(): void {
    localStorage.setItem(LS_CONNECT_DISMISSED, 'true');
  }

  async connect(): Promise<void> {
    this.connectingSubject.next(true);
    this.connectTimeout = setTimeout(() => {
      this.clearConnecting();
    }, 30000);

    try {
      const verifier = this.generateCodeVerifier();
      const challenge = await this.generateCodeChallenge(verifier);
      localStorage.setItem(LS_VERIFIER, verifier);

      const params = new URLSearchParams({
        client_id: APP_KEY,
        response_type: 'code',
        redirect_uri: this.redirectUri,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        token_access_type: 'offline',
      });

      const authUrl = `https://www.dropbox.com/oauth2/authorize?${params}`;
      if (Capacitor.isNativePlatform()) {
        await Browser.open({ url: authUrl });
      } else {
        window.location.href = authUrl;
      }
    } catch (e) {
      this.clearConnecting();
      throw e;
    }
  }

  async handleCallback(url: string): Promise<void> {
    const codeMatch = /[?&]code=([^&]+)/.exec(url);
    const code = codeMatch?.[1];
    if (!code) return;

    const verifier = localStorage.getItem(LS_VERIFIER);
    if (!verifier) {
      throw new Error('OAuth code verifier missing - please try connecting again.');
    }

    const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        client_id: APP_KEY,
        redirect_uri: this.redirectUri,
        code_verifier: verifier,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}) as Record<string, unknown>);
      throw new Error(`Dropbox auth failed: ${(err as Record<string, unknown>)['error_description'] ?? res.statusText}`);
    }

    const result = await res.json() as { access_token: string; refresh_token?: string };
    localStorage.setItem(LS_TOKEN, result.access_token);
    if (result.refresh_token) {
      localStorage.setItem(LS_REFRESH, result.refresh_token);
    }
    localStorage.removeItem(LS_VERIFIER);

    if (Capacitor.isNativePlatform()) {
      try { await Browser.close(); } catch { /* ignore if already closed */ }
    }

    this.connectedSubject.next(true);
    this.clearConnecting();
  }

  private clearConnecting(): void {
    if (this.connectTimeout !== null) {
      clearTimeout(this.connectTimeout);
      this.connectTimeout = null;
    }
    this.connectingSubject.next(false);
  }

  disconnect(): void {
    [LS_TOKEN, LS_REFRESH, LS_VERIFIER, LS_LAST_SYNC, LS_CONNECT_DISMISSED].forEach(k =>
      localStorage.removeItem(k),
    );
    this.connectedSubject.next(false);
  }

  async sync(): Promise<void> {
    const token = await this.getValidToken();
    const json = this.db.exportAll();

    const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Dropbox-API-Arg': JSON.stringify({ path: BACKUP_PATH, mode: 'overwrite', mute: true }),
        'Content-Type': 'application/octet-stream',
      },
      body: json,
    });

    if (!res.ok) {
      throw new Error(`Dropbox sync failed: ${await this.extractErrorMessage(res)}`);
    }

    localStorage.setItem(LS_LAST_SYNC, new Date().toISOString());
  }

  async restore(): Promise<void> {
    const token = await this.getValidToken();

    const res = await fetch('https://content.dropboxapi.com/2/files/download', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Dropbox-API-Arg': JSON.stringify({ path: BACKUP_PATH }),
      },
    });

    if (!res.ok) {
      throw new Error(`Dropbox restore failed: ${await this.extractErrorMessage(res)}`);
    }

    const json = await res.text();
    this.db.importAll(json);
  }

  private async getValidToken(): Promise<string> {
    const refreshToken = localStorage.getItem(LS_REFRESH);
    if (refreshToken) {
      return this.refreshAccessToken(refreshToken);
    }
    const token = localStorage.getItem(LS_TOKEN);
    if (token) return token;
    throw new Error('Not connected to Dropbox.');
  }

  private async refreshAccessToken(refreshToken: string): Promise<string> {
    const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: APP_KEY,
      }),
    });

    if (!res.ok) {
      localStorage.removeItem(LS_TOKEN);
      localStorage.removeItem(LS_REFRESH);
      throw new Error('Dropbox session expired. Please reconnect in Settings.');
    }

    const result = await res.json() as { access_token: string };
    localStorage.setItem(LS_TOKEN, result.access_token);
    return result.access_token;
  }

  private async extractErrorMessage(res: Response): Promise<string> {
    const body = await res.text().catch(() => '');
    let summary: string | undefined;
    try {
      const json = JSON.parse(body) as Record<string, unknown>;
      summary = (json['error_summary'] as string | undefined)
        ?? (json['error_description'] as string | undefined)
        ?? (json['error'] as string | undefined);
    } catch { /* not JSON */ }
    return (summary ?? body.slice(0, 200)) || `HTTP ${res.status}`;
  }

  private generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...Array.from(array)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  private async generateCodeChallenge(verifier: string): Promise<string> {
    const data = new TextEncoder().encode(verifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...Array.from(new Uint8Array(digest))))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }
}
