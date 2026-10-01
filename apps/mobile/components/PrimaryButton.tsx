import React, { useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';

type Props = {
  label: string;
  onPress: () => void;
  icon?: React.ComponentProps<typeof Feather>['name'];
  disabled?: boolean;
  loading?: boolean;
  /** "solid" is the emerald gradient with a glow; "ghost" is a hairline outline for secondary actions. */
  variant?: 'solid' | 'ghost' | 'danger';
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

const SPRING = { damping: 14, stiffness: 220, mass: 0.8, useNativeDriver: true } as const;

/** The app's main button: gradient fill, soft glow, and a springy press with a light haptic. */
export function PrimaryButton({ label, onPress, icon, disabled, loading, variant = 'solid', style, accessibilityLabel }: Props) {
  const colors = useColors();
  const scale = useRef(new Animated.Value(1)).current;
  const off = disabled || loading;
  const solid = variant === 'solid';
  const textColor = solid ? colors.primaryForeground : variant === 'danger' ? colors.destructive : colors.foreground;

  return (
    <Animated.View style={[{ transform: [{ scale }], opacity: disabled ? 0.45 : 1, borderRadius: colors.radiusPill }, solid && !off ? colors.glow : null, style]}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        onPressIn={() => Animated.spring(scale, { toValue: 0.97, ...SPRING }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, ...SPRING }).start()}
        disabled={off}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled: !!off, busy: !!loading }}
        style={[styles.btn, { borderRadius: colors.radiusPill }, !solid && { borderWidth: StyleSheet.hairlineWidth * 2, borderColor: variant === 'danger' ? colors.destructive : colors.border, backgroundColor: colors.card }]}
      >
        {solid ? <LinearGradient colors={colors.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} /> : null}
        {solid ? <View pointerEvents="none" style={styles.sheen} /> : null}
        {loading ? (
          <ActivityIndicator color={textColor} />
        ) : (
          <>
            {icon ? <Feather name={icon} size={18} color={textColor} /> : null}
            <Text style={[styles.label, { color: textColor }]}>{label}</Text>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  btn: { height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, overflow: 'hidden', paddingHorizontal: 24 },
  // A faint top highlight gives the button a glassy edge.
  sheen: { position: 'absolute', top: 0, left: 0, right: 0, height: '50%', backgroundColor: 'rgba(255,255,255,0.12)' },
  label: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, letterSpacing: 0.2 },
});
