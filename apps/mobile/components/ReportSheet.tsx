import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { DisputeReason } from '@trotrolink/shared';
import { useColors } from '@/hooks/useColors';
import { SCRIM } from '@/lib/colors';

export const REPORT_REASONS: ReadonlyArray<{ key: DisputeReason; label: string; hint: string; icon: React.ComponentProps<typeof Feather>['name'] }> = [
  { key: 'overcharge', label: 'Overcharge', hint: 'I was asked to pay more than the official fare', icon: 'alert-circle' },
  { key: 'route_deviation', label: 'Route deviation', hint: 'The trotro left its route', icon: 'shuffle' },
  { key: 'safety_concern', label: 'Safety concern', hint: 'Unsafe driving or behaviour', icon: 'shield' },
  { key: 'forced_early_alighting', label: 'Forced early alighting', hint: 'I was made to get off before my stop', icon: 'log-out' },
];

export type ReportReason = DisputeReason;

type Props = { visible: boolean; onSubmit: (reason: DisputeReason, description?: string) => void | Promise<void>; onClose: () => void };

/** Step 1: pick what went wrong. Step 2: add an optional note and send. */
export function ReportSheet({ visible, onSubmit, onClose }: Props) {
  const colors = useColors();
  const [reason, setReason] = useState<DisputeReason | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) {
      setReason(null);
      setNote('');
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
          <Text style={[styles.title, { color: colors.foreground }]}>Report an issue</Text>
          {!chosen ? (
            <>
              <Text style={[styles.sub, { color: colors.mutedForeground }]}>What went wrong on this trip?</Text>
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
              <Pressable
                disabled={busy}
                onPress={async () => {
                  setBusy(true);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  await onSubmit(chosen.key, note.trim() || undefined);
                }}
                accessibilityRole="button"
                style={[styles.send, { backgroundColor: colors.primary, opacity: busy ? 0.5 : 1, borderRadius: colors.radiusPill }]}
              >
                <Text style={[styles.sendText, { color: colors.primaryForeground }]}>Send report</Text>
              </Pressable>
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
  sheet: { padding: 24, paddingBottom: 40, borderWidth: 1, borderBottomWidth: 0 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 20 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 22, marginBottom: 4 },
  sub: { fontFamily: 'Inter_400Regular', fontSize: 14, marginBottom: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, padding: 14, marginBottom: 10 },
  iconWrap: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1 },
  rowTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 16 },
  rowHint: { fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 2 },
  chosen: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, padding: 14, marginTop: 14 },
  chosenText: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 16 },
  change: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  input: { borderWidth: 1, minHeight: 90, padding: 14, marginTop: 12, fontFamily: 'Inter_400Regular', fontSize: 15, textAlignVertical: 'top' },
  fine: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17, marginTop: 10 },
  send: { height: 56, marginTop: 18, alignItems: 'center', justifyContent: 'center' },
  sendText: { fontFamily: 'Inter_700Bold', fontSize: 17 },
});
