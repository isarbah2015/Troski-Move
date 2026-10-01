import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { VerifySheet } from '@/components/VerifySheet';
import { KenteStrip } from '@/components/KenteStrip';
import { PulseDot } from '@/components/PulseDot';
import { SectionHeader } from '@/components/SectionHeader';
import { useColors } from '@/hooks/useColors';
import { api, formatCedis } from '@/lib/api';
import { bonusFor, formatOnline, MOCK_BONUS, MOCK_TODAY, useConductorVehicle } from '@/lib/conductor';
import { useFocusPolling } from '@/lib/polling';
import { showToast } from '@/lib/toast';
import { sendOrQueue } from '@/lib/sync';
import { announcement, buildBoard, paxLabel } from '@/lib/board';
import { useAutoStops } from '@/lib/autoStops';
import { speak } from '@/lib/speak';
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
  // Where the trotro is: GPS (this phone), else the furthest stop any passenger's phone has reached, else the start. Nobody taps for it.
  const furthest = (passengers ?? []).reduce((best, p) => Math.max(best, stops.findIndex((x) => x.name === p.currentStop)), -1);
  const current = currentStop ?? (furthest >= 0 ? stops[furthest]!.name : stops[0]?.name ?? null);
  const [heads, setHeads] = useState<number | null>(null);
  const [auto, setAuto] = useState(true);
  const [voice, setVoice] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const board = useMemo(() => buildBoard(stops.map((s) => s.name), current, passengers ?? []), [stops, current, passengers]);
  const counted = heads ?? board.total;
  const missing = Math.max(0, counted - board.total);
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

  const markStop = (name: string, automatic = false) => {
    if (name === current) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCurrentStop(name);
    if (automatic) showToast(`${name} marked automatically`);
    if (vehicleCode) {
      void sendOrQueue({ type: 'stop', body: { vehicleCode, stopName: name } });
      void refreshOnBoard();
    }
  };

  // GPS marks the stop for the conductor when the trotro gets within 100 m of it. No GPS: the "We're at" button below does it in one tap.
  const gps = useAutoStops({ stops, current, enabled: auto && online && stops.length > 0, onArrive: (name) => markStop(name, true) });

  // Optional voice: say the next stop and who is getting off whenever the stop changes.
  const spoken = useRef<string | null>(null);
  const boardRef = useRef(board);
  boardRef.current = board;
  useEffect(() => {
    if (!voice || !current || spoken.current === current) return;
    spoken.current = current;
    speak(announcement(boardRef.current));
  }, [voice, current]);

  const reportUnpaid = (note: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    void sendOrQueue({ type: 'unpaid', body: { description: `${note} at ${current ?? 'unknown stop'}` } });
    showToast('Report sent to the union');
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
            <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}><KenteStrip /></View>
          </LinearGradient>

          {/* The Big Board: who is getting off, who has paid, and whether the head count matches. */}
          <View style={[styles.status, { borderColor: missing > 0 ? colors.accent : colors.primary, backgroundColor: missing > 0 ? 'rgba(212,164,55,0.12)' : colors.scheme === 'light' ? 'rgba(7,128,90,0.08)' : 'rgba(43,217,159,0.10)', borderRadius: colors.radius }]} accessibilityRole="summary">
            <Feather name={missing > 0 ? 'alert-triangle' : 'check-circle'} size={30} color={missing > 0 ? colors.accent : colors.primary} />
            <View style={styles.statusText}>
              <Text style={[styles.statusBig, { color: missing > 0 ? colors.accent : colors.primary }]}>
                {missing > 0 ? `${missing} NOT ON THE LIST` : board.total === 0 ? 'NOBODY PAID YET' : 'ALL PAID'}
              </Text>
              <Text style={[styles.statusSmall, { color: colors.foreground }]}>{board.total} paid on board{counted !== board.total ? ` · you counted ${counted}` : ''}</Text>
            </View>
          </View>

          {/* Fraud check in one glance: count heads, compare with the number on screen. */}
          <View style={[styles.headRow, card]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.headTitle, { color: colors.foreground }]}>People in the trotro</Text>
              <Text style={[styles.headHint, { color: colors.mutedForeground }]}>Count heads. Different from {board.total}? Add the unpaid.</Text>
            </View>
            <Pressable onPress={() => { Haptics.selectionAsync(); setHeads(Math.max(0, counted - 1)); }} accessibilityRole="button" accessibilityLabel="One fewer person" style={[styles.stepBtn, { borderColor: colors.border }]}>
              <Feather name="minus" size={22} color={colors.foreground} />
            </Pressable>
            <Text style={[styles.headCount, { color: colors.foreground }]} accessibilityLabel={`${counted} people`}>{counted}</Text>
            <Pressable onPress={() => { Haptics.selectionAsync(); setHeads(counted + 1); }} accessibilityRole="button" accessibilityLabel="One more person" style={[styles.stepBtn, { borderColor: colors.border }]}>
              <Feather name="plus" size={22} color={colors.foreground} />
            </Pressable>
          </View>

          {/* Stops: GPS does it; one tap if it cannot. */}
          <View style={styles.autoRow}>
            <Pressable onPress={() => { Haptics.selectionAsync(); setAuto((a) => !a); }} accessibilityRole="switch" accessibilityState={{ checked: auto }} style={[styles.chip, { borderColor: auto ? colors.primary : colors.border, borderRadius: colors.radiusPill }]}>
              <Feather name="navigation" size={14} color={auto ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.chipText, { color: auto ? colors.primary : colors.mutedForeground }]}>
                {auto ? (gps === 'searching' ? 'Waiting for GPS' : 'Stops are detected for you') : 'GPS off'}
              </Text>
            </Pressable>
            <Pressable onPress={() => { Haptics.selectionAsync(); setVoice((v) => { if (!v) speak(announcement(board)); return !v; }); }} accessibilityRole="switch" accessibilityState={{ checked: voice }} style={[styles.chip, { borderColor: voice ? colors.primary : colors.border, borderRadius: colors.radiusPill }]}>
              <Feather name={voice ? 'volume-2' : 'volume-x'} size={14} color={voice ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.chipText, { color: voice ? colors.primary : colors.mutedForeground }]}>{voice ? 'Voice on' : 'Voice off'}</Text>
            </Pressable>
          </View>

          {board.past.length > 0 ? (
            <>
              <SectionHeader>Past their stop</SectionHeader>
              {board.past.map((p) => (
                <Pressable key={p.tripId} onPress={() => { Haptics.selectionAsync(); setSelected(p); }} accessibilityRole="button" accessibilityLabel={`${paxLabel(p.tripId)}, past their stop ${p.alightingStop}`} style={[styles.bigCard, { borderColor: colors.destructive, backgroundColor: 'rgba(224,60,60,0.08)', borderRadius: colors.radius }]}>
                  <PulseDot color={colors.destructive} size={12} />
                  <View style={styles.pMain}>
                    <Text style={[styles.bigName, { color: colors.foreground }]}>{paxLabel(p.tripId)}</Text>
                    <Text style={[styles.bigTo, { color: colors.destructive }]}>Past {p.alightingStop} · now at {p.overstay?.stop}</Text>
                  </View>
                  <Feather name="alert-octagon" size={26} color={colors.destructive} />
                </Pressable>
              ))}
            </>
          ) : null}

          {board.here.length > 0 ? (
            <>
              <SectionHeader>{`Getting off here · ${board.current}`}</SectionHeader>
              {board.here.map((p) => (
                <PaxCard key={p.tripId} pax={p} onPress={() => { Haptics.selectionAsync(); setSelected(p); }} />
              ))}
            </>
          ) : null}

          {board.next ? (
            <>
              <SectionHeader>{`Next stop · ${board.next}`}</SectionHeader>
              {board.nextPax.length === 0 ? (
                <Text style={[styles.empty, { color: colors.mutedForeground }]}>Nobody is getting off at {board.next}.</Text>
              ) : (
                board.nextPax.map((p) => <PaxCard key={p.tripId} pax={p} onPress={() => { Haptics.selectionAsync(); setSelected(p); }} />)
              )}
            </>
          ) : (
            <Pressable onPress={turnRound} accessibilityRole="button" style={[styles.atBtn, { backgroundColor: colors.primary, borderRadius: colors.radiusPill }]}>
              <Feather name="repeat" size={20} color={colors.primaryForeground} />
              <Text style={[styles.atText, { color: colors.primaryForeground }]}>End of the line: turn round</Text>
            </Pressable>
          )}

          {board.later.length > 0 ? (
            <>
              <SectionHeader>Later stops</SectionHeader>
              {board.later.map((g) => (
                <View key={g.stop} style={[styles.laterCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                  <Text style={[styles.laterStop, { color: colors.foreground }]}>{g.stop}</Text>
                  {g.pax.map((p) => (
                    <Pressable key={p.tripId} onPress={() => { Haptics.selectionAsync(); setSelected(p); }} accessibilityRole="button" accessibilityLabel={`${paxLabel(p.tripId)} to ${g.stop}, paid`} style={styles.laterRow}>
                      <Feather name="check-circle" size={16} color={colors.primary} />
                      <Text style={[styles.laterName, { color: colors.mutedForeground }]}>{paxLabel(p.tripId)}</Text>
                      <Text style={[styles.laterPaid, { color: colors.primary }]}>PAID</Text>
                    </Pressable>
                  ))}
                </View>
              ))}
            </>
          ) : null}

          {/* The two things a conductor does about fraud, one tap each. */}
          <View style={styles.actions}>
            <Pressable onPress={() => { Haptics.selectionAsync(); setVerifyOpen(true); }} accessibilityRole="button" style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, ...colors.elevation }]}>
              <Feather name="shield" size={24} color={colors.primary} />
              <Text style={[styles.actionText, { color: colors.foreground }]}>Verify QR</Text>
              <Text style={[styles.actionHint, { color: colors.mutedForeground }]}>They say they paid</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                const note = missing > 0 ? `${missing} unpaid passenger${missing === 1 ? '' : 's'} reported` : 'Unpaid passenger reported';
                if (Platform.OS === 'web') {
                  if (typeof window !== 'undefined' && window.confirm(`${note}? The union will review it.`)) reportUnpaid(note);
                  return;
                }
                Alert.alert('Report unpaid?', 'The union will review it.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Report', style: 'destructive', onPress: () => reportUnpaid(note) }]);
              }}
              accessibilityRole="button"
              style={[styles.actionBtn, { backgroundColor: missing > 0 ? 'rgba(212,164,55,0.14)' : colors.card, borderColor: missing > 0 ? colors.accent : colors.border, borderRadius: colors.radius, ...colors.elevation }]}
            >
              <Feather name="user-plus" size={24} color={colors.accent} />
              <Text style={[styles.actionText, { color: colors.foreground }]}>+ Add unpaid</Text>
              <Text style={[styles.actionHint, { color: colors.mutedForeground }]}>{missing > 0 ? `${missing} missing` : 'Someone not on the list'}</Text>
            </Pressable>
          </View>


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


          <Pressable onPress={endShift} accessibilityRole="button" style={[styles.endShift, { borderColor: colors.destructive, borderRadius: colors.radiusPill }]}>
            <Feather name="power" size={18} color={colors.destructive} />
            <Text style={[styles.endShiftText, { color: colors.destructive }]}>End shift</Text>
          </Pressable>
        </>
      )}

      <VerifySheet visible={verifyOpen} passengers={passengers ?? []} onClose={() => setVerifyOpen(false)} onReportUnpaid={(code) => reportUnpaid(`Passenger claimed to have paid (code ${code || 'none'})`)} />
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

/** A passenger getting off soon: big and plain so it reads from arm's length. */
function PaxCard({ pax, onPress }: { pax: ServerTrip; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${paxLabel(pax.tripId)} to ${pax.alightingStop}, paid ${formatCedis(pax.amountPaid)}`} style={[styles.bigCard, { backgroundColor: colors.card, borderColor: colors.primary, borderRadius: colors.radius, ...colors.elevation }]}>
      <View style={styles.pMain}>
        <Text style={[styles.bigName, { color: colors.foreground }]}>{paxLabel(pax.tripId)}</Text>
        <Text style={[styles.bigTo, { color: colors.mutedForeground }]}>→ {pax.alightingStop} · {formatCedis(pax.amountPaid)}</Text>
      </View>
      <View style={[styles.paidTag, { backgroundColor: colors.primary, borderRadius: colors.radiusPill }]}>
        <Feather name="check" size={16} color={colors.primaryForeground} />
        <Text style={[styles.paidTagText, { color: colors.primaryForeground }]}>PAID</Text>
      </View>
    </Pressable>
  );
}


const styles = StyleSheet.create({
  status: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 2, padding: 18, marginBottom: GAP },
  statusText: { flex: 1 },
  statusBig: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 26, letterSpacing: 0.3 },
  statusSmall: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, marginTop: 2 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: StyleSheet.hairlineWidth * 2, padding: 16, marginBottom: GAP },
  headTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15 },
  headHint: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, lineHeight: 17, marginTop: 2 },
  stepBtn: { width: 46, height: 46, borderRadius: 23, borderWidth: StyleSheet.hairlineWidth * 2, alignItems: 'center', justifyContent: 'center' },
  headCount: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 30, minWidth: 40, textAlign: 'center' },
  autoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: StyleSheet.hairlineWidth * 2, paddingHorizontal: 14, paddingVertical: 9 },
  chipText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13 },
  bigCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 2, padding: 18, marginBottom: 10, minHeight: 78 },
  bigName: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 19 },
  bigTo: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15, marginTop: 3 },
  paidTag: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8 },
  paidTagText: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 13, letterSpacing: 0.6 },
  atBtn: { height: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 4, marginBottom: 6 },
  atText: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18 },
  laterCard: { borderWidth: StyleSheet.hairlineWidth * 2, padding: 14, marginBottom: 8 },
  laterStop: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, marginBottom: 6 },
  laterRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  laterName: { flex: 1, fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14 },
  laterPaid: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 12, letterSpacing: 0.6 },
  fixLink: { alignSelf: 'center', paddingVertical: 14 },
  fixText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, textDecorationLine: 'underline' },
  fixChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  actions: { flexDirection: 'row', gap: 12, marginBottom: 20, marginTop: 6 },
  actionBtn: { flex: 1, minHeight: 112, borderWidth: StyleSheet.hairlineWidth * 2, padding: 16, justifyContent: 'center', gap: 4 },
  actionText: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18, marginTop: 6 },
  actionHint: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12 },
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
  vehicle: { overflow: 'hidden', padding: 20, borderWidth: StyleSheet.hairlineWidth * 2, marginBottom: GAP },
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
