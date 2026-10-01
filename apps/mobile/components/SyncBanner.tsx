import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { flushQueue, usePendingSync } from '@/lib/sync';

/** "X actions pending sync": shown while anything is waiting in the offline queue. Tap to retry now. */
export function SyncBanner() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const pending = usePendingSync();
  if (pending === 0) return null;

  return (
    <Pressable
      onPress={() => void flushQueue()}
      accessibilityRole="button"
      accessibilityLabel={`${pending} ${pending === 1 ? 'action' : 'actions'} pending sync. Tap to retry`}
      style={[styles.banner, { top: insets.top + 4, backgroundColor: colors.secondary, borderColor: colors.accent, borderRadius: colors.radiusPill }]}
    >
      <Feather name="upload-cloud" size={14} color={colors.accent} />
      <Text style={[styles.text, { color: colors.foreground }]}>
        {pending} {pending === 1 ? 'action' : 'actions'} pending sync
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 7, zIndex: 90 },
  text: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
});
