import { useEffect, useState } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ThemePreference } from '@trotrolink/shared';

const KEY = 'themePreference';

function valid(v: string | null): ThemePreference {
  return v === 'light' || v === 'dark' ? v : 'system';
}

/** Applies the choice app-wide: Appearance drives `useColorScheme`, the status bar and native pickers. */
export function applyTheme(pref: ThemePreference) {
  Appearance.setColorScheme(pref === 'system' ? null : pref);
}

export async function getThemePreference(): Promise<ThemePreference> {
  try {
    return valid(await AsyncStorage.getItem(KEY));
  } catch {
    return 'system';
  }
}

export async function setThemePreference(pref: ThemePreference): Promise<void> {
  applyTheme(pref);
  await AsyncStorage.setItem(KEY, pref);
}

/** Restores the saved choice at launch. */
export async function restoreTheme() {
  applyTheme(await getThemePreference());
}

export function useThemePreference(): ThemePreference {
  const [pref, setPref] = useState<ThemePreference>('system');
  useEffect(() => {
    void getThemePreference().then(setPref);
  }, []);
  return pref;
}
