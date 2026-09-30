import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { subscribeToast } from '@/lib/toast';

const VISIBLE_MS = 2200;

export function ToastHost() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<string | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () =>
      subscribeToast((next) => {
        if (timer.current) clearTimeout(timer.current);
        setMessage(next);
        Animated.timing(anim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
        timer.current = setTimeout(() => {
          Animated.timing(anim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setMessage(null));
        }, VISIBLE_MS);
      }),
    [anim],
  );

  if (!message) return null;

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={[
        styles.toast,
        {
          top: insets.top + 12,
          backgroundColor: colors.card,
          borderColor: colors.primary,
          borderRadius: colors.radiusPill,
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
        },
      ]}
    >
      <Feather name="check-circle" size={18} color={colors.primary} />
      <Text style={[styles.text, { color: colors.foreground }]}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingVertical: 12, borderWidth: 1, zIndex: 100 },
  text: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
});
