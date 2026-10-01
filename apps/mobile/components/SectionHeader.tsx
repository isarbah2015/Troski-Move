import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { useColors } from '@/hooks/useColors';

export function SectionHeader({ children }: { children: string }) {
  const colors = useColors();
  return (
    <Text accessibilityRole="header" style={[styles.text, { color: colors.mutedForeground }]}>
      {children.toUpperCase()}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, letterSpacing: 1.4, marginTop: 28, marginBottom: 10 },
});
