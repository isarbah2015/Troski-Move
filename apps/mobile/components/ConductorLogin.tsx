import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ApiError } from '@trotrolink/api-client';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { api } from '@/lib/api';
import { saveSession } from '@/lib/conductorSession';
import { getConductorVehicleCode, setRole } from '@/lib/storage';
import { PrimaryButton } from '@/components/PrimaryButton';

type Mode = 'login' | 'setup';

/** Conductor sign-in: vehicle code + 4-digit PIN. First time, the conductor chooses the PIN. */
export function ConductorLogin() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [code, setCode] = useState('');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [setupCode, setSetupCode] = useState('');
  const [needsSetupCode, setNeedsSetupCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Pre-fill the last vehicle on this phone.
  React.useEffect(() => {
    void getConductorVehicleCode().then((c) => setCode((prev) => prev || c));
  }, []);

  const setup = mode === 'setup';
  const ready = code.trim().length >= 3 && /^\d{4}$/.test(pin) && (!setup || confirm === pin) && !busy;

  const submit = async () => {
    if (!ready) return;
    setBusy(true);
    setError(null);
    const vehicleCode = code.trim().toUpperCase();
    try {
      if (setup) await api.conductorSetup({ vehicleCode, pin, ...(setupCode ? { setupCode } : {}) });
      const session = await api.conductorLogin({ vehicleCode, pin });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await saveSession(session);
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const message = e instanceof ApiError ? e.message : "Couldn't reach the server. Check your connection.";
      if (e instanceof ApiError && e.status === 403 && /setup code/i.test(message)) setNeedsSetupCode(true);
      setError(message);
      setPin('');
      setConfirm('');
    } finally {
      setBusy(false);
    }
  };

  const field = (focus?: boolean) => [styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: error && focus ? colors.destructive : colors.border, borderRadius: colors.radius, ...colors.elevation }];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <View style={[styles.badge, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radiusModal }]}>
          <Feather name="lock" size={28} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>{setup ? 'Set your PIN' : 'Conductor sign-in'}</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          {setup ? 'Choose a 4-digit PIN for your vehicle. You will use it every shift.' : 'Enter your vehicle code and PIN to start your shift.'}
        </Text>

        <Text style={[styles.label, { color: colors.mutedForeground }]}>VEHICLE CODE</Text>
        <TextInput value={code} onChangeText={(t) => setCode(t.toUpperCase())} autoCapitalize="characters" autoCorrect={false} placeholder="CIR01" placeholderTextColor={colors.mutedForeground} maxLength={12} accessibilityLabel="Vehicle code" style={field()} />

        <Text style={[styles.label, { color: colors.mutedForeground }]}>{setup ? 'CHOOSE A 4-DIGIT PIN' : '4-DIGIT PIN'}</Text>
        <TextInput value={pin} onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" secureTextEntry maxLength={4} placeholder="••••" placeholderTextColor={colors.mutedForeground} accessibilityLabel="PIN" style={[...field(true), styles.pin]} />

        {setup ? (
          <>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>CONFIRM PIN</Text>
            <TextInput value={confirm} onChangeText={(t) => setConfirm(t.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" secureTextEntry maxLength={4} placeholder="••••" placeholderTextColor={colors.mutedForeground} accessibilityLabel="Confirm PIN" style={[...field(), styles.pin]} />
            {confirm.length === 4 && confirm !== pin ? <Text style={[styles.error, { color: colors.destructive }]}>The PINs don&apos;t match.</Text> : null}
          </>
        ) : null}

        {setup && needsSetupCode ? (
          <>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>SETUP CODE FROM THE UNION</Text>
            <TextInput value={setupCode} onChangeText={setSetupCode} autoCapitalize="none" autoCorrect={false} accessibilityLabel="Setup code" style={field()} />
          </>
        ) : null}

        {error ? <Text style={[styles.error, { color: colors.destructive }]} accessibilityRole="alert">{error}</Text> : null}

        <PrimaryButton onPress={() => void submit()} disabled={!ready} loading={busy} label={setup ? 'Set PIN and sign in' : 'Sign in'} style={styles.cta} />

        <Pressable
          onPress={() => {
            setMode(setup ? 'login' : 'setup');
            setError(null);
            setPin('');
            setConfirm('');
          }}
          accessibilityRole="button"
          style={styles.link}
        >
          <Text style={[styles.linkText, { color: colors.primary }]}>{setup ? 'I already have a PIN' : 'First time? Set up your PIN'}</Text>
        </Pressable>

        <Pressable
          onPress={async () => {
            await setRole('passenger');
            router.navigate('/');
          }}
          accessibilityRole="button"
          style={styles.link}
        >
          <Text style={[styles.linkText, { color: colors.mutedForeground }]}>Switch to Passenger</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 24 },
  badge: { width: 72, height: 72, borderWidth: StyleSheet.hairlineWidth * 2, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title: { fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -0.8, fontSize: 30 },
  sub: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 15, lineHeight: 22, marginTop: 6, marginBottom: 8 },
  label: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, letterSpacing: 1.3, marginTop: 20, marginBottom: 8 },
  input: { borderWidth: StyleSheet.hairlineWidth * 2, height: 56, paddingHorizontal: 16, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 18 },
  pin: { letterSpacing: 10, textAlign: 'center', fontSize: 24 },
  error: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, marginTop: 12 },
  cta: { marginTop: 28 },
  ctaText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 17 },
  link: { alignSelf: 'center', paddingVertical: 14 },
  linkText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15 },
});
