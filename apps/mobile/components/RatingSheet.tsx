import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { EMERALD, SCRIM, SILVER } from '@/lib/colors';
import { useT } from '@/lib/i18n';

export type RatingTarget = {
  tripId: string;
  vehicleId?: number;
  destination: string;
  driverName: string;
  conductorName: string;
  /** True right after "Confirm alighting"; false when rating an older trip from history. */
  justArrived: boolean;
};

export type RatingResult = { driverRating: number; conductorRating: number; comment?: string };

type Props = {
  target: RatingTarget | null;
  onSubmit: (target: RatingTarget, result: RatingResult) => void | Promise<void>;
  onSkip: (target: RatingTarget) => void | Promise<void>;
};

function StarRow({ label, name, value, onChange }: { label: string; name: string; value: number; onChange: (n: number) => void }) {
  const colors = useColors();
  return (
    <View style={styles.block}>
      <Text style={[styles.section, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.person, { color: colors.foreground }]}>{name}</Text>
      <View style={styles.stars} accessibilityRole="radiogroup">
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            onPress={() => {
              Haptics.selectionAsync();
              onChange(n);
            }}
            hitSlop={6}
            accessibilityRole="radio"
            accessibilityState={{ selected: value === n }}
            accessibilityLabel={`${n} ${n === 1 ? 'star' : 'stars'} for ${label.toLowerCase()}`}
          >
            <Ionicons name={n <= value ? 'star' : 'star-outline'} size={38} color={n <= value ? colors.accent : `${SILVER}66`} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** Bottom sheet: rate the driver and the conductor (1–5 stars each, both required) with an optional comment. */
export function RatingSheet({ target, onSubmit, onSkip }: Props) {
  const colors = useColors();
  const t = useT();
  const [driver, setDriver] = useState(0);
  const [conductor, setConductor] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDriver(0);
    setConductor(0);
    setComment('');
    setBusy(false);
  }, [target?.tripId]);

  const ready = driver >= 1 && conductor >= 1 && !busy;

  return (
    <Modal visible={!!target} transparent animationType="slide" onRequestClose={() => target && void onSkip(target)}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: SCRIM }]} onPress={() => target && void onSkip(target)} accessibilityLabel="Close" />
        {target ? (
          <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border, borderTopLeftRadius: colors.radiusModal, borderTopRightRadius: colors.radiusModal }]}>
            <View style={[styles.grabber, { backgroundColor: colors.border }]} />
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.head}>
                <View style={[styles.badge, { backgroundColor: colors.secondary }]}>
                  <Feather name={target.justArrived ? 'check-circle' : 'star'} size={26} color={EMERALD} />
                </View>
                <Text style={[styles.title, { color: colors.foreground }]}>{target.justArrived ? t('rate.arrived') : t('rate.rateTrip')}</Text>
                <Text style={[styles.dest, { color: colors.primary }]}>{target.destination}</Text>
                <Text style={[styles.sub, { color: colors.mutedForeground }]}>{t('rate.how')}</Text>
              </View>

              <StarRow label={t('rate.driver')} name={target.driverName} value={driver} onChange={setDriver} />
              <StarRow label={t('rate.conductor')} name={target.conductorName} value={conductor} onChange={setConductor} />

              <Text style={[styles.section, { color: colors.mutedForeground, marginTop: 4 }]}>{t('rate.comment').toUpperCase()}</Text>
              <TextInput
                value={comment}
                onChangeText={setComment}
                placeholder="Smooth ride, on time"
                placeholderTextColor={colors.mutedForeground}
                multiline
                maxLength={200}
                accessibilityLabel="Comment (optional)"
                style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border, borderRadius: colors.radius }]}
              />

              <Pressable
                disabled={!ready}
                onPress={async () => {
                  setBusy(true);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  await onSubmit(target, { driverRating: driver, conductorRating: conductor, comment: comment.trim() || undefined });
                }}
                accessibilityRole="button"
                accessibilityState={{ disabled: !ready }}
                style={[styles.submit, { backgroundColor: ready ? colors.primary : colors.muted, borderRadius: colors.radiusPill }]}
              >
                <Text style={[styles.submitText, { color: ready ? colors.primaryForeground : colors.mutedForeground }]}>{t('rate.submit')}</Text>
              </Pressable>

              <Pressable onPress={() => void onSkip(target)} accessibilityRole="button" style={styles.skip}>
                <Text style={[styles.skipText, { color: colors.mutedForeground }]}>{t('rate.skip')}</Text>
              </Pressable>
            </ScrollView>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: { padding: 24, paddingBottom: 28, borderWidth: StyleSheet.hairlineWidth * 2, borderBottomWidth: 0, maxHeight: '92%' },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 16 },
  head: { alignItems: 'center', marginBottom: 20 },
  badge: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 26 },
  dest: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20, marginTop: 4 },
  sub: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 15, marginTop: 6 },
  block: { marginBottom: 18 },
  section: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, letterSpacing: 1.3 },
  person: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 17, marginTop: 4 },
  stars: { flexDirection: 'row', gap: 10, marginTop: 10 },
  input: { borderWidth: StyleSheet.hairlineWidth * 2, minHeight: 84, padding: 14, marginTop: 10, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 15, textAlignVertical: 'top' },
  submit: { height: 56, marginTop: 20, alignItems: 'center', justifyContent: 'center' },
  submitText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 17 },
  skip: { alignSelf: 'center', paddingVertical: 16 },
  skipText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 15 },
});
