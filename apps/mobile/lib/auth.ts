import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { clearSession } from '@/lib/conductorSession';
import { api } from '@/lib/api';
import { resetDemo } from '@/lib/demoServer';
import { clearAllLocalData } from '@/lib/storage';

/**
 * Confirms, then wipes every locally stored key. There is no (auth)/login screen yet, so callers
 * return to the guest state themselves in `onSignedOut`.
 */
export function confirmSignOut(onSignedOut: () => void | Promise<void>, beforeClear?: () => Promise<void>) {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  Alert.alert('Sign out?', 'This clears your trips, settings and any active trip from this device.', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Sign out',
      style: 'destructive',
      onPress: async () => {
        try {
          await beforeClear?.();
        } catch {
          // Offline: the local session is wiped anyway.
        }
        await clearAllLocalData();
        await resetDemo();
        await clearSession();
        await onSignedOut();
      },
    },
  ]);
}
