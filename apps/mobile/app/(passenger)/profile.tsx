import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { LocalUser, TripRating, TripRecord } from '@trotrolink/shared';
import { RatingSheet, type RatingTarget } from '@/components/RatingSheet';
import { RoleSwitcher } from '@/components/RoleSwitcher';
import { SectionHeader } from '@/components/SectionHeader';
import { SettingsGroup } from '@/components/SettingsGroup';
import { Stars } from '@/components/Stars';
import { TripDetailSheet } from '@/components/TripDetailSheet';
import { useColors } from '@/hooks/useColors';
import { formatCedis } from '@/lib/api';
import { confirmDeleteAccount, confirmSignOut } from '@/lib/auth';
import { loadDemoProfile } from '@/lib/demo';
import { submitTripRating } from '@/lib/ratings';
import { NetworkPicker } from '@/components/NetworkPicker';
import { MOMO_NETWORK_LABEL } from '@trotrolink/shared';
import { useMomoNetwork } from '@/lib/network';
import { formatWhen, GUEST_USER, lifetimeStats, maskMomo, maskPhone } from '@/lib/profile';
import {
  clearTripHistory,
  getRole,
  getTripHistory,
  getTripRatings,
  getTripReports,
  getUser,
  setRole as saveRole,
  type Role,
} from '@/lib/storage';
import { showToast } from '@/lib/toast';
import { GOLD, SILVER, WHITE } from '@/lib/colors';
import { useT } from '@/lib/i18n';
import { CEDI } from '@trotrolink/shared';

const HISTORY_LIMIT = 10;

export default function ProfileScreen() {
  const t = useT();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [user, setUser] = useState<LocalUser | null>(null);
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [role, setRoleState] = useState<Role>('passenger');
  const [selected, setSelected] = useState<TripRecord | null>(null);
  const [ratings, setRatings] = useState<Record<string, TripRating>>({});
  const [reports, setReports] = useState<Record<string, string>>({});
  const [rateTarget, setRateTarget] = useState<RatingTarget | null>(null);

  const load = useCallback(async () => {
    const [u, t, r, rt, rp] = await Promise.all([getUser(), getTripHistory(), getRole(), getTripRatings(), getTripReports()]);
    setRatings(rt);
    setReports(rp);
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
  const [network, setNetwork] = useMomoNetwork();

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

  const card = { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, ...colors.elevation };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16 }]} showsVerticalScrollIndicator={false}>
      <Text style={[styles.title, { color: colors.foreground }]}>{t('profile.title')}</Text>

      {/* User card: a navy hero with a gold-ringed avatar */}
      <LinearGradient colors={colors.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.userCard, { borderRadius: colors.radius }, colors.elevation]}>
        <View style={styles.avatarRing}>
          <View style={[styles.avatar, { backgroundColor: '#0A1A33' }]}>
            <Feather name="user" size={26} color={GOLD} />
          </View>
        </View>
        <View style={styles.userText}>
          <Text style={[styles.name, { color: WHITE }]}>{person.name}</Text>
          <Text style={[styles.phone, { color: SILVER }]}>{maskPhone(person.phone)}</Text>
          <View style={[styles.verifiedPill, { backgroundColor: person.verified ? 'rgba(43,217,159,0.16)' : 'rgba(148,163,184,0.16)' }]}>
            <Feather name={person.verified ? 'check-circle' : 'alert-circle'} size={13} color={person.verified ? '#2BD99F' : SILVER} />
            <Text style={[styles.verified, { color: person.verified ? '#2BD99F' : SILVER }]}>{person.verified ? 'Verified' : 'Not verified'}</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Stats */}
      <View style={styles.stats}>
        {[
          { value: String(stats.trips), label: t('profile.trips') },
          { value: formatCedis(stats.spent).replace(CEDI, ''), label: t('profile.spent') },
          { value: stats.tier, label: t('profile.tier') },
        ].map((s) => (
          <View key={s.label} style={[styles.stat, card]}>
            <Text style={[styles.statValue, { color: colors.foreground }]} numberOfLines={1} adjustsFontSizeToFit>{s.value}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Role */}
      <SectionHeader>{t('profile.role')}</SectionHeader>
      <RoleSwitcher role={role} onChange={(r) => void switchRole(r)} />

      {/* History */}
      <SectionHeader>{t('profile.history')}</SectionHeader>
      {trips.length === 0 ? (
        <View style={[styles.emptyHistory, card]}>
          <Feather name="clock" size={22} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{t('profile.noTrips')}</Text>
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
              {reports[t.tripId] ? (
                <View style={[styles.reported, { borderColor: colors.mutedForeground, borderRadius: colors.radiusPill }]}>
                  <Feather name="flag" size={11} color={colors.mutedForeground} />
                  <Text style={[styles.reportedText, { color: colors.mutedForeground }]}>Reported</Text>
                </View>
              ) : null}
              <View style={{ marginTop: 6 }}>
                {(ratings[t.tripId]?.driverRating ?? t.rating) !== null && (ratings[t.tripId]?.driverRating ?? t.rating) !== undefined ? (
                  <Stars rating={ratings[t.tripId]?.driverRating ?? t.rating} />
                ) : (
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setRateTarget({
                        tripId: t.tripId,
                        vehicleId: t.vehicleId,
                        destination: t.alightingStop,
                        driverName: t.driverName ?? 'Driver',
                        conductorName: t.conductorName ?? 'Conductor',
                        justArrived: false,
                      });
                    }}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Rate trip to ${t.alightingStop}`}
                    style={[styles.rateChip, { borderColor: colors.accent, borderRadius: colors.radiusPill }]}
                  >
                    <Feather name="star" size={12} color={colors.accent} />
                    <Text style={[styles.rateChipText, { color: colors.accent }]}>Rate trip</Text>
                  </Pressable>
                )}
              </View>
            </View>
            <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
          </Pressable>
        ))
      )}

      {/* Payment */}
      <SectionHeader>{t('profile.payment')}</SectionHeader>
      <View style={[styles.payCard, card]}>
        <View style={[styles.payIcon, { backgroundColor: colors.secondary }]}>
          <Feather name="smartphone" size={20} color={GOLD} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.payName, { color: colors.foreground }]}>{MOMO_NETWORK_LABEL[network]}</Text>
          <Text style={[styles.payNumber, { color: colors.mutedForeground }]}>{momo ?? 'No number added yet'}</Text>
        </View>
      </View>
      <View style={{ marginTop: 10 }}>
        <NetworkPicker value={network} onChange={setNetwork} />
        <Text style={[styles.payNumber, { color: colors.mutedForeground, marginTop: 8 }]}>{t('profile.networkNote')}</Text>
      </View>

      {/* Settings */}
      <SectionHeader>{t('profile.settings')}</SectionHeader>
      <SettingsGroup
        onDeleteAccount={() =>
          confirmDeleteAccount('passenger', async () => {
            await load();
            showToast('Account deleted');
            router.navigate('/');
          })
        }
      />

      <Pressable onPress={signOut} accessibilityRole="button" style={[styles.signOut, { borderColor: colors.destructive, borderRadius: colors.radiusPill }]}>
        <Feather name="log-out" size={18} color={colors.destructive} />
        <Text style={[styles.signOutText, { color: colors.destructive }]}>{t('profile.signOut')}</Text>
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
        rating={selected ? ratings[selected.tripId] : undefined}
        onClose={() => setSelected(null)}
        onRideAgain={(code) => {
          setSelected(null);
          router.navigate({ pathname: '/', params: { code, n: String(Date.now()) } });
        }}
      />
      <RatingSheet
        target={rateTarget}
        onSkip={() => setRateTarget(null)}
        onSubmit={async (t, result) => {
          await submitTripRating(t, result);
          setRateTarget(null);
          await load();
          showToast('Thanks for rating!');
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 24, paddingBottom: 132 },
  title: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 32, letterSpacing: -0.8, marginBottom: 20 },
  userCard: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 22, overflow: 'hidden' },
  avatarRing: { width: 68, height: 68, borderRadius: 34, borderWidth: 2, borderColor: GOLD, alignItems: 'center', justifyContent: 'center' },
  verifiedPill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginTop: 8 },
  avatar: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  userText: { flex: 1 },
  name: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20 },
  phone: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, marginTop: 2 },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  verified: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13 },
  stats: { flexDirection: 'row', gap: 10, marginTop: 12 },
  stat: { flex: 1, borderWidth: StyleSheet.hairlineWidth * 2, paddingVertical: 16, paddingHorizontal: 8, alignItems: 'center' },
  statValue: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 24, letterSpacing: -0.4 },
  statLabel: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, marginTop: 4 },
  emptyHistory: { borderWidth: StyleSheet.hairlineWidth * 2, padding: 24, alignItems: 'center', gap: 10 },
  emptyText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, textAlign: 'center' },
  reported: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: StyleSheet.hairlineWidth * 2, paddingHorizontal: 8, height: 22, marginTop: 6 },
  reportedText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11 },
  rateChip: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: StyleSheet.hairlineWidth * 2, paddingHorizontal: 10, height: 26 },
  rateChipText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12 },
  tripRow: { flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth * 2, padding: 16, marginBottom: 10 },
  tripMain: { flex: 1 },
  tripRoute: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16 },
  tripMeta: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, marginTop: 3 },
  payCard: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: StyleSheet.hairlineWidth * 2, padding: 16 },
  payIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  payName: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16 },
  payNumber: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, marginTop: 2 },
  signOut: { marginTop: 28, height: 56, borderWidth: StyleSheet.hairlineWidth * 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  signOutText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16 },
  devRow: { alignItems: 'center', gap: 14, paddingTop: 20 },
  devText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12 },
});
