import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { SCRIM } from '@/lib/colors';
import { useT } from '@/lib/i18n';
import { PrimaryButton } from '@/components/PrimaryButton';

type Props = {
  initialCode?: string;
  visible: boolean;
  loading: boolean;
  error: string | null;
  onSubmit: (code: string) => void;
  onClose: () => void;
};

export function CodeEntrySheet({ initialCode = '', visible, loading, error, onSubmit, onClose }: Props) {
  const colors = useColors();
  const t = useT();
  const [code, setCode] = useState(initialCode);
  useEffect(() => {
    if (visible) setCode(initialCode);
  }, [visible, initialCode]);
  const ready = code.trim().length >= 3 && !loading;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border, borderTopLeftRadius: colors.radiusModal, borderTopRightRadius: colors.radiusModal }]}>
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          <Text style={[styles.title, { color: colors.foreground }]}>{t('code.title')}</Text>
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>{t('code.hint')}</Text>
          <TextInput
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            placeholder="CIR01"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
            maxLength={12}
            returnKeyType="go"
            onSubmitEditing={() => ready && onSubmit(code)}
            accessibilityLabel="Vehicle short code"
            style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: error ? colors.destructive : colors.border, borderRadius: colors.radius }]}
          />
          {error ? <Text style={[styles.error, { color: colors.destructive }]} accessibilityRole="alert">{error}</Text> : null}
          <PrimaryButton onPress={() => onSubmit(code)} disabled={!ready} loading={loading} label={t('code.find')} style={styles.cta} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: SCRIM },
  sheet: { padding: 24, paddingBottom: 36, borderWidth: StyleSheet.hairlineWidth * 2, borderBottomWidth: 0 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 20 },
  title: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 22, marginBottom: 6 },
  hint: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, marginBottom: 18 },
  input: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 28, letterSpacing: 4, textAlign: 'center', borderWidth: StyleSheet.hairlineWidth * 2, paddingVertical: 16 },
  error: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, marginTop: 10 },
  cta: { marginTop: 20 },
  ctaText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 17 },
});
