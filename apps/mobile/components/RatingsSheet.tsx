import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { DriverRatingsResponse, LeaderboardEntry } from '@trotrolink/shared';
import { Stars } from '@/components/Stars';
import { useColors } from '@/hooks/useColors';
import { api } from '@/lib/api';
import { colors as tokens } from '@/lib/colors';

type Props = { entry: LeaderboardEntry | null; forceEmpty: boolean; onClose: () => void };

function ago(iso: string): string {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  return mins < 60 ? `${mins} min ago` : `${Math.round(mins / 60)} h ago`;
}

/** The last 10 ratings behind one driver's standing. */
export function RatingsSheet({ entry, forceEmpty, onClose }: Props) {
  const colors = useColors();
  const [data, setData] = useState<DriverRatingsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!entry) return;
    let active = true;
    setData(null);
    setError(false);
    setLoading(true);
    api
      .driverRatings(entry.shortCode, forceEmpty ? { mock: 'off' } : {})
      .then((d) => active && setData(d))
      .catch(() => active && setError(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [entry, forceEmpty]);

  return (
    <Modal visible={!!entry} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: `${tokens.background}99` }]} onPress={onClose} accessibilityLabel="Close" />
        {entry ? (
          <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border, borderTopLeftRadius: colors.radiusModal, borderTopRightRadius: colors.radiusModal }]}>
            <View style={[styles.grabber, { backgroundColor: colors.border }]} />
            <View style={styles.head}>
              <View style={[styles.codePill, { backgroundColor: colors.secondary, borderRadius: colors.radiusPill }]}>
                <Text style={[styles.codeText, { color: colors.accent }]}>{entry.shortCode}</Text>
              </View>
              <Text style={[styles.driver, { color: colors.mutedForeground }]}>{entry.driverName}</Text>
            </View>
            <View style={styles.avgRow}>
              <Text style={[styles.avg, { color: colors.foreground }]}>{entry.avgRating.toFixed(1)}</Text>
              <Feather name="star" size={22} color={colors.accent} />
              <Text style={[styles.count, { color: colors.mutedForeground }]}>{entry.totalRatings} ratings today</Text>
            </View>
            <Text style={[styles.section, { color: colors.mutedForeground }]}>LAST 10 RATINGS</Text>

            {loading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 32 }} />
            ) : error ? (
              <Text style={[styles.empty, { color: colors.mutedForeground }]}>Couldn&apos;t load ratings. Try again.</Text>
            ) : data && data.entries.length === 0 ? (
              <Text style={[styles.empty, { color: colors.mutedForeground }]}>No ratings in the last 24 hours.</Text>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} style={styles.list}>
                {data?.entries.map((r, i) => (
                  <View key={`${r.ratedAt}-${i}`} style={[styles.row, i > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                    <View style={styles.rowTop}>
                      <Stars rating={r.rating} />
                      <Text style={[styles.time, { color: colors.mutedForeground }]}>{ago(r.ratedAt)}</Text>
                    </View>
                    {r.comment ? <Text style={[styles.comment, { color: colors.foreground }]}>{r.comment}</Text> : null}
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: { padding: 24, paddingBottom: 32, borderWidth: 1, borderBottomWidth: 0, maxHeight: '85%' },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 18 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  codePill: { paddingHorizontal: 12, paddingVertical: 5 },
  codeText: { fontFamily: 'Inter_700Bold', fontSize: 13, letterSpacing: 1 },
  driver: { fontFamily: 'Inter_500Medium', fontSize: 14 },
  avgRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  avg: { fontFamily: 'Inter_700Bold', fontSize: 40 },
  count: { fontFamily: 'Inter_500Medium', fontSize: 14, marginLeft: 6 },
  section: { fontFamily: 'Inter_600SemiBold', fontSize: 12, letterSpacing: 1.3, marginTop: 20, marginBottom: 6 },
  list: { flexGrow: 0 },
  empty: { fontFamily: 'Inter_500Medium', fontSize: 14, textAlign: 'center', paddingVertical: 32 },
  row: { paddingVertical: 12 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  time: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  comment: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, marginTop: 6 },
});
