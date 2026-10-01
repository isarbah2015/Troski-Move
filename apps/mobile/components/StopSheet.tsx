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
import { RouteSpine } from '@/components/RouteSpine';
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
  const [changing, setChanging] = useState(false);
  useEffect(() => {
    setBoarding(null);
    setSelected(null);
    setChanging(false);
  }, [resolved?.vehicle.shortCode]);

  // Passengers can get on anywhere along the route, not only at the first stop. Default to where the trotro is now.
  const all = resolved?.route.stops ?? [];
  const names = all.map((x) => x.name);
  const hereName = resolved?.currentStop && names.includes(resolved.currentStop) ? resolved.currentStop : names[0] ?? '';
  // Where they get on: what they chose, else where their phone says they are, else where the trotro is.
  const detected = resolved?.detectedBoarding && names.includes(resolved.detectedBoarding.stop) ? resolved.detectedBoarding : null;
  const boardName = boarding && names.includes(boarding) ? boarding : detected ? detected.stop : hereName;
  const tint = colors.scheme === 'light' ? 'rgba(7,128,90,0.10)' : 'rgba(43,217,159,0.14)';
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
              <ScrollView style={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" bounces={false}>
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
              {/* Where the passenger gets on: found from their location, so there is nothing to pick unless it is wrong. */}
              <View style={[styles.boardCard, { backgroundColor: detected ? tint : colors.background, borderColor: detected && !boarding ? colors.primary : colors.border, borderRadius: colors.radius }]}>
                <View style={[styles.boardIcon, { backgroundColor: detected && !boarding ? colors.primary : colors.secondary }]}>
                  <Feather name={detected && !boarding ? 'navigation' : 'map-pin'} size={18} color={detected && !boarding ? colors.primaryForeground : GOLD} />
                </View>
                <View style={styles.boardText2}>
                  <Text style={[styles.boardKicker, { color: colors.mutedForeground }]}>{(boarding ? t('stop.youChose') : detected ? t('stop.detected') : t('stop.on')).toUpperCase()}</Text>
                  <Text style={[styles.boardName, { color: colors.foreground }]} numberOfLines={1}>{boardName}</Text>
                  {!boarding && detected ? <Text style={[styles.boardHint, { color: colors.mutedForeground }]}>{detected.distanceM < 30 ? t('stop.atStop') : t('stop.metresAway', { m: detected.distanceM })}</Text> : null}
                  {!boarding && !detected ? <Text style={[styles.boardHint, { color: colors.mutedForeground }]}>{t('stop.noLocation')}</Text> : null}
                </View>
                <Pressable onPress={() => { Haptics.selectionAsync(); setChanging((c) => !c); }} accessibilityRole="button" accessibilityLabel={t('stop.change')} style={[styles.changeBtn, { borderColor: colors.border, borderRadius: colors.radiusPill }]}>
                  <Text style={[styles.changeText, { color: colors.primary }]}>{changing ? t('stop.done') : t('stop.change')}</Text>
                </Pressable>
              </View>
              {changing || (!detected && !boarding) ? (
                <View style={styles.boardRow}>
                  {all.slice(0, -1).map((x) => {
                    const on = x.name === boardName;
                    return (
                      <Pressable
                        key={x.name}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setBoarding(x.name);
                          setSelected(null);
                          setChanging(false);
                        }}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: on }}
                        accessibilityLabel={`Get on at ${x.name}`}
                        style={[styles.boardChip, { borderColor: on ? colors.primary : colors.border, backgroundColor: on ? tint : 'transparent', borderRadius: colors.radiusPill }]}
                      >
                        <Text style={[styles.boardText, { color: on ? colors.primary : colors.foreground }]}>{x.name}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 16 }]}>{(custom ? t('stop.nearest') : t('stop.where')).toUpperCase()}</Text>

              <RouteSpine
                stops={all.map((x, i) => ({
                  name: x.name,
                  here: i === boardIdx,
                  behind: i < boardIdx,
                  right: i > boardIdx ? formatCedis(stops.find((y) => y.name === x.name)?.officialFare ?? x.officialFare) : undefined,
                }))}
                selected={selected}
                onSelect={(n) => {
                  Haptics.selectionAsync();
                  setSelected(n);
                }}
              />

              </ScrollView>

              {/* Footer: always on screen, however many stops there are. */}
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

              {stop && stop.amountToPay > stop.officialFare + 0.001 ? (
                <Text style={[styles.fareLine, { color: colors.mutedForeground, textAlign: 'center', marginBottom: 6 }]}>
                  {t('stop.official')} {formatCedis(stop.officialFare)} · {t('stop.roundedUp')}
                </Text>
              ) : null}
              {stop ? <Approx amount={stop.amountToPay} /> : null}
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
  boardCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, padding: 14, marginBottom: 10 },
  boardIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  boardText2: { flex: 1 },
  boardKicker: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 10, letterSpacing: 1.3 },
  boardName: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 22, letterSpacing: -0.4, marginTop: 1 },
  boardHint: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, marginTop: 1 },
  changeBtn: { borderWidth: StyleSheet.hairlineWidth * 2, paddingHorizontal: 14, paddingVertical: 8 },
  changeText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13 },
  boardRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
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
  sheet: { padding: 24, paddingBottom: 30, borderWidth: StyleSheet.hairlineWidth * 2, borderBottomWidth: 0, maxHeight: '94%' },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 18 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  codePill: { paddingHorizontal: 12, paddingVertical: 5 },
  codeText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, letterSpacing: 1 },
  conductor: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13 },
  route: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 22, marginBottom: 18 },
  label: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, letterSpacing: 1, marginBottom: 10 },
  body: { flexShrink: 1 },
  list: { flexGrow: 0 },
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
