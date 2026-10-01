import React from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import { formatApprox } from '@trotrolink/shared';
import { useColors } from '@/hooks/useColors';
import { useDisplayCurrency } from '@/lib/currencyPref';

/** "≈ $0.18" under a cedi amount when the user chose another display currency; renders nothing for cedis. */
export function Approx({ amount, style }: { amount: number; style?: StyleProp<TextStyle> }) {
  const colors = useColors();
  const currency = useDisplayCurrency();
  const text = formatApprox(amount, currency);
  if (!text) return null;
  return <Text style={[styles.text, { color: colors.mutedForeground }, style]} accessibilityLabel={`About ${text.replace('≈ ', '')}`}>{text}</Text>;
}

const styles = StyleSheet.create({ text: { fontFamily: 'Inter_500Medium', fontSize: 14 } });
