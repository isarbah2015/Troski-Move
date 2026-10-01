import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import QRCode from 'react-native-qrcode-svg';
import type { TripRating, TripRecord } from '@trotrolink/shared';
import { Stars } from '@/components/Stars';
import { useColors } from '@/hooks/useColors';
import { formatCedis } from '@/lib/api';
import { formatWhen } from '@/lib/profile';
import { QR_BG, QR_FG, SCRIM } from '@/lib/colors';

type Props = { trip: TripRecord | null; rating?: TripRating | null; onClose: () => void; onRideAgain: (vehicleCode: string) => void };

function clock(iso: string, plusMinutes: number) {
  return new Date(new Date(iso).getTime() + plusMinutes * 60_000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function TripDetailSheet({ trip, rating, onClose, onRideAgain }: Props) {
  const colors = useColors();

  // Stop times: start time at boarding, then the cumulative leg times along the route.
  const rows = trip
    ? (() => {
        const names = trip.stops.map((s) => s.name);
        const b = names.indexOf(trip.boardingStop);
        const a = names.indexOf(trip.alightingStop);
        let cum = 0;
        return trip.stops.map((s, i) => {
          if (i > b && i <= a) cum += s.etaMinutes;
          const onRide = i >= b && i <= a;
          return { ...s, onRide, time: onRide ? clock(trip.startedAt, i === b ? 0 : cum) : null };
        });
      })()
    : [];

  return (
    <Modal visible={!!trip} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: SCRIM }]} onPress={onClose} accessibilityLabel="Close" />
        {trip ? (
          <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border, borderTopLeftRadius: colors.radiusModal, borderTopRightRadius: colors.radiusModal }]}>
            <View style={[styles.grabber, { backgroundColor: colors.border }]} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.title, { color: colors.foreground }]}>{trip.boardingStop} → {trip.alightingStop}</Text>
              <Text style={[styles.sub, { color: colors.mutedForeground }]}>{trip.vehicleShortCode} · {formatWhen(trip.startedAt)}</Text>
              {rating ? (
                <View style={styles.ratingBlock}>
                  <View style={styles.ratingLine}>
                    <Text style={[styles.ratingLabel, { color: colors.mutedForeground }]}>Driver</Text>
                    <Stars rating={rating.driverRating} />
                  </View>
                  <View style={styles.ratingLine}>
                    <Text style={[styles.ratingLabel, { color: colors.mutedForeground }]}>Conductor</Text>
                    <Stars rating={rating.conductorRating} />
                  </View>
                  {rating.comment ? <Text style={[styles.comment, { color: colors.foreground }]}>&ldquo;{rating.comment}&rdquo;</Text> : null}
                </View>
              ) : (
                <View style={styles.ratingRow}><Stars rating={trip.rating} /></View>
              )}

              <View style={styles.qrWrap}>
                <View style={[styles.qrBox, { borderRadius: colors.radius }]}>
                  <QRCode value={`trotrolink://trip/${trip.tripId}`} size={132} color={QR_FG} backgroundColor={QR_BG} />
                </View>
                <Text style={[styles.ref, { color: colors.mutedForeground }]}>{trip.tripId}</Text>
              </View>

              <View style={[styles.box, { borderColor: colors.border, borderRadius: colors.radius }]}>
                {rows.map((r, i) => (
                  <View key={r.name} style={[styles.stopRow, i > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                    <Text style={[styles.stopName, { color: r.onRide ? colors.foreground : colors.mutedForeground }]}>{r.name}</Text>
                    <Text style={[styles.stopTime, { color: colors.mutedForeground }]}>{r.time ?? '—'}</Text>
                  </View>
                ))}
              </View>

              <View style={[styles.box, { borderColor: colors.border, borderRadius: colors.radius, marginTop: 12 }]}>
                <View style={styles.fareRow}>
                  <Text style={[styles.fareLabel, { color: colors.mutedForeground }]}>Official fare</Text>
                  <Text style={[styles.fareValue, { color: colors.foreground }]}>{formatCedis(trip.officialFare)}</Text>
                </View>
                <View style={styles.fareRow}>
                  <Text style={[styles.fareLabel, { color: colors.mutedForeground }]}>Rounded up</Text>
                  <Text style={[styles.fareValue, { color: colors.foreground }]}>+ {formatCedis(trip.amountPaid - trip.officialFare)}</Text>
                </View>
                <View style={[styles.fareRow, { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                  <Text style={[styles.fareTotalLabel, { color: colors.foreground }]}>Paid</Text>
                  <Text style={[styles.fareTotal, { color: colors.foreground }]}>{formatCedis(trip.amountPaid)}</Text>
                </View>
              </View>

              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onRideAgain(trip.vehicleShortCode);
                }}
                accessibilityRole="button"
                style={[styles.cta, { backgroundColor: colors.primary, borderRadius: colors.radiusPill }]}
              >
                <Feather name="rotate-cw" size={18} color={colors.primaryForeground} />
                <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>Ride again</Text>
              </Pressable>
            </ScrollView>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: { padding: 24, paddingBottom: 32, borderWidth: 1, borderBottomWidth: 0, maxHeight: '90%' },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 18 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 24 },
  sub: { fontFamily: 'Inter_500Medium', fontSize: 14, marginTop: 4 },
  ratingRow: { marginTop: 10 },
  ratingBlock: { marginTop: 10, gap: 6 },
  ratingLine: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ratingLabel: { fontFamily: 'Inter_500Medium', fontSize: 13, width: 78 },
  comment: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, marginTop: 4 },
  qrWrap: { alignItems: 'center', marginVertical: 20 },
  qrBox: { padding: 12, backgroundColor: QR_BG },
  ref: { fontFamily: 'Inter_600SemiBold', fontSize: 13, letterSpacing: 0.5, marginTop: 10 },
  box: { borderWidth: 1, paddingHorizontal: 16 },
  stopRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 },
  stopName: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  stopTime: { fontFamily: 'Inter_500Medium', fontSize: 14 },
  fareRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 },
  fareLabel: { fontFamily: 'Inter_500Medium', fontSize: 14 },
  fareValue: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  fareTotalLabel: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  fareTotal: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  cta: { height: 56, marginTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  ctaText: { fontFamily: 'Inter_700Bold', fontSize: 17 },
});
