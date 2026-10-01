import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { payAmount, tripFare, type ResolvedVehicle, type Stop } from '@trotrolink/shared';
import { formatCedis } from '@/lib/api';
import { GOLD, SCRIM } from '@/lib/colors';
import { Approx } from '@/components/Approx';
import { useT } from '@/lib/i18n';
import { PrimaryButton } from '@/components/PrimaryButton';
import { NetworkPicker } from '@/components/NetworkPicker';
import { MOMO_NETWORK_LABEL } from '@trotrolink/shared';
import { useMomoNetwork } from '@/lib/network';

type Props = {
  resolved: ResolvedVehicle | null;
  onClose: () => void;
  /** `customNote` is set when the passenger's stop is between anchors: `stop` is then the nearest anchor behind it. */
  onPay: (stop: Stop, customNote?: string, boardingStop?: string) => void;
};

/** Pick the alighting stop, see the official fare and the rounded-up amount to pay. */
export function StopSheet({ resolved, onClose, onPay }: Props) {
  const [network, setNetwork] = useMomoNetwork();
  const colors = useColors();
  const t = useT();
  const [selected, setSelected] = useState<string | null>(null);
  const [custom, setCustom] = useState(false);
  const [note, setNote] = useState('');

  const [boarding, setBoarding] = useState<string | null>(null);
  useEffect(() => {
    setBoarding(null);
    setSelected(null);
  }, [resolved?.vehicle.shortCode]);

  // Passengers can get on anywhere along the route, not only at the first stop. Default to where the trotro is now.
  const all = resolved?.route.stops ?? [];
  const names = all.map((x) => x.name);
  const hereName = resolved?.currentStop && names.includes(resolved.currentStop) ? resolved.currentStop : names[0] ?? '';
  const boardName = boarding && names.includes(boarding) ? boarding : hereName;
  const boardIdx = Math.max(0, names.indexOf(boardName));
  const step = resolved?.roundingStep ?? 1;
  // Each later stop priced from where the passenger gets on: a specific stop-to-stop fare wins, else the difference.
  const stops: Stop[] = all.slice(boardIdx + 1).map((x) => {
    const official = tripFare(all.map((y) => ({ name: y.name, fare: y.officialFare })), resolved?.pairFares, boardName, x.name) ?? x.officialFare;
    return { ...x, officialFare: official, amountToPay: payAmount(official, step) };
  });
  const stop = stops.find((x) => x.name === selected) ?? null;
  const customNote = custom ? note.trim() : '';
  // A custom drop-off needs a note describing where exactly; the fare is for the anchor before it.
  const suspended = !!resolved?.vehicle.suspended;
  const ready = !!stop && !suspended && (!custom || customNote.length >= 3);

  const close = () => {
    setSelected(null);
    setBoarding(null);
    setCustom(false);
    setNote('');
    onClose();
  };

  return (
    <Modal visible={!!resolved} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
        <Pressable style={styles.scrim} onPress={close} accessibilityLabel="Close" />
        <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border, borderTopLeftRadius: colors.radiusModal, borderTopRightRadius: colors.radiusModal }]}>
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          {resolved ? (
            <>
              <View style={styles.headRow}>
                <View style={[styles.codePill, { backgroundColor: colors.secondary, borderRadius: colors.radiusPill }]}>
                  <Text style={[styles.codeText, { color: GOLD }]}>{resolved.vehicle.shortCode}</Text>
                </View>
                <Text style={[styles.conductor, { color: colors.mutedForeground }]}>{t('stop.conductor')} {resolved.vehicle.conductorName}</Text>
              </View>
              {resolved.vehicle.verified ? (
                <View style={[styles.verified, { backgroundColor: colors.scheme === 'light' ? 'rgba(7,128,90,0.10)' : 'rgba(43,217,159,0.13)', borderRadius: colors.radiusPill }]} accessibilityLabel="GPRTU verified vehicle">
                  <Feather name="shield" size={14} color={colors.primary} />
                  <Text style={[styles.verifiedText, { color: colors.primary }]}>{t('verified.badge')}</Text>
                </View>
              ) : null}
              {suspended ? (
                <View style={[styles.banner, { borderColor: colors.destructive, borderRadius: colors.radius }]} accessibilityRole="alert">
                  <Feather name="slash" size={18} color={colors.destructive} />
                  <View style={styles.bannerText}>
                    <Text style={[styles.bannerTitle, { color: colors.destructive }]}>{t('suspended.title')}</Text>
                    <Text style={[styles.bannerBody, { color: colors.mutedForeground }]}>{t('suspended.body')}</Text>
                  </View>
                </View>
              ) : null}
              {resolved.fareNotice ? (
                <View style={[styles.notice, { borderColor: colors.accent, borderRadius: colors.radiusPill }]}>
                  <Feather name="trending-up" size={13} color={colors.accent} />
                  <Text style={[styles.noticeText, { color: colors.accent }]}>{t('fare.notice', { date: new Date(resolved.fareNotice.effectiveFrom).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) })}</Text>
                </View>
              ) : null}
              <Text style={[styles.route, { color: colors.foreground }]}>{resolved.route.name}</Text>
              {/* Where the passenger gets on: the trotro's current stop by default, any other stop on the route if they board there */}
              <Text style={[styles.label, { color: colors.mutedForeground }]}>{t('stop.on').toUpperCase()}</Text>
              <View style={styles.boardRow}>
                {all.slice(0, -1).map((x) => {
                  const on = x.name === boardName;
                  const here = x.name === hereName;
                  return (
                    <Pressable
                      key={x.name}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setBoarding(x.name);
                        setSelected(null);
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={`Get on at ${x.name}${here ? ', where the trotro is now' : ''}`}
                      style={[styles.boardChip, { borderColor: on ? colors.primary : colors.border, backgroundColor: on ? (colors.scheme === 'light' ? 'rgba(7,128,90,0.10)' : 'rgba(43,217,159,0.14)') : 'transparent', borderRadius: colors.radiusPill }]}
                    >
                      {here ? <View style={[styles.hereDot, { backgroundColor: colors.primary }]} /> : null}
                      <Text style={[styles.boardText, { color: on ? colors.primary : colors.foreground }]}>{x.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 14 }]}>{(custom ? t('stop.nearest') : t('stop.where')).toUpperCase()}</Text>

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

              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setCustom((c) => !c);
                }}
                accessibilityRole="button"
                style={styles.customLink}
              >
                <Feather name={custom ? 'list' : 'map-pin'} size={14} color={colors.primary} />
                <Text style={[styles.customText, { color: colors.primary }]}>{custom ? t('stop.customBack') : t('stop.custom')}</Text>
              </Pressable>
              {custom ? (
                <View>
                  <TextInput
                    value={note}
                    onChangeText={setNote}
                    placeholder={t('stop.notePlaceholder')}
                    placeholderTextColor={colors.mutedForeground}
                    maxLength={120}
                    accessibilityLabel={t('stop.notePlaceholder')}
                    style={[styles.noteInput, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border, borderRadius: colors.radius }]}
                  />
                  <Text style={[styles.noteHint, { color: colors.mutedForeground }]}>{t('stop.noteHint')}</Text>
                </View>
              ) : null}

              {stop ? (
                <View style={styles.fareBox}>
                  <Text style={[styles.fareLine, { color: colors.mutedForeground }]}>
                    {t('stop.official')} {formatCedis(stop.officialFare)}{stop.amountToPay > stop.officialFare + 0.001 ? ` · ${t('stop.roundedUp')}` : ''}
                  </Text>
                  <Text style={[styles.fareAmount, { color: colors.foreground }]}>{formatCedis(stop.amountToPay)}</Text>
                  <Approx amount={stop.amountToPay} />
                </View>
              ) : null}

              <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 10 }]}>{t('stop.payWith').toUpperCase()}</Text>
              <NetworkPicker value={network} onChange={setNetwork} />

              <PrimaryButton
                disabled={!ready}
                onPress={() => stop && onPay(stop, customNote || undefined, boardName)}
                label={stop ? `${t('stop.pay', { amount: formatCedis(stop.amountToPay) }).replace(/MoMo/, MOMO_NETWORK_LABEL[network])}` : t('stop.choose')}
                style={styles.cta}
              />
            </>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  boardRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  boardChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: StyleSheet.hairlineWidth * 2, paddingHorizontal: 14, paddingVertical: 9 },
  boardText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13 },
  hereDot: { width: 7, height: 7, borderRadius: 4 },
  verified: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, marginTop: 10 },
  verifiedText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, letterSpacing: 0.3 },
  banner: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', borderWidth: StyleSheet.hairlineWidth * 2, padding: 14, marginTop: 12 },
  bannerText: { flex: 1 },
  bannerTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14 },
  bannerBody: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, lineHeight: 19, marginTop: 2 },
  notice: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: StyleSheet.hairlineWidth * 2, paddingHorizontal: 10, paddingVertical: 4, marginTop: 10 },
  noticeText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12 },
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: SCRIM },
  sheet: { padding: 24, paddingBottom: 40, borderWidth: StyleSheet.hairlineWidth * 2, borderBottomWidth: 0, maxHeight: '88%' },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 18 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  codePill: { paddingHorizontal: 12, paddingVertical: 5 },
  codeText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, letterSpacing: 1 },
  conductor: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13 },
  route: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 22, marginBottom: 18 },
  label: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, letterSpacing: 1, marginBottom: 10 },
  list: { flexGrow: 0, flexShrink: 1, minHeight: 200 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: StyleSheet.hairlineWidth * 2, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 8 },
  stopName: { flex: 1, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 16 },
  stopFare: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14 },
  customLink: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 },
  customText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14 },
  noteInput: { borderWidth: StyleSheet.hairlineWidth * 2, height: 52, paddingHorizontal: 14, fontFamily: 'PlusJakartaSans_500Medium', fontSize: 15 },
  noteHint: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, marginTop: 6 },
  fareBox: { marginTop: 10, alignItems: 'center' },
  fareLine: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13 },
  fareAmount: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 30, letterSpacing: -0.6, marginTop: 0 },
  cta: { marginTop: 16 },
  ctaText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 17 },
});
