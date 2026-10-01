import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { DEMO_MODE } from '@/lib/api';
import { GOLD } from '@/lib/colors';

/** Shown only in offline demo mode, so nobody mistakes the demo for the live service. */
export function DemoBadge({ force }: { force?: 'light' | 'dark' }) {
  const colors = useColors(force);
  if (!DEMO_MODE) return null;
  return (
    <View style={[styles.badge, { borderColor: colors.accent, backgroundColor: colors.secondary, borderRadius: colors.radiusPill }]} accessibilityLabel="Demo mode. No real payments.">
      <Feather name="play-circle" size={12} color={GOLD} />
      <Text style={[styles.text, { color: GOLD }]}>DEMO MODE</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  text: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 0.8 },
});
