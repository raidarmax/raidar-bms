import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabase } from './supabase';

const PUSH_TOKEN_KEY = '@bms_push_token';

export class PushNotificationService {
  private static instance: PushNotificationService;
  private token: string | null = null;

  static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  async initialize(officerId: string): Promise<void> {
    try {
      const permission = await this.requestPermission();
      if (!permission) return;

      const token = await this.getDeviceToken();
      if (token) {
        this.token = token;
        await this.registerTokenWithServer(officerId, token);
      }
    } catch (error) {
      console.warn('Push notification setup failed:', error);
    }
  }

  private async requestPermission(): Promise<boolean> {
    // React Native push notification permission request
    // In production, use @react-native-firebase/messaging or expo-notifications
    // For now, return true as a placeholder
    return true;
  }

  private async getDeviceToken(): Promise<string | null> {
    // In production, this would get the FCM/APNs token
    // Placeholder that returns cached token or generates a device ID
    const cached = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    if (cached) return cached;

    const deviceId = `device_${Platform.OS}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, deviceId);
    return deviceId;
  }

  private async registerTokenWithServer(officerId: string, token: string): Promise<void> {
    const supabase = getSupabase();
    await supabase.from('push_tokens').upsert(
      {
        officer_id: officerId,
        token,
        platform: Platform.OS,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'officer_id' }
    );
  }

  async unregister(officerId: string): Promise<void> {
    if (this.token) {
      const supabase = getSupabase();
      await supabase
        .from('push_tokens')
        .delete()
        .eq('officer_id', officerId);
      await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
      this.token = null;
    }
  }

  getToken(): string | null {
    return this.token;
  }
}

export const pushNotifications = PushNotificationService.getInstance();
