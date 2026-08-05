import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getListRoutesQueryKey, useListRoutes } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';

export default function RoutesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const query = useListRoutes(search ? { search } : undefined, { query: { queryKey: getListRoutesQueryKey(search ? { search } : undefined) } });
  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>
      <Text style={[styles.kicker, { color: colors.mutedForeground }]}>NETWORK MAP</Text>
      <Text style={[styles.title, { color: colors.foreground }]}>Find your route.</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Reliable options across Accra, with the details that matter before you step out.</Text>
      <View style={[styles.search, { backgroundColor: colors.card, borderColor: colors.border }]}><Feather name="search" size={18} color={colors.mutedForeground} /><TextInput value={search} onChangeText={setSearch} placeholder="Search route or destination" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground }]} /></View>
      {query.isLoading ? <ActivityIndicator color={colors.primary} /> : query.data?.map((route) => <View key={route.id} style={[styles.routeCard, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={[styles.routeLine, { backgroundColor: colors.secondary }]} /><View style={styles.flex}><View style={styles.routeHeader}><Text style={[styles.routeName, { color: colors.foreground }]}>{route.name}</Text><Text style={[styles.status, { backgroundColor: colors.accent, color: colors.foreground }]}>{route.status}</Text></View><Text style={[styles.meta, { color: colors.mutedForeground }]}>{route.from} → {route.to}</Text><View style={styles.metrics}><Text style={[styles.metric, { color: colors.foreground }]}>{route.durationMinutes} min</Text><Text style={[styles.metric, { color: colors.foreground }]}>GHS {route.fare.toFixed(2)}</Text><Text style={[styles.metric, { color: colors.foreground }]}>{route.nextDeparture}</Text></View></View><Pressable accessibilityLabel={`Save ${route.name}`} style={[styles.save, { borderColor: colors.border }]}><Feather name="plus" size={18} color={colors.foreground} /></Pressable></View>)}
      {!query.isLoading && !query.data?.length ? <Text style={[styles.empty, { color: colors.mutedForeground }]}>No routes match that search.</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18 },
  kicker: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1.7 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 34, letterSpacing: -1.2, marginTop: 7 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, marginTop: 9, marginBottom: 20 },
  search: { height: 48, borderWidth: 1, borderRadius: 13, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  input: { flex: 1, marginLeft: 9, fontFamily: 'Inter_400Regular', fontSize: 14 },
  routeCard: { borderWidth: 1, borderRadius: 19, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 9 },
  routeLine: { width: 4, height: 52, borderRadius: 3 },
  flex: { flex: 1 },
  routeHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  routeName: { fontFamily: 'Inter_700Bold', fontSize: 15, flex: 1 },
  status: { fontFamily: 'Inter_600SemiBold', fontSize: 9, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 8, overflow: 'hidden' },
  meta: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 5 },
  metrics: { flexDirection: 'row', gap: 14, marginTop: 10 },
  metric: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  save: { width: 37, height: 37, borderWidth: 1, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  empty: { textAlign: 'center', fontFamily: 'Inter_400Regular', fontSize: 14, padding: 20 },
});