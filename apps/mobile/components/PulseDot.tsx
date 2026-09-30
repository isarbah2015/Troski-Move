import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';

/** A small dot that pulses (native driver) while `active`; respects Reduce Motion. */
export function PulseDot({ color, active = true, size = 10 }: { color: string; active?: boolean; size?: number }) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!active) {
      opacity.setValue(1);
      return;
    }
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce || cancelled) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.25, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      );
      loop.start();
    });
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [active, opacity]);

  return <Animated.View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity }} />;
}
