import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { LocalUser, TripRecord } from '@trotrolink/shared';
import { RoleSwitcher } from '@/components/RoleSwitcher';
import { SectionHeader } from '@/components/SectionHeader';
import { SettingsGroup } from '@/components/SettingsGroup';
import { Stars } from '@/components/Stars';
import { TripDetailSheet } from '@/components/TripDetailSheet';
import { useColors } from '@/hooks/useColors';
import { formatCedis } from '@/lib/api';
import { confirmSignOut } from '@/lib/auth';
import { loadDemoProfile } from '@/lib/demo';
import { formatWhen, GUEST_USER, lifetimeStats, maskMomo, maskPhone } from '@/lib/profile';
import {
  clearTripHistory,
  getRole,
  getTripHistory,
  getUser,
  setRole as saveRole,
  type Role,
} from '@/lib/storage';
import { showToast } from '@/lib/toast';

const HISTORY_LIMIT = 10;

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [user, setUser] = useState<LocalUser | null>(null);
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [role, setRoleState] = useState<Role>('passenger');
  const [selected, setSelected] = useState<TripRecord | null>(null);

  const load = useCallback(async () => {
    const [u, t, r] = await Promise.all([getUser(), getTripHistory(), getRole()]);
    setUser(u);
    setTrips(t);
    setRoleState(r);
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Returning to Profile always means the passenger role is active.
      void load().then(() => saveRole('passenger')).then(() => setRoleState('passenger'));
    }, [load]),
  );

  const person = user ?? GUEST_USER;
  const stats = lifetimeStats(trips);
  const momo = user ? maskMomo(user.phone) : null;

  const switchRole = async (next: Role) => {
    if (next === role) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRoleState(next);
    await saveRole(next);
    if (next === 'conductor') router.navigate('/today');
  };

  const signOut = () =>
    confirmSignOut(async () => {
      // No (auth)/login screen exists yet, so sign-out resets local state and returns to Scan.
      await load();
      showToast('Signed out');
      router.navigate('/');
    });

  const card = { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16 }]} showsVerticalScrollIndicator={false}>
      <Text style={[styles.title, { color: colors.foreground }]}>Profile</Text>

      {/* User card */}
      <View style={[styles.userCard, card]}>
        <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
          <Feather name="user" size={26} color={colors.accent} />
        </View>
        <View style={styles.userText}>
          <Text style={[styles.name, { color: colors.foreground }]}>{person.name}</Text>
          <Text style={[styles.phone, { color: colors.mutedForeground }]}>{maskPhone(person.phone)}</Text>
          <View style={styles.verifiedRow}>
            <Feather name={person.verified ? 'check-circle' : 'alert-circle'} size={14} color={person.verified ? colors.primary : colors.mutedForeground} />
            <Text style={[styles.verified, { color: person.verified ? colors.primary : colors.mutedForeground }]}>{person.verified ? 'Verified' : 'Not verified'}</Text>
          </View>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.stats}>
        {[
          { value: String(stats.trips), label: 'Trips' },
          { value: formatCedis(stats.spent).replace('GHS ', ''), label: 'GHS spent' },
          { value: stats.tier, label: 'Tier' },
        ].map((s) => (
          <View key={s.label} style={[styles.stat, card]}>
            <Text style={[styles.statValue, { color: colors.foreground }]} numberOfLines={1} adjustsFontSizeToFit>{s.value}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Role */}
      <SectionHeader>Role</SectionHeader>
      <RoleSwitcher role={role} onChange={(r) => void switchRole(r)} />

      {/* History */}
      <SectionHeader>Trip history</SectionHeader>
      {trips.length === 0 ? (
        <View style={[styles.emptyHistory, card]}>
          <Feather name="clock" size={22} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No trips yet. Scan a QR to get started.</Text>
        </View>
      ) : (
        trips.slice(0, HISTORY_LIMIT).map((t) => (
          <Pressable
            key={t.tripId}
            onPress={() => {
              Haptics.selectionAsync();
              setSelected(t);
            }}
            accessibilityRole="button"
            accessibilityLabel={`${t.boardingStop} to ${t.alightingStop}, ${formatWhen(t.startedAt)}, ${formatCedis(t.amountPaid)}`}
            style={[styles.tripRow, card]}
          >
            <View style={styles.tripMain}>
              <Text style={[styles.tripRoute, { color: colors.foreground }]}>{t.boardingStop} → {t.alightingStop}</Text>
              <Text style={[styles.tripMeta, { color: colors.mutedForeground }]}>{formatWhen(t.startedAt)} · {formatCedis(t.amountPaid)}</Text>
              <View style={{ marginTop: 6 }}><Stars rating={t.rating} /></View>
            </View>
            <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
          </Pressable>
        ))
      )}

      {/* Payment */}
      <SectionHeader>Payment method</SectionHeader>
      <View style={[styles.payCard, card]}>
        <View style={[styles.payIcon, { backgroundColor: colors.secondary }]}>
          <Feather name="smartphone" size={20} color={colors.accent} />
        </View>
        <View>
          <Text style={[styles.payName, { color: colors.foreground }]}>MTN MoMo</Text>
          <Text style={[styles.payNumber, { color: colors.mutedForeground }]}>{momo ?? 'No number added yet'}</Text>
        </View>
      </View>

      {/* Settings */}
      <SectionHeader>Settings</SectionHeader>
      <SettingsGroup />

      <Pressable onPress={signOut} accessibilityRole="button" style={[styles.signOut, { borderColor: colors.destructive, borderRadius: colors.radiusPill }]}>
        <Feather name="log-out" size={18} color={colors.destructive} />
        <Text style={[styles.signOutText, { color: colors.destructive }]}>Sign out</Text>
      </Pressable>

      {__DEV__ ? (
        <View style={styles.devRow}>
          <Pressable onPress={async () => { await loadDemoProfile(); await load(); }} accessibilityRole="button">
            <Text style={[styles.devText, { color: colors.mutedForeground }]}>Load demo data (dev only)</Text>
          </Pressable>
          <Pressable onPress={async () => { await clearTripHistory(); await load(); }} accessibilityRole="button">
            <Text style={[styles.devText, { color: colors.mutedForeground }]}>Clear history (dev only)</Text>
          </Pressable>
        </View>
      ) : null}

      <TripDetailSheet
        trip={selected}
        onClose={() => setSelected(null)}
        onRideAgain={(code) => {
          setSelected(null);
          router.navigate({ pathname: '/', params: { code, n: String(Date.now()) } });
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 24, paddingBottom: 48 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 32, marginBottom: 20 },
  userCard: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 20, borderWidth: 1 },
  avatar: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  userText: { flex: 1 },
  name: { fontFamily: 'Inter_700Bold', fontSize: 20 },
  phone: { fontFamily: 'Inter_500Medium', fontSize: 14, marginTop: 2 },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  verified: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  stats: { flexDirection: 'row', gap: 10, marginTop: 12 },
  stat: { flex: 1, borderWidth: 1, paddingVertical: 16, paddingHorizontal: 8, alignItems: 'center' },
  statValue: { fontFamily: 'Inter_700Bold', fontSize: 22 },
  statLabel: { fontFamily: 'Inter_500Medium', fontSize: 12, marginTop: 4 },
  emptyHistory: { borderWidth: 1, padding: 24, alignItems: 'center', gap: 10 },
  emptyText: { fontFamily: 'Inter_500Medium', fontSize: 14, textAlign: 'center' },
  tripRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, padding: 16, marginBottom: 10 },
  tripMain: { flex: 1 },
  tripRoute: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  tripMeta: { fontFamily: 'Inter_500Medium', fontSize: 13, marginTop: 3 },
  payCard: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, padding: 16 },
  payIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  payName: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  payNumber: { fontFamily: 'Inter_500Medium', fontSize: 14, marginTop: 2 },
  signOut: { marginTop: 28, height: 56, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  signOutText: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  devRow: { alignItems: 'center', gap: 14, paddingTop: 20 },
  devText: { fontFamily: 'Inter_500Medium', fontSize: 12 },
});
