import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { APP_LANGUAGES, type AppLanguage } from '@trotrolink/shared';
import { useColors } from '@/hooks/useColors';
import { SCRIM } from '@/lib/colors';

// Each language is listed in its own script so visitors can find it, with the English name beneath for the others.
export const NATIVE_NAME: Record<AppLanguage, string> = {
  English: 'English', Twi: 'Twi (Akan)', Ewe: 'Eʋegbe (Ewe)', German: 'Deutsch', Russian: 'Русский', Dutch: 'Nederlands', Chinese: '中文 (简体)',
};

type Props = { visible: boolean; selected: AppLanguage; onSelect: (l: AppLanguage) => void; onClose: () => void };

export function LanguageSheet({ visible, selected, onSelect, onClose }: Props) {
  const colors = useColors();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: SCRIM }]} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border, borderTopLeftRadius: colors.radiusModal, borderTopRightRadius: colors.radiusModal }]}>
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          <Text style={[styles.title, { color: colors.foreground }]}>Language</Text>
          {APP_LANGUAGES.map((l) => {
            const active = l === selected;
            return (
              <Pressable
                key={l}
                onPress={() => {
                  Haptics.selectionAsync();
                  onSelect(l);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={[styles.row, { borderColor: active ? colors.primary : colors.border, borderRadius: colors.radius }]}
              >
                <Text style={[styles.label, { color: colors.foreground }]}>{NATIVE_NAME[l]}</Text>
                {active ? <Feather name="check" size={20} color={colors.primary} /> : null}
              </Pressable>
            );
          })}
          <Text style={[styles.note, { color: colors.mutedForeground }]}>All languages cover the passenger screens (the conductor screens stay in English). Non-English wording is a first version and may change.</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: { padding: 24, paddingBottom: 40, borderWidth: 1, borderBottomWidth: 0 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 20 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 22, marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, padding: 16, marginBottom: 10 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 16 },
  note: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, marginTop: 4 },
});
