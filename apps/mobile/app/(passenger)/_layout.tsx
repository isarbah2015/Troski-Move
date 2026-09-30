import React from 'react';
import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { colors } from '@/lib/colors';

// Passenger role: exactly 3 tabs (Scan, Trip, Profile). Screens are placeholders until their build step.
export default function PassengerLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accentEmerald,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen name="scan" options={{ title: 'Scan', tabBarIcon: ({ color }) => <Feather name="maximize" size={22} color={color} /> }} />
      <Tabs.Screen name="trip" options={{ title: 'Trip', tabBarIcon: ({ color }) => <Feather name="navigation" size={22} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color }) => <Feather name="user" size={22} color={color} /> }} />
    </Tabs>
  );
}
