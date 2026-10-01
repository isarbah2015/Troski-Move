import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { api } from '@/lib/api';
import { getDeviceId } from '@/lib/identity';
import { getPosition } from '@/lib/location';
import { SCRIM } from '@/lib/colors';
import { useT } from '@/lib/i18n';
import { showToast } from '@/lib/toast';
import { PrimaryButton } from '@/components/PrimaryButton';

type Props = { visible: boolean; initialCode?: string; onClose: () => void };

/**
 * Report a trotro that is not on the GPRTU register: no sticker, or a code the app does not know. The report carries
 * the phone's position (when allowed) so the union can find the vehicle, and goes to the union dashboard.
 */
export function UnregisteredSheet({ visible, initialCode = '', onClose }: Props) {
  const colors = useColors();
  const t = useT();
  const [code, setCode] = useState(initialCode);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setCode(initialCode);
      setNote('');
      setBusy(false);
    }
  }, [visible, initialCode]);

  const send = async () => {
    setBusy(true);
    try {
      const pos = await getPosition({ timeoutMs: 3000 });
      await api.reportUnregistered({ deviceId: await getDeviceId(), ...(code.trim() ? { code: code.trim() } : {}), ...(note.trim() ? { note: note.trim() } : {}), ...(pos ? { lat: pos.lat, lng: pos.lng } : {}) });
      showToast(t('unreg.thanks'));
      onClose();
    } catch {
      showToast("Couldn't send the report. Check your connection and try again.");
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: SCRIM }]} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border, borderTopLeftRadius: colors.radiusModal, borderTopRightRadius: colors.radiusModal }]}>
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          <View style={[styles.icon, { backgroundColor: colors.scheme === 'light' ? 'rgba(154,103,0,0.10)' : 'rgba(231,184,90,0.14)' }]}>
            <Feather name="alert-triangle" size={24} color={colors.accent} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>{t('unreg.title')}</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>{t('unreg.body')}</Text>
          <TextInput
            value={code}
            onChangeText={(v) => setCode(v.toUpperCase())}
            placeholder={t('unreg.code')}
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={20}
            accessibilityLabel={t('unreg.code')}
            style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border, borderRadius: colors.radius }]}
          />
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder={t('unreg.note')}
            placeholderTextColor={colors.mutedForeground}
            multiline
            maxLength={300}
            accessibilityLabel={t('unreg.note')}
            style={[styles.input, styles.multi, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border, borderRadius: colors.radius }]}
          />
          <PrimaryButton onPress={() => void send()} loading={busy} label={t('unreg.send')} icon="send" style={styles.cta} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: { padding: 24, paddingBottom: 36, borderWidth: StyleSheet.hairlineWidth * 2, borderBottomWidth: 0 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 18 },
  icon: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 22, letterSpacing: -0.4 },
  body: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, lineHeight: 21, marginTop: 6, marginBottom: 16 },
  input: { borderWidth: StyleSheet.hairlineWidth * 2, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 10, fontFamily: 'PlusJakartaSans_500Medium', fontSize: 15 },
  multi: { minHeight: 88, textAlignVertical: 'top' },
  cta: { marginTop: 8 },
});
