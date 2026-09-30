import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCreateReport } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';

export default function SafetyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const report = useCreateReport();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [notice, setNotice] = useState('');
  const submit = () => {
    if (title.trim().length < 3 || description.trim().length < 5) {
      setNotice('Add a short title and a few details so we can help.');
      return;
    }
    report.mutate({ data: { reportType: 'service', title: title.trim(), description: description.trim() } }, {
      onSuccess: async (created) => {
        const existing = JSON.parse((await AsyncStorage.getItem('trotrolink-mobile-reports')) || '[]') as unknown[];
        await AsyncStorage.setItem('trotrolink-mobile-reports', JSON.stringify([created, ...existing]));
        setTitle('');
        setDescription('');
        setNotice('Report received. Our team will review it.');
      },
      onError: () => setNotice('We could not send that report. Try again.'),
    });
  };
  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 100 }]} keyboardShouldPersistTaps="handled">
      <Text style={[styles.kicker, { color: colors.mutedForeground }]}>CARE WHEN IT MATTERS</Text>
      <Text style={[styles.title, { color: colors.foreground }]}>Safety desk.</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Report a concern, a service issue, or something that made your journey feel unsafe.</Text>
      <View style={[styles.sos, { backgroundColor: colors.primary }]}><View style={[styles.sosIcon, { backgroundColor: colors.secondary }]}><Feather name="shield" size={22} color={colors.foreground} /></View><View style={styles.flex}><Text style={[styles.sosTitle, { color: colors.primaryForeground }]}>Need urgent help?</Text><Text style={[styles.sosText, { color: colors.primaryForeground + 'bb' }]}>For an immediate emergency, contact local emergency services first.</Text></View></View>
      <Text style={[styles.label, { color: colors.foreground }]}>What happened?</Text>
      <TextInput value={title} onChangeText={setTitle} placeholder="e.g. Driver skipped my stop" placeholderTextColor={colors.mutedForeground} style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]} />
      <Text style={[styles.label, { color: colors.foreground }]}>Tell us more</Text>
      <TextInput value={description} onChangeText={setDescription} placeholder="Share the route, vehicle, time, or anything else that helps." placeholderTextColor={colors.mutedForeground} multiline textAlignVertical="top" style={[styles.textarea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]} />
      <Pressable disabled={report.isPending} onPress={submit} style={({ pressed }) => [styles.submit, { backgroundColor: colors.primary, opacity: report.isPending ? 0.5 : pressed ? 0.8 : 1 }]}><Text style={{ color: colors.primaryForeground, fontFamily: 'Inter_700Bold', fontSize: 14 }}>{report.isPending ? 'Sending...' : 'Send report'}</Text></Pressable>
      {notice ? <View style={[styles.notice, { backgroundColor: colors.accent }]}><Feather name="check-circle" size={17} color={colors.foreground} /><Text style={[styles.noticeText, { color: colors.foreground }]}>{notice}</Text></View> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18 },
  kicker: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1.7 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 34, letterSpacing: -1.2, marginTop: 7 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, marginTop: 9, marginBottom: 20 },
  sos: { borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  sosIcon: { width: 45, height: 45, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  sosTitle: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  sosText: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 17, marginTop: 4 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 13, marginBottom: 7, marginTop: 12 },
  input: { height: 50, borderWidth: 1, borderRadius: 13, paddingHorizontal: 14, fontFamily: 'Inter_400Regular', fontSize: 14 },
  textarea: { minHeight: 125, borderWidth: 1, borderRadius: 13, padding: 14, fontFamily: 'Inter_400Regular', fontSize: 14 },
  submit: { height: 50, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  notice: { flexDirection: 'row', gap: 8, alignItems: 'center', borderRadius: 13, padding: 13, marginTop: 14 },
  noticeText: { fontFamily: 'Inter_500Medium', fontSize: 13, flex: 1 },
});