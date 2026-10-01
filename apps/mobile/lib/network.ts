import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { guessMomoNetwork, MOMO_NETWORKS, type MomoNetwork } from '@trotrolink/shared';
import { getUser } from '@/lib/storage';

const KEY = 'momoNetwork';

/** The wallet the passenger last chose, else a guess from their number, else MTN. */
export async function getMomoNetwork(): Promise<MomoNetwork> {
  try {
    const saved = await AsyncStorage.getItem(KEY);
    if (saved && (MOMO_NETWORKS as readonly string[]).includes(saved)) return saved as MomoNetwork;
  } catch {
    // fall through to the guess
  }
  const user = await getUser();
  return guessMomoNetwork(user?.phone) ?? 'mtn';
}

export async function setMomoNetwork(network: MomoNetwork): Promise<void> {
  await AsyncStorage.setItem(KEY, network);
}

/** The chosen wallet, kept in sync across the app while a screen is mounted. */
export function useMomoNetwork(): [MomoNetwork, (n: MomoNetwork) => void] {
  const [network, setNetwork] = useState<MomoNetwork>('mtn');
  useEffect(() => {
    void getMomoNetwork().then(setNetwork);
  }, []);
  const choose = useCallback((n: MomoNetwork) => {
    setNetwork(n);
    void setMomoNetwork(n);
  }, []);
  return [network, choose];
}
