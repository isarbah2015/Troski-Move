import React from 'react';
import { StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { ConductorLogin } from '@/components/ConductorLogin';
import { FloatingTabBar } from '@/components/FloatingTabBar';
import { useConductorSession } from '@/lib/conductorSession';
import { colors } from '@/lib/colors';

// Conductor role: Today, My QR, Leaderboard, Earnings, plus Profile (the role switcher lives there).
export default function ConductorLayout() {
  const session = useConductorSession();
  // Nothing in the conductor app works without a signed-in conductor: show the PIN screen instead of the tabs.
  if (session === undefined) return null;
  if (session === null) return <ConductorLogin />;
  return (
    <Tabs
      initialRouteName="today"
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accentEmerald,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
        tabBarLabelStyle: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
      }}
    >
      <Tabs.Screen name="today" options={{ title: 'Today', tabBarIcon: ({ color }) => <Feather name="check-square" size={22} color={color} /> }} />
      <Tabs.Screen name="my-qr" options={{ title: 'My QR', tabBarIcon: ({ color }) => <Feather name="grid" size={22} color={color} /> }} />
      <Tabs.Screen name="leaderboard" options={{ title: 'Leaderboard', tabBarIcon: ({ color }) => <Feather name="award" size={22} color={color} /> }} />
      <Tabs.Screen name="earnings" options={{ title: 'Earnings', tabBarIcon: ({ color }) => <Feather name="dollar-sign" size={22} color={color} /> }} />
      <Tabs.Screen name="conductor-profile" options={{ title: 'Profile', tabBarIcon: ({ color }) => <Feather name="user" size={22} color={color} /> }} />
    </Tabs>
  );
}
