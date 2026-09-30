import React from 'react';
import { Text, View } from 'react-native';
import { colors } from '@/lib/colors';

export default function ScanScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <Text style={{ color: colors.textPrimary, fontFamily: 'Inter_700Bold', fontSize: 22 }}>Scan</Text>
    </View>
  );
}
