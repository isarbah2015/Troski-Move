import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { EMERALD, GOLD } from '@/lib/colors';

const INK = '#060A13';
const TILE = 112;
const SPRING = { damping: 11, stiffness: 90, mass: 1, useNativeDriver: true } as const;

/**
 * Launch animation: three stacked tiles swing into place in 3D (staggered, so they read as layers with depth),
 * an orbit ring tilts around them, then the wordmark rises in. It always starts on the same dark navy as the
 * native splash, so the hand-off is seamless, and it fades away when done. Reduced motion skips the 3D swing.
 */
export function AnimatedSplash({ onDone }: { onDone: () => void }) {
  const layers = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  const float = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
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
        const s = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 3200, easing: Easing.linear, useNativeDriver: true }));
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
  }, [layers, float, spin, glow, word, exit, onDone]);

  const tilt = float.interpolate({ inputRange: [0, 1], outputRange: ['7deg', '-7deg'] });
  const bob = float.interpolate({ inputRange: [0, 1], outputRange: [4, -6] });
  const rotateZ = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View
      pointerEvents="auto"
      accessibilityLabel="TrotroLink"
      style={[styles.root, { opacity: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }), transform: [{ scale: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] }]}
    >
      {/* Nested translucent discs fake a soft radial glow without a hard edge. */}
      <Animated.View style={[styles.haloWrap, { opacity: glow, transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }]} pointerEvents="none">
        {[320, 250, 190].map((d) => (
          <View key={d} style={{ position: 'absolute', width: d, height: d, borderRadius: d / 2, backgroundColor: 'rgba(43,217,159,0.05)' }} />
        ))}
      </Animated.View>

      <Animated.View style={[styles.stage, { transform: [{ perspective: 900 }, { translateY: bob }, { rotateX: tilt }] }]}>
        {/* Orbit ring: flattened with rotateX so it reads as a ring seen at an angle, with a gold bead travelling around it. */}
        <Animated.View style={[styles.orbit, { opacity: glow, transform: [{ perspective: 900 }, { rotateX: '72deg' }, { rotateZ }] }]}>
          <View style={styles.bead} />
        </Animated.View>

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
            <LinearGradient
              colors={i === 0 ? ['#4CE8B4', '#0E9F76'] : i === 1 ? ['#1B8F73', '#0B5B49'] : ['#12493F', '#0A2B2A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.tileFill}
            >
              {i === 0 ? <Feather name="navigation" size={46} color="#04130D" style={styles.glyph} /> : null}
              {i === 0 ? <View style={styles.sheen} /> : null}
            </LinearGradient>
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
  orbit: { position: 'absolute', width: 232, height: 232, borderRadius: 116, borderWidth: 1.5, borderColor: 'rgba(43,217,159,0.45)', alignItems: 'center' },
  bead: { position: 'absolute', top: -6, width: 12, height: 12, borderRadius: 6, backgroundColor: GOLD, shadowColor: GOLD, shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  tile: { position: 'absolute', width: TILE, height: TILE, borderRadius: 32, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 22, shadowOffset: { width: 0, height: 14 }, elevation: 12 },
  tileFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  glyph: { transform: [{ rotate: '-8deg' }] },
  sheen: { position: 'absolute', top: 0, left: 0, right: 0, height: '45%', backgroundColor: 'rgba(255,255,255,0.16)' },
  words: { position: 'absolute', bottom: '24%', alignItems: 'center' },
  name: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 36, letterSpacing: -1, color: '#F6F8FC' },
  tag: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, color: '#8A97AE', marginTop: 8, letterSpacing: 0.2 },
});
