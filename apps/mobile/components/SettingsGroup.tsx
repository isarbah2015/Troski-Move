import React, { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import type { AppLanguage } from '@trotrolink/shared';
import { LanguageSheet } from '@/components/LanguageSheet';
import { useColors } from '@/hooks/useColors';
import { getLanguage, getNotifications, setLanguage, setNotifications } from '@/lib/storage';

type IconName = React.ComponentProps<typeof Feather>['name'];

function Row({ icon, label, value, onPress, divider }: { icon: IconName; label: string; value?: string; onPress: () => void; divider?: boolean }) {
  const colors = useColors();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={[styles.row, divider && styles.divider, divider && { borderTopColor: colors.border }]}>
      <Feather name={icon} size={20} color={colors.mutedForeground} />
      <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
      {value ? <Text style={[styles.value, { color: colors.mutedForeground }]}>{value}</Text> : null}
      <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
    </Pressable>
  );
}

/** Language, Notifications, Privacy and Help: shared by the passenger and conductor Profile tabs. */
export function SettingsGroup() {
  const colors = useColors();
  const router = useRouter();
  const [language, setLanguageState] = useState<AppLanguage>('English');
  const [notifications, setNotificationsState] = useState(true);
  const [languageOpen, setLanguageOpen] = useState(false);

  useEffect(() => {
    void Promise.all([getLanguage(), getNotifications()]).then(([l, n]) => {
      setLanguageState(l);
      setNotificationsState(n);
    });
  }, []);

  return (
    <View style={[styles.group, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
      <Row icon="globe" label="Language" value={language} onPress={() => setLanguageOpen(true)} />
      <View style={[styles.row, styles.divider, { borderTopColor: colors.border }]}>
        <Feather name="bell" size={20} color={colors.mutedForeground} />
        <Text style={[styles.label, { color: colors.foreground }]}>Notifications</Text>
        <View style={styles.switchWrap}>
          <Switch
            value={notifications}
            onValueChange={async (on) => {
              Haptics.selectionAsync();
              setNotificationsState(on);
              await setNotifications(on);
            }}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.foreground}
            accessibilityLabel="Notifications"
          />
        </View>
      </View>
      <Row icon="lock" label="Privacy" onPress={() => router.push('/privacy')} divider />
      <Row icon="help-circle" label="Help" onPress={() => Linking.openURL('mailto:help@trotrolink.app')} divider />

      <LanguageSheet
        visible={languageOpen}
        selected={language}
        onSelect={async (l) => {
          setLanguageState(l);
          await setLanguage(l);
          setLanguageOpen(false);
        }}
        onClose={() => setLanguageOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  group: { borderWidth: 1, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 56 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth },
  switchWrap: { height: 31, justifyContent: 'center' },
  label: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 16 },
  value: { fontFamily: 'Inter_500Medium', fontSize: 14 },
});
