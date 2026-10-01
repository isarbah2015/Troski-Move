import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { formatCedis, pairKey, payAmount, tripFare, type FaresResponse } from '@trotrolink/shared';
import { useColors } from '@/hooks/useColors';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';

const dateLabel = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** Official fares for every route, readable without scanning or signing in. Tap two stops to price a short hop. */
export default function FaresScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const t = useT();
  const tint = colors.scheme === 'light' ? 'rgba(7,128,90,0.10)' : 'rgba(43,217,159,0.14)';
  const [data, setData] = useState<FaresResponse | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [routeId, setRouteId] = useState<string | null>(null);
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api.fares();
      setData(d);
      setError(false);
      setRouteId((cur) => cur ?? d.routes[0]?.routeId ?? null);
    } catch {
      setError(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const route = useMemo(() => data?.routes.find((r) => r.routeId === routeId) ?? null, [data, routeId]);

  const pick = (name: string) => {
    Haptics.selectionAsync();
    if (!from || (from && to)) {
      setFrom(name);
      setTo(null);
    } else if (name === from) {
      setFrom(null);
    } else if (route && route.stops.findIndex((s) => s.name === name) > route.stops.findIndex((s) => s.name === from)) {
      setTo(name);
    } else {
      setFrom(name);
      setTo(null);
    }
  };

  const hop = route && from && to ? tripFare(route.stops, route.pairs, from, to) : null;
  const card = { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, ...colors.elevation };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 140 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.primary} />}
    >
      <Text style={[styles.title, { color: colors.foreground }]}>{t('fares.title')}</Text>
      <Text style={[styles.sub, { color: colors.mutedForeground }]}>{t('fares.sub')}</Text>

      {!data && !error ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> : null}
      {error ? (
        <Pressable onPress={load} style={[styles.banner, card]} accessibilityRole="button">
          <Feather name="wifi-off" size={18} color={colors.destructive} />
          <Text style={[styles.bannerText, { color: colors.foreground }]}>{t('fares.error')}</Text>
        </Pressable>
      ) : null}

      {data ? (
        <>
          <View style={[styles.banner, card]}>
            <Feather name="check-circle" size={18} color={colors.primary} />
            <Text style={[styles.bannerText, { color: colors.foreground }]}>
              {data.table ? `${data.table.label} · ${t('fares.since')} ${dateLabel(data.table.effectiveFrom)}` : t('fares.original')}
            </Text>
          </View>
          {data.upcoming ? (
            <View style={[styles.banner, { backgroundColor: 'rgba(212,164,55,0.14)', borderColor: 'rgba(212,164,55,0.5)', borderRadius: colors.radius }]}>
              <Feather name="clock" size={18} color="#B7791F" />
              <Text style={[styles.bannerText, { color: colors.foreground }]}>
                {t('fares.upcoming', { label: data.upcoming.label, date: dateLabel(data.upcoming.effectiveFrom) })}
              </Text>
            </View>
          ) : null}

          <Text style={[styles.label, { color: colors.mutedForeground }]}>{t('fares.route').toUpperCase()}</Text>
          <View style={styles.chips}>
            {data.routes.map((r) => {
              const on = r.routeId === routeId;
              return (
                <Pressable
                  key={r.routeId}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setRouteId(r.routeId);
                    setFrom(null);
                    setTo(null);
                  }}
                  style={[styles.chip, { borderRadius: colors.radiusPill, borderColor: on ? colors.primary : colors.border, backgroundColor: on ? tint : colors.card }]}
                >
                  <Text style={[styles.chipText, { color: on ? colors.primary : colors.foreground }]}>{r.origin} → {r.destination}</Text>
                </Pressable>
              );
            })}
          </View>

          {route ? (
            <>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>{t('fares.stops').toUpperCase()}</Text>
              <View style={[styles.list, card]}>
                {route.stops.map((s, i) => {
                  const isFrom = s.name === from;
                  const isTo = s.name === to;
                  const between = !!from && !!to && route.stops.findIndex((x) => x.name === from) < i && i < route.stops.findIndex((x) => x.name === to);
                  return (
                    <Pressable
                      key={s.name}
                      onPress={() => pick(s.name)}
                      accessibilityRole="button"
                      accessibilityLabel={`${s.name}, ${formatCedis(s.fare)} from ${route.origin}`}
                      style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: colors.border }, (isFrom || isTo) && { backgroundColor: tint }]}
                    >
                      <View style={styles.rail}>
                        <View style={[styles.line, { backgroundColor: colors.border, top: i === 0 ? '50%' : 0, bottom: i === route.stops.length - 1 ? '50%' : 0 }]} />
                        <View style={[styles.node, { borderColor: isFrom || isTo || between ? colors.primary : colors.border, backgroundColor: isFrom || isTo ? colors.primary : colors.card }]} />
                      </View>
                      <Text numberOfLines={1} style={[styles.stop, { color: colors.foreground }]}>{s.name}</Text>
                      {isFrom ? <Text style={[styles.tag, { color: colors.primary }]}>{t('fares.from').toUpperCase()}</Text> : null}
                      {isTo ? <Text style={[styles.tag, { color: colors.primary }]}>{t('fares.to').toUpperCase()}</Text> : null}
                      <Text style={[styles.fare, { color: i === 0 ? colors.mutedForeground : colors.foreground }]}>{i === 0 ? t('fares.start') : formatCedis(s.fare)}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={[styles.hop, card]}>
                {hop != null && from && to ? (
                  <>
                    <Text style={[styles.hopLabel, { color: colors.mutedForeground }]}>{from} → {to}</Text>
                    <Text style={[styles.hopFare, { color: colors.foreground }]}>{formatCedis(payAmount(hop, data.roundingStep))}</Text>
                    <Text style={[styles.hopNote, { color: colors.mutedForeground }]}>
                      {t('fares.official')} {formatCedis(hop)}{route.pairs[pairKey(from, to)] != null ? ` · ${t('fares.fixed')}` : ''}
                    </Text>
                  </>
                ) : (
                  <>
                    <Feather name="mouse-pointer" size={18} color={colors.mutedForeground} />
                    <Text style={[styles.hopNote, { color: colors.mutedForeground, marginTop: 6, textAlign: 'center' }]}>{from ? t('fares.pickTo') : t('fares.pickFrom')}</Text>
                  </>
                )}
              </View>
              <Text style={[styles.foot, { color: colors.mutedForeground }]}>{t('fares.foot')}</Text>
            </>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 24 },
  title: { fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -0.8, fontSize: 30 },
  sub: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 15, lineHeight: 22, marginTop: 6, marginBottom: 18 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: StyleSheet.hairlineWidth * 2, padding: 14, marginBottom: 10 },
  bannerText: { flex: 1, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, lineHeight: 19 },
  label: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, letterSpacing: 1.2, marginTop: 14, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: StyleSheet.hairlineWidth * 2, paddingHorizontal: 14, paddingVertical: 9 },
  chipText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13 },
  list: { borderWidth: StyleSheet.hairlineWidth * 2, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, minHeight: 52 },
  rail: { width: 14, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  line: { position: 'absolute', width: 2 },
  node: { width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  stop: { flex: 1, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15 },
  tag: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 10, letterSpacing: 1 },
  fare: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, minWidth: 64, textAlign: 'right' },
  hop: { borderWidth: StyleSheet.hairlineWidth * 2, padding: 18, marginTop: 12, alignItems: 'center', minHeight: 110, justifyContent: 'center' },
  hopLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13 },
  hopFare: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 38, letterSpacing: -1, marginTop: 4 },
  hopNote: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, marginTop: 2 },
  foot: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, lineHeight: 18, marginTop: 14 },
});
