import React, { useCallback, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useColors } from '@/hooks/useColors';
import { restoreTheme } from '@/lib/theme';
import { restoreLanguage } from '@/lib/i18n';
import { restoreCurrency } from '@/lib/currencyPref';
import { registerForPush } from '@/lib/notify';
import { seedDemoActiveTrip } from '@/lib/demo';
import { AnimatedSplash } from '@/components/AnimatedSplash';
import { SyncBanner } from '@/components/SyncBanner';
import { ToastHost } from '@/components/ToastHost';
import { useSyncLoop } from '@/lib/sync';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function ThemedStatusBar() {
  const { scheme } = useColors();
  return <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />;
}

function RootLayoutNav() {
  useSyncLoop();
  const colors = useColors();
  return (
    <Stack
      screenOptions={{
        headerBackTitle: 'Back',
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.foreground,
        headerTitleStyle: { fontFamily: 'PlusJakartaSans_600SemiBold' },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(passenger)" options={{ headerShown: false }} />
      <Stack.Screen name="(conductor)" options={{ headerShown: false }} />
      <Stack.Screen name="privacy" options={{ title: 'Privacy' }} />
      <Stack.Screen name="visitor" options={{ title: 'Visiting Ghana?' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  const [splashDone, setSplashDone] = useState(false);
  const finishSplash = useCallback(() => setSplashDone(true), []);

  useEffect(() => {
    void restoreTheme();
    void restoreLanguage();
    void restoreCurrency();
    void registerForPush();
    void seedDemoActiveTrip();
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView>
            <KeyboardProvider>
              <RootLayoutNav />
              <ThemedStatusBar />
              <SyncBanner />
              <ToastHost />
              {splashDone ? null : <AnimatedSplash onDone={finishSplash} />}
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
