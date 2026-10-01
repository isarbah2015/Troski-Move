import React from 'react';
import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { CediIcon } from '@/components/CediIcon';
import { ConductorLogin }from '@/components/ConductorLogin';
import { FloatingTabBar } from '@/components/FloatingTabBar';
import { useConductorSession } from '@/lib/conductorSession';
import { useColors } from '@/hooks/useColors';

// Conductor role: Today, My QR, Leaderboard, Earnings, plus Profile (the role switcher lives there).
export default function ConductorLayout() {
  const colors = useColors();
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
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarLabelStyle: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11 },
      }}
    >
      <Tabs.Screen name="today" options={{ title: 'Today', tabBarIcon: ({ color }) => <Feather name="check-square" size={22} color={color} /> }} />
      <Tabs.Screen name="my-qr" options={{ title: 'My QR', tabBarIcon: ({ color }) => <Feather name="grid" size={22} color={color} /> }} />
      <Tabs.Screen name="leaderboard" options={{ title: 'Leaderboard', tabBarIcon: ({ color }) => <Feather name="award" size={22} color={color} /> }} />
      <Tabs.Screen name="earnings" options={{ title: 'Earnings', tabBarIcon: ({ color }) => <CediIcon size={22} color={color} /> }} />
      <Tabs.Screen name="conductor-profile" options={{ title: 'Profile', tabBarIcon: ({ color }) => <Feather name="user" size={22} color={color} /> }} />
    </Tabs>
  );
}
