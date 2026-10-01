import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { CediIcon } from '@/components/CediIcon';
import { useColors } from '@/hooks/useColors';

type IconName = React.ComponentProps<typeof Feather>['name'];

const STEPS: Array<{ icon: IconName | 'cedi'; title: string; body: string }> = [
  { icon: 'maximize', title: 'Ride in three taps', body: 'Open Scan, point at the QR sticker inside the trotro (or type the short code, like CIR01), pick where you are getting off, and pay. No sign-up is needed.' },
  { icon: 'map-pin', title: "Your stop isn't listed?", body: 'Trotros stop anywhere. Choose "My stop isn\'t listed", type a note like "near Melcom", and pay the fare to the stop just before it.' },
  { icon: 'smartphone', title: 'Paying with MTN MoMo', body: 'Fares are paid by MTN Mobile Money from your phone: you approve a prompt with your MoMo PIN. You need an MTN SIM with MoMo registered, which MTN shops can set up with your passport.' },
  { icon: 'credit-card', title: 'No MoMo yet?', body: 'Card and international payment options depend on the payment provider GPRTU chooses. Until they are added, ask your hotel or an MTN shop to help you set up MoMo.' },
  { icon: 'cedi', title: 'Prices in your currency', body: 'Go to Profile → Settings → Currency to see approximate prices in dollars, euros, pounds or naira. Fares are always set and charged in Ghana cedis (₵), and the conversion is only a guide.' },
  { icon: 'shield', title: 'Staying safe', body: 'Check the vehicle code matches the sticker, keep your PAID badge ready to show the conductor, and use Report issue on the Trip screen if you are overcharged or feel unsafe.' },
];

/** Plain-language guide for visitors who are new to trotros and MoMo. */
export default function VisitorGuide() {
  const colors = useColors();
  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.body}>
      <Text style={[styles.title, { color: colors.foreground }]}>Visiting Ghana?</Text>
      <Text style={[styles.sub, { color: colors.mutedForeground }]}>Everything you need to ride a trotro with TrotroLink.</Text>
      {STEPS.map((s) => (
        <View key={s.title} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <View style={[styles.icon, { backgroundColor: colors.secondary }]}>
            {s.icon === 'cedi' ? <CediIcon size={20} color="#D4A437" /> : <Feather name={s.icon} size={20} color="#D4A437" />}
          </View>
          <View style={styles.text}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>{s.title}</Text>
            <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>{s.body}</Text>
          </View>
        </View>
      ))}
      <Pressable onPress={() => Linking.openURL('mailto:help@trotrolink.app')} accessibilityRole="button" style={styles.help}>
        <Feather name="mail" size={16} color={colors.primary} />
        <Text style={[styles.helpText, { color: colors.primary }]}>Need help? help@trotrolink.app</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 24, paddingBottom: 48 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 30 },
  sub: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22, marginTop: 6, marginBottom: 20 },
  card: { flexDirection: 'row', gap: 14, borderWidth: 1, padding: 16, marginBottom: 12 },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1 },
  cardTitle: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  cardBody: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, marginTop: 4 },
  help: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 20 },
  helpText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
});
