import React from 'react';
import { StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { colors } from '@/lib/colors';

// Passenger role: exactly 3 tabs (Scan, Trip, Profile). Scan (index.tsx) is the first tab and owns `/`.
export default function PassengerLayout() {
  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accentEmerald,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
        tabBarLabelStyle: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Scan', tabBarIcon: ({ color }) => <Feather name="maximize" size={22} color={color} /> }} />
      <Tabs.Screen name="trip" options={{ title: 'Trip', tabBarIcon: ({ color }) => <Feather name="navigation" size={22} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color }) => <Feather name="user" size={22} color={color} /> }} />
    </Tabs>
  );
}
