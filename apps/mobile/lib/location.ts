import * as Location from 'expo-location';
import type { LatLng } from '@trotrolink/shared';

let asked = false;

/**
 * The phone's position, or null. Location is optional everywhere in TrotroLink: it improves ETAs and gives dispute
 * evidence, but a refused permission, no signal or a slow fix must never block a passenger.
 */
export async function getPosition(opts: { askPermission?: boolean; timeoutMs?: number } = {}): Promise<(LatLng & { accuracy?: number }) | null> {
  try {
    let perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted && perm.canAskAgain && opts.askPermission && !asked) {
      asked = true; // ask once per launch
      perm = await Location.requestForegroundPermissionsAsync();
    }
    if (!perm.granted) return null;
    const fix = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), opts.timeoutMs ?? 5000)),
    ]);
    return fix ? { lat: fix.coords.latitude, lng: fix.coords.longitude, ...(fix.coords.accuracy != null ? { accuracy: fix.coords.accuracy } : {}) } : null;
  } catch {
    return null;
  }
}
