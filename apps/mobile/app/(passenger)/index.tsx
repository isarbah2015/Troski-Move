import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import type { ResolvedVehicle, Stop } from '@trotrolink/shared';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CodeEntrySheet } from '@/components/CodeEntrySheet';
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
import { CAMERA_DIM, SILVER, WHITE } from '@/lib/colors';
import { useT } from '@/lib/i18n';

type PaymentState = { phase: PaymentPhase; resolved: ResolvedVehicle; stop: Stop; simulator: boolean; message?: string; referenceId?: string; tripId?: string; customNote?: string };

const FRAME = 260;
// Demo codes for web / simulators that have no camera.
const DEMO_CODES = ['CIR01', 'CIR02', 'MAD05', 'TEM03'];
const SHOW_DEMO = Platform.OS === 'web' || __DEV__ || DEMO_MODE;

export default function ScanScreen() {
  const t = useT();
  const colors = useColors('dark'); // the camera screen is dark in both themes
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
  const busy = useRef(false);
  const paying = useRef(false);
  const [payment, setPayment] = useState<PaymentState | null>(null);

  const resolve = useCallback(async (code: string) => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setError(null);
    try {
      const result = await api.resolveVehicle(code);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCodeOpen(false);
      setResolved(result);
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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
  const finishPaid = async (res: ResolvedVehicle, stop: Stop, tripId: string, customNote?: string) => {
    const trip = buildTrip(res, stop, tripId, customNote);
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

  const pay = async (res: ResolvedVehicle, stop: Stop, customNote?: string, previous?: { referenceId: string; tripId: string }) => {
    if (paying.current) return;
    paying.current = true;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      // iOS cannot present a second modal over the stop sheet: close it first and let it finish animating.
      if (resolved) {
        setResolved(null);
        await new Promise((r) => setTimeout(r, 450));
      }
      setPayment({ phase: 'sending', resolved: res, stop, simulator: false, customNote });

      // A timed-out request may still have been approved: check it before charging again, so a retry never double-charges.
      if (previous) {
        try {
          if ((await api.paymentStatus(previous.referenceId)).status === 'SUCCESSFUL') {
            await finishPaid(res, stop, previous.tripId, customNote);
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
        boardingStop: res.route.stops[0]!.name,
        tripId,
        customStopNote: customNote,
        onPending: ({ referenceId, simulator, tripId: serverTripId }) => setPayment((p) => (p ? { ...p, phase: 'pending', simulator, referenceId, tripId: serverTripId } : p)),
      });
      if (outcome.kind === 'success') {
        await finishPaid(res, stop, outcome.tripId, customNote);
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

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {focused ? <StatusBar style="light" /> : null}
      {permission?.granted && focused ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={scanning ? ({ data }) => { void resolve(data); } : undefined}
        />
      ) : null}
      <View style={[StyleSheet.absoluteFill, styles.dim]} pointerEvents="none" />

      <View style={[styles.top, { paddingTop: insets.top + 16 }]}>
        <DemoBadge force="dark" />
        <Text style={[styles.title, { color: WHITE }]}>{t('scan.title')}</Text>
        <Text style={[styles.subtitle, { color: SILVER }]}>{t('scan.subtitle')}</Text>
      </View>

      <View style={styles.center} pointerEvents="none">
        <View style={styles.frame}>
          {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
            <View key={c} style={[styles.corner, styles[c], { borderColor: colors.primary }]} />
          ))}
        </View>
      </View>


      <View style={[styles.bottom, { paddingBottom: insets.bottom + 24 }]}>
        {permission && !permission.granted ? (
          <View style={[styles.permission, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <Feather name="camera-off" size={20} color={colors.mutedForeground} />
            <Text style={[styles.permissionText, { color: colors.mutedForeground }]}>
              {permission.canAskAgain ? t('scan.allowCamera') : 'Camera is off. Enable it in Settings, or enter the short code.'}
            </Text>
            <Pressable
              onPress={() => (permission.canAskAgain ? requestPermission() : Linking.openSettings())}
              accessibilityRole="button"
              hitSlop={8}
            >
              <Text style={[styles.permissionLink, { color: colors.primary }]}>{permission.canAskAgain ? t('scan.allow') : 'Settings'}</Text>
            </Pressable>
          </View>
        ) : null}
        {SHOW_DEMO ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipsRow}>
            {DEMO_CODES.map((code) => (
              <Pressable
                key={code}
                onPress={() => { Haptics.selectionAsync(); void resolve(code); }}
                accessibilityRole="button"
                accessibilityLabel={`Use demo code ${code}`}
                style={[styles.chip, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radiusPill }]}
              >
                <Text style={[styles.chipText, { color: colors.foreground }]}>{code}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setError(null);
            setCodeOpen(true);
          }}
          accessibilityRole="button"
          style={[styles.cta, { backgroundColor: colors.primary, borderRadius: colors.radiusPill }]}
        >
          <Feather name="hash" size={18} color={colors.primaryForeground} />
          <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>{t('scan.enterCode')}</Text>
        </Pressable>
      </View>

      <CodeEntrySheet initialCode={initialCode} visible={codeOpen} loading={loading} error={error} onSubmit={resolve} onClose={() => setCodeOpen(false)} />
      <StopSheet resolved={resolved} onClose={() => setResolved(null)} onPay={(stop, note) => resolved && void pay(resolved, stop, note)} />
      <PaymentSheet
        phase={payment?.phase ?? null}
        amount={payment?.stop.amountToPay ?? 0}
        destination={payment?.stop.name ?? ''}
        message={payment?.message}
        simulator={payment?.simulator ?? false}
        onRetry={() =>
          payment &&
          void pay(payment.resolved, payment.stop, payment.customNote, payment.phase === 'timeout' && payment.referenceId && payment.tripId ? { referenceId: payment.referenceId, tripId: payment.tripId } : undefined)
        }
        onClose={() => setPayment(null)}
      />
    </View>
  );
}

const CORNER = 36;
const styles = StyleSheet.create({
  root: { flex: 1 },
  dim: { backgroundColor: CAMERA_DIM },
  top: { paddingHorizontal: 24 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 28 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 15, marginTop: 4 },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  frame: { width: FRAME, height: FRAME },
  corner: { position: 'absolute', width: CORNER, height: CORNER },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 16 },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 16 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 16 },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 16 },
  permission: { marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderWidth: 1 },
  permissionText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 20 },
  permissionLink: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  chipsRow: { flexGrow: 0, marginBottom: 16 },
  chips: { gap: 8 },
  chip: { borderWidth: 1, paddingHorizontal: 16, paddingVertical: 10 },
  chipText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, letterSpacing: 1 },
  bottom: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 24 },
  cta: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  ctaText: { fontFamily: 'Inter_700Bold', fontSize: 17 },
});
