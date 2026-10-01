import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Linking, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { DisputeReason } from '@trotrolink/shared';
import { useColors } from '@/hooks/useColors';
import { SCRIM } from '@/lib/colors';
import { useT } from '@/lib/i18n';
import { PrimaryButton } from '@/components/PrimaryButton';

export const REPORT_REASONS: ReadonlyArray<{ key: DisputeReason; label: string; hint: string; icon: React.ComponentProps<typeof Feather>['name'] }> = [
  { key: 'accident', label: 'Accident', hint: 'There has been an accident', icon: 'alert-octagon' },
  { key: 'careless_driving', label: 'Careless driving', hint: 'The driver is speeding or driving dangerously', icon: 'zap' },
  { key: 'overcharge', label: 'Overcharge', hint: 'I was asked to pay more than the official fare', icon: 'alert-circle' },
  { key: 'route_deviation', label: 'Route deviation', hint: 'The trotro left its route', icon: 'shuffle' },
  { key: 'safety_concern', label: 'Safety concern', hint: 'Unsafe driving or behaviour', icon: 'shield' },
  { key: 'forced_early_alighting', label: 'Forced early alighting', hint: 'I was made to get off before my stop', icon: 'log-out' },
];

export type ReportReason = DisputeReason;

type Props = { visible: boolean; initialReason?: DisputeReason | null; onSubmit: (reason: DisputeReason, description?: string, amountAsked?: number) => void | Promise<void>; onClose: () => void };

/** Step 1: pick what went wrong. Step 2: add an optional note and send. */
/** Ghana's emergency numbers: 112 (all emergencies), 193 (ambulance), 191 (police). */
const EMERGENCY = [
  { label: 'Call 112', sub: 'Emergency', number: '112' },
  { label: 'Ambulance', sub: '193', number: '193' },
  { label: 'Police', sub: '191', number: '191' },
] as const;
const SUPPORT_PHONE = process.env.EXPO_PUBLIC_GPRTU_SUPPORT_PHONE;

export function ReportSheet({ visible, initialReason = null, onSubmit, onClose }: Props) {
  const colors = useColors();
  const t = useT();
  const [reason, setReason] = useState<DisputeReason | null>(null);
  const [note, setNote] = useState('');
  const [asked, setAsked] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible && initialReason) setReason(initialReason);
  }, [visible, initialReason]);

  useEffect(() => {
    if (!visible) {
      setReason(null);
      setNote('');
      setAsked('');
      setBusy(false);
    }
  }, [visible]);

  const chosen = REPORT_REASONS.find((r) => r.key === reason);
  const urgent = chosen?.key === 'accident' || chosen?.key === 'careless_driving';

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
              {chosen.key === 'accident' ? (
                <View style={[styles.sos, { borderColor: colors.destructive, borderRadius: colors.radius }]}>
                  <Text style={[styles.sosTitle, { color: colors.destructive }]}>{t('sos.hurt')}</Text>
                  <View style={styles.sosRow}>
                    {EMERGENCY.map((e) => (
                      <Pressable key={e.number} onPress={() => void Linking.openURL(`tel:${e.number}`)} accessibilityRole="button" accessibilityLabel={`${e.label} ${e.sub}`} style={[styles.sosBtn, { backgroundColor: colors.destructive, borderRadius: colors.radius }]}>
                        <Feather name="phone" size={16} color="#FFFFFF" />
                        <Text style={styles.sosBtnText}>{e.label}</Text>
                        <Text style={styles.sosBtnSub}>{e.sub}</Text>
                      </Pressable>
                    ))}
                  </View>
                  {SUPPORT_PHONE ? (
                    <Pressable onPress={() => void Linking.openURL(`tel:${SUPPORT_PHONE}`)} accessibilityRole="button" style={styles.supportLink}>
                      <Feather name="headphones" size={15} color={colors.primary} />
                      <Text style={[styles.supportText, { color: colors.primary }]}>{t('sos.callGprtu')}</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
              {urgent ? <Text style={[styles.live, { color: colors.mutedForeground }]}>{t('sos.live')}</Text> : null}
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
                label={urgent ? t('sos.send') : t('report.send')}
                icon={urgent ? 'send' : undefined}
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
  sos: { borderWidth: StyleSheet.hairlineWidth * 2, padding: 14, marginTop: 12 },
  sosTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, marginBottom: 10 },
  sosRow: { flexDirection: 'row', gap: 8 },
  sosBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 2 },
  sosBtnText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: '#FFFFFF' },
  sosBtnSub: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, color: 'rgba(255,255,255,0.85)' },
  supportLink: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  supportText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14 },
  live: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, lineHeight: 19, marginTop: 12 },
  amount: { minHeight: 0, paddingVertical: 14 },
  fine: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, lineHeight: 17, marginTop: 10 },
  send: { marginTop: 18 },
  sendText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 17 },
});
