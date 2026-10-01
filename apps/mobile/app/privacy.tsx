import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useColors } from '@/hooks/useColors';

// Placeholder until the real privacy policy is written.
export default function PrivacyScreen() {
  const colors = useColors();
  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.body}>
      <Text style={[styles.h, { color: colors.foreground }]}>Privacy</Text>
      <Text style={[styles.p, { color: colors.mutedForeground }]}>
        TrotroLink stores your trips and settings on this device. Your full privacy policy will be published here before launch.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 24 },
  h: { fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -0.8, fontSize: 28, marginBottom: 12 },
  p: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 15, lineHeight: 22 },
});
