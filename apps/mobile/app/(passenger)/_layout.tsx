import React from 'react';
import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { FloatingTabBar } from '@/components/FloatingTabBar';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/lib/i18n';

// Passenger role: 4 tabs (Scan, Fares, Trip, Profile). Scan (index.tsx) is the first tab and owns `/`.
export default function PassengerLayout() {
  const colors = useColors();
  const t = useT();
  return (
    <Tabs
      initialRouteName="index"
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarLabelStyle: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tab.scan'), tabBarIcon: ({ color }) => <Feather name="maximize" size={22} color={color} /> }} />
      <Tabs.Screen name="fares" options={{ title: t('tab.fares'), tabBarIcon: ({ color }) => <Feather name="tag" size={22} color={color} /> }} />
      <Tabs.Screen name="trip" options={{ title: t('tab.trip'), tabBarIcon: ({ color }) => <Feather name="navigation" size={22} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: t('tab.profile'), tabBarIcon: ({ color }) => <Feather name="user" size={22} color={color} /> }} />
    </Tabs>
  );
}
