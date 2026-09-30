import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { colors as tokens } from '@/lib/colors';

export const REPORT_REASONS = [
  { key: 'overcharge', label: 'Overcharge', hint: 'I was asked to pay more than the official fare', icon: 'alert-circle' },
  { key: 'route_deviation', label: 'Route deviation', hint: 'The trotro left its route', icon: 'shuffle' },
  { key: 'safety', label: 'Safety concern', hint: 'Unsafe driving or behaviour', icon: 'shield' },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]['key'];

type Props = { visible: boolean; onSelect: (reason: ReportReason) => void; onClose: () => void };

export function ReportSheet({ visible, onSelect, onClose }: Props) {
  const colors = useColors();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={[styles.scrim, { backgroundColor: `${tokens.background}99` }]} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border, borderTopLeftRadius: colors.radiusModal, borderTopRightRadius: colors.radiusModal }]}>
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          <Text style={[styles.title, { color: colors.foreground }]}>Report an issue</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>What went wrong on this trip?</Text>
          {REPORT_REASONS.map((r) => (
            <Pressable
              key={r.key}
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                onSelect(r.key);
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
        </View>
      </View>
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
});
