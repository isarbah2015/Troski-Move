import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ActiveTrip, TripRecord } from '@trotrolink/shared';
import { RatingSheet, type RatingTarget } from '@/components/RatingSheet';
import { alightCheck } from '@trotrolink/shared';
import { getPosition } from '@/lib/location';
import { notifyOnce } from '@/lib/notify';
import { useLiveEta } from '@/lib/liveEta';
import { Approx } from '@/components/Approx';
import { OverstaySheet } from '@/components/OverstaySheet';
import { PaymentSheet, type PaymentPhase } from '@/components/PaymentSheet';
import { ReportSheet } from '@/components/ReportSheet';
import { PulseDot } from '@/components/PulseDot';
import { useColors } from '@/hooks/useColors';
import { api, formatCedis } from '@/lib/api';
import { RATING_PROMPT_WINDOW_MS, submitTripRating } from '@/lib/ratings';
import { getDeviceId } from '@/lib/identity';
import { waitForPayment } from '@/lib/payment';
import { clearActiveTrip, getActiveTrip, getTripHistory, getTripRatings, markTripArrived, saveActiveTrip, saveTripReport, updateTripRecord } from '@/lib/storage';
import { showToast } from '@/lib/toast';
import { useFocusPolling } from '@/lib/polling';
import { sendOrQueue } from '@/lib/sync';
import { applyServerTrip, tripProgress } from '@/lib/trip';
import { EMERALD, GOLD, SILVER, WHITE } from '@/lib/colors';
import { t as tt, useT } from '@/lib/i18n';
import { PrimaryButton } from '@/components/PrimaryButton';
import { LiveEta } from '@/components/LiveEta';
import { SupportStatus } from '@/components/SupportStatus';

function LiveBadge() {
  const colors = useColors();
  const t = useT();
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 0.25, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      );
      loop.start();
    });
    return () => loop?.stop();
  }, [pulse]);

  return (
    <View style={[styles.live, { borderColor: EMERALD, borderRadius: colors.radiusPill }]} accessibilityLabel="Live">
      <Animated.View style={[styles.liveDot, { backgroundColor: EMERALD, opacity: pulse }]} />
      <Text style={[styles.liveText, { color: EMERALD }]}>{t('trip.live')}</Text>
    </View>
  );
}

function ActiveTripView({ trip, onCleared, onConfirmAlighting }: { trip: ActiveTrip; onCleared: () => void; onConfirmAlighting: () => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<import('@trotrolink/shared').DisputeReason | null>(null);
  const t = useT();
  const progress = tripProgress(trip);
  const eta = useLiveEta(trip);
  // The passenger can only confirm alighting once the vehicle has reached their stop.
  const atDestination = trip.currentStop === trip.alightingStop;

  const dotColor = { passed: colors.primary, current: colors.accent, upcoming: colors.mutedForeground } as const;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16 }]}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient colors={colors.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { borderRadius: colors.radiusModal }, colors.elevation]}>
        <View style={styles.headRow}>
          <Text style={[styles.kicker, { color: SILVER }]}>{t('trip.progress')}</Text>
          <LiveBadge />
        </View>

        <View style={[styles.paid, { backgroundColor: 'rgba(255,255,255,0.07)', borderColor: 'rgba(43,217,159,0.55)', borderRadius: colors.radiusPill }]} accessibilityLabel={`Paid, trip ${trip.tripId}`}>
          <PulseDot color={EMERALD} size={8} />
          <Feather name="shield" size={14} color={EMERALD} />
          <Text style={[styles.paidText, { color: WHITE }]}>PAID · {trip.tripId}</Text>
        </View>

        <Text style={[styles.to, { color: WHITE }]}>{t('trip.to', { stop: trip.alightingStop })}</Text>
        {trip.customStopNote ? (
          <View style={[styles.noteChip, { borderColor: GOLD, borderRadius: colors.radiusPill }]}>
            <Feather name="map-pin" size={12} color={GOLD} />
            <Text style={[styles.noteText, { color: GOLD }]} numberOfLines={1}>{t('trip.gettingOff', { note: trip.customStopNote })}</Text>
          </View>
        ) : null}
        <Text style={[styles.route, { color: SILVER }]}>
          {trip.vehicleShortCode} · {trip.routeName} · Driver {trip.driverName}
        </Text>
      </LinearGradient>

      <LiveEta
        eta={eta}
        progress={progress}
        destination={trip.alightingStop}
        currentStop={trip.currentStop}
        stopsRemaining={trip.stopsRemaining}
        stops={trip.stops.map((st) => st.name)}
        alightingStop={trip.alightingStop}
        boardingStop={trip.boardingStop}
      />

      <SupportStatus trip={trip} onOpen={(reason) => { setReportReason(reason); setReportOpen(true); }} />

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, ...colors.elevation }]}>
        {trip.stops.slice(Math.max(0, trip.stops.findIndex((x) => x.name === trip.boardingStop))).map((s, i, shown) => {
          const last = i === shown.length - 1;
          const isDest = s.name === trip.alightingStop;
          return (
            <View key={s.name} style={styles.stopRow} accessibilityLabel={`${s.name}, ${s.status}${isDest ? ', your stop' : ''}`}>
              <View style={styles.rail}>
                <View style={[styles.dot, { backgroundColor: s.status === 'upcoming' ? 'transparent' : dotColor[s.status], borderColor: dotColor[s.status] }]}>
                  {s.status === 'passed' ? <Feather name="check" size={10} color={colors.primaryForeground} /> : null}
                </View>
                {!last ? <View style={[styles.line, { backgroundColor: s.status === 'passed' ? colors.primary : colors.border }]} /> : null}
              </View>
              <Text style={[styles.stopName, { color: s.status === 'upcoming' ? colors.mutedForeground : colors.foreground, fontFamily: s.status === 'current' ? 'PlusJakartaSans_700Bold' : 'PlusJakartaSans_500Medium' }]}>
                {s.name}
              </Text>
              {isDest ? (
                <View style={[styles.destPill, { backgroundColor: colors.secondary, borderRadius: colors.radiusPill }]}>
                  <Text style={[styles.destText, { color: GOLD }]}>{t('trip.yourStop')}</Text>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      <View style={styles.receipt}>
        <View style={styles.receiptItem}>
          <Feather name="credit-card" size={16} color={colors.mutedForeground} />
          <Text style={[styles.receiptText, { color: colors.foreground }]}>{t('trip.paid', { amount: formatCedis(trip.amountPaid) })}</Text>
          <Approx amount={trip.amountPaid} style={{ fontSize: 12 }} />
        </View>
        <View style={styles.receiptItem}>
          <Feather name="hash" size={16} color={colors.mutedForeground} />
          <Text style={[styles.receiptText, { color: colors.mutedForeground }]}>{trip.tripId}</Text>
        </View>
      </View>

      {atDestination ? (
        <PrimaryButton onPress={onConfirmAlighting} icon="check-circle" label={t('trip.confirm')} accessibilityLabel={`Confirm alighting at ${trip.alightingStop}`} style={styles.confirmBtn} />
      ) : null}

      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setReportOpen(true);
        }}
        accessibilityRole="button"
        style={[styles.secondaryBtn, { borderColor: colors.border, borderRadius: colors.radiusPill }]}
      >
        <Feather name="alert-triangle" size={18} color={colors.foreground} />
        <Text style={[styles.secondaryText, { color: colors.foreground }]}>{t('trip.report')}</Text>
      </Pressable>

      {__DEV__ ? (
        <View style={styles.devRow}>
          <Pressable
            onPress={async () => {
              await clearActiveTrip();
              onCleared();
            }}
            accessibilityRole="button"
            style={styles.devLink}
          >
            <Text style={[styles.devText, { color: colors.mutedForeground }]}>Clear trip (dev only)</Text>
          </Pressable>
        </View>
      ) : null}

      <ReportSheet
        visible={reportOpen}
        initialReason={reportReason}
        onClose={() => { setReportOpen(false); setReportReason(null); }}
        onSubmit={async (reason, description, amountAsked) => {
          // Queued if offline; the server attaches the trip, vehicle and stop history as evidence.
          // Accidents and careless driving are live alerts: send the phone's position so GPRTU can find the trotro.
          const urgent = reason === 'accident' || reason === 'careless_driving';
          const pos = urgent ? await getPosition({ timeoutMs: 4000 }) : null;
          await sendOrQueue({ type: 'dispute', body: { tripId: trip.tripId, deviceId: await getDeviceId(), reason, description, ...(amountAsked !== undefined ? { amountAsked } : {}), ...(pos ? { lat: pos.lat, lng: pos.lng } : {}) } });
          await saveTripReport(trip.tripId, reason);
          setReportOpen(false);
          setReportReason(null);
          showToast(urgent ? 'Alert sent. GPRTU can see your report now.' : 'Report sent. Union will review within 24h.');
        }}
      />
    </ScrollView>
  );
}

function EmptyState({ recent, onRate }: { recent: TripRecord | null; onRate: (t: TripRecord) => void }) {
  const colors = useColors();
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.empty, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.emptyBadge, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radiusModal }]}>
        <Feather name="navigation" size={30} color={colors.primary} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{t('trip.empty.title')}</Text>
      <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>{t('trip.empty.body')}</Text>
      <PrimaryButton onPress={() => router.navigate('/')} icon="maximize" label={t('trip.empty.go')} style={styles.primaryBtn} />

      {recent ? (
        <View style={[styles.prompt, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, ...colors.elevation }]}>
          <Feather name="star" size={20} color={colors.accent} />
          <View style={styles.promptText}>
            <Text style={[styles.promptTitle, { color: colors.foreground }]}>{t('trip.rate.title', { stop: recent.alightingStop })}</Text>
            <Text style={[styles.promptBody, { color: colors.mutedForeground }]}>Your rating helps the Driver of the Day.</Text>
          </View>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onRate(recent);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Rate your trip to ${recent.alightingStop}`}
            style={[styles.promptBtn, { borderColor: colors.accent, borderRadius: colors.radiusPill }]}
          >
            <Text style={[styles.promptBtnText, { color: colors.accent }]}>{t('trip.rate.cta')}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export default function TripScreen() {
  const colors = useColors();
  const router = useRouter();
  const [trip, setTrip] = useState<ActiveTrip | null>(null);
  const [recent, setRecent] = useState<TripRecord | null>(null);
  const [target, setTarget] = useState<RatingTarget | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [overstay, setOverstay] = useState<{ stop: string; extraFare: number; deadline: string } | null>(null);
  const [extPay, setExtPay] = useState<{ phase: PaymentPhase; simulator: boolean; message?: string } | null>(null);
  const confirmRef = useRef<(notifyServer: boolean) => Promise<void>>(async () => undefined);

  /** The newest trip the passenger confirmed alighting from in the last 24h and has not rated. */
  const loadRecent = useCallback(async () => {
    const [history, ratings] = await Promise.all([getTripHistory(), getTripRatings()]);
    const cutoff = Date.now() - RATING_PROMPT_WINDOW_MS;
    return history.find((t) => t.arrivedAt && new Date(t.arrivedAt).getTime() > cutoff && !ratings[t.tripId]) ?? null;
  }, []);

  // While a trip is live, ask the API every 10 seconds where the vehicle is (the conductor's stop marks).
  const tripRef = useRef<ActiveTrip | null>(null);
  tripRef.current = trip;
  const pollTrip = useCallback(async () => {
    const current = tripRef.current;
    if (!current) return;
    try {
      const { trips } = await api.activeTrips({ tripId: current.tripId });
      const server = trips[0];
      if (!server) {
        // The conductor closed this trip (they confirmed we got off here): finish it and ask for the rating.
        if (!current.arrivedAt) {
          showToast('Your trip was ended by the conductor');
          await confirmRef.current(false);
        }
        return;
      }
      setOverstay(server.overstay ?? null);
      // Local alerts (they fire while the app is open or recently backgrounded; closed-app push comes from the server).
      if (server.overstay) notifyOnce(`${current.tripId}:over`, tt('notif.over.title', { stop: current.alightingStop }), tt('notif.over.body'));
      else if (server.stopsRemaining === 1) notifyOnce(`${current.tripId}:next`, tt('notif.next.title'), tt('notif.next.body', { stop: server.alightingStop }));
      else if (server.stopsRemaining === 0) notifyOnce(`${current.tripId}:arrived:${server.alightingStop}`, tt('notif.arrived.title'), tt('notif.arrived.body', { stop: server.alightingStop }));
      const next = applyServerTrip(current, server);
      if (next.alightingStop !== current.alightingStop) {
        // An overstay extension went through (we paid, or the 60 s auto-charge ran): keep the stored trip in step.
        await updateTripRecord(next.tripId, { alightingStop: next.alightingStop, amountPaid: next.amountPaid });
        showToast(`Trip extended to ${next.alightingStop}. ${formatCedis(next.amountPaid - current.amountPaid)} charged.`);
      }
      if (next.currentStop !== current.currentStop || next.etaMinutes !== current.etaMinutes || next.alightingStop !== current.alightingStop) {
        await saveActiveTrip(next);
        setTrip(next);
      }
    } catch {
      // Offline: keep showing the last known state.
    }
  }, []);
  useFocusPolling(pollTrip, !!trip && !trip.arrivedAt);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void Promise.all([getActiveTrip(), loadRecent()]).then(([t, r]) => {
        if (!active) return;
        setTrip(t);
        setRecent(r);
        setLoaded(true);
      });
      return () => {
        active = false;
      };
    }, [loadRecent]),
  );

  const confirmAlighting = async (notifyServer = true) => {
    const t = tripRef.current;
    if (!t) return;
    const arrivedAt = new Date().toISOString();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Optional GPS check: where the phone is vs the declared stop. A data point for disputes, never a gate.
    const pos = await getPosition({ timeoutMs: 4000 });
    const dest = t.stops.find((s) => s.name === t.alightingStop);
    const check = alightCheck(dest && { name: dest.name, fare: 0, etaMinutes: 0, lat: dest.lat, lng: dest.lng }, pos);
    if (check?.status === 'far') showToast(`We noted you are about ${check.distanceM} m from ${t.alightingStop}.`);
    // The trip already sits in history from payment; stamp it as arrived and open the rating sheet.
    await Promise.all([saveActiveTrip({ ...t, arrivedAt }), markTripArrived(t.tripId, arrivedAt)]);
    if (notifyServer) void sendOrQueue({ type: 'alight', body: { tripId: t.tripId, ...(pos ? { lat: pos.lat, lng: pos.lng } : {}) } });
    setOverstay(null);
    setTrip({ ...t, arrivedAt });
    setTarget({ tripId: t.tripId, vehicleId: t.vehicleId, destination: t.alightingStop, driverName: t.driverName, conductorName: t.conductorName ?? 'Conductor', justArrived: true });
  };
  confirmRef.current = confirmAlighting;

  /** The passenger chose to pay the difference. Same MoMo flow as the first payment. */
  const payExtension = async () => {
    const t = tripRef.current;
    if (!t) return;
    setExtPay({ phase: 'sending', simulator: false });
    try {
      const started = await api.extendTrip(t.tripId);
      setExtPay({ phase: 'pending', simulator: started.simulator });
      const outcome = await waitForPayment(started.referenceId, started.tripId);
      if (outcome.kind === 'success') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setExtPay(null);
        await pollTrip();
      } else {
        setExtPay({ phase: outcome.kind, simulator: started.simulator, message: outcome.kind === 'failed' ? outcome.reason : undefined });
      }
    } catch (e) {
      setExtPay({ phase: 'failed', simulator: false, message: e instanceof Error ? e.message : "Couldn't start the payment." });
    }
  };

  /** Closing the sheet after arrival ends the trip: it leaves `activeTrip` and lives on in history. */
  const finishTrip = async (t: RatingTarget) => {
    setTarget(null);
    if (t.justArrived) {
      await clearActiveTrip();
      setTrip(null);
    }
    setRecent(await loadRecent());
  };

  const rateRecent = (t: TripRecord) =>
    setTarget({
      tripId: t.tripId,
      vehicleId: t.vehicleId,
      destination: t.alightingStop,
      driverName: t.driverName ?? 'Driver',
      conductorName: t.conductorName ?? 'Conductor',
      justArrived: false,
    });

  if (!loaded) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  return (
    <>
      {trip ? (
        <ActiveTripView
          trip={trip}
          onCleared={() => setTrip(null)}
          onConfirmAlighting={() => void confirmAlighting(true)}
        />
      ) : (
        <EmptyState recent={recent} onRate={rateRecent} />
      )}
      {trip ? (
        <OverstaySheet declaredStop={trip.alightingStop} overstay={extPay ? null : overstay} onPay={() => void payExtension()} onGetOff={() => void confirmAlighting(true)} />
      ) : null}
      <PaymentSheet
        phase={extPay?.phase ?? null}
        amount={overstay?.extraFare ?? 0}
        destination={overstay?.stop ?? ''}
        message={extPay?.message}
        simulator={extPay?.simulator ?? false}
        onRetry={() => void payExtension()}
        onClose={() => setExtPay(null)}
      />
      <RatingSheet
        target={target}
        onSkip={finishTrip}
        onSubmit={async (t, result) => {
          await submitTripRating(t, result);
          await finishTrip(t);
          showToast('Thanks for rating!');
          // After arriving, send the passenger back to Scan; rating from history stays put.
          if (t.justArrived) router.navigate('/');
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 24, paddingBottom: 40 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  kicker: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, letterSpacing: 1.2 },
  live: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: StyleSheet.hairlineWidth * 2, paddingHorizontal: 10, paddingVertical: 4 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  liveText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, letterSpacing: 1 },
  noteChip: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: StyleSheet.hairlineWidth * 2, paddingHorizontal: 10, paddingVertical: 4, marginTop: 6 },
  noteText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, maxWidth: 260 },
  paid: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: StyleSheet.hairlineWidth * 2, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 10 },
  paidText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, letterSpacing: 0.5 },
  to: { fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -0.8, fontSize: 32 },
  route: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, lineHeight: 20, marginTop: 6 },
  hero: { padding: 22, marginBottom: 18, overflow: 'hidden' },
  stats: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  stat: { flex: 1, padding: 12, gap: 6, borderWidth: StyleSheet.hairlineWidth * 2 },
  statValue: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 17 },
  statLabel: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12 },
  track: { height: 10, overflow: 'hidden' },
  fill: { height: 10 },
  pct: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, marginTop: 8, marginBottom: 20 },
  card: { borderWidth: StyleSheet.hairlineWidth * 2, paddingVertical: 12, paddingHorizontal: 16, marginBottom: 20 },
  stopRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: 14 },
  rail: { width: 18, alignItems: 'center', alignSelf: 'stretch', justifyContent: 'center' },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  line: { position: 'absolute', top: '50%', bottom: -22, width: 2 },
  stopName: { flex: 1, fontSize: 16 },
  destPill: { paddingHorizontal: 10, paddingVertical: 4 },
  destText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11 },
  receipt: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  receiptItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  receiptText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14 },
  secondaryBtn: { height: 56, borderWidth: StyleSheet.hairlineWidth * 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  secondaryText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 16 },
  devRow: { alignItems: 'center' },
  devLink: { alignSelf: 'center', paddingVertical: 12 },
  confirmBtn: { marginBottom: 12 },
  prompt: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: StyleSheet.hairlineWidth * 2, padding: 14, marginTop: 28, alignSelf: 'stretch' },
  promptText: { flex: 1 },
  promptTitle: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14 },
  promptBody: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, marginTop: 2 },
  promptBtn: { borderWidth: StyleSheet.hairlineWidth * 2, paddingHorizontal: 14, height: 36, alignItems: 'center', justifyContent: 'center' },
  promptBtnText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13 },
  devText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyBadge: { width: 80, height: 80, borderWidth: StyleSheet.hairlineWidth * 2, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  emptyTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 24, marginBottom: 8 },
  emptyBody: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 28 },
  primaryBtn: { alignSelf: 'stretch', marginHorizontal: 24 },
  primaryText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 17 },
});
