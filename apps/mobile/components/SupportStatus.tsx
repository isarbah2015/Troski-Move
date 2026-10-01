import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { ActiveTrip, DisputeReason, SupportStatusResponse } from '@trotrolink/shared';
import { useColors } from '@/hooks/useColors';
import { api } from '@/lib/api';
import { getDeviceId } from '@/lib/identity';
import { useT } from '@/lib/i18n';

type Report = SupportStatusResponse['reports'][number];

/**
 * Safety on a live trip: two one-tap buttons (accident, careless driving) that open the urgent report, and the live
 * conversation with GPRTU support once a report is sent. The union's reply lands here within seconds, because the app
 * checks for it every few seconds while an urgent report is open.
 */
export function SupportStatus({ trip, onOpen }: { trip: ActiveTrip; onOpen: (reason: DisputeReason) => void }) {
  const colors = useColors();
  const t = useT();
  const [report, setReport] = useState<Report | null>(null);
  const pulse = useRef(new Animated.Value(0)).current;
  const lastReply = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const { reports } = await api.supportStatus(trip.tripId, await getDeviceId());
        if (!active) return;
        const latest = reports[0] ?? null;
        setReport(latest);
        // A new reply from GPRTU: tap the phone so the passenger notices it.
        if (latest?.reply && latest.reply !== lastReply.current) {
          if (lastReply.current !== null) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          lastReply.current = latest.reply;
        }
      } catch {
        // Offline: keep the last known state.
      }
    };
    void check();
    const id = setInterval(() => void check(), 5000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [trip.tripId]);

  useEffect(() => {
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const open = report && report.status !== 'resolved' && report.status !== 'rejected';
  const title = report ? (report.reason === 'accident' ? t('support.accident') : t('support.careless')) : '';

  return (
    <View style={styles.wrap}>
      {report ? (
        <View style={[styles.live, { backgroundColor: colors.card, borderColor: open ? colors.destructive : colors.border, borderRadius: colors.radius }, colors.elevation]} accessibilityRole="alert">
          <View style={styles.liveHead}>
            <View style={styles.dotWrap}>
              {open ? <Animated.View style={[styles.ping, { backgroundColor: colors.destructive, opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }] }]} /> : null}
              <View style={[styles.dot, { backgroundColor: open ? colors.destructive : colors.primary }]} />
            </View>
            <Text style={[styles.liveTitle, { color: colors.foreground }]}>{title}</Text>
            <View style={[styles.state, { backgroundColor: report.status === 'resolved' ? 'rgba(43,217,159,0.14)' : report.reply ? 'rgba(43,217,159,0.14)' : 'rgba(242,85,90,0.12)' }]}>
              <Text style={[styles.stateText, { color: report.status === 'resolved' || report.reply ? colors.primary : colors.destructive }]}>
                {report.status === 'resolved' ? t('support.resolved') : report.reply ? t('support.replied') : t('support.title')}
              </Text>
            </View>
          </View>
          {report.reply ? (
            <View style={[styles.bubble, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Feather name="headphones" size={15} color={colors.primary} />
              <Text style={[styles.bubbleText, { color: colors.foreground }]}>{report.reply}</Text>
            </View>
          ) : (
            <Text style={[styles.waiting, { color: colors.mutedForeground }]}>{t('support.received')}</Text>
          )}
        </View>
      ) : null}

      <View style={styles.row}>
        <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onOpen('accident'); }} accessibilityRole="button" accessibilityLabel={t('safety.accident')} style={[styles.btn, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }, colors.elevation]}>
          <View style={[styles.icon, { backgroundColor: 'rgba(242,85,90,0.12)' }]}>
            <Feather name="alert-octagon" size={18} color={colors.destructive} />
          </View>
          <Text style={[styles.btnText, { color: colors.foreground }]}>{t('safety.accident')}</Text>
        </Pressable>
        <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onOpen('careless_driving'); }} accessibilityRole="button" accessibilityLabel={t('safety.careless')} style={[styles.btn, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }, colors.elevation]}>
          <View style={[styles.icon, { backgroundColor: colors.scheme === 'light' ? 'rgba(154,103,0,0.12)' : 'rgba(231,184,90,0.14)' }]}>
            <Feather name="zap" size={18} color={colors.accent} />
          </View>
          <Text style={[styles.btnText, { color: colors.foreground }]}>{t('safety.careless')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 18, gap: 12 },
  live: { borderWidth: StyleSheet.hairlineWidth * 2, padding: 16, gap: 12 },
  liveHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dotWrap: { width: 14, height: 14, alignItems: 'center', justifyContent: 'center' },
  ping: { position: 'absolute', width: 10, height: 10, borderRadius: 5 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  liveTitle: { flex: 1, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15 },
  state: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  stateText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11 },
  waiting: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, lineHeight: 19 },
  bubble: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderWidth: StyleSheet.hairlineWidth * 2, borderRadius: 14, padding: 12 },
  bubbleText: { flex: 1, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, lineHeight: 20 },
  row: { flexDirection: 'row', gap: 12 },
  btn: { flex: 1, borderWidth: StyleSheet.hairlineWidth * 2, padding: 12, gap: 10 },
  icon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, lineHeight: 18 },
});
