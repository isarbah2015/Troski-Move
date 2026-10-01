import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import type { Role } from '@/lib/storage';

/** Pill-shaped Passenger / Conductor segmented control (emerald on the selected role). */
export function RoleSwitcher({ role, onChange }: { role: Role; onChange: (next: Role) => void }) {
  const colors = useColors();
  return (
    <View style={[styles.segment, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radiusPill }]} accessibilityRole="radiogroup">
      {(['passenger', 'conductor'] as const).map((r) => {
        const active = role === r;
        return (
          <Pressable
            key={r}
            onPress={() => onChange(r)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            style={[styles.btn, { backgroundColor: active ? colors.primary : 'transparent', borderRadius: colors.radiusPill }]}
          >
            <Text style={[styles.text, { color: active ? colors.primaryForeground : colors.mutedForeground }]}>{r === 'passenger' ? 'Passenger' : 'Conductor'}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth * 2, padding: 4 },
  btn: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center' },
  text: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15 },
});
