import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { ServerTrip } from '@trotrolink/shared';
import { useColors } from '@/hooks/useColors';
import { formatCedis } from '@/lib/api';
import { findPassenger, paxLabel } from '@/lib/board';
import { SCRIM } from '@/lib/colors';

type Props = {
  visible: boolean;
  passengers: ServerTrip[];
  onClose: () => void;
  /** The code did not match anyone paid on this vehicle: the conductor can send it to the union. */
  onReportUnpaid: (code: string) => void;
};

/**
 * "Passenger says they paid": scan the QR on their Trip screen, or type the code under the PAID badge. The answer is one
 * big result: PAID (with where they get off), or NOT FOUND with a single button to report it.
 */
export function VerifySheet({ visible, passengers, onClose, onReportUnpaid }: Props) {
  const colors = useColors();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [code, setCode] = useState('');
  const [checked, setChecked] = useState<{ code: string; trip: ServerTrip | null } | null>(null);

  useEffect(() => {
    if (!visible) {
      setScanning(false);
      setCode('');
      setChecked(null);
    }
  }, [visible]);

  const check = (raw: string) => {
    const trip = findPassenger(passengers, raw);
    Haptics.notificationAsync(trip ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
    setScanning(false);
    setChecked({ code: raw.trim(), trip });
  };

  const startScan = async () => {
    if (!permission?.granted) {
      const r = await requestPermission();
      if (!r.granted) return;
    }
    setChecked(null);
    setScanning(true);
  };

  const ok = checked?.trip ?? null;
  const bad = checked && !checked.trip;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: SCRIM }]} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border, borderTopLeftRadius: colors.radiusModal, borderTopRightRadius: colors.radiusModal }]}>
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" bounces={false}>
            <Text style={[styles.title, { color: colors.foreground }]}>Verify a passenger</Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>Ask them to open their Trip screen. Scan the QR, or type the code next to PAID.</Text>

            {scanning ? (
              <View style={[styles.camera, { borderRadius: colors.radius }]}>
                <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={({ data }) => check(data)} />
              </View>
            ) : (
              <Pressable onPress={() => void startScan()} accessibilityRole="button" style={[styles.scanBtn, { backgroundColor: colors.primary, borderRadius: colors.radiusPill }]}>
                <Feather name="maximize" size={20} color={colors.primaryForeground} />
                <Text style={[styles.scanText, { color: colors.primaryForeground }]}>Scan their QR</Text>
              </Pressable>
            )}

            <View style={styles.or}><Text style={[styles.orText, { color: colors.mutedForeground }]}>or type the code</Text></View>
            <View style={styles.codeRow}>
              <TextInput
                value={code}
                onChangeText={(v) => setCode(v.toUpperCase())}
                placeholder="e.g. K3P5"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="characters"
                autoCorrect={false}
                accessibilityLabel="Trip code"
                onSubmitEditing={() => code.trim().length >= 4 && check(code)}
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background, borderRadius: colors.radius }]}
              />
              <Pressable
                disabled={code.trim().length < 4}
                onPress={() => check(code)}
                accessibilityRole="button"
                style={[styles.checkBtn, { backgroundColor: colors.foreground, borderRadius: colors.radius, opacity: code.trim().length < 4 ? 0.4 : 1 }]}
              >
                <Text style={[styles.checkText, { color: colors.background }]}>Check</Text>
              </Pressable>
            </View>

            {ok ? (
              <View style={[styles.result, { borderColor: colors.primary, backgroundColor: colors.scheme === 'light' ? 'rgba(7,128,90,0.08)' : 'rgba(43,217,159,0.10)', borderRadius: colors.radius }]} accessibilityRole="alert">
                <Feather name="check-circle" size={34} color={colors.primary} />
                <Text style={[styles.resultTitle, { color: colors.primary }]}>PAID</Text>
                <Text style={[styles.resultBody, { color: colors.foreground }]}>{paxLabel(ok.tripId)} → {ok.alightingStop}</Text>
                <Text style={[styles.resultMeta, { color: colors.mutedForeground }]}>{formatCedis(ok.amountPaid)} · {ok.tripId}</Text>
              </View>
            ) : null}
            {bad ? (
              <View style={[styles.result, { borderColor: colors.destructive, backgroundColor: 'rgba(224,60,60,0.08)', borderRadius: colors.radius }]} accessibilityRole="alert">
                <Feather name="alert-octagon" size={34} color={colors.destructive} />
                <Text style={[styles.resultTitle, { color: colors.destructive }]}>NOT FOUND</Text>
                <Text style={[styles.resultBody, { color: colors.foreground }]}>No paid trip on this vehicle matches that code.</Text>
                <Pressable
                  onPress={() => {
                    onReportUnpaid(checked!.code);
                    onClose();
                  }}
                  accessibilityRole="button"
                  style={[styles.reportBtn, { backgroundColor: colors.destructive, borderRadius: colors.radiusPill }]}
                >
                  <Text style={styles.reportText}>Report unpaid</Text>
                </Pressable>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: { padding: 24, paddingBottom: 32, maxHeight: '92%', borderWidth: StyleSheet.hairlineWidth * 2, borderBottomWidth: 0 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 16 },
  title: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 24, letterSpacing: -0.4 },
  sub: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, lineHeight: 20, marginTop: 4, marginBottom: 16 },
  camera: { height: 230, overflow: 'hidden' },
  scanBtn: { height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  scanText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 17 },
  or: { alignItems: 'center', marginVertical: 14 },
  orText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, letterSpacing: 0.6 },
  codeRow: { flexDirection: 'row', gap: 10 },
  input: { flex: 1, height: 54, borderWidth: StyleSheet.hairlineWidth * 2, paddingHorizontal: 16, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, letterSpacing: 2 },
  checkBtn: { height: 54, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center' },
  checkText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16 },
  result: { marginTop: 18, borderWidth: 2, padding: 20, alignItems: 'center', gap: 6 },
  resultTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 30, letterSpacing: 1 },
  resultBody: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 16, textAlign: 'center' },
  resultMeta: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13 },
  reportBtn: { marginTop: 10, height: 50, paddingHorizontal: 28, alignItems: 'center', justifyContent: 'center' },
  reportText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: '#FFFFFF' },
});
