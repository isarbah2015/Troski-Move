import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import QRCode from 'react-native-qrcode-svg';
import type { ServerTrip } from '@trotrolink/shared';
import { useColors } from '@/hooks/useColors';
import { formatCedis } from '@/lib/api';
import { EMERALD, QR_BG, QR_FG, SCRIM, WHITE } from '@/lib/colors';

type Props = { trip: ServerTrip | null; onClose: () => void; onConfirmAlight: (trip: ServerTrip) => void };

/** A paid passenger's trip. The QR matches the one on the passenger's own phone, so the conductor can verify it by eye. */
export function PassengerSheet({ trip, onClose, onConfirmAlight }: Props) {
  const colors = useColors();
  return (
    <Modal visible={!!trip} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: SCRIM }]} onPress={onClose} accessibilityLabel="Close" />
        {trip ? (
          <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border, borderTopLeftRadius: colors.radiusModal, borderTopRightRadius: colors.radiusModal }]}>
            <View style={[styles.grabber, { backgroundColor: colors.border }]} />
            <View style={[styles.paid, { backgroundColor: colors.secondary, borderColor: colors.primary, borderRadius: colors.radiusPill }]}>
              <Feather name="shield" size={14} color={EMERALD} />
              <Text style={[styles.paidText, { color: WHITE }]}>PAID · {trip.tripId}</Text>
            </View>
            <Text style={[styles.title, { color: colors.foreground }]}>
              {trip.boardingStop} → {trip.alightingStop}
            </Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>
              Paid {formatCedis(trip.amountPaid)} · now at {trip.currentStop}
            </Text>
            <View style={styles.qrWrap}>
              <View style={[styles.qrBox, { borderRadius: colors.radius }]}>
                <QRCode value={`trotrolink://trip/${trip.tripId}`} size={150} color={QR_FG} backgroundColor={QR_BG} />
              </View>
              <Text style={[styles.hint, { color: colors.mutedForeground }]}>Matches the QR on the passenger&apos;s Trip screen</Text>
            </View>
            {trip.overstay ? (
              <Pressable
                onPress={() => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                  onConfirmAlight(trip);
                }}
                accessibilityRole="button"
                style={[styles.cta, { backgroundColor: colors.accent, borderRadius: colors.radiusPill }]}
              >
                <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>Confirm they&apos;re getting off here</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: { padding: 24, paddingBottom: 36, borderWidth: 1, borderBottomWidth: 0 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 16 },
  paid: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  paidText: { fontFamily: 'Inter_700Bold', fontSize: 12, letterSpacing: 0.5 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 24, marginTop: 14 },
  sub: { fontFamily: 'Inter_500Medium', fontSize: 14, marginTop: 4 },
  qrWrap: { alignItems: 'center', marginVertical: 20 },
  qrBox: { padding: 12, backgroundColor: QR_BG },
  hint: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 10 },
  cta: { height: 54, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: 'Inter_700Bold', fontSize: 16 },
});
