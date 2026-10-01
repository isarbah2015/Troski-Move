import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { RouteSheet } from '@/components/RouteSheet';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CEDI, CONDUCTOR_BONUS, type ServerTrip } from '@trotrolink/shared';
import { DemoBadge } from '@/components/DemoBadge';
import { PassengerSheet } from '@/components/PassengerSheet';
import { PulseDot } from '@/components/PulseDot';
import { SectionHeader } from '@/components/SectionHeader';
import { useColors } from '@/hooks/useColors';
import { api, formatCedis } from '@/lib/api';
import { bonusFor, formatOnline, MOCK_BONUS, MOCK_TODAY, useConductorVehicle } from '@/lib/conductor';
import { useFocusPolling } from '@/lib/polling';
import { showToast } from '@/lib/toast';
import { sendOrQueue } from '@/lib/sync';
import { EMERALD, HERO_GRADIENT, SILVER, WHITE } from '@/lib/colors';

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
  const [passengers, setPassengers] = useState<ServerTrip[] | null>(null);
  const [selected, setSelected] = useState<ServerTrip | null>(null);
  const onBoard = passengers === null ? null : passengers.length;
  const pastStop = (passengers ?? []).filter((p) => p.overstay);

  const stops = data?.route.stops ?? [];
  const current = currentStop ?? stops[0]?.name ?? null;
  const bonus = bonusFor(MOCK_BONUS.scans, MOCK_BONUS.avgRating);
  const tile = (width - GUTTER * 2 - GAP) / 2;
  const card = { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, ...colors.elevation };

  // Passengers who have paid for this vehicle and not yet alighted, refreshed every 10 seconds.
  const vehicleCode = data?.vehicle.shortCode;
  const refreshOnBoard = useCallback(async () => {
    if (!vehicleCode) return;
    try {
      setPassengers((await api.activeTrips({ vehicleCode })).trips);
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
      void sendOrQueue({ type: 'stop', body: { vehicleCode, stopName: name } });
    }
  };

  const [routeOpen, setRouteOpen] = useState(false);
  const afterRouteChange = () => {
    setCurrentStop(null);
    void reload();
    void refreshOnBoard();
  };
  /** The return leg: the same road the other way. The stops, fares and route name flip from the next scan. */
  const turnRound = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const to = data ? `${data.route.destination} → ${data.route.origin}` : 'the return leg';
    const message = `This trotro will now run ${to}. Passengers who scan next will see the return stops and fares.`;
    const go = async () => {
      try {
        await api.switchDirection();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast('Turned round. Now running the return leg.');
        afterRouteChange();
      } catch (e) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        showToast(e instanceof Error ? e.message : "Couldn't turn round.", 'error');
      }
    };
    // React Native's Alert does nothing on the web build, so confirm with the browser's own dialog there.
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`Turn round?\n\n${message}`)) void go();
      return;
    }
    Alert.alert('Turn round?', message, [{ text: 'Cancel', style: 'cancel' }, { text: 'Turn round', onPress: () => void go() }]);
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
      <RouteSheet visible={routeOpen} onClose={() => setRouteOpen(false)} onChanged={afterRouteChange} />
      <DemoBadge />
      <Text style={[styles.kicker, { color: colors.mutedForeground, marginTop: 8 }]}>TROTROLINK · CONDUCTOR</Text>

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
          <LinearGradient colors={HERO_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.vehicle, { borderColor: colors.border, borderRadius: colors.radius }]}>
            <View style={styles.vehicleTop}>
              <View style={styles.codeRow}>
                <Feather name="truck" size={20} color={WHITE} />
                <Text style={[styles.code, { color: WHITE }]}>{data.vehicle.shortCode}</Text>
              </View>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setOnline((o) => !o);
                }}
                accessibilityRole="switch"
                accessibilityState={{ checked: online }}
                accessibilityLabel={online ? 'Online. Tap to go offline' : 'Offline. Tap to go online'}
                style={[styles.pill, { borderColor: online ? EMERALD : SILVER, borderRadius: colors.radiusPill }]}
              >
                <PulseDot color={online ? EMERALD : SILVER} active={online} size={8} />
                <Text style={[styles.pillText, { color: online ? EMERALD : SILVER }]}>{online ? 'Online' : 'Offline'}</Text>
              </Pressable>
            </View>
            <Text style={[styles.route, { color: WHITE }]}>{data.route.origin} → {data.route.destination}</Text>
            <Text style={[styles.driver, { color: SILVER }]}>{data.vehicle.driverName} (driver)</Text>
            {/* Heading: turn round for the return leg, or move to another route. Blocked while passengers are on board. */}
            <View style={styles.headingRow}>
              <Pressable onPress={turnRound} accessibilityRole="button" accessibilityLabel={`Turn round. Now heading to ${data.route.destination}`} style={[styles.headingBtn, { borderColor: 'rgba(255,255,255,0.22)', backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                <Feather name="repeat" size={15} color={WHITE} />
                <Text style={[styles.headingText, { color: WHITE }]}>Turn round</Text>
              </Pressable>
              <Pressable onPress={() => { Haptics.selectionAsync(); setRouteOpen(true); }} accessibilityRole="button" accessibilityLabel="Change route" style={[styles.headingBtn, { borderColor: 'rgba(255,255,255,0.22)', backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                <Feather name="map" size={15} color={WHITE} />
                <Text style={[styles.headingText, { color: WHITE }]}>Change route</Text>
              </Pressable>
            </View>
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
              <LinearGradient colors={colors.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.fill, { width: `${Math.round(bonus.progress * 100)}%`, borderRadius: colors.radiusPill }]} />
            </View>
            <View style={styles.bonusRow}>
              <View style={styles.ratingRow}>
                <Text style={[styles.meta, { color: colors.mutedForeground }]}>Avg rating: {MOCK_BONUS.avgRating.toFixed(1)}</Text>
                <Feather name="star" size={14} color={colors.accent} />
              </View>
              <Text style={[styles.meta, { color: colors.mutedForeground }]}>{Math.round(bonus.progress * 100)}%</Text>
            </View>
            <Text style={[styles.bonusAmount, { color: colors.foreground }]}>{CEDI}{bonus.earned} / {CEDI}{bonus.target}</Text>
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

          <SectionHeader>{`Paid passengers on board (${onBoard ?? '–'})`}</SectionHeader>
          {pastStop.length > 0 ? (
            <View style={[styles.pastBadge, { borderColor: colors.accent, borderRadius: colors.radiusPill }]} accessibilityRole="alert">
              <Feather name="alert-triangle" size={14} color={colors.accent} />
              <Text style={[styles.pastText, { color: colors.accent }]}>
                {pastStop.length} {pastStop.length === 1 ? 'passenger' : 'passengers'} past stop
              </Text>
            </View>
          ) : null}
          {passengers && passengers.length === 0 ? (
            <Text style={[styles.empty, { color: colors.mutedForeground }]}>No paid passengers yet.</Text>
          ) : (
            (passengers ?? []).map((p) => (
              <Pressable
                key={p.tripId}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelected(p);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Passenger to ${p.alightingStop}, paid ${formatCedis(p.amountPaid)}${p.overstay ? ', past their stop' : ''}`}
                style={[styles.pRow, { backgroundColor: colors.card, borderColor: p.overstay ? colors.accent : colors.border, borderRadius: colors.radius, ...colors.elevation }]}
              >
                <Feather name={p.overstay ? 'alert-triangle' : 'user-check'} size={18} color={p.overstay ? colors.accent : colors.primary} />
                <View style={styles.pMain}>
                  <Text style={[styles.pName, { color: colors.foreground }]}>Guest · to {p.alightingStop}</Text>
                  <Text style={[styles.pMeta, { color: colors.mutedForeground }]}>
                    {formatCedis(p.amountPaid)} · {p.tripId}
                    {p.overstay ? ` · past stop (at ${p.overstay.stop})` : ''}
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </Pressable>
            ))
          )}

          <Pressable
            onPress={() =>
              Alert.alert('Report an unpaid passenger?', 'Use this if someone is on board who is not in the paid list. The union will review it.', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Report',
                  style: 'destructive',
                  onPress: () => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    void sendOrQueue({ type: 'unpaid', body: { description: `Unpaid passenger reported at ${current ?? 'unknown stop'}` } });
                    showToast('Report sent to the union');
                  },
                },
              ])
            }
            accessibilityRole="button"
            style={[styles.unpaid, { borderColor: colors.border, borderRadius: colors.radiusPill }]}
          >
            <Feather name="user-x" size={16} color={colors.foreground} />
            <Text style={[styles.unpaidText, { color: colors.foreground }]}>Add unpaid passenger</Text>
          </Pressable>

          <Pressable onPress={endShift} accessibilityRole="button" style={[styles.endShift, { borderColor: colors.destructive, borderRadius: colors.radiusPill }]}>
            <Feather name="power" size={18} color={colors.destructive} />
            <Text style={[styles.endShiftText, { color: colors.destructive }]}>End shift</Text>
          </Pressable>
        </>
      )}

      <PassengerSheet
        trip={selected}
        onClose={() => setSelected(null)}
        onConfirmAlight={async (t) => {
          setSelected(null);
          try {
            await api.confirmAlight(t.tripId);
            showToast('Passenger closed out');
            void refreshOnBoard();
          } catch {
            showToast("Couldn't close the trip. Try again.");
          }
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headingRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  headingBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 11, borderWidth: StyleSheet.hairlineWidth * 2, borderRadius: 999 },
  headingText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13 },
  scroll: { paddingHorizontal: GUTTER, paddingBottom: 132 },
  kicker: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, letterSpacing: 1.4, marginBottom: 16 },
  center: { paddingVertical: 80, alignItems: 'center' },
  errorCard: { borderWidth: StyleSheet.hairlineWidth * 2, padding: 24, alignItems: 'center', gap: 12 },
  errorText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, textAlign: 'center' },
  retry: { height: 44, paddingHorizontal: 24, borderWidth: StyleSheet.hairlineWidth * 2, alignItems: 'center', justifyContent: 'center' },
  retryText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15 },
  vehicle: { padding: 20, borderWidth: StyleSheet.hairlineWidth * 2, marginBottom: GAP },
  vehicleTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  code: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 22, letterSpacing: 1 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: StyleSheet.hairlineWidth * 2, paddingHorizontal: 12, height: 32 },
  pillText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12 },
  route: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 18, marginTop: 14 },
  driver: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, marginTop: 4 },
  card: { borderWidth: StyleSheet.hairlineWidth * 2, padding: 20, marginBottom: GAP },
  cardKicker: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, letterSpacing: 1.2 },
  bigNumber: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 40, marginTop: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  meta: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13 },
  scans: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 22, marginTop: 8, marginBottom: 12 },
  track: { height: 10, overflow: 'hidden' },
  fill: { height: 10 },
  bonusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bonusAmount: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, marginTop: 10 },
  hint: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, lineHeight: 17, marginTop: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  stopBtn: { minHeight: 80, borderWidth: StyleSheet.hairlineWidth * 2, padding: 14, justifyContent: 'center' },
  stopIndex: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, letterSpacing: 1 },
  stopName: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20, marginTop: 4 },
  pastBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: StyleSheet.hairlineWidth * 2, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 10 },
  pastText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12 },
  empty: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, marginBottom: 6 },
  pRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: StyleSheet.hairlineWidth * 2, padding: 14, marginBottom: 8 },
  pMain: { flex: 1 },
  pName: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15 },
  pMeta: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, marginTop: 2 },
  unpaid: { height: 48, marginTop: 8, marginBottom: 20, borderWidth: StyleSheet.hairlineWidth * 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  unpaidText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14 },
  onBoard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 24, marginBottom: 20 },
  onBoardText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14 },
  endShift: { height: 56, borderWidth: StyleSheet.hairlineWidth * 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  endShiftText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16 },
});
