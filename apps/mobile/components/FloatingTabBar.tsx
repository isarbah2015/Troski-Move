import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, LayoutChangeEvent, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import type { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { EMERALD } from '@/lib/colors';

// The tab bar's props, derived from Expo Router (its navigation package isn't a direct dependency).
type BottomTabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

const PAD = 8;
// The pill is narrower than its tab by this much on each side, so it never touches the neighbouring icons or labels.
// Bars with 5+ tabs are tighter, so they use a smaller inset and label.
const pillInset = (count: number) => (count >= 5 ? 2 : 7);
const SPRING = { damping: 16, stiffness: 190, mass: 0.9, useNativeDriver: true } as const;

/** One tab: the icon lifts and the label brightens when active; pressing squeezes it. */
function TabItem({ label, focused, compact, icon, onPress, onLongPress, testID }: {
  label: string;
  compact: boolean;
  focused: boolean;
  icon: (color: string, focused: boolean) => React.ReactNode;
  onPress: () => void;
  onLongPress: () => void;
  testID?: string;
}) {
  const colors = useColors();
  const lift = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const press = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(lift, { toValue: focused ? 1 : 0, ...SPRING }).start();
  }, [focused, lift]);

  const color = focused ? colors.primary : colors.mutedForeground;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => Animated.spring(press, { toValue: 0.88, ...SPRING }).start()}
      onPressOut={() => Animated.spring(press, { toValue: 1, ...SPRING }).start()}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      testID={testID}
      style={styles.item}
    >
      <Animated.View style={[styles.itemInner, { transform: [{ scale: press }] }]}>
        <Animated.View style={{ transform: [{ translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) }, { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }] }}>
          {icon(color, focused)}
        </Animated.View>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={[styles.label, { color, fontSize: compact ? 9.5 : 11, fontFamily: focused ? (compact ? 'PlusJakartaSans_600SemiBold' : 'PlusJakartaSans_700Bold') : 'PlusJakartaSans_500Medium' }]}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

/**
 * Floating "card" tab bar: it hovers above the content with a soft emerald glow and a slow bob, and a
 * pill slides between tabs on a spring. The bob stops when the user prefers reduced motion.
 */
export function FloatingTabBar({ state, descriptors, navigation, darkRoutes = [] }: BottomTabBarProps & { darkRoutes?: string[] }) {
  // Always-dark screens (the camera) get a dark bar and strip; everything else follows the theme.
  const onDarkScreen = darkRoutes.includes(state.routes[state.index]!.name);
  const colors = useColors(onDarkScreen ? 'dark' : undefined);
  const stripBg = colors.background;
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const slide = useRef(new Animated.Value(state.index)).current;
  const bob = useRef(new Animated.Value(0)).current;

  const count = state.routes.length;
  const itemWidth = width > 0 ? (width - PAD * 2) / count : 0;
  const inset = pillInset(count);

  useEffect(() => {
    Animated.spring(slide, { toValue: state.index, ...SPRING }).start();
  }, [state.index, slide]);

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce || cancelled) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(bob, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(bob, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      );
      loop.start();
    });
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [bob]);

  return (
    // The wrapper takes part in layout (so screens end above it) and stays transparent so the card floats.
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom - 18, 4), backgroundColor: stripBg }]} pointerEvents="box-none">
      <Animated.View
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        style={[
          styles.card,
          {
            backgroundColor: colors.glass,
            borderColor: colors.border,
            borderRadius: colors.radiusPill,
            shadowColor: colors.scheme === 'light' ? '#0F172A' : EMERALD,
            shadowOpacity: colors.scheme === 'light' ? 0.14 : 0.22,
            transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [1, -2] }) }],
          },
        ]}
      >
        <BlurView intensity={40} tint={colors.scheme === 'light' ? 'light' : 'dark'} style={[StyleSheet.absoluteFill, { borderRadius: colors.radiusPill, overflow: 'hidden' }]} pointerEvents="none" />
        {/* Sliding highlight pill */}
        {itemWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.pill,
              {
                width: Math.max(0, itemWidth - inset * 2),
                marginLeft: inset,
                backgroundColor: `${EMERALD}${colors.scheme === 'light' ? '26' : '1F'}`,
                borderColor: `${EMERALD}${colors.scheme === 'light' ? '66' : '55'}`,
                borderRadius: colors.radiusPill,
                transform: [{ translateX: slide.interpolate({ inputRange: [0, Math.max(1, count - 1)], outputRange: [0, itemWidth * Math.max(1, count - 1)] }) }],
              },
            ]}
          />
        ) : null}

        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key]!;
          const focused = state.index === index;
          const label = typeof options.tabBarLabel === 'string' ? options.tabBarLabel : (options.title ?? route.name);
          return (
            <TabItem
              key={route.key}
              label={label}
              focused={focused}
              compact={count >= 5}
              testID={options.tabBarButtonTestID}
              icon={(color, f) => options.tabBarIcon?.({ color, size: 22, focused: f }) ?? null}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) {
                  Haptics.selectionAsync();
                  navigation.navigate(route.name, route.params);
                }
              }}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
            />
          );
        })}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingTop: 6 },
  card: {
    flexDirection: 'row',
    padding: PAD,
    borderWidth: StyleSheet.hairlineWidth * 2,
    // The glow: a wide, low-opacity emerald shadow reads as the card hovering over the screen.
    shadowOpacity: 0.22,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 10 },
    elevation: Platform.OS === 'android' ? 12 : 0,
  },
  pill: { position: 'absolute', top: PAD, bottom: PAD, left: PAD, borderWidth: StyleSheet.hairlineWidth * 2 },
  item: { flex: 1 },
  itemInner: { alignItems: 'center', justifyContent: 'center', paddingVertical: 9, paddingHorizontal: 2, gap: 3 },
  label: { textAlign: 'center' },
});
