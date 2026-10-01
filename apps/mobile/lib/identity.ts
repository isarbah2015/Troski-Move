import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'deviceId';

function randomId(): string {
  const hex = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
  return `${hex()}${hex()}-${hex()}-${hex()}-${hex()}-${hex()}${hex()}${hex()}`;
}

/**
 * A random, stable id for this install: the anonymous identity the API maps to a guest user until
 * phone OTP accounts exist. Signing out clears it, which starts a fresh guest.
 */
export async function getDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(KEY);
  if (existing) return existing;
  const id = randomId();
  await AsyncStorage.setItem(KEY, id);
  return id;
}
