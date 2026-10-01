import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { formatCedis } from '@/lib/api';
import { GOLD, SCRIM_STRONG } from '@/lib/colors';

type Props = {
  declaredStop: string;
  overstay: { stop: string; extraFare: number; deadline: string } | null;
  onPay: () => void;
  onGetOff: () => void;
};

/** The vehicle has gone past the passenger's stop: extend the trip, or get off now. After the countdown the extension is charged automatically. */
export function OverstaySheet({ declaredStop, overstay, onPay, onGetOff }: Props) {
  const colors = useColors();
  const [left, setLeft] = useState(0);

  useEffect(() => {
    if (!overstay) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    const tick = () => setLeft(Math.max(0, Math.ceil((new Date(overstay.deadline).getTime() - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 500);
    return () => clearInterval(t);
  }, [overstay?.deadline, overstay]);

  return (
    <Modal visible={!!overstay} transparent animationType="fade" onRequestClose={() => undefined}>
      <View style={[styles.root, { backgroundColor: SCRIM_STRONG }]}>
        {overstay ? (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.accent, borderRadius: colors.radiusModal }]} accessibilityLiveRegion="polite">
            <View style={[styles.badge, { backgroundColor: colors.secondary }]}>
              <Feather name="alert-triangle" size={28} color={GOLD} />
            </View>
            <Text style={[styles.title, { color: colors.foreground }]}>You&apos;ve passed {declaredStop}</Text>
            <Text style={[styles.body, { color: colors.mutedForeground }]}>
              Extend to {overstay.stop} for {formatCedis(overstay.extraFare)} more?
            </Text>
            <View style={[styles.timer, { borderColor: colors.border, borderRadius: colors.radiusPill }]}>
              <Feather name="clock" size={14} color={colors.accent} />
              <Text style={[styles.timerText, { color: colors.foreground }]}>
                {left > 0 ? `Charged automatically in ${left}s` : 'Charging…'}
              </Text>
            </View>
            <Pressable onPress={onPay} accessibilityRole="button" style={[styles.pay, { backgroundColor: colors.primary, borderRadius: colors.radiusPill }]}>
              <Text style={[styles.payText, { color: colors.primaryForeground }]}>Pay {formatCedis(overstay.extraFare)}</Text>
            </Pressable>
            <Pressable onPress={onGetOff} accessibilityRole="button" style={[styles.off, { borderColor: colors.border, borderRadius: colors.radiusPill }]}>
              <Text style={[styles.offText, { color: colors.foreground }]}>Get off now</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 380, borderWidth: 1.5, padding: 26, alignItems: 'center' },
  badge: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 22, textAlign: 'center' },
  body: { fontFamily: 'Inter_500Medium', fontSize: 16, lineHeight: 23, textAlign: 'center', marginTop: 10 },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 7, marginTop: 16 },
  timerText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  pay: { height: 54, alignSelf: 'stretch', marginTop: 20, alignItems: 'center', justifyContent: 'center' },
  payText: { fontFamily: 'Inter_700Bold', fontSize: 17 },
  off: { height: 52, alignSelf: 'stretch', marginTop: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  offText: { fontFamily: 'Inter_600SemiBold', fontSize: 16 },
});
