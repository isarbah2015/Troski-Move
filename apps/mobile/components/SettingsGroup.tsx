import React, { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import type { AppLanguage, ThemePreference } from '@trotrolink/shared';
import { APPEARANCE_LABEL, AppearanceSheet } from '@/components/AppearanceSheet';
import { LanguageSheet } from '@/components/LanguageSheet';
import { useColors } from '@/hooks/useColors';
import { getLanguage, getNotifications, setLanguage, setNotifications } from '@/lib/storage';
import { getThemePreference, setThemePreference } from '@/lib/theme';

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
  const [theme, setTheme] = useState<ThemePreference>('system');
  const [themeOpen, setThemeOpen] = useState(false);

  useEffect(() => {
    void Promise.all([getLanguage(), getNotifications(), getThemePreference()]).then(([l, n, t]) => {
      setLanguageState(l);
      setNotificationsState(n);
      setTheme(t);
    });
  }, []);

  return (
    <View style={[styles.group, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
      <Row icon="globe" label="Language" value={language} onPress={() => setLanguageOpen(true)} />
      <Row icon={theme === 'light' ? 'sun' : 'moon'} label="Appearance" value={APPEARANCE_LABEL[theme]} onPress={() => setThemeOpen(true)} divider />
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
            thumbColor="#FFFFFF"
            accessibilityLabel="Notifications"
          />
        </View>
      </View>
      <Row icon="lock" label="Privacy" onPress={() => router.push('/privacy')} divider />
      <Row icon="help-circle" label="Help" onPress={() => Linking.openURL('mailto:help@trotrolink.app')} divider />

      <AppearanceSheet
        visible={themeOpen}
        selected={theme}
        onSelect={async (t) => {
          setTheme(t);
          await setThemePreference(t);
          setThemeOpen(false);
        }}
        onClose={() => setThemeOpen(false)}
      />
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
