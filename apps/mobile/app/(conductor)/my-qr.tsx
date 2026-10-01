import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Print from 'expo-print';
import { useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import QRCode from 'react-native-qrcode-svg';
import { captureRef } from 'react-native-view-shot';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { encodeQrPayload } from '@trotrolink/shared';
import { useColors } from '@/hooks/useColors';
import { useConductorVehicle } from '@/lib/conductor';
import { getQrState, saveQrState, type QrState } from '@/lib/storage';
import { showToast } from '@/lib/toast';
import { QR_BG, QR_FG, SILVER } from '@/lib/colors';
import { PrimaryButton } from '@/components/PrimaryButton';

const QR_SIZE = 240;

export default function MyQrScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data, loading, error, reload } = useConductorVehicle();
  const [qr, setQr] = useState<QrState>({ version: 1, printedAt: null });
  const [busy, setBusy] = useState<'download' | 'print' | null>(null);
  const stickerRef = useRef<View>(null);

  useFocusEffect(
    useCallback(() => {
      void getQrState().then(setQr);
    }, []),
  );

  const markPrinted = async () => {
    const next = { ...qr, printedAt: new Date().toISOString().slice(0, 10) };
    setQr(next);
    await saveQrState(next);
  };

  const download = async () => {
    if (busy || !stickerRef.current) return;
    setBusy('download');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const uri = await captureRef(stickerRef, { format: 'png', quality: 1, result: 'tmpfile' });
      if (!(await Sharing.isAvailableAsync())) {
        showToast('Sharing is not available on this device');
        return;
      }
      // The iOS share sheet includes "Save Image" for the gallery.
      await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Save your TrotroLink QR' });
      await markPrinted();
    } catch {
      showToast("Couldn't export the QR. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const print = async () => {
    if (busy || !stickerRef.current || !data) return;
    setBusy('print');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const base64 = await captureRef(stickerRef, { format: 'png', quality: 1, result: 'base64' });
      const html = `<html><body style="margin:0;display:flex;flex-direction:column;align-items:center;font-family:-apple-system,Helvetica,sans-serif;padding:48px">
        <img src="data:image/png;base64,${base64}" style="width:420px" />
        <p style="font-size:18px;color:#0B1220;margin-top:24px">${data.route.name}</p>
        <p style="font-size:14px;color:#475569">Hold your phone 5–10 cm from the QR code to scan.</p></body></html>`;
      await Print.printAsync({ html });
      await markPrinted();
    } catch {
      // Dismissing the print dialog rejects; nothing to report.
    } finally {
      setBusy(null);
    }
  };

  const regenerate = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert('Regenerate QR code?', 'Your current sticker stops being the latest version. You will need to print and replace it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Regenerate',
        style: 'destructive',
        onPress: async () => {
          // TODO: POST /api/vehicles/:id/regenerate-qr so the server retires the old version.
          const next = { version: qr.version + 1, printedAt: null };
          setQr(next);
          await saveQrState(next);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          showToast(`QR code version ${next.version} ready`);
        },
      },
    ]);
  };

  const card = { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, ...colors.elevation };
  const via = data ? data.route.stops.slice(1, -1).map((s) => s.name).join(' – ') : '';

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16 }]} showsVerticalScrollIndicator={false}>
      <Text style={[styles.title, { color: colors.foreground }]}>My QR code</Text>

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
          {/* White sticker: this exact view is what gets exported and printed. */}
          <View ref={stickerRef} collapsable={false} style={[styles.sticker, { borderRadius: colors.radius }]}>
            <QRCode
              value={encodeQrPayload({ vehicleId: data.vehicle.id, shortCode: data.vehicle.shortCode, routeId: data.route.routeId, version: qr.version })}
              size={QR_SIZE}
              color={QR_FG}
              backgroundColor={QR_BG}
            />
            <Text style={styles.stickerLabel}>SHORT CODE</Text>
            <Text style={styles.stickerCode} accessibilityLabel={`Short code ${data.vehicle.shortCode.split('').join(' ')}`}>{data.vehicle.shortCode}</Text>
          </View>

          <View style={styles.routeBox}>
            <Text style={[styles.routeLine, { color: colors.foreground }]}>Route: {data.route.origin} → {data.route.destination}</Text>
            {via ? <Text style={[styles.via, { color: colors.mutedForeground }]}>Via: {via}</Text> : null}
          </View>

          <View style={styles.actions}>
            <PrimaryButton onPress={() => void download()} disabled={busy !== null && busy !== 'download'} loading={busy === 'download'} icon="download" label="Download" style={styles.action} />
            <PrimaryButton variant="ghost" onPress={() => void print()} disabled={busy !== null && busy !== 'print'} loading={busy === 'print'} icon="printer" label="Print" style={styles.action} />
          </View>

          <View style={[styles.warning, { borderColor: colors.accent, borderRadius: colors.radius }]}>
            <Feather name="alert-triangle" size={18} color={colors.accent} />
            <View style={styles.warningText}>
              <Text style={[styles.warningTitle, { color: colors.accent }]}>Hold 5–10 cm from the camera</Text>
              <Text style={[styles.warningBody, { color: colors.accent }]}>Print it as a sticker for the dashboard. Sticker torn or lost? Show this screen: it works the same.</Text>
            </View>
          </View>

          <Pressable onPress={regenerate} accessibilityRole="button" style={[styles.regen, { borderColor: colors.destructive, borderRadius: colors.radiusPill }]}>
            <Feather name="refresh-cw" size={18} color={colors.destructive} />
            <Text style={[styles.regenText, { color: colors.destructive }]}>Regenerate QR code</Text>
          </Pressable>
          <Text style={[styles.version, { color: colors.mutedForeground }]}>
            Version {qr.version} · {qr.printedAt ? `Printed ${qr.printedAt}` : 'Not printed yet'}
          </Text>
        </>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 24, paddingBottom: 132 },
  title: { fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -0.8, fontSize: 32, marginBottom: 20 },
  center: { paddingVertical: 80, alignItems: 'center' },
  errorCard: { borderWidth: StyleSheet.hairlineWidth * 2, padding: 24, alignItems: 'center', gap: 12 },
  errorText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, textAlign: 'center' },
  retry: { height: 44, paddingHorizontal: 24, borderWidth: StyleSheet.hairlineWidth * 2, alignItems: 'center', justifyContent: 'center' },
  retryText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15 },
  sticker: { alignSelf: 'center', alignItems: 'center', backgroundColor: QR_BG, padding: 24 },
  stickerLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, letterSpacing: 2, color: SILVER, marginTop: 20 },
  stickerCode: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 44, letterSpacing: 12, color: QR_FG, marginTop: 4, paddingLeft: 12 },
  routeBox: { marginTop: 20, alignItems: 'center' },
  routeLine: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 16 },
  via: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, marginTop: 4, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  action: { flex: 1 },
  actionText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15 },
  warning: { flexDirection: 'row', gap: 12, borderWidth: StyleSheet.hairlineWidth * 2, padding: 14, marginTop: 20 },
  warningText: { flex: 1 },
  warningTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13 },
  warningBody: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, marginTop: 2, lineHeight: 17 },
  regen: { marginTop: 28, height: 56, borderWidth: StyleSheet.hairlineWidth * 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  regenText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16 },
  version: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, textAlign: 'center', marginTop: 12 },
});
