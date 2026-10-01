import React, { useEffect, useMemo, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Line, Rect, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { EMERALD } from '@/lib/colors';

const INK = '#060A13';
const TILE = 124;
const SPRING = { damping: 11, stiffness: 90, mass: 1, useNativeDriver: true } as const;


const AnimatedRect = Animated.createAnimatedComponent(Rect);
const RING_R = 34;
const RING_SIZE = TILE + 8;
// Perimeter of the rounded-rect outline, used to size and animate the running light.
const RING_LEN = 4 * (RING_SIZE - 2 * RING_R) + 2 * Math.PI * RING_R;

/** Small seeded generator so the network looks the same on every launch. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A faded transit-map backdrop: jittered nodes joined to their near neighbours, fading out toward the screen edges
 * so it reads as a distant city network behind the logo.
 */
function NetworkBackdrop({ width, height }: { width: number; height: number }) {
  const { nodes, edges } = useMemo(() => {
    const rand = rng(2026);
    const cols = 6;
    const rows = Math.max(9, Math.round((height / width) * cols));
    const cw = width / cols;
    const ch = height / rows;
    const pts: Array<{ x: number; y: number; hub: boolean }> = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        pts.push({ x: (c + 0.15 + rand() * 0.7) * cw, y: (r + 0.15 + rand() * 0.7) * ch, hub: rand() > 0.82 });
      }
    }
    const max = Math.hypot(cw, ch) * 1.18;
    const es: Array<[number, number]> = [];
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        if (Math.hypot(pts[i]!.x - pts[j]!.x, pts[i]!.y - pts[j]!.y) < max && rand() > 0.28) es.push([i, j]);
      }
    }
    return { nodes: pts, edges: es };
  }, [width, height]);

  const cx = width / 2;
  const cy = height / 2;
  const far = Math.hypot(cx, cy);
  // Strongest near the middle, gone at the edges.
  const fade = (x: number, y: number) => Math.max(0, 1 - Math.hypot(x - cx, y - cy) / far) ** 1.2;

  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      {edges.map(([i, j]) => {
        const a = nodes[i]!;
        const b = nodes[j]!;
        const o = fade((a.x + b.x) / 2, (a.y + b.y) / 2) * 0.30;
        return o > 0.02 ? <Line key={`${i}-${j}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#2BD99F" strokeOpacity={o} strokeWidth={1} /> : null;
      })}
      {nodes.map((n, i) => {
        const o = fade(n.x, n.y);
        return o > 0.05 ? <Circle key={i} cx={n.x} cy={n.y} r={n.hub ? 3.2 : 1.8} fill={n.hub ? '#FBBF4A' : '#2BD99F'} fillOpacity={o * (n.hub ? 0.6 : 0.45)} /> : null;
      })}
    </Svg>
  );
}

/**
 * Launch animation: three stacked tiles swing into place in 3D (staggered, so they read as layers with depth),
 * a light runs endlessly around the logo's border over a faded transit-network backdrop, then the wordmark rises in. It always starts on the same dark navy as the
 * native splash, so the hand-off is seamless, and it fades away when done. Reduced motion skips the 3D swing.
 */
export function AnimatedSplash({ onDone }: { onDone: () => void }) {
  const { width: W, height: H } = useWindowDimensions();
  const run = useRef(new Animated.Value(0)).current;
  const layers = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  const float = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const word = useRef(new Animated.Value(0)).current;
  const exit = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    let loops: Animated.CompositeAnimation[] = [];
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) {
        layers.forEach((l) => l.setValue(1));
        glow.setValue(1);
        word.setValue(1);
      } else {
        // Back layer first, front layer last; each springs from a steep angle to flat.
        Animated.stagger(
          90,
          [2, 1, 0].map((i) => Animated.spring(layers[i]!, { toValue: 1, ...SPRING })),
        ).start(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
        Animated.timing(glow, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
        Animated.timing(word, { toValue: 1, duration: 650, delay: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
        const f = Animated.loop(Animated.sequence([
          Animated.timing(float, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(float, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]));
        // The running border light is an SVG prop, so it is driven from JS rather than the native thread.
        const s = Animated.loop(Animated.timing(run, { toValue: 1, duration: 1800, easing: Easing.linear, useNativeDriver: false }));
        loops = [f, s];
        loops.forEach((l) => l.start());
      }
      const hold = setTimeout(() => {
        Animated.timing(exit, { toValue: 1, duration: 420, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => !cancelled && onDone());
      }, reduce ? 900 : 2500);
      loops.push({ stop: () => clearTimeout(hold) } as Animated.CompositeAnimation);
    });
    return () => {
      cancelled = true;
      loops.forEach((l) => l.stop());
    };
  }, [layers, float, run, glow, word, exit, onDone]);

  const tilt = float.interpolate({ inputRange: [0, 1], outputRange: ['7deg', '-7deg'] });
  const bob = float.interpolate({ inputRange: [0, 1], outputRange: [4, -6] });
  const dashA = run.interpolate({ inputRange: [0, 1], outputRange: [0, -RING_LEN] });
  const dashB = run.interpolate({ inputRange: [0, 1], outputRange: [-RING_LEN / 2, -RING_LEN * 1.5] });

  return (
    <Animated.View
      pointerEvents="auto"
      accessibilityLabel="TrotroLink"
      style={[styles.root, { opacity: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }), transform: [{ scale: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] }]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: glow, transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [1.08, 1] }) }] }]} pointerEvents="none">
        <NetworkBackdrop width={W} height={H} />
      </Animated.View>

      {/* Nested translucent discs fake a soft radial glow without a hard edge. */}
      <Animated.View style={[styles.haloWrap, { opacity: glow, transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }]} pointerEvents="none">
        {[320, 250, 190].map((d) => (
          <View key={d} style={{ position: 'absolute', width: d, height: d, borderRadius: d / 2, backgroundColor: 'rgba(43,217,159,0.05)' }} />
        ))}
      </Animated.View>

      <Animated.View style={[styles.stage, { transform: [{ perspective: 900 }, { translateY: bob }, { rotateX: tilt }] }]}>
        {[2, 1, 0].map((i) => (
          <Animated.View
            key={i}
            style={[
              styles.tile,
              {
                opacity: layers[i]!.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 1, 1] }),
                transform: [
                  { perspective: 900 },
                  { rotateY: layers[i]!.interpolate({ inputRange: [0, 1], outputRange: ['-85deg', '0deg'] }) },
                  { translateX: i * 9 },
                  { translateY: i * -9 },
                  { scale: 1 - i * 0.07 },
                ],
              },
            ]}
          >
            <View style={styles.clip}>
              {i === 0 ? (
                <Image source={require('../assets/images/icon.png')} style={styles.logo} resizeMode="cover" accessibilityIgnoresInvertColors />
              ) : (
                <LinearGradient colors={i === 1 ? ['#1B7C86', '#0B4F5A'] : ['#0E5560', '#083A44']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.tileFill} />
              )}
            </View>
            {i === 0 ? (
              /* Two comets chase each other around the border, forever: emerald and amber, half a lap apart. */
              <Svg width={RING_SIZE} height={RING_SIZE} style={styles.ring} pointerEvents="none">
                <Defs>
                  <SvgGradient id="ringA" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#7DF3CF" /><Stop offset="1" stopColor="#2BD99F" /></SvgGradient>
                  <SvgGradient id="ringB" x1="1" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#FFE08A" /><Stop offset="1" stopColor="#FBBF4A" /></SvgGradient>
                </Defs>
                <Rect x={2} y={2} width={RING_SIZE - 4} height={RING_SIZE - 4} rx={RING_R} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth={2} />
                <AnimatedRect x={2} y={2} width={RING_SIZE - 4} height={RING_SIZE - 4} rx={RING_R} fill="none" stroke="url(#ringA)" strokeWidth={3.5} strokeLinecap="round" strokeDasharray={`${RING_LEN * 0.26} ${RING_LEN * 0.74}`} strokeDashoffset={dashA} />
                <AnimatedRect x={2} y={2} width={RING_SIZE - 4} height={RING_SIZE - 4} rx={RING_R} fill="none" stroke="url(#ringB)" strokeWidth={3.5} strokeLinecap="round" strokeDasharray={`${RING_LEN * 0.18} ${RING_LEN * 0.82}`} strokeDashoffset={dashB} />
              </Svg>
            ) : null}
          </Animated.View>
        ))}
      </Animated.View>

      <Animated.View style={[styles.words, { opacity: word, transform: [{ translateY: word.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }]}>
        <Text style={styles.name}>Trotro<Text style={{ color: EMERALD }}>Link</Text></Text>
        <Text style={styles.tag}>Pay your fare. Ride with confidence.</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: INK, alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  haloWrap: { position: 'absolute', width: 320, height: 320, alignItems: 'center', justifyContent: 'center' },
  stage: { width: 240, height: 240, alignItems: 'center', justifyContent: 'center' },
  clip: { flex: 1, borderRadius: 32, overflow: 'hidden' },
  ring: { position: 'absolute', top: -4, left: -4 },
  tile: { position: 'absolute', width: TILE, height: TILE, borderRadius: 32, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 22, shadowOffset: { width: 0, height: 14 }, elevation: 12 },
  tileFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logo: { width: TILE, height: TILE },
  words: { position: 'absolute', bottom: '24%', alignItems: 'center' },
  name: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 36, letterSpacing: -1, color: '#F6F8FC' },
  tag: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, color: '#8A97AE', marginTop: 8, letterSpacing: 0.2 },
});
