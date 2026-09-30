import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGetWallet } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';

export default function WalletScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const wallet = useGetWallet();
  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>
      <Text style={[styles.kicker, { color: colors.mutedForeground }]}>MONEY FOR MOVEMENT</Text>
      <Text style={[styles.title, { color: colors.foreground }]}>Your wallet.</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>A simple way to keep your daily journeys moving.</Text>
      {wallet.isLoading ? <ActivityIndicator color={colors.primary} /> : wallet.data ? <><View style={[styles.balance, { backgroundColor: colors.primary }]}><Text style={[styles.kicker, { color: colors.primaryForeground + 'aa' }]}>AVAILABLE BALANCE</Text><Text style={[styles.balanceText, { color: colors.primaryForeground }]}>GHS {wallet.data.balance.toFixed(2)}</Text><View style={[styles.divider, { backgroundColor: colors.primaryForeground + '25' }]} /><View style={styles.row}><Text style={[styles.meta, { color: colors.primaryForeground + 'bb' }]}>Auto top-up</Text><Text style={[styles.pill, { backgroundColor: colors.accent, color: colors.foreground }]}>{wallet.data.autoTopup ? 'On' : 'Off'}</Text></View></View><View style={styles.section}><Text style={[styles.sectionTitle, { color: colors.foreground }]}>Payment methods</Text>{wallet.data.methods.map((method) => <View key={method.id} style={[styles.method, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={[styles.methodIcon, { backgroundColor: colors.accent }]}><Feather name="credit-card" size={17} color={colors.foreground} /></View><View style={styles.flex}><Text style={[styles.methodLabel, { color: colors.foreground }]}>{method.label}</Text><Text style={[styles.meta, { color: colors.mutedForeground }]}>{method.type}</Text></View>{method.isDefault ? <Text style={[styles.meta, { color: colors.mutedForeground }]}>Default</Text> : null}</View>)}</View><View style={styles.section}><Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent transactions</Text>{wallet.data.transactions.map((tx) => <View key={tx.id} style={[styles.transaction, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={[styles.methodIcon, { backgroundColor: colors.muted }]}><Feather name={tx.amount < 0 ? 'arrow-up-right' : 'plus'} size={17} color={colors.foreground} /></View><View style={styles.flex}><Text style={[styles.methodLabel, { color: colors.foreground }]}>{tx.description}</Text><Text style={[styles.meta, { color: colors.mutedForeground }]}>{tx.date} · {tx.status}</Text></View><Text style={[styles.amount, { color: colors.foreground }]}>{tx.amount > 0 ? '+' : ''}GHS {Math.abs(tx.amount).toFixed(2)}</Text></View>)}</View></> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18 },
  kicker: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1.7 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 34, letterSpacing: -1.2, marginTop: 7 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, marginTop: 9, marginBottom: 20 },
  balance: { borderRadius: 23, padding: 20 },
  balanceText: { fontFamily: 'Inter_700Bold', fontSize: 42, letterSpacing: -1.5, marginTop: 18 },
  divider: { height: 1, marginVertical: 17 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pill: { fontFamily: 'Inter_600SemiBold', fontSize: 11, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10, overflow: 'hidden' },
  section: { marginTop: 25 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 21, marginBottom: 10 },
  method: { borderWidth: 1, borderRadius: 16, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 8 },
  methodIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  methodLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  meta: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 4 },
  transaction: { borderWidth: 1, borderRadius: 16, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 8 },
  amount: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
});