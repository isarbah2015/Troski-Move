import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DISPLAY_CURRENCIES, type DisplayCurrency } from '@trotrolink/shared';

const KEY = 'displayCurrency';
let current: DisplayCurrency = 'GHS';
const listeners = new Set<() => void>();

const valid = (v: string | null): DisplayCurrency => ((DISPLAY_CURRENCIES as readonly string[]).includes(v ?? '') ? (v as DisplayCurrency) : 'GHS');

export async function restoreCurrency() {
  try {
    current = valid(await AsyncStorage.getItem(KEY));
  } catch {
    current = 'GHS';
  }
  listeners.forEach((l) => l());
}

export async function setDisplayCurrency(c: DisplayCurrency) {
  current = c;
  listeners.forEach((l) => l());
  await AsyncStorage.setItem(KEY, c);
}

/** The currency visitors see approximate prices in. Payments are always in cedis. */
export function useDisplayCurrency(): DisplayCurrency {
  const [c, setC] = useState<DisplayCurrency>(current);
  useEffect(() => {
    const l = () => setC(current);
    listeners.add(l);
    l();
    return () => {
      listeners.delete(l);
    };
  }, []);
  return c;
}
