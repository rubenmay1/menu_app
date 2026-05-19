import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export const MENU_CHANNEL_ID = 'menu_reminders';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  async createChannel(): Promise<void> {
    if (Capacitor.getPlatform() !== 'android') {
      return;
    }
    await LocalNotifications.createChannel({
      id: MENU_CHANNEL_ID,
      name: 'Meal Reminders',
      description: 'Reminders for planned meals',
      importance: 4,
      visibility: 1,
      lights: true,
      vibration: true,
    });
  }

  async ensurePermission(): Promise<boolean> {
    try {
      const status = await LocalNotifications.checkPermissions();
      if (status.display === 'granted') {
        return true;
      }
      if (Capacitor.getPlatform() === 'web') {
        return false;
      }
      const req = await LocalNotifications.requestPermissions();
      return req.display === 'granted';
    } catch (err) {
      console.warn('LocalNotifications permission check failed', err);
      return false;
    }
  }

  async schedule(id: number, title: string, body: string, at: Date): Promise<void> {
    if (Capacitor.getPlatform() === 'web') {
      return;
    }
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id,
            title,
            body,
            schedule: { at, allowWhileIdle: true },
            channelId: MENU_CHANNEL_ID,
          },
        ],
      });
    } catch (err) {
      console.warn('LocalNotifications.schedule failed', err);
    }
  }

  async cancel(id: number): Promise<void> {
    try {
      await LocalNotifications.cancel({ notifications: [{ id }] });
    } catch (err) {
      console.warn('LocalNotifications.cancel failed', err);
    }
  }
}
