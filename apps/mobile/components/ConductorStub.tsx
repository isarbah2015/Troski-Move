import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { setRole } from '@/lib/storage';

type Props = { icon: React.ComponentProps<typeof Feather>['name']; title: string; body: string };

/** Placeholder for a conductor tab, with a way back to the passenger role. */
export function ConductorStub({ icon, title, body }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.badge, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radiusModal }]}>
        <Feather name={icon} size={28} color={colors.primary} />
      </View>
      <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.body, { color: colors.mutedForeground }]}>{body}</Text>
      <Pressable
        onPress={async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          await setRole('passenger');
          router.navigate('/');
        }}
        accessibilityRole="button"
        style={[styles.btn, { borderColor: colors.border, borderRadius: colors.radiusPill }]}
      >
        <Feather name="repeat" size={16} color={colors.foreground} />
        <Text style={[styles.btnText, { color: colors.foreground }]}>Switch to Passenger</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  badge: { width: 72, height: 72, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 22, marginBottom: 8 },
  body: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 28 },
  btn: { height: 48, paddingHorizontal: 24, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
});
