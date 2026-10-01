import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CONDUCTOR_BONUS } from '@trotrolink/shared';
import { PulseDot } from '@/components/PulseDot';
import { SectionHeader } from '@/components/SectionHeader';
import { useColors } from '@/hooks/useColors';
import { api, formatCedis } from '@/lib/api';
import { colors as tokens } from '@/lib/colors';
import { bonusFor, formatOnline, MOCK_BONUS, MOCK_TODAY, useConductorVehicle } from '@/lib/conductor';
import { getDeviceId } from '@/lib/identity';
import { useFocusPolling } from '@/lib/polling';
import { sendOrQueue } from '@/lib/sync';

const GUTTER = 24;
const GAP = 12;

export default function TodayScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { data, loading, error, reload } = useConductorVehicle();

  const [currentStop, setCurrentStop] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [onBoard, setOnBoard] = useState<number | null>(null);

  const stops = data?.route.stops ?? [];
  const current = currentStop ?? stops[0]?.name ?? null;
  const bonus = bonusFor(MOCK_BONUS.scans, MOCK_BONUS.avgRating);
  const tile = (width - GUTTER * 2 - GAP) / 2;
  const card = { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius };

  // Passengers who have paid for this vehicle and not yet alighted, refreshed every 10 seconds.
  const vehicleCode = data?.vehicle.shortCode;
  const refreshOnBoard = useCallback(async () => {
    if (!vehicleCode) return;
    try {
      setOnBoard((await api.activeTrips({ vehicleCode })).trips.length);
    } catch {
      // Offline: keep the last count.
    }
  }, [vehicleCode]);
  useFocusPolling(refreshOnBoard, !!vehicleCode && online);

  const markStop = (name: string) => {
    if (name === current) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCurrentStop(name);
    if (vehicleCode) {
      void getDeviceId().then((deviceId) => sendOrQueue({ type: 'stop', body: { vehicleCode, stopName: name, deviceId } }));
    }
  };

  const endShift = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert('End shift?', "You'll go offline and your stop marker resets. Today's totals are on the Earnings tab.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End shift',
        style: 'destructive',
        onPress: () => {
          setCurrentStop(null);
          setOnline(true);
          router.navigate('/earnings');
        },
      },
    ]);
  };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16 }]} showsVerticalScrollIndicator={false}>
      <Text style={[styles.kicker, { color: colors.mutedForeground }]}>TROTROLINK · CONDUCTOR</Text>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : error || !data ? (
        <View style={[styles.errorCard, card]}>
          <Feather name="wifi-off" size={22} color={colors.mutedForeground} />
          <Text style={[styles.errorText, { color: colors.mutedForeground }]}>Couldn&apos;t load your vehicle. Check your connection.</Text>
          <Pressable onPress={() => void reload()} accessibilityRole="button" style={[styles.retry, { borderColor: colors.border, borderRadius: colors.radiusPill }]}>
            <Text style={[styles.retryText, { color: colors.foreground }]}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {/* Vehicle */}
          <LinearGradient colors={[tokens.primaryNavy, tokens.surface]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.vehicle, { borderColor: colors.border, borderRadius: colors.radius }]}>
            <View style={styles.vehicleTop}>
              <View style={styles.codeRow}>
                <Feather name="truck" size={20} color={tokens.textPrimary} />
                <Text style={[styles.code, { color: tokens.textPrimary }]}>{data.vehicle.shortCode}</Text>
              </View>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setOnline((o) => !o);
                }}
                accessibilityRole="switch"
                accessibilityState={{ checked: online }}
                accessibilityLabel={online ? 'Online. Tap to go offline' : 'Offline. Tap to go online'}
                style={[styles.pill, { borderColor: online ? colors.primary : colors.mutedForeground, borderRadius: colors.radiusPill }]}
              >
                <PulseDot color={online ? colors.primary : colors.mutedForeground} active={online} size={8} />
                <Text style={[styles.pillText, { color: online ? colors.primary : colors.mutedForeground }]}>{online ? 'Online' : 'Offline'}</Text>
              </Pressable>
            </View>
            <Text style={[styles.route, { color: tokens.textPrimary }]}>{data.route.origin} → {data.route.destination}</Text>
            <Text style={[styles.driver, { color: tokens.textSecondary }]}>{data.vehicle.driverName} (driver)</Text>
          </LinearGradient>

          {/* Earnings */}
          <View style={[styles.card, card]}>
            <Text style={[styles.cardKicker, { color: colors.mutedForeground }]}>TODAY&apos;S EARNINGS</Text>
            <Text style={[styles.bigNumber, { color: colors.foreground }]}>{formatCedis(MOCK_TODAY.total)}</Text>
            <View style={styles.metaRow}>
              <Feather name="users" size={14} color={colors.mutedForeground} />
              <Text style={[styles.meta, { color: colors.mutedForeground }]}>{MOCK_TODAY.riders} riders</Text>
              <Text style={[styles.meta, { color: colors.mutedForeground }]}>·</Text>
              <Feather name="clock" size={14} color={colors.mutedForeground} />
              <Text style={[styles.meta, { color: colors.mutedForeground }]}>{formatOnline(MOCK_TODAY.hoursOnline)} online</Text>
            </View>
          </View>

          {/* Bonus */}
          <View style={[styles.card, card]}>
            <Text style={[styles.cardKicker, { color: colors.mutedForeground }]}>BONUS PROGRESS</Text>
            <Text style={[styles.scans, { color: colors.foreground }]}>{MOCK_BONUS.scans} / {CONDUCTOR_BONUS.scans} scans</Text>
            <View
              style={[styles.track, { backgroundColor: colors.border, borderRadius: colors.radiusPill }]}
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: 100, now: Math.round(bonus.progress * 100) }}
            >
              <View style={[styles.fill, { width: `${Math.round(bonus.progress * 100)}%`, backgroundColor: colors.primary, borderRadius: colors.radiusPill }]} />
            </View>
            <View style={styles.bonusRow}>
              <View style={styles.ratingRow}>
                <Text style={[styles.meta, { color: colors.mutedForeground }]}>Avg rating: {MOCK_BONUS.avgRating.toFixed(1)}</Text>
                <Feather name="star" size={14} color={colors.accent} />
              </View>
              <Text style={[styles.meta, { color: colors.mutedForeground }]}>{Math.round(bonus.progress * 100)}%</Text>
            </View>
            <Text style={[styles.bonusAmount, { color: colors.foreground }]}>GHS {bonus.earned} / GHS {bonus.target}</Text>
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>Unlocks at {CONDUCTOR_BONUS.scans}+ scans with an average rating of {CONDUCTOR_BONUS.minAvgRating.toFixed(1)} or better.</Text>
          </View>

          {/* Stops */}
          <SectionHeader>Mark current stop</SectionHeader>
          <View style={styles.grid}>
            {stops.map((s, i) => {
              const active = s.name === current;
              return (
                <Pressable
                  key={s.name}
                  onPress={() => markStop(s.name)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${s.name}${active ? ', current stop' : ''}`}
                  style={[
                    styles.stopBtn,
                    { width: tile, backgroundColor: active ? colors.primary : colors.card, borderColor: active ? colors.primary : colors.border, borderRadius: colors.radius },
                  ]}
                >
                  <Text style={[styles.stopIndex, { color: active ? colors.primaryForeground : colors.mutedForeground }]}>{active ? 'CURRENT' : `STOP ${i + 1}`}</Text>
                  <Text style={[styles.stopName, { color: active ? colors.primaryForeground : colors.foreground }]} numberOfLines={1} adjustsFontSizeToFit>{s.name}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.onBoard}>
            <Feather name="users" size={16} color={colors.mutedForeground} />
            <Text style={[styles.onBoardText, { color: colors.mutedForeground }]}>{onBoard === null ? '–' : onBoard} {onBoard === 1 ? 'passenger' : 'passengers'} on board</Text>
          </View>

          <Pressable onPress={endShift} accessibilityRole="button" style={[styles.endShift, { borderColor: colors.destructive, borderRadius: colors.radiusPill }]}>
            <Feather name="power" size={18} color={colors.destructive} />
            <Text style={[styles.endShiftText, { color: colors.destructive }]}>End shift</Text>
          </Pressable>
        </>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: GUTTER, paddingBottom: 40 },
  kicker: { fontFamily: 'Inter_600SemiBold', fontSize: 12, letterSpacing: 1.4, marginBottom: 16 },
  center: { paddingVertical: 80, alignItems: 'center' },
  errorCard: { borderWidth: 1, padding: 24, alignItems: 'center', gap: 12 },
  errorText: { fontFamily: 'Inter_500Medium', fontSize: 14, textAlign: 'center' },
  retry: { height: 44, paddingHorizontal: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  retryText: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  vehicle: { padding: 20, borderWidth: 1, marginBottom: GAP },
  vehicleTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  code: { fontFamily: 'Inter_700Bold', fontSize: 22, letterSpacing: 1 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, paddingHorizontal: 12, height: 32 },
  pillText: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  route: { fontFamily: 'Inter_600SemiBold', fontSize: 18, marginTop: 14 },
  driver: { fontFamily: 'Inter_500Medium', fontSize: 14, marginTop: 4 },
  card: { borderWidth: 1, padding: 20, marginBottom: GAP },
  cardKicker: { fontFamily: 'Inter_600SemiBold', fontSize: 12, letterSpacing: 1.2 },
  bigNumber: { fontFamily: 'Inter_700Bold', fontSize: 40, marginTop: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  meta: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  scans: { fontFamily: 'Inter_700Bold', fontSize: 22, marginTop: 8, marginBottom: 12 },
  track: { height: 10, overflow: 'hidden' },
  fill: { height: 10 },
  bonusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bonusAmount: { fontFamily: 'Inter_700Bold', fontSize: 16, marginTop: 10 },
  hint: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17, marginTop: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  stopBtn: { minHeight: 80, borderWidth: 1, padding: 14, justifyContent: 'center' },
  stopIndex: { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 1 },
  stopName: { fontFamily: 'Inter_700Bold', fontSize: 20, marginTop: 4 },
  onBoard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 24, marginBottom: 20 },
  onBoardText: { fontFamily: 'Inter_500Medium', fontSize: 14 },
  endShift: { height: 56, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  endShiftText: { fontFamily: 'Inter_700Bold', fontSize: 16 },
});
