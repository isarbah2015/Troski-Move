import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { DisputeReason } from '@trotrolink/shared';
import { useColors } from '@/hooks/useColors';
import { SCRIM } from '@/lib/colors';
import { useT } from '@/lib/i18n';
import { PrimaryButton } from '@/components/PrimaryButton';

export const REPORT_REASONS: ReadonlyArray<{ key: DisputeReason; label: string; hint: string; icon: React.ComponentProps<typeof Feather>['name'] }> = [
  { key: 'overcharge', label: 'Overcharge', hint: 'I was asked to pay more than the official fare', icon: 'alert-circle' },
  { key: 'route_deviation', label: 'Route deviation', hint: 'The trotro left its route', icon: 'shuffle' },
  { key: 'safety_concern', label: 'Safety concern', hint: 'Unsafe driving or behaviour', icon: 'shield' },
  { key: 'forced_early_alighting', label: 'Forced early alighting', hint: 'I was made to get off before my stop', icon: 'log-out' },
];

export type ReportReason = DisputeReason;

type Props = { visible: boolean; onSubmit: (reason: DisputeReason, description?: string, amountAsked?: number) => void | Promise<void>; onClose: () => void };

/** Step 1: pick what went wrong. Step 2: add an optional note and send. */
export function ReportSheet({ visible, onSubmit, onClose }: Props) {
  const colors = useColors();
  const t = useT();
  const [reason, setReason] = useState<DisputeReason | null>(null);
  const [note, setNote] = useState('');
  const [asked, setAsked] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) {
      setReason(null);
      setNote('');
      setAsked('');
      setBusy(false);
    }
  }, [visible]);

  const chosen = REPORT_REASONS.find((r) => r.key === reason);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
        <Pressable style={[styles.scrim, { backgroundColor: SCRIM }]} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border, borderTopLeftRadius: colors.radiusModal, borderTopRightRadius: colors.radiusModal }]}>
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          <Text style={[styles.title, { color: colors.foreground }]}>{t('report.title')}</Text>
          {!chosen ? (
            <>
              <Text style={[styles.sub, { color: colors.mutedForeground }]}>{t('report.what')}</Text>
              {REPORT_REASONS.map((r) => (
                <Pressable
                  key={r.key}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setReason(r.key);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${r.label}. ${r.hint}`}
                  style={[styles.row, { borderColor: colors.border, borderRadius: colors.radius }]}
                >
                  <View style={[styles.iconWrap, { backgroundColor: colors.background, borderRadius: colors.radius }]}>
                    <Feather name={r.icon} size={20} color={colors.accent} />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={[styles.rowTitle, { color: colors.foreground }]}>{r.label}</Text>
                    <Text style={[styles.rowHint, { color: colors.mutedForeground }]}>{r.hint}</Text>
                  </View>
                  <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
                </Pressable>
              ))}
            </>
          ) : (
            <>
              <View style={[styles.chosen, { backgroundColor: colors.background, borderColor: colors.border, borderRadius: colors.radius }]}>
                <Feather name={chosen.icon} size={18} color={colors.accent} />
                <Text style={[styles.chosenText, { color: colors.foreground }]}>{chosen.label}</Text>
                <Pressable onPress={() => setReason(null)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Change reason">
                  <Text style={[styles.change, { color: colors.primary }]}>Change</Text>
                </Pressable>
              </View>
              {chosen.key === 'overcharge' ? (
                <TextInput
                  value={asked}
                  onChangeText={(v) => setAsked(v.replace(/[^\d.]/g, '').slice(0, 6))}
                  placeholder={t('report.asked')}
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="decimal-pad"
                  accessibilityLabel={t('report.asked')}
                  style={[styles.input, styles.amount, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border, borderRadius: colors.radius }]}
                />
              ) : null}
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Add a note (optional)"
                placeholderTextColor={colors.mutedForeground}
                multiline
                maxLength={300}
                accessibilityLabel="Note (optional)"
                style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border, borderRadius: colors.radius }]}
              />
              <Text style={[styles.fine, { color: colors.mutedForeground }]}>We attach your trip, the vehicle and its stop history automatically.</Text>
              <PrimaryButton
                loading={busy}
                onPress={async () => {
                  setBusy(true);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  const amount = chosen.key === 'overcharge' && Number(asked) > 0 ? Number(asked) : undefined;
                  await onSubmit(chosen.key, note.trim() || undefined, amount);
                }}
                label={t('report.send')}
                style={styles.send}
              />
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFillObject },
  sheet: { padding: 24, paddingBottom: 40, borderWidth: StyleSheet.hairlineWidth * 2, borderBottomWidth: 0 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 20 },
  title: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 22, marginBottom: 4 },
  sub: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, marginBottom: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: StyleSheet.hairlineWidth * 2, padding: 14, marginBottom: 10 },
  iconWrap: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1 },
  rowTitle: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 16 },
  rowHint: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, marginTop: 2 },
  chosen: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: StyleSheet.hairlineWidth * 2, padding: 14, marginTop: 14 },
  chosenText: { flex: 1, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 16 },
  change: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14 },
  input: { borderWidth: StyleSheet.hairlineWidth * 2, minHeight: 90, padding: 14, marginTop: 12, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 15, textAlignVertical: 'top' },
  amount: { minHeight: 0, paddingVertical: 14 },
  fine: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, lineHeight: 17, marginTop: 10 },
  send: { marginTop: 18 },
  sendText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 17 },
});
