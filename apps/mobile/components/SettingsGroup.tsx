import React, { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import type { AppLanguage, ThemePreference } from '@trotrolink/shared';
import { APPEARANCE_LABEL, AppearanceSheet } from '@/components/AppearanceSheet';
import { CediIcon } from '@/components/CediIcon';
import { CurrencySheet } from '@/components/CurrencySheet';
import { setDisplayCurrency, useDisplayCurrency } from '@/lib/currencyPref';
import { LanguageSheet, NATIVE_NAME } from '@/components/LanguageSheet';
import { useColors } from '@/hooks/useColors';
import { ensureNotificationPermission, registerForPush } from '@/lib/notify';
import { getLanguage, getNotifications, setLanguage, setNotifications } from '@/lib/storage';
import { getThemePreference, setThemePreference } from '@/lib/theme';
import { setAppLanguage, useT } from '@/lib/i18n';

type IconName = React.ComponentProps<typeof Feather>['name'] | 'cedi';

function Row({ icon, label, value, onPress, divider }: { icon: IconName; label: string; value?: string; onPress: () => void; divider?: boolean }) {
  const colors = useColors();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={[styles.row, divider && styles.divider, divider && { borderTopColor: colors.border }]}>
      {icon === 'cedi' ? <CediIcon size={20} color={colors.mutedForeground} /> : <Feather name={icon} size={20} color={colors.mutedForeground} />}
      <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
      {value ? <Text style={[styles.value, { color: colors.mutedForeground }]}>{value}</Text> : null}
      <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
    </Pressable>
  );
}

/** Language, Notifications, Privacy and Help: shared by the passenger and conductor Profile tabs. */
export function SettingsGroup({ onDeleteAccount }: { onDeleteAccount?: () => void }) {
  const colors = useColors();
  const t = useT();
  const router = useRouter();
  const [language, setLanguageState] = useState<AppLanguage>('English');
  const [notifications, setNotificationsState] = useState(true);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [theme, setTheme] = useState<ThemePreference>('system');
  const [themeOpen, setThemeOpen] = useState(false);
  const currency = useDisplayCurrency();
  const [currencyOpen, setCurrencyOpen] = useState(false);

  useEffect(() => {
    void Promise.all([getLanguage(), getNotifications(), getThemePreference()]).then(([l, n, t]) => {
      setLanguageState(l);
      setNotificationsState(n);
      setTheme(t);
    });
  }, []);

  return (
    <View style={[styles.group, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, ...colors.elevation }]}>
      <Row icon="globe" label={t('set.language')} value={NATIVE_NAME[language]} onPress={() => setLanguageOpen(true)} />
      <Row icon={theme === 'light' ? 'sun' : 'moon'} label={t('set.appearance')} value={APPEARANCE_LABEL[theme]} onPress={() => setThemeOpen(true)} divider />
      <View style={[styles.row, styles.divider, { borderTopColor: colors.border }]}>
        <Feather name="bell" size={20} color={colors.mutedForeground} />
        <Text style={[styles.label, { color: colors.foreground }]}>{t('set.notifications')}</Text>
        <View style={styles.switchWrap}>
          <Switch
            value={notifications}
            onValueChange={async (on) => {
              Haptics.selectionAsync();
              setNotificationsState(on);
              await setNotifications(on);
              if (on) {
                await ensureNotificationPermission();
                void registerForPush();
              }
            }}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#FFFFFF"
            accessibilityLabel="Notifications"
          />
        </View>
      </View>
      <Row icon="cedi"label="Currency" value={currency === 'GHS' ? '₵ Cedi' : currency} onPress={() => setCurrencyOpen(true)} divider />
      <Row icon="lock" label={t('set.privacy')} onPress={() => router.push('/privacy')} divider />
      <Row icon="compass" label="Visiting Ghana?" onPress={() => router.push('/visitor')} divider />
      <Row icon="help-circle" label={t('set.help')} onPress={() => Linking.openURL('mailto:help@trotrolink.app')} divider />
      {onDeleteAccount ? (
        <Pressable onPress={onDeleteAccount} accessibilityRole="button" accessibilityLabel="Delete account" style={[styles.row, styles.divider, { borderTopColor: colors.border }]}>
          <Feather name="trash-2" size={20} color={colors.destructive} />
          <Text style={[styles.label, { color: colors.destructive }]}>{t('set.delete')}</Text>
        </Pressable>
      ) : null}

      <CurrencySheet
        visible={currencyOpen}
        selected={currency}
        onSelect={async (c) => {
          await setDisplayCurrency(c);
          setCurrencyOpen(false);
        }}
        onClose={() => setCurrencyOpen(false)}
      />
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
          setAppLanguage(l);
          await setLanguage(l);
          setLanguageOpen(false);
        }}
        onClose={() => setLanguageOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  group: { borderWidth: StyleSheet.hairlineWidth * 2, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 56 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth },
  switchWrap: { height: 31, justifyContent: 'center' },
  label: { flex: 1, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 16 },
  value: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14 },
});
