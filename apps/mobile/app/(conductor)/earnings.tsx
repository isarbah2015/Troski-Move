import React, { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SectionHeader } from '@/components/SectionHeader';
import { useColors } from '@/hooks/useColors';
import { formatCedis } from '@/lib/api';
import { MOCK_TODAY, formatOnline } from '@/lib/conductor';
import { DEFAULT_SPLITS, localDateKey, netEarnings, parseAmount, sanitizeAmount, weekDays } from '@/lib/earnings';
import { getConductorVehicleCode, getDailySplits, saveDailySplit, type DailySplitRecord } from '@/lib/storage';
import { sendOrQueue } from '@/lib/sync';
import { showToast } from '@/lib/toast';
import { EMERALD, ERROR, GOLD, HERO_GRADIENT, SILVER, WHITE } from '@/lib/colors';
import { CEDI } from '@trotrolink/shared';
import { PrimaryButton } from '@/components/PrimaryButton';

type Field = 'ownerDrop' | 'conductorWage' | 'fuelCost';

const FIELDS: Array<{ key: Field; label: string }> = [
  { key: 'ownerDrop', label: 'Owner drop' },
  { key: 'conductorWage', label: 'Conductor wage' },
  { key: 'fuelCost', label: 'Fuel cost' },
];

function SplitInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const colors = useColors();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.splitRow}>
      <Text style={[styles.splitLabel, { color: colors.foreground }]}>{label}</Text>
      <View style={[styles.inputWrap, { borderColor: focused ? colors.primary : colors.border, backgroundColor: colors.background, borderRadius: 12 }]}>
        <Text style={[styles.prefix, { color: colors.mutedForeground }]}>{CEDI}</Text>
        <TextInput
          value={value}
          onChangeText={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={colors.mutedForeground}
          selectTextOnFocus
          maxLength={8}
          accessibilityLabel={`${label} in cedis`}
          style={[styles.input, { color: colors.foreground }]}
        />
      </View>
    </View>
  );
}

export default function EarningsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const today = new Date();
  const todayKey = localDateKey(today);
  const total = MOCK_TODAY.total; // TODO: sum of today's transactions once payments are recorded

  const [values, setValues] = useState<Record<Field, string>>({
    ownerDrop: String(DEFAULT_SPLITS.ownerDrop),
    conductorWage: String(DEFAULT_SPLITS.conductorWage),
    fuelCost: String(DEFAULT_SPLITS.fuelCost),
  });
  const [saved, setSaved] = useState<Record<string, DailySplitRecord>>({});

  useFocusEffect(
    useCallback(() => {
      void getDailySplits().then((all) => {
        setSaved(all);
        const t = all[todayKey];
        if (t) setValues({ ownerDrop: String(t.ownerDrop), conductorWage: String(t.conductorWage), fuelCost: String(t.fuelCost) });
      });
    }, [todayKey]),
  );

  const net = netEarnings(total, parseAmount(values.ownerDrop), parseAmount(values.conductorWage), parseAmount(values.fuelCost));
  const positive = net >= 0;
  const week = weekDays(today);

  const setField = (key: Field, text: string) => {
    Haptics.selectionAsync();
    setValues((v) => ({ ...v, [key]: sanitizeAmount(text) }));
  };

  const saveDay = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert('Save & close day?', `Net earnings ${formatCedis(net)} will be saved for ${todayKey}.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Save',
        onPress: async () => {
          const record: DailySplitRecord = {
            date: todayKey,
            total,
            ownerDrop: parseAmount(values.ownerDrop),
            conductorWage: parseAmount(values.conductorWage),
            fuelCost: parseAmount(values.fuelCost),
            net,
            savedAt: new Date().toISOString(),
          };
          await saveDailySplit(record);
          void getConductorVehicleCode().then((vehicleCode) =>
            sendOrQueue({ type: 'split', body: { vehicleCode, date: todayKey, totalFares: total, ownerDrop: record.ownerDrop, conductorWage: record.conductorWage, fuelCost: record.fuelCost } }),
          );
          setSaved(await getDailySplits());
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          showToast('Day saved');
        },
      },
    ]);
  };

  const card = { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, ...colors.elevation };

  return (
    <KeyboardAwareScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16 }]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      bottomOffset={24}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: colors.foreground }]}>Earnings</Text>
      <Text style={[styles.sub, { color: colors.mutedForeground }]}>Today · {todayKey}</Text>

      <View style={[styles.totalCard, { backgroundColor: colors.card, borderColor: colors.primary, borderRadius: colors.radius, ...colors.elevation }]}>
        <Text style={[styles.kicker, { color: colors.primary }]}>TOTAL FARES COLLECTED</Text>
        <Text style={[styles.total, { color: colors.foreground }]}>{formatCedis(total)}</Text>
        <Text style={[styles.meta, { color: colors.mutedForeground }]}>{MOCK_TODAY.riders} riders · {formatOnline(MOCK_TODAY.hoursOnline)}</Text>
      </View>

      <SectionHeader>Today&apos;s split</SectionHeader>
      <View style={[styles.group, card]}>
        {FIELDS.map((f, i) => (
          <View key={f.key} style={i > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }}>
            <SplitInput label={f.label} value={values[f.key]} onChange={(t) => setField(f.key, t)} />
          </View>
        ))}
      </View>

      <LinearGradient
        colors={HERO_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.netCard, { borderColor: positive ? GOLD : ERROR, borderRadius: colors.radius }]}
      >
        <Text style={[styles.kicker, { color: SILVER }]}>YOUR NET EARNINGS</Text>
        <Text style={[styles.net, { color: positive ? WHITE : ERROR }]} accessibilityLiveRegion="polite">
          {net < 0 ? '-' : ''}{formatCedis(Math.abs(net))}
        </Text>
        {!positive ? <Text style={[styles.warn, { color: ERROR }]}>Costs are higher than today&apos;s fares</Text> : null}
      </LinearGradient>

      <SectionHeader>This week</SectionHeader>
      <View style={[styles.group, card]}>
        {week.map((d, i) => {
          const record = saved[d.key];
          const amount = d.isToday ? net : record?.net;
          return (
            <View
              key={d.key}
              style={[
                styles.weekRow,
                i > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
                d.isToday && { backgroundColor: `${EMERALD}1F`, borderRadius: 10, marginHorizontal: -8, paddingHorizontal: 8 },
              ]}
            >
              <Text style={[styles.weekDay, { color: d.isToday ? colors.primary : colors.mutedForeground }]}>{d.label}</Text>
              <Text style={[styles.weekAmount, { color: amount === undefined ? colors.mutedForeground : amount < 0 ? colors.destructive : colors.foreground }]}>
                {amount === undefined ? '—' : `${amount < 0 ? '-' : ''}${formatCedis(Math.abs(amount))}`}
                {d.isToday ? (saved[todayKey] ? ' (today, saved)' : ' (today)') : ''}
              </Text>
            </View>
          );
        })}
      </View>

      <PrimaryButton onPress={saveDay} icon="check" label="Save & close day" style={styles.save} />

      {__DEV__ ? (
        <Pressable
          onPress={async () => {
            const demo = [45, 52, 48, 50, 47, 55];
            for (const [i, d] of week.entries()) {
              if (d.isToday || d.isFuture) continue;
              await saveDailySplit({ date: d.key, total: 120, ownerDrop: 40, conductorWage: 20, fuelCost: 15, net: demo[i] ?? 45, savedAt: new Date().toISOString() });
            }
            setSaved(await getDailySplits());
          }}
          accessibilityRole="button"
          style={styles.devLink}
        >
          <Text style={[styles.devText, { color: colors.mutedForeground }]}>Load demo week (dev only)</Text>
        </Pressable>
      ) : null}
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 24, paddingBottom: 132 },
  title: { fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -0.8, fontSize: 32 },
  sub: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, marginTop: 4, marginBottom: 20 },
  totalCard: { borderWidth: 1.5, padding: 20 },
  kicker: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, letterSpacing: 1.2 },
  total: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 40, marginTop: 8 },
  meta: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, marginTop: 6 },
  group: { borderWidth: StyleSheet.hairlineWidth * 2, paddingHorizontal: 16 },
  splitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 64 },
  splitLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 16 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, width: 132, height: 44, paddingHorizontal: 10 },
  prefix: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12 },
  input: { flex: 1, textAlign: 'right', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, paddingVertical: 0 },
  netCard: { borderWidth: 1.5, padding: 20, marginTop: 16 },
  net: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 36, marginTop: 8 },
  warn: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, marginTop: 6 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 48 },
  weekDay: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15 },
  weekAmount: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15 },
  save: { marginTop: 28 },
  saveText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 17 },
  devLink: { alignSelf: 'center', paddingVertical: 20 },
  devText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12 },
});
