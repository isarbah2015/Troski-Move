import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { MOMO_NETWORKS, MOMO_NETWORK_COLOR, MOMO_NETWORK_LABEL, type MomoNetwork } from '@trotrolink/shared';
import { useColors } from '@/hooks/useColors';

/** Chooses which mobile-money wallet pays. Three equal chips so they never scroll or clip, even on small phones. */
export function NetworkPicker({ value, onChange }: { value: MomoNetwork; onChange: (n: MomoNetwork) => void }) {
  const colors = useColors();
  const tint = colors.scheme === 'light' ? 'rgba(7,128,90,0.10)' : 'rgba(43,217,159,0.14)';
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {MOMO_NETWORKS.map((n) => {
        const on = n === value;
        return (
          <Pressable
            key={n}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={MOMO_NETWORK_LABEL[n]}
            onPress={() => {
              Haptics.selectionAsync();
              onChange(n);
            }}
            style={[
              styles.chip,
              { borderRadius: colors.radiusPill, borderColor: on ? colors.primary : colors.border, backgroundColor: on ? tint : colors.card },
            ]}
          >
            <View style={[styles.dot, { backgroundColor: MOMO_NETWORK_COLOR[n] }]} />
            <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.text, { color: on ? colors.primary : colors.foreground }]}>
              {MOMO_NETWORK_LABEL[n]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  chip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: StyleSheet.hairlineWidth * 2, paddingVertical: 10, paddingHorizontal: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, flexShrink: 1 },
});
