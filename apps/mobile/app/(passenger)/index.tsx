import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import type { ResolvedVehicle, Stop } from '@trotrolink/shared';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CodeEntrySheet } from '@/components/CodeEntrySheet';
import { UnregisteredSheet } from '@/components/UnregisteredSheet';
import { DemoBadge } from '@/components/DemoBadge';
import { PaymentSheet, type PaymentPhase } from '@/components/PaymentSheet';
import { StopSheet } from '@/components/StopSheet';
import { useColors } from '@/hooks/useColors';
import { DEMO_MODE, VehicleNotFoundError } from '@/lib/api';
import { api } from '@/lib/api';
import { payForTrip } from '@/lib/payment';
import { appendTripRecord, saveActiveTrip } from '@/lib/storage';
import { showToast } from '@/lib/toast';
import { buildTrip, buildTripRecord, newTripId } from '@/lib/trip';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useT } from '@/lib/i18n';

type PaymentState = { phase: PaymentPhase; resolved: ResolvedVehicle; stop: Stop; simulator: boolean; message?: string; referenceId?: string; tripId?: string; customNote?: string; boarding?: string };

// Demo codes for web / simulators that have no camera.
const DEMO_CODES = ['CIR01', 'CIR02', 'MAD05', 'TEM03'];
const SHOW_DEMO = Platform.OS === 'web' || __DEV__ || DEMO_MODE;

export default function ScanScreen() {
  const t = useT();
  const colors = useColors(); // the screen follows the theme; only the live camera picture is dark
  const { width: screenW, height: screenH } = useWindowDimensions();
  const frameW = Math.min(screenW - 48, 420);
  const frameH = Math.min(Math.max(screenH * 0.42, 280), 400);
  const sweep = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(sweep, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(sweep, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [sweep]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { code: prefillCode, n: prefillNonce } = useLocalSearchParams<{ code?: string; n?: string }>();
  const [initialCode, setInitialCode] = useState('');
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const [permission, requestPermission] = useCameraPermissions();
  const [resolved, setResolved] = useState<ResolvedVehicle | null>(null);
  const [codeOpen, setCodeOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportCode, setReportCode] = useState('');
  const busy = useRef(false);
  const paying = useRef(false);
  const [payment, setPayment] = useState<PaymentState | null>(null);

  const resolve = useCallback(async (code: string) => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const result = await api.resolveVehicle(code);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCodeOpen(false);
      setResolved(result);
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setNotFound(e instanceof VehicleNotFoundError);
      setError(e instanceof VehicleNotFoundError ? "We couldn't find that trotro. Check the code and try again." : 'Something went wrong. Check your connection and try again.');
    } finally {
      setLoading(false);
      // Give the sheet a beat before the camera may fire again.
      setTimeout(() => { busy.current = false; }, 1200);
    }
  }, []);

  /**
   * MoMo flow: ask the API to charge the passenger, wait for their approval, and only then start the
   * trip. Each attempt uses a fresh trip reference, so a declined or abandoned attempt never blocks a retry.
   */
  const finishPaid = async (res: ResolvedVehicle, stop: Stop, tripId: string, customNote?: string, boarding?: string) => {
    const trip = buildTrip(res, stop, tripId, customNote, new Date(), boarding);
    await saveActiveTrip(trip);
    await appendTripRecord(buildTripRecord(res, stop, trip));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPayment((p) => (p ? { ...p, phase: 'success' } : p));
    await new Promise((r) => setTimeout(r, 900));
    setPayment(null);
    setResolved(null);
    showToast('Payment successful');
    router.navigate('/trip');
  };

  const pay = async (res: ResolvedVehicle, stop: Stop, customNote?: string, previous?: { referenceId: string; tripId: string }, boarding?: string) => {
    if (paying.current) return;
    paying.current = true;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      // iOS cannot present a second modal over the stop sheet: close it first and let it finish animating.
      if (resolved) {
        setResolved(null);
        await new Promise((r) => setTimeout(r, 450));
      }
      setPayment({ phase: 'sending', resolved: res, stop, simulator: false, customNote, boarding });

      // A timed-out request may still have been approved: check it before charging again, so a retry never double-charges.
      if (previous) {
        try {
          if ((await api.paymentStatus(previous.referenceId)).status === 'SUCCESSFUL') {
            await finishPaid(res, stop, previous.tripId, customNote, boarding);
            return;
          }
        } catch {
          // Could not check; fall through and start a fresh attempt.
        }
      }

      const tripId = newTripId();
      const outcome = await payForTrip({
        resolved: res,
        stop,
        boardingStop: boarding ?? res.route.stops[0]!.name,
        tripId,
        customStopNote: customNote,
        onPending: ({ referenceId, simulator, tripId: serverTripId }) => setPayment((p) => (p ? { ...p, phase: 'pending', simulator, referenceId, tripId: serverTripId } : p)),
      });
      if (outcome.kind === 'success') {
        await finishPaid(res, stop, outcome.tripId, customNote, boarding);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setPayment((p) => (p ? { ...p, phase: outcome.kind, message: outcome.kind === 'failed' ? outcome.reason : undefined } : p));
      }
    } finally {
      paying.current = false;
    }
  };

  // "Ride again" from Profile arrives with ?code=CIR01&n=<timestamp>: open the short-code sheet pre-filled.
  useEffect(() => {
    if (!prefillCode) return;
    setInitialCode(prefillCode);
    setError(null);
    setCodeOpen(true);
  }, [prefillCode, prefillNonce]);

  const scanning = focused && !resolved && !codeOpen && permission?.granted;

  const cameraOn = !!permission?.granted && focused;
  const cameraOff = !!permission && !permission.granted;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* A soft emerald wash behind the header gives the page depth without a heavy image. */}
      <LinearGradient colors={[colors.scheme === 'light' ? 'rgba(18,165,118,0.10)' : 'rgba(43,217,159,0.07)', 'transparent']} style={styles.wash} pointerEvents="none" />

      <View style={[styles.top, { paddingTop: insets.top + 16 }]}>
        <DemoBadge />
        <Text style={[styles.title, { color: colors.foreground }]}>{t('scan.title')}</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{t('scan.subtitle')}</Text>
      </View>

      <View style={styles.stage}>
        <View
          style={[
            styles.viewfinder,
            { width: frameW, height: frameH, borderRadius: colors.radiusModal, backgroundColor: cameraOn ? '#05080F' : colors.card, borderColor: colors.border },
            colors.elevation,
          ]}
        >
          {cameraOn ? (
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={scanning ? ({ data }) => { void resolve(data); } : undefined}
            />
          ) : (
            <View style={styles.placeholder} pointerEvents="box-none">
              <View style={[styles.placeholderIcon, { backgroundColor: colors.scheme === 'light' ? 'rgba(7,128,90,0.1)' : 'rgba(43,217,159,0.12)' }]}>
                <Feather name={cameraOff ? 'camera-off' : 'maximize'} size={30} color={colors.primary} />
              </View>
              {cameraOff ? (
                <>
                  <Text style={[styles.permissionText, { color: colors.mutedForeground }]}>
                    {permission!.canAskAgain ? t('scan.allowCamera') : 'Camera is off. Enable it in Settings, or enter the short code.'}
                  </Text>
                  <Pressable onPress={() => (permission!.canAskAgain ? requestPermission() : Linking.openSettings())} accessibilityRole="button" hitSlop={8}>
                    <Text style={[styles.permissionLink, { color: colors.primary }]}>{permission!.canAskAgain ? t('scan.allow') : 'Settings'}</Text>
                  </Pressable>
                </>
              ) : null}
            </View>
          )}

          {/* Corner brackets and a sweeping scan line frame the target. */}
          <View style={styles.brackets} pointerEvents="none">
            {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
              <View key={c} style={[styles.corner, styles[c], { borderColor: colors.primary }]} />
            ))}
            {cameraOn ? <Animated.View
              style={[
                styles.scanLine,
                { backgroundColor: colors.primary, shadowColor: colors.primary, transform: [{ translateY: sweep.interpolate({ inputRange: [0, 1], outputRange: [28, frameH - 32] }) }] },
              ]}
            /> : null}
          </View>
        </View>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 20 }]}>
        {SHOW_DEMO ? (
          <>
            <Text style={[styles.chipsLabel, { color: colors.mutedForeground }]}>TRY A DEMO CODE</Text>
            {/* Four equal chips: they always fit the screen width, so nothing is cut or needs scrolling. */}
            <View style={styles.chipsWrap}>
              {DEMO_CODES.map((code) => (
                <Pressable
                  key={code}
                  onPress={() => { Haptics.selectionAsync(); void resolve(code); }}
                  accessibilityRole="button"
                  accessibilityLabel={`Use demo code ${code}`}
                  style={[styles.chip, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radiusPill }]}
                >
                  <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.chipText, { color: colors.foreground }]}>{code}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}
        <Pressable onPress={() => { setReportCode(''); setReportOpen(true); }} accessibilityRole="button" hitSlop={8} style={styles.reportRow}>
          <Feather name="alert-triangle" size={14} color={colors.accent} />
          <Text style={[styles.reportText, { color: colors.accent }]}>{t('unreg.link')}</Text>
        </Pressable>
        <PrimaryButton
          label={t('scan.enterCode')}
          icon="hash"
          onPress={() => {
            setError(null);
            setCodeOpen(true);
          }}
        />
      </View>

      <CodeEntrySheet initialCode={initialCode} visible={codeOpen} loading={loading} error={error} canReport={notFound} onReport={(c) => { setReportCode(c); setCodeOpen(false); setTimeout(() => setReportOpen(true), 350); }} onSubmit={resolve} onClose={() => setCodeOpen(false)} />
      <UnregisteredSheet visible={reportOpen} initialCode={reportCode} onClose={() => setReportOpen(false)} />
      <StopSheet resolved={resolved} onClose={() => setResolved(null)} onPay={(stop, note, boardingStop) => resolved && void pay(resolved, stop, note, undefined, boardingStop)} />
      <PaymentSheet
        phase={payment?.phase ?? null}
        amount={payment?.stop.amountToPay ?? 0}
        destination={payment?.stop.name ?? ''}
        message={payment?.message}
        simulator={payment?.simulator ?? false}
        onRetry={() =>
          payment &&
          void pay(payment.resolved, payment.stop, payment.customNote, payment.phase === 'timeout' && payment.referenceId && payment.tripId ? { referenceId: payment.referenceId, tripId: payment.tripId } : undefined, payment.boarding)
        }
        onClose={() => setPayment(null)}
      />
    </View>
  );
}

const CORNER = 34;
const styles = StyleSheet.create({
  root: { flex: 1 },
  wash: { position: 'absolute', top: 0, left: 0, right: 0, height: 320 },
  top: { paddingHorizontal: 24 },
  title: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 32, letterSpacing: -0.8, marginTop: 14 },
  subtitle: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 15, lineHeight: 22, marginTop: 6 },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  viewfinder: { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth * 2 },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 36 },
  placeholderIcon: { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  brackets: { ...StyleSheet.absoluteFillObject, margin: 22 },
  corner: { position: 'absolute', width: CORNER, height: CORNER },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 18 },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 18 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 18 },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 18 },
  scanLine: { position: 'absolute', left: 14, right: 14, top: -22, height: 2.5, borderRadius: 2, opacity: 0.85, shadowOpacity: 0.9, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
  permissionText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, lineHeight: 21, textAlign: 'center' },
  permissionLink: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15 },
  bottom: { paddingHorizontal: 24 },
  reportRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 14 },
  reportText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13 },
  chipsLabel: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, letterSpacing: 1.6, marginBottom: 10 },
  chipsWrap: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  chip: { flex: 1, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth * 2, paddingHorizontal: 4, paddingVertical: 11 },
  chipText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, letterSpacing: 1.2 },
});
