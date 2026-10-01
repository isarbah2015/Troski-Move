import React from 'react';
import { StyleSheet, Text } from 'react-native';

/**
 * Ghana cedi sign (₵) sized and weighted to sit next to Feather icons. Feather has no cedi glyph (its
 * "dollar-sign" is a dollar), so this renders the real ₵ character in the app font instead.
 */
export function CediIcon({ size = 22, color }: { size?: number; color: string }) {
  return (
    <Text
      accessible={false}
      allowFontScaling={false}
      style={[styles.glyph, { fontSize: size * 1.05, lineHeight: size * 1.25, width: size * 1.1, height: size * 1.25, color }]}
    >
      ₵
    </Text>
  );
}

const styles = StyleSheet.create({
  glyph: { fontFamily: 'Inter_700Bold', textAlign: 'center', includeFontPadding: false },
});
