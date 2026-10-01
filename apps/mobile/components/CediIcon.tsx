import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

/**
 * Ghana cedi sign (₵) sized and weighted to sit next to Feather icons. Feather has no cedi glyph (its
 * "dollar-sign" is a dollar), so this renders the real ₵ character in the app font instead. It sits in a fixed
 * square box, like the Feather icons, so it lines up with them in the tab bar.
 */
export function CediIcon({ size = 22, color }: { size?: number; color: string }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessible={false}>
      <Text allowFontScaling={false} style={[styles.glyph, { fontSize: size * 1.02, lineHeight: size * 1.15, color }]}>
        ₵
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  glyph: { fontFamily: 'PlusJakartaSans_700Bold', textAlign: 'center', includeFontPadding: false },
});
