import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { LeaderboardEntry, LeaderboardResponse } from '@trotrolink/shared';
import { RatingsSheet } from '@/components/RatingsSheet';
import { SectionHeader } from '@/components/SectionHeader';
import { useColors } from '@/hooks/useColors';
import { api } from '@/lib/api';
import { colors as tokens } from '@/lib/colors';
import { getConductorVehicleCode } from '@/lib/storage';

export default function LeaderboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<LeaderboardEntry | null>(null);
  const [forceEmpty, setForceEmpty] = useState(false);

  const load = useCallback(async (empty: boolean, quiet = false) => {
    if (!quiet) setLoading(true);
    setError(false);
    try {
      const forVehicle = await getConductorVehicleCode();
      setData(await api.dailyLeaderboard({ forVehicle, ...(empty ? { mock: 'off' as const } : {}) }));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(forceEmpty, true);
    }, [load, forceEmpty]),
  );

  // Rank colours from the locked tokens: gold, silver (secondary text), bronze (muted gold).
  const rankColor = (rank: number) => (rank === 1 ? tokens.highlightGold : rank === 2 ? tokens.textSecondary : rank === 3 ? `${tokens.highlightGold}99` : colors.mutedForeground);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.primary} onRefresh={() => { setRefreshing(true); void load(forceEmpty, true); }} />}
    >
      <View style={styles.headRow}>
        <Feather name="award" size={26} color={colors.accent} />
        <Text style={[styles.title, { color: colors.foreground }]}>Driver of the Day</Text>
      </View>
      <Text style={[styles.sub, { color: colors.mutedForeground }]}>Today&apos;s top 5 by rating</Text>
      <Text style={[styles.sub, { color: colors.mutedForeground }]}>Updated hourly · Min 3 ratings</Text>
      {data?.mock ? (
        <View style={[styles.sample, { borderColor: colors.border, borderRadius: colors.radiusPill }]}>
          <Text style={[styles.sampleText, { color: colors.mutedForeground }]}>Sample data until ratings go live</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : error || !data ? (
        <View style={[styles.stateCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <Feather name="wifi-off" size={22} color={colors.mutedForeground} />
          <Text style={[styles.stateText, { color: colors.mutedForeground }]}>Couldn&apos;t load the leaderboard. Check your connection.</Text>
          <Pressable onPress={() => void load(forceEmpty)} accessibilityRole="button" style={[styles.retry, { borderColor: colors.border, borderRadius: colors.radiusPill }]}>
            <Text style={[styles.retryText, { color: colors.foreground }]}>Retry</Text>
          </Pressable>
        </View>
      ) : data.entries.length === 0 ? (
        <View style={[styles.stateCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <Feather name="star" size={22} color={colors.mutedForeground} />
          <Text style={[styles.stateText, { color: colors.mutedForeground }]}>No ratings yet today. Rate a driver after your trip.</Text>
        </View>
      ) : (
        <>
          <View style={styles.list}>
            {data.entries.map((e) => {
              const first = e.rank === 1;
              return (
                <Pressable
                  key={e.shortCode}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelected(e);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Rank ${e.rank}, ${e.shortCode}, ${e.driverName}, rated ${e.avgRating.toFixed(1)} from ${e.totalRatings} ratings`}
                  style={[
                    styles.row,
                    { backgroundColor: colors.card, borderColor: first ? tokens.highlightGold : colors.border, borderRadius: colors.radius },
                    first && { shadowColor: tokens.highlightGold, shadowOpacity: 0.45, shadowRadius: 14, shadowOffset: { width: 0, height: 0 } },
                  ]}
                >
                  <View style={styles.rankCol}>
                    <Text style={[styles.rank, { color: rankColor(e.rank) }]}>{e.rank}</Text>
                    {first ? <Feather name="award" size={16} color={tokens.highlightGold} /> : null}
                  </View>
                  <View style={styles.mid}>
                    <Text style={[styles.code, { color: colors.foreground }]}>{e.shortCode}</Text>
                    <Text style={[styles.driver, { color: colors.mutedForeground }]}>{e.driverName}</Text>
                    <Text style={[styles.count, { color: colors.mutedForeground }]}>{e.totalRatings} ratings</Text>
                  </View>
                  <View style={styles.right}>
                    <Feather name="star" size={16} color={colors.accent} />
                    <Text style={[styles.avg, { color: colors.foreground }]}>{e.avgRating.toFixed(1)}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {data.you ? (
            <>
              <SectionHeader>Your rank</SectionHeader>
              <View style={[styles.you, { backgroundColor: colors.card, borderColor: colors.primary, borderRadius: colors.radius }]}>
                <View style={styles.youRow}>
                  <Text style={[styles.youMain, { color: colors.primary }]}>#{data.you.rank} · {data.you.shortCode} ·</Text>
                  <Feather name="star" size={16} color={colors.accent} />
                  <Text style={[styles.youMain, { color: colors.primary }]}>{data.you.avgRating.toFixed(1)}</Text>
                </View>
                <Text style={[styles.youMeta, { color: colors.mutedForeground }]}>{data.you.ratingsThisWeek} ratings this week</Text>
              </View>
            </>
          ) : null}
        </>
      )}

      {__DEV__ ? (
        <Pressable
          onPress={() => {
            const next = !forceEmpty;
            setForceEmpty(next);
            void load(next);
          }}
          accessibilityRole="button"
          style={styles.devLink}
        >
          <Text style={[styles.devText, { color: colors.mutedForeground }]}>{forceEmpty ? 'Show sample data (dev only)' : 'Show real / empty data (dev only)'}</Text>
        </Pressable>
      ) : null}

      <RatingsSheet entry={selected} forceEmpty={forceEmpty} onClose={() => setSelected(null)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 24, paddingBottom: 40 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 28 },
  sub: { fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 20 },
  sample: { alignSelf: 'flex-start', borderWidth: 1, paddingHorizontal: 12, paddingVertical: 4, marginTop: 10 },
  sampleText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  center: { paddingVertical: 80, alignItems: 'center' },
  stateCard: { borderWidth: 1, padding: 28, alignItems: 'center', gap: 12, marginTop: 24 },
  stateText: { fontFamily: 'Inter_500Medium', fontSize: 15, textAlign: 'center', lineHeight: 22 },
  retry: { height: 44, paddingHorizontal: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  retryText: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  list: { marginTop: 20, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, padding: 16, gap: 14 },
  rankCol: { width: 44, alignItems: 'center', gap: 2 },
  rank: { fontFamily: 'Inter_700Bold', fontSize: 28 },
  mid: { flex: 1 },
  code: { fontFamily: 'Inter_700Bold', fontSize: 18, letterSpacing: 0.5 },
  driver: { fontFamily: 'Inter_500Medium', fontSize: 14, marginTop: 2 },
  count: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  avg: { fontFamily: 'Inter_700Bold', fontSize: 20 },
  you: { borderWidth: 1.5, padding: 18, gap: 6 },
  youRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  youMain: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  youMeta: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  devLink: { alignSelf: 'center', paddingVertical: 24 },
  devText: { fontFamily: 'Inter_500Medium', fontSize: 12 },
});
