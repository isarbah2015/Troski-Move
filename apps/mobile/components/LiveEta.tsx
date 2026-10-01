import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { useColors } from '@/hooks/useColors';
import { EMERALD } from '@/lib/colors';
import { useT } from '@/lib/i18n';

const SIZE = 136;
const STROKE = 11;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  /** Minutes to the passenger's stop. */
  eta: number;
  /** 0–1 share of the ride done. */
  progress: number;
  destination: string;
  currentStop: string;
  stopsRemaining: number;
  /** Stop names in route order, boarding to alighting and beyond. */
  stops: string[];
  alightingStop: string;
  /** Where the passenger got on; the route line starts here (they may board mid-route). */
  boardingStop?: string;
};

/** Counts smoothly from the old number to the new one instead of jumping. */
function useCountTo(target: number) {
  const val = useRef(new Animated.Value(target)).current;
  const [shown, setShown] = useState(target);
  useEffect(() => {
    const id = val.addListener(({ value }) => setShown(Math.round(value)));
    Animated.timing(val, { toValue: target, duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => val.removeListener(id);
  }, [target, val]);
  return shown;
}

/**
 * The live ETA: a progress ring that fills as the trotro advances, the minutes counting down in the middle, the clock
 * time it should arrive, a pulsing LIVE badge with "updated" age, and a route line with the bus riding along it.
 */
export function LiveEta({ eta, progress, destination, currentStop, stopsRemaining, stops, alightingStop, boardingStop }: Props) {
  const colors = useColors();
  const t = useT();
  const ring = useRef(new Animated.Value(progress)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const bus = useRef(new Animated.Value(0)).current;
  const tick = useRef(new Animated.Value(1)).current;
  const [width, setWidth] = useState(0);
  const [stamp, setStamp] = useState(Date.now());
  const [, rerender] = useState(0);
  const shown = useCountTo(eta);

  // Remember when the figures last changed, so "Updated 20s ago" is honest.
  useEffect(() => {
    setStamp(Date.now());
    tick.setValue(1.14);
    Animated.spring(tick, { toValue: 1, damping: 9, stiffness: 160, useNativeDriver: true }).start();
  }, [eta, currentStop, tick]);
  useEffect(() => {
    const id = setInterval(() => rerender((n) => n + 1), 5000);
    return () => clearInterval(id);
  }, []);

  const names = stops;
  const alightIdx = Math.max(1, names.indexOf(alightingStop));
  const startIdx = Math.max(0, boardingStop ? names.indexOf(boardingStop) : 0);
  const curIdx = Math.max(0, names.indexOf(currentStop) - startIdx);
  const track = names.slice(startIdx, alightIdx + 1);

  useEffect(() => {
    Animated.timing(ring, { toValue: progress, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [progress, ring]);
  useEffect(() => {
    Animated.spring(bus, { toValue: curIdx / Math.max(1, track.length - 1), damping: 14, stiffness: 90, useNativeDriver: true }).start();
  }, [curIdx, track.length, bus]);

  useEffect(() => {
    let loops: Animated.CompositeAnimation[] = [];
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) return;
      const p = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 2000, easing: Easing.out(Easing.quad), useNativeDriver: true }));
      const b = Animated.loop(Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]));
      loops = [p, b];
      loops.forEach((l) => l.start());
    });
    return () => loops.forEach((l) => l.stop());
  }, [pulse, breathe]);

  const arrived = eta <= 0 && stopsRemaining === 0;
  const clock = new Date(Date.now() + eta * 60_000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const ageSec = Math.max(0, Math.round((Date.now() - stamp) / 1000));
  const updated = ageSec < 8 ? t('eta.now') : ageSec < 90 ? `${ageSec}s` : `${Math.round(ageSec / 60)} min`;
  const dash = ring.interpolate({ inputRange: [0, 1], outputRange: [C, 0] });
  const trackW = Math.max(0, width - 8);

  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width - 44)}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radiusModal }, colors.elevation]}
      accessibilityLabel={arrived ? `Arrived at ${destination}` : `${eta} minutes to ${destination}, ${stopsRemaining} stops away`}
    >
      <View style={styles.top}>
        <View style={styles.ringWrap}>
          {/* Soft radar pulse behind the ring */}
          <Animated.View pointerEvents="none" style={[styles.radar, { borderColor: EMERALD, opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1.28] }) }] }]} />
          <Animated.View pointerEvents="none" style={[styles.halo, { backgroundColor: EMERALD, opacity: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.05, 0.14] }) }]} />
          <Svg width={SIZE} height={SIZE} style={styles.svg}>
            <Defs>
              <SvgGradient id="etaRing" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={colors.scheme === 'light' ? '#12A576' : '#6CF0C4'} />
                <Stop offset="1" stopColor={colors.scheme === 'light' ? '#066B4C' : '#16B887'} />
              </SvgGradient>
            </Defs>
            <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={colors.border} strokeWidth={STROKE} fill="none" />
            <AnimatedCircle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke="url(#etaRing)" strokeWidth={STROKE} strokeLinecap="round" fill="none" strokeDasharray={`${C} ${C}`} strokeDashoffset={dash} transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`} />
          </Svg>
          <Animated.View style={[styles.center, { transform: [{ scale: tick }] }]}>
            {arrived ? (
              <>
                <Feather name="check-circle" size={34} color={colors.primary} />
                <Text style={[styles.unit, { color: colors.primary }]}>{t('eta.arrived')}</Text>
              </>
            ) : (
              <>
                <Text style={[styles.minutes, { color: colors.foreground }]}>{shown}</Text>
                <Text style={[styles.unit, { color: colors.mutedForeground }]}>{t('eta.min')}</Text>
              </>
            )}
          </Animated.View>
        </View>

        <View style={styles.info}>
          <View style={styles.liveRow}>
            <Animated.View style={[styles.liveDot, { backgroundColor: EMERALD, opacity: breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] }) }]} />
            <Text style={[styles.liveText, { color: colors.primary }]}>{t('eta.live')}</Text>
            <Text style={[styles.updated, { color: colors.mutedForeground }]} numberOfLines={1}>{updated}</Text>
          </View>
          <Text style={[styles.kicker, { color: colors.mutedForeground }]}>{t('eta.arrive', { stop: '' }).trim().toUpperCase()}</Text>
          <Text style={[styles.dest, { color: colors.foreground }]} numberOfLines={1} adjustsFontSizeToFit>{destination}</Text>
          {!arrived ? (
            <View style={styles.clockRow}>
              <Feather name="clock" size={14} color={colors.mutedForeground} />
              <Text style={[styles.clock, { color: colors.foreground }]}>{t('eta.at', { time: clock })}</Text>
            </View>
          ) : null}
          <View style={[styles.chip, { backgroundColor: colors.scheme === 'light' ? 'rgba(7,128,90,0.10)' : 'rgba(43,217,159,0.13)', borderRadius: colors.radiusPill }]}>
            <Feather name="flag" size={12} color={colors.primary} />
            <Text style={[styles.chipText, { color: colors.primary }]}>{stopsRemaining === 1 ? t('eta.stop1') : t('eta.stops', { n: stopsRemaining })}</Text>
          </View>
        </View>
      </View>

      {/* Route line: the bus rides from stop to stop as the conductor marks them */}
      <View style={styles.routeWrap}>
        <View style={[styles.routeLine, { backgroundColor: colors.border }]} />
        <Animated.View style={[styles.routeFill, { width: bus.interpolate({ inputRange: [0, 1], outputRange: [0, trackW] }) }]}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.primary, borderRadius: 2 }]} />
        </Animated.View>
        {track.map((name, i) => {
          const x = (i / Math.max(1, track.length - 1)) * trackW;
          const passed = i <= curIdx;
          const dest = i === track.length - 1;
          return (
            <View key={name} style={[styles.stopMark, { left: x }]}>
              <View style={[styles.stopDot, { backgroundColor: passed ? colors.primary : colors.card, borderColor: passed ? colors.primary : colors.mutedForeground, width: dest ? 14 : 10, height: dest ? 14 : 10, borderRadius: 7 }]} />
            </View>
          );
        })}
        <Animated.View style={[styles.bus, { transform: [{ translateX: bus.interpolate({ inputRange: [0, 1], outputRange: [0, trackW] }) }] }]}>
          <View style={[styles.busBubble, { backgroundColor: colors.primary }]}>
            <Ionicons name="bus" size={14} color={colors.primaryForeground} />
          </View>
        </Animated.View>
      </View>
      <View style={styles.labels}>
        <Text style={[styles.label, { color: colors.mutedForeground }]} numberOfLines={1}>{track[0]}</Text>
        <Text style={[styles.label, styles.labelEnd, { color: colors.foreground }]} numberOfLines={1}>{track[track.length - 1]}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 22, borderWidth: StyleSheet.hairlineWidth * 2, marginBottom: 18 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  ringWrap: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  svg: { position: 'absolute' },
  radar: { position: 'absolute', width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderWidth: 2 },
  halo: { position: 'absolute', width: SIZE - 34, height: SIZE - 34, borderRadius: SIZE / 2 },
  center: { alignItems: 'center', justifyContent: 'center' },
  minutes: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 44, letterSpacing: -1.5, lineHeight: 48, fontVariant: ['tabular-nums'] },
  unit: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', marginTop: -2 },
  info: { flex: 1 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  liveText: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 11, letterSpacing: 1.2 },
  updated: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, marginLeft: 'auto' },
  kicker: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10, letterSpacing: 1.4 },
  dest: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 24, letterSpacing: -0.6, marginTop: 2 },
  clockRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  clock: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14 },
  chip: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, marginTop: 10 },
  chipText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12 },
  routeWrap: { height: 36, marginTop: 22, marginHorizontal: 4, justifyContent: 'center' },
  routeLine: { height: 4, borderRadius: 2 },
  routeFill: { position: 'absolute', left: 0, height: 4 },
  stopMark: { position: 'absolute', width: 14, marginLeft: -7, top: 11, alignItems: 'center' },
  stopDot: { borderWidth: 2 },
  bus: { position: 'absolute', left: -14, top: 0 },
  busBubble: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', shadowColor: EMERALD, shadowOpacity: 0.6, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  label: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, flex: 1 },
  labelEnd: { textAlign: 'right' },
});
