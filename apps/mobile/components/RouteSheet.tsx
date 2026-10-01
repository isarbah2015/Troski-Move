import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { ConductorRouteResponse } from '@trotrolink/shared';
import { useColors } from '@/hooks/useColors';
import { api } from '@/lib/api';
import { SCRIM } from '@/lib/colors';
import { showToast } from '@/lib/toast';

type Props = { visible: boolean; onClose: () => void; onChanged: () => void };

/** Conductor: pick another route for this vehicle. The union sees every change, and it is blocked while passengers are on board. */
export function RouteSheet({ visible, onClose, onChanged }: Props) {
  const colors = useColors();
  const [info, setInfo] = useState<ConductorRouteResponse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setInfo(null);
    api.conductorRoute().then(setInfo).catch(() => showToast("Couldn't load the routes.", 'error'));
  }, [visible]);

  const choose = async (routeId: string) => {
    if (busy || info?.current.routeId === routeId) return;
    setBusy(routeId);
    Haptics.selectionAsync();
    try {
      await api.setRoute(routeId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('Route changed. Passengers now see it when they scan.');
      onChanged();
      onClose();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Couldn't change the route.", 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: SCRIM }]} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border, borderTopLeftRadius: colors.radiusModal, borderTopRightRadius: colors.radiusModal }]}>
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          <Text style={[styles.title, { color: colors.foreground }]}>Change route</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>Pick the route this trotro is running now. GPRTU can see route changes.</Text>
          {!info ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
          ) : (
            <>
              {info.onBoard > 0 ? (
                <View style={[styles.warn, { borderColor: colors.accent, borderRadius: colors.radius }]}>
                  <Feather name="users" size={16} color={colors.accent} />
                  <Text style={[styles.warnText, { color: colors.accent }]}>{info.onBoard} paid passenger{info.onBoard === 1 ? '' : 's'} on board. You can change route once everyone has got off.</Text>
                </View>
              ) : null}
              {info.routes.map((r) => {
                const active = r.routeId === info.current.routeId;
                return (
                  <Pressable
                    key={r.routeId}
                    onPress={() => void choose(r.routeId)}
                    disabled={info.onBoard > 0}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active, disabled: info.onBoard > 0 }}
                    style={[styles.row, { borderColor: active ? colors.primary : colors.border, borderRadius: colors.radius, opacity: info.onBoard > 0 && !active ? 0.5 : 1 }]}
                  >
                    <View style={styles.rowText}>
                      <Text style={[styles.rowTitle, { color: colors.foreground }]}>{r.origin} → {r.destination}</Text>
                      <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>{r.name}</Text>
                    </View>
                    {busy === r.routeId ? <ActivityIndicator color={colors.primary} /> : active ? <Feather name="check-circle" size={22} color={colors.primary} /> : null}
                  </Pressable>
                );
              })}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: { padding: 24, paddingBottom: 40, borderWidth: StyleSheet.hairlineWidth * 2, borderBottomWidth: 0 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 18 },
  title: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 22, letterSpacing: -0.4 },
  sub: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, lineHeight: 20, marginTop: 4, marginBottom: 16 },
  warn: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderWidth: StyleSheet.hairlineWidth * 2, padding: 12, marginBottom: 12 },
  warnText: { flex: 1, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, lineHeight: 19 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: StyleSheet.hairlineWidth * 2, padding: 16, marginBottom: 10 },
  rowText: { flex: 1 },
  rowTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16 },
  rowSub: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, marginTop: 2 },
});
