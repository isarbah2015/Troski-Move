import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { colors } from '@/lib/colors';
import type { ResolvedVehicle, Stop } from '@trotrolink/shared';
import { formatCedis } from '@/lib/api';

type Props = {
  resolved: ResolvedVehicle | null;
  onClose: () => void;
  onPay: (stop: Stop) => void;
};

/** Pick the alighting stop, see the official fare and the rounded-up amount to pay. */
export function StopSheet({ resolved, onClose, onPay }: Props) {
  const colors = useColors();
  const [selected, setSelected] = useState<string | null>(null);

  // Origin is where the passenger boards, so it is not a valid alighting stop.
  const stops = resolved ? resolved.route.stops.slice(1) : [];
  const stop = stops.find((s) => s.name === selected) ?? null;

  const close = () => {
    setSelected(null);
    onClose();
  };

  return (
    <Modal visible={!!resolved} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.root}>
        <Pressable style={styles.scrim} onPress={close} accessibilityLabel="Close" />
        <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border, borderTopLeftRadius: colors.radiusModal, borderTopRightRadius: colors.radiusModal }]}>
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          {resolved ? (
            <>
              <View style={styles.headRow}>
                <View style={[styles.codePill, { backgroundColor: colors.secondary, borderRadius: colors.radiusPill }]}>
                  <Text style={[styles.codeText, { color: colors.accent }]}>{resolved.vehicle.shortCode}</Text>
                </View>
                <Text style={[styles.conductor, { color: colors.mutedForeground }]}>Conductor {resolved.vehicle.conductorName}</Text>
              </View>
              <Text style={[styles.route, { color: colors.foreground }]}>{resolved.route.name}</Text>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>WHERE ARE YOU GETTING OFF?</Text>

              <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
                {stops.map((s) => {
                  const active = s.name === selected;
                  return (
                    <Pressable
                      key={s.name}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setSelected(s.name);
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`${s.name}, ${formatCedis(s.amountToPay)}`}
                      style={[styles.row, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.background : 'transparent', borderRadius: colors.radius }]}
                    >
                      <Feather name={active ? 'check-circle' : 'circle'} size={20} color={active ? colors.primary : colors.mutedForeground} />
                      <Text style={[styles.stopName, { color: colors.foreground }]}>{s.name}</Text>
                      <Text style={[styles.stopFare, { color: colors.mutedForeground }]}>{formatCedis(s.officialFare)}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {stop ? (
                <View style={styles.fareBox}>
                  <Text style={[styles.fareLine, { color: colors.mutedForeground }]}>
                    Official fare {formatCedis(stop.officialFare)} · rounded up
                  </Text>
                  <Text style={[styles.fareAmount, { color: colors.foreground }]}>{formatCedis(stop.amountToPay)}</Text>
                </View>
              ) : null}

              <Pressable
                disabled={!stop}
                onPress={() => stop && onPay(stop)}
                accessibilityRole="button"
                accessibilityState={{ disabled: !stop }}
                style={[styles.cta, { backgroundColor: colors.primary, opacity: stop ? 1 : 0.4, borderRadius: colors.radiusPill }]}
              >
                <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>
                  {stop ? `Pay ${formatCedis(stop.amountToPay)} with MoMo` : 'Choose your stop'}
                </Text>
              </Pressable>
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: `${colors.background}99` },
  sheet: { padding: 24, paddingBottom: 36, borderWidth: 1, borderBottomWidth: 0, maxHeight: '88%' },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 18 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  codePill: { paddingHorizontal: 12, paddingVertical: 5 },
  codeText: { fontFamily: 'Inter_700Bold', fontSize: 13, letterSpacing: 1 },
  conductor: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  route: { fontFamily: 'Inter_700Bold', fontSize: 22, marginBottom: 18 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 1, marginBottom: 10 },
  list: { flexGrow: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 8 },
  stopName: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 16 },
  stopFare: { fontFamily: 'Inter_500Medium', fontSize: 14 },
  fareBox: { marginTop: 10, alignItems: 'center' },
  fareLine: { fontFamily: 'Inter_400Regular', fontSize: 13 },
  fareAmount: { fontFamily: 'Inter_700Bold', fontSize: 34, marginTop: 2 },
  cta: { marginTop: 16, height: 56, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: 'Inter_700Bold', fontSize: 17 },
});
