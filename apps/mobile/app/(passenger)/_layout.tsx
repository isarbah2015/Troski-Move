import React from 'react';
import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { FloatingTabBar } from '@/components/FloatingTabBar';
import { useColors } from '@/hooks/useColors';

// Passenger role: exactly 3 tabs (Scan, Trip, Profile). Scan (index.tsx) is the first tab and owns `/`.
export default function PassengerLayout() {
  const colors = useColors();
  return (
    <Tabs
      initialRouteName="index"
      tabBar={(props) => <FloatingTabBar {...props} darkRoutes={['index']} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarLabelStyle: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Scan', tabBarIcon: ({ color }) => <Feather name="maximize" size={22} color={color} /> }} />
      <Tabs.Screen name="trip" options={{ title: 'Trip', tabBarIcon: ({ color }) => <Feather name="navigation" size={22} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color }) => <Feather name="user" size={22} color={color} /> }} />
    </Tabs>
  );
}
