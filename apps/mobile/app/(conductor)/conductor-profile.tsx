import React, { useCallback } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RoleSwitcher } from '@/components/RoleSwitcher';
import { SectionHeader } from '@/components/SectionHeader';
import { SettingsGroup } from '@/components/SettingsGroup';
import { useColors } from '@/hooks/useColors';
import { api } from '@/lib/api';
import { confirmDeleteAccount, confirmSignOut } from '@/lib/auth';
import { useConductorVehicle } from '@/lib/conductor';
import { setRole, type Role } from '@/lib/storage';
import { showToast } from '@/lib/toast';

function InfoRow({ icon, label, value, divider }: { icon: React.ComponentProps<typeof Feather>['name']; label: string; value: string; divider?: boolean }) {
  const colors = useColors();
  return (
    <View style={[styles.infoRow, divider && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
      <Feather name={icon} size={18} color={colors.mutedForeground} />
      <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.foreground }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

export default function ConductorProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, loading, error, reload } = useConductorVehicle();

  useFocusEffect(
    useCallback(() => {
      void setRole('conductor');
    }, []),
  );

  const switchRole = async (next: Role) => {
    if (next === 'conductor') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await setRole('passenger');
    router.navigate('/');
  };

  const signOut = () =>
    confirmSignOut(
      () => {
      // No (auth)/login screen exists yet, so sign-out clears local data and returns to Scan as a guest.
      showToast('Signed out');
      router.navigate('/');
      },
      () => api.conductorLogout(),
    );

  const card = { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16 }]} showsVerticalScrollIndicator={false}>
      <Text style={[styles.title, { color: colors.foreground }]}>Profile</Text>

      <SectionHeader>Vehicle</SectionHeader>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : error || !data ? (
        <View style={[styles.errorCard, card]}>
          <Feather name="wifi-off" size={22} color={colors.mutedForeground} />
          <Text style={[styles.errorText, { color: colors.mutedForeground }]}>Couldn&apos;t load your vehicle. Check your connection.</Text>
          <Pressable onPress={() => void reload()} accessibilityRole="button" style={[styles.retry, { borderColor: colors.border, borderRadius: colors.radiusPill }]}>
            <Text style={[styles.retryText, { color: colors.foreground }]}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <View style={[styles.infoCard, card]}>
          <InfoRow icon="truck" label="Vehicle" value={data.vehicle.shortCode} />
          <InfoRow icon="user" label="Driver" value={data.vehicle.driverName} divider />
          <InfoRow icon="user-check" label="Conductor" value={data.vehicle.conductorName} divider />
          <InfoRow icon="map" label="Route" value={`${data.route.origin} → ${data.route.destination}`} divider />
        </View>
      )}

      <SectionHeader>Role</SectionHeader>
      <RoleSwitcher role="conductor" onChange={(r) => void switchRole(r)} />

      <SectionHeader>Settings</SectionHeader>
      <SettingsGroup
        onDeleteAccount={() =>
          confirmDeleteAccount('conductor', () => {
            showToast('Account deleted');
            router.navigate('/');
          })
        }
      />

      <Pressable onPress={signOut} accessibilityRole="button" style={[styles.signOut, { borderColor: colors.destructive, borderRadius: colors.radiusPill }]}>
        <Feather name="log-out" size={18} color={colors.destructive} />
        <Text style={[styles.signOutText, { color: colors.destructive }]}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 24, paddingBottom: 48 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 32, marginBottom: -8 },
  center: { paddingVertical: 40, alignItems: 'center' },
  errorCard: { borderWidth: 1, padding: 24, alignItems: 'center', gap: 12 },
  errorText: { fontFamily: 'Inter_500Medium', fontSize: 14, textAlign: 'center' },
  retry: { height: 44, paddingHorizontal: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  retryText: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  infoCard: { borderWidth: 1, paddingHorizontal: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  infoLabel: { fontFamily: 'Inter_500Medium', fontSize: 14, width: 84 },
  infoValue: { flex: 1, textAlign: 'right', fontFamily: 'Inter_700Bold', fontSize: 15 },
  signOut: { marginTop: 28, height: 56, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  signOutText: { fontFamily: 'Inter_700Bold', fontSize: 16 },
});
