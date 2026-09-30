import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { colors } from '@/lib/colors';

type Props = {
  visible: boolean;
  loading: boolean;
  error: string | null;
  onSubmit: (code: string) => void;
  onClose: () => void;
};

export function CodeEntrySheet({ visible, loading, error, onSubmit, onClose }: Props) {
  const colors = useColors();
  const [code, setCode] = useState('');
  const ready = code.trim().length >= 3 && !loading;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border, borderTopLeftRadius: colors.radiusModal, borderTopRightRadius: colors.radiusModal }]}>
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          <Text style={[styles.title, { color: colors.foreground }]}>Enter short code</Text>
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>Find it printed under the QR sticker, e.g. CIR01.</Text>
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
          <Pressable
            onPress={() => onSubmit(code)}
            disabled={!ready}
            accessibilityRole="button"
            accessibilityState={{ disabled: !ready }}
            style={[styles.cta, { backgroundColor: colors.primary, opacity: ready ? 1 : 0.4, borderRadius: colors.radiusPill }]}
          >
            {loading ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>Find my trotro</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: `${colors.background}99` },
  sheet: { padding: 24, paddingBottom: 36, borderWidth: 1, borderBottomWidth: 0 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 20 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 22, marginBottom: 6 },
  hint: { fontFamily: 'Inter_400Regular', fontSize: 14, marginBottom: 18 },
  input: { fontFamily: 'Inter_700Bold', fontSize: 28, letterSpacing: 4, textAlign: 'center', borderWidth: 1, paddingVertical: 16 },
  error: { fontFamily: 'Inter_500Medium', fontSize: 14, marginTop: 10 },
  cta: { marginTop: 20, height: 56, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: 'Inter_700Bold', fontSize: 17 },
});
