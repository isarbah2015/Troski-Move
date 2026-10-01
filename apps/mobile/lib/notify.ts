import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { DEMO_MODE, api } from '@/lib/api';
import { getDeviceId } from '@/lib/identity';
import { getNotifications } from '@/lib/storage';

// Show alerts even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

let channelReady = false;
async function ensureChannel() {
  if (Platform.OS !== 'android' || channelReady) return;
  channelReady = true;
  await Notifications.setNotificationChannelAsync('trip', { name: 'Trip updates', importance: Notifications.AndroidImportance.HIGH });
}

/** Asks for permission if needed (Android 13+ and iOS). Returns true when alerts can be shown. */
export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    await ensureChannel();
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/** Shows a notification now, if the user has notifications on and the OS allows it. Never throws. */
export async function notifyNow(title: string, body: string): Promise<void> {
  try {
    if (!(await getNotifications())) return;
    if (!(await ensureNotificationPermission())) return;
    await Notifications.scheduleNotificationAsync({ content: { title, body, data: { screen: 'trip' } }, trigger: null });
  } catch {
    // Notifications are a nicety; never break the app for them.
  }
}

/**
 * Registers this phone for real push (the closed-app "your stop is next"), when a push service is configured:
 * the app needs an EAS project id and FCM credentials from GPRTU's Firebase project. Without them this quietly does
 * nothing and the local notifications above still work while the app is open.
 */
export async function registerForPush(): Promise<void> {
  if (DEMO_MODE) return;
  try {
    if (!(await getNotifications()) || !(await ensureNotificationPermission())) return;
    const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
    if (!projectId) return;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await api.registerPushToken(await getDeviceId(), token);
  } catch {
    // No push credentials yet; ignore.
  }
}

/** Tracks which alerts a trip has already produced, so a poll never repeats one. */
const sent = new Set<string>();
export function notifyOnce(key: string, title: string, body: string) {
  if (sent.has(key)) return;
  sent.add(key);
  void notifyNow(title, body);
}
