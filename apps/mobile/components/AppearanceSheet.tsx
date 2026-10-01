import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { ThemePreference } from '@trotrolink/shared';
import { useColors } from '@/hooks/useColors';
import { SCRIM } from '@/lib/colors';

const OPTIONS: ReadonlyArray<{ key: ThemePreference; label: string; hint: string; icon: React.ComponentProps<typeof Feather>['name'] }> = [
  { key: 'system', label: 'System', hint: 'Match your phone', icon: 'smartphone' },
  { key: 'light', label: 'Light', hint: 'Bright, for daytime', icon: 'sun' },
  { key: 'dark', label: 'Dark', hint: 'Easy on the eyes at night', icon: 'moon' },
];

export const APPEARANCE_LABEL: Record<ThemePreference, string> = { system: 'System', light: 'Light', dark: 'Dark' };

type Props = { visible: boolean; selected: ThemePreference; onSelect: (p: ThemePreference) => void; onClose: () => void };

export function AppearanceSheet({ visible, selected, onSelect, onClose }: Props) {
  const colors = useColors();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: SCRIM }]} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border, borderTopLeftRadius: colors.radiusModal, borderTopRightRadius: colors.radiusModal }]}>
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          <Text style={[styles.title, { color: colors.foreground }]}>Appearance</Text>
          {OPTIONS.map((o) => {
            const active = o.key === selected;
            return (
              <Pressable
                key={o.key}
                onPress={() => {
                  Haptics.selectionAsync();
                  onSelect(o.key);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={[styles.row, { borderColor: active ? colors.primary : colors.border, borderRadius: colors.radius }]}
              >
                <Feather name={o.icon} size={20} color={colors.mutedForeground} />
                <View style={styles.text}>
                  <Text style={[styles.label, { color: colors.foreground }]}>{o.label}</Text>
                  <Text style={[styles.hint, { color: colors.mutedForeground }]}>{o.hint}</Text>
                </View>
                {active ? <Feather name="check" size={20} color={colors.primary} /> : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: { padding: 24, paddingBottom: 40, borderWidth: StyleSheet.hairlineWidth * 2, borderBottomWidth: 0 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 20 },
  title: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 22, marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: StyleSheet.hairlineWidth * 2, padding: 16, marginBottom: 10 },
  text: { flex: 1 },
  label: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 16 },
  hint: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, marginTop: 2 },
});
