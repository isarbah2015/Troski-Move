import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Booking } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';

export default function BookingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    AsyncStorage.getItem('troski-mobile-bookings').then((value) => {
      setBookings(value ? (JSON.parse(value) as Booking[]) : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);
  return <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.content, { paddingTop: 18, paddingBottom: insets.bottom + 40 }]}>{loading ? <ActivityIndicator color={colors.primary} /> : bookings.length ? bookings.map((booking) => <View key={booking.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={[styles.icon, { backgroundColor: colors.accent }]}><Feather name="tag" size={19} color={colors.foreground} /></View><View style={styles.flex}><View style={styles.row}><Text style={[styles.name, { color: colors.foreground }]}>{booking.routeName}</Text><Text style={[styles.status, { backgroundColor: colors.accent, color: colors.foreground }]}>{booking.status}</Text></View><Text style={[styles.meta, { color: colors.mutedForeground }]}>{booking.passengerCount} passenger · {booking.paymentMethod}</Text></View><Text style={[styles.price, { color: colors.foreground }]}>GHS {booking.totalFare.toFixed(2)}</Text></View>) : <View style={styles.empty}><Feather name="tag" size={28} color={colors.mutedForeground} /><Text style={[styles.emptyTitle, { color: colors.foreground }]}>No bookings yet</Text><Text style={[styles.meta, { color: colors.mutedForeground }]}>Confirm a seat from Home and it will stay here.</Text></View>}</ScrollView>;
}

const styles = StyleSheet.create({
  content: { padding: 18 },
  card: { borderWidth: 1, borderRadius: 19, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 9 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontFamily: 'Inter_700Bold', fontSize: 14, flex: 1 },
  status: { fontFamily: 'Inter_600SemiBold', fontSize: 9, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 8, overflow: 'hidden' },
  meta: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 17, marginTop: 5 },
  price: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 120, paddingHorizontal: 25 },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 20, marginTop: 15 },
});