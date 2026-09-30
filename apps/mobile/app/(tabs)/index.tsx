import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getSearchTripsQueryKey,
  useCreateBooking,
  useGetCommuterSummary,
  useSearchTrips,
} from '@workspace/api-client-react';
import type { TripOption } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';

const money = (amount: number) => `GHS ${amount.toFixed(2)}`;

function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  const colors = useColors();
  return <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, style]}>{children}</View>;
}

function ActionButton({ label, onPress, secondary = false, disabled = false }: { label: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        { backgroundColor: secondary ? colors.secondary : colors.primary, opacity: disabled ? 0.5 : pressed ? 0.78 : 1 },
      ]}
    >
      <Text style={[styles.actionButtonText, { color: secondary ? colors.secondaryForeground : colors.primaryForeground }]}>{label}</Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const summary = useGetCommuterSummary();
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [searched, setSearched] = useState(false);
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<TripOption | null>(null);
  const params = { origin: origin || 'Osu', destination: destination || 'Madina' };
  const trips = useSearchTrips(params, {
    query: { enabled: searched && !!origin && !!destination, queryKey: getSearchTripsQueryKey(params) },
  });
  const booking = useCreateBooking();

  const bookTrip = (trip: TripOption) => {
    setSelected(trip);
    booking.mutate(
      { data: { tripId: trip.id, passengerCount: 1, paymentMethod: 'MTN MoMo' } },
      {
        onSuccess: async (created) => {
          const existing = JSON.parse((await AsyncStorage.getItem('trotrolink-mobile-bookings')) || '[]') as unknown[];
          await AsyncStorage.setItem('trotrolink-mobile-bookings', JSON.stringify([created, ...existing]));
          setNotice('Seat confirmed. Your booking is ready.');
          setSelected(null);
          void summary.refetch();
        },
        onError: () => setNotice('We could not confirm that seat. Please try again.'),
      },
    );
  };

  if (summary.isLoading && !summary.data) {
    return <View style={[styles.centered, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} size="large" /></View>;
  }

  if (summary.isError || !summary.data) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <Feather name="alert-circle" size={28} color={colors.destructive} />
        <Text style={[styles.errorTitle, { color: colors.foreground }]}>We could not load your commute.</Text>
        <ActionButton label="Try again" onPress={() => void summary.refetch()} />
      </View>
    );
  }

  const data = summary.data;
  return (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 100 }]}
      refreshControl={<RefreshControl refreshing={summary.isFetching} onRefresh={() => void summary.refetch()} tintColor={colors.primary} />}
      style={{ backgroundColor: colors.background }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topRow}>
        <View>
          <Text style={[styles.kicker, { color: colors.mutedForeground }]}>TUESDAY · 18 JUNE 2024</Text>
          <Text style={[styles.heading, { color: colors.foreground }]}>Good morning, {data.firstName}.</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Let’s make the next journey the easy part.</Text>
        </View>
        <View style={[styles.avatar, { backgroundColor: colors.secondary }]}><Text style={[styles.avatarText, { color: colors.foreground }]}>A</Text></View>
      </View>

      <View style={[styles.hero, { backgroundColor: colors.primary }]}>
        <View style={styles.heroRingOne} />
        <View style={styles.heroRingTwo} />
        <Text style={[styles.kicker, { color: colors.secondary }]}>● LIVE JOURNEY PLANNING</Text>
        <Text style={[styles.heroTitle, { color: colors.primaryForeground }]}>Where are you headed?</Text>
        <View style={[styles.inputWrap, { backgroundColor: colors.card }]}>
          <Feather name="map-pin" size={17} color={colors.mutedForeground} />
          <TextInput
            accessibilityLabel="Leaving from"
            placeholder="Leaving from"
            placeholderTextColor={colors.mutedForeground}
            value={origin}
            onChangeText={setOrigin}
            style={[styles.input, { color: colors.foreground }]}
          />
        </View>
        <View style={[styles.inputWrap, { backgroundColor: colors.card }]}>
          <Feather name="navigation" size={17} color={colors.mutedForeground} />
          <TextInput
            accessibilityLabel="Going to"
            placeholder="Going to"
            placeholderTextColor={colors.mutedForeground}
            value={destination}
            onChangeText={setDestination}
            style={[styles.input, { color: colors.foreground }]}
          />
        </View>
        <ActionButton label="Plan journey  →" secondary onPress={() => { setNotice(''); setSearched(true); }} />
      </View>

      {notice ? <View style={[styles.notice, { backgroundColor: colors.accent }]}><Feather name="check-circle" size={17} color={colors.foreground} /><Text style={[styles.noticeText, { color: colors.foreground }]}>{notice}</Text></View> : null}

      {searched ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}><Text style={[styles.sectionTitle, { color: colors.foreground }]}>Journey options</Text><Pressable onPress={() => router.push('/routes')}><Text style={[styles.link, { color: colors.foreground }]}>All routes</Text></Pressable></View>
          {trips.isLoading ? <ActivityIndicator color={colors.primary} /> : trips.data?.length ? trips.data.slice(0, 3).map((trip) => (
            <Card key={trip.id} style={styles.tripCard}>
              <View style={[styles.iconTile, { backgroundColor: colors.accent }]}><Feather name="truck" size={19} color={colors.foreground} /></View>
              <View style={styles.flex}><View style={styles.tripTop}><Text style={[styles.tripRoute, { color: colors.foreground }]}>{trip.routeName}</Text><Text style={[styles.mode, { backgroundColor: colors.muted, color: colors.foreground }]}>{trip.mode}</Text></View><Text style={[styles.meta, { color: colors.mutedForeground }]}>{trip.departure} — {trip.arrival} · {trip.durationMinutes} min</Text></View>
              <View style={styles.tripPrice}><Text style={[styles.price, { color: colors.foreground }]}>{money(trip.fare)}</Text><Pressable onPress={() => bookTrip(trip)} disabled={booking.isPending && selected?.id === trip.id} style={[styles.smallButton, { backgroundColor: colors.primary }]}><Text style={{ color: colors.primaryForeground, fontWeight: '700', fontSize: 12 }}>{booking.isPending && selected?.id === trip.id ? '...' : 'Book'}</Text></Pressable></View>
            </Card>
          )) : <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No trips found. Try a nearby landmark.</Text>}
        </View>
      ) : null}

      <View style={styles.twoCol}>
        <Card style={styles.activeCard}>
          <View style={styles.sectionHeader}><View><Text style={[styles.kicker, { color: colors.mutedForeground }]}>IN MOTION</Text><Text style={[styles.sectionTitle, { color: colors.foreground }]}>Active journey</Text></View><Text style={[styles.statusPill, { backgroundColor: colors.accent, color: colors.foreground }]}>On schedule</Text></View>
          {data.activeTrip ? <><View style={styles.rowBetween}><Text style={[styles.tripRoute, { color: colors.foreground }]}>{data.activeTrip.routeName}</Text><Text style={[styles.meta, { color: colors.mutedForeground }]}>{data.activeTrip.etaMinutes} min to go</Text></View><View style={[styles.progressTrack, { backgroundColor: colors.muted }]}><View style={[styles.progress, { backgroundColor: colors.secondary, width: `${data.activeTrip.progress}%` }]} /></View><View style={styles.rowBetween}><Text style={[styles.meta, { color: colors.mutedForeground }]}>Departed</Text><Text style={[styles.meta, { color: colors.mutedForeground }]}>{data.activeTrip.destination}</Text></View><View style={[styles.divider, { backgroundColor: colors.border }]} /><Text style={[styles.meta, { color: colors.mutedForeground }]}><Feather name="zap" size={13} color={colors.secondary} /> {data.activeTrip.vehicle} · {data.activeTrip.status}</Text></> : <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Nothing to track right now.</Text>}
        </Card>
        <View style={[styles.impactCard, { backgroundColor: colors.secondary }]}><Text style={[styles.kicker, { color: colors.foreground }]}>YOUR IMPACT</Text><Text style={[styles.impactNumber, { color: colors.foreground }]}>{data.impact.minutesSaved}<Text style={styles.impactUnit}> min</Text></Text><Text style={[styles.impactLabel, { color: colors.foreground }]}>saved this month</Text><View style={[styles.impactStats, { borderTopColor: colors.foreground + '22' }]}><View><Text style={[styles.impactStat, { color: colors.foreground }]}>{data.impact.tripsCompleted}</Text><Text style={[styles.impactLabel, { color: colors.foreground }]}>trips</Text></View><View><Text style={[styles.impactStat, { color: colors.foreground }]}>{data.impact.carbonReduced}kg</Text><Text style={[styles.impactLabel, { color: colors.foreground }]}>carbon reduced</Text></View></View></View>
      </View>

      <View style={styles.section}><View style={styles.sectionHeader}><View><Text style={[styles.kicker, { color: colors.mutedForeground }]}>KEEP MOVING</Text><Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent journeys</Text></View><Pressable onPress={() => router.push('/bookings')}><Text style={[styles.link, { color: colors.foreground }]}>Bookings</Text></Pressable></View>{data.recentTrips.slice(0, 3).map((trip) => <Card key={trip.id} style={styles.recentRow}><View style={[styles.iconTile, { backgroundColor: colors.muted }]}><Feather name="truck" size={17} color={colors.foreground} /></View><View style={styles.flex}><Text style={[styles.tripRoute, { color: colors.foreground }]}>{trip.routeName}</Text><Text style={[styles.meta, { color: colors.mutedForeground }]}>{trip.date} · {trip.status}</Text></View><Text style={[styles.price, { color: colors.foreground }]}>{money(trip.fare)}</Text></Card>)}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14, paddingHorizontal: 28 },
  scrollContent: { paddingHorizontal: 18 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 },
  kicker: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1.7 },
  heading: { fontFamily: 'Inter_700Bold', fontSize: 32, letterSpacing: -1.1, marginTop: 7, maxWidth: 310 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, marginTop: 8 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'Inter_700Bold', fontSize: 17 },
  hero: { borderRadius: 25, padding: 20, overflow: 'hidden', marginBottom: 16 },
  heroRingOne: { position: 'absolute', width: 220, height: 220, borderWidth: 24, borderColor: 'rgba(245,201,76,.14)', borderRadius: 120, right: -100, top: -100 },
  heroRingTwo: { position: 'absolute', width: 180, height: 180, borderWidth: 18, borderColor: 'rgba(172,210,197,.12)', borderRadius: 100, right: -35, bottom: -100 },
  heroTitle: { fontFamily: 'Inter_700Bold', fontSize: 27, letterSpacing: -0.7, marginTop: 15, marginBottom: 16 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderRadius: 13, height: 49, paddingHorizontal: 14, marginBottom: 8 },
  input: { flex: 1, marginLeft: 9, fontFamily: 'Inter_400Regular', fontSize: 14 },
  actionButton: { minHeight: 47, paddingHorizontal: 18, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  actionButtonText: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  notice: { flexDirection: 'row', gap: 8, alignItems: 'center', borderRadius: 13, padding: 13, marginBottom: 16 },
  noticeText: { fontFamily: 'Inter_500Medium', fontSize: 13, flex: 1 },
  section: { marginTop: 18 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 21, letterSpacing: -0.5, marginTop: 3 },
  link: { fontFamily: 'Inter_600SemiBold', fontSize: 12, textDecorationLine: 'underline' },
  card: { borderWidth: 1, borderRadius: 19, padding: 15 },
  tripCard: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 9 },
  iconTile: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  tripTop: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  tripRoute: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  mode: { fontFamily: 'Inter_600SemiBold', fontSize: 9, textTransform: 'uppercase', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5 },
  meta: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 4 },
  tripPrice: { alignItems: 'flex-end', gap: 5 },
  price: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  smallButton: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8 },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, paddingVertical: 12 },
  twoCol: { gap: 12, marginTop: 22 },
  activeCard: { padding: 17 },
  statusPill: { fontFamily: 'Inter_600SemiBold', fontSize: 10, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10, overflow: 'hidden' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15 },
  progressTrack: { height: 8, borderRadius: 5, overflow: 'hidden', marginTop: 13 },
  progress: { height: 8, borderRadius: 5 },
  divider: { height: 1, marginVertical: 14 },
  impactCard: { borderRadius: 19, padding: 18 },
  impactNumber: { fontFamily: 'Inter_700Bold', fontSize: 43, letterSpacing: -1.8, marginTop: 18 },
  impactUnit: { fontSize: 16 },
  impactLabel: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  impactStats: { flexDirection: 'row', gap: 30, borderTopWidth: 1, paddingTop: 13, marginTop: 18 },
  impactStat: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 8 },
  errorTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 16, textAlign: 'center' },
});