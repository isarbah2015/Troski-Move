import React, { useCallback, useRef, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import type { ResolvedVehicle } from '@trotrolink/shared';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CodeEntrySheet } from '@/components/CodeEntrySheet';
import { StopSheet } from '@/components/StopSheet';
import { useColors } from '@/hooks/useColors';
import { colors as tokens } from '@/lib/colors';
import { api, VehicleNotFoundError } from '@/lib/api';
import { saveActiveTrip } from '@/lib/storage';
import { showToast } from '@/lib/toast';
import { buildTrip } from '@/lib/trip';

const FRAME = 260;
// Demo codes for web / simulators that have no camera.
const DEMO_CODES = ['CIR01', 'CIR02', 'MAD05', 'TEM03'];
const SHOW_DEMO = Platform.OS === 'web' || __DEV__;

export default function ScanScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
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

  const scanning = focused && !resolved && !codeOpen && permission?.granted;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
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
        <Text style={[styles.title, { color: tokens.textPrimary }]}>Scan to ride</Text>
        <Text style={[styles.subtitle, { color: tokens.textSecondary }]}>Point at the QR sticker inside the trotro</Text>
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
              {permission.canAskAgain ? 'Allow camera access to scan the QR code.' : 'Camera is off. Enable it in Settings, or enter the short code.'}
            </Text>
            <Pressable
              onPress={() => (permission.canAskAgain ? requestPermission() : Linking.openSettings())}
              accessibilityRole="button"
              hitSlop={8}
            >
              <Text style={[styles.permissionLink, { color: colors.primary }]}>{permission.canAskAgain ? 'Allow' : 'Settings'}</Text>
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
          <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>Enter short code</Text>
        </Pressable>
      </View>

      <CodeEntrySheet visible={codeOpen} loading={loading} error={error} onSubmit={resolve} onClose={() => setCodeOpen(false)} />
      <StopSheet
        resolved={resolved}
        onClose={() => setResolved(null)}
        onPay={async (stop) => {
          if (!resolved) return;
          // TODO: Wire to MTN MoMo sandbox — see apps/api/src/services/momo.ts
          await saveActiveTrip(buildTrip(resolved, stop));
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setResolved(null);
          showToast('Payment successful');
          router.navigate('/trip');
        }}
      />
    </View>
  );
}

const CORNER = 36;
const styles = StyleSheet.create({
  root: { flex: 1 },
  dim: { backgroundColor: `${tokens.background}73` },
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
