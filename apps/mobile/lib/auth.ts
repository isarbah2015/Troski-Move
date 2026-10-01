import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { clearSession } from '@/lib/conductorSession';
import { api } from '@/lib/api';
import { resetDemo } from '@/lib/demoServer';
import { getDeviceId } from '@/lib/identity';
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

/**
 * Deletes the account: asks the server (or the in-app demo server) to erase the data first, and only then wipes the
 * phone, so a failed request never leaves data behind on the server while the app looks empty.
 */
export function confirmDeleteAccount(role: 'passenger' | 'conductor', onDeleted: () => void | Promise<void>) {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  Alert.alert(
    'Delete your account?',
    'This permanently erases your trips, ratings, reports and settings. Payments already made stay on file as anonymous records. This cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete account',
        style: 'destructive',
        onPress: async () => {
          try {
            if (role === 'conductor') await api.deleteConductorAccount();
            else await api.deleteAccount(await getDeviceId());
          } catch {
            Alert.alert("Couldn't delete your account", 'Check your connection and try again. Nothing was deleted.');
            return;
          }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          await clearAllLocalData();
          await resetDemo();
          await clearSession();
          await onDeleted();
        },
      },
    ],
  );
}
