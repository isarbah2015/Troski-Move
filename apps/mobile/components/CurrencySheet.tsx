import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { CURRENCY_LABELS, DISPLAY_CURRENCIES, RATES_NOTE, type DisplayCurrency } from '@trotrolink/shared';
import { useColors } from '@/hooks/useColors';
import { SCRIM } from '@/lib/colors';

type Props = { visible: boolean; selected: DisplayCurrency; onSelect: (c: DisplayCurrency) => void; onClose: () => void };

export function CurrencySheet({ visible, selected, onSelect, onClose }: Props) {
  const colors = useColors();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: SCRIM }]} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border, borderTopLeftRadius: colors.radiusModal, borderTopRightRadius: colors.radiusModal }]}>
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          <Text style={[styles.title, { color: colors.foreground }]}>Show prices in</Text>
          {DISPLAY_CURRENCIES.map((c) => {
            const active = c === selected;
            return (
              <Pressable
                key={c}
                onPress={() => {
                  Haptics.selectionAsync();
                  onSelect(c);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={[styles.row, { borderColor: active ? colors.primary : colors.border, borderRadius: colors.radius }]}
              >
                <Text style={[styles.label, { color: colors.foreground }]}>{CURRENCY_LABELS[c]}</Text>
                {active ? <Feather name="check" size={20} color={colors.primary} /> : null}
              </Pressable>
            );
          })}
          <Text style={[styles.note, { color: colors.mutedForeground }]}>{RATES_NOTE} Fares are always set and charged in Ghana cedis (₵).</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: { padding: 24, paddingBottom: 40, borderWidth: StyleSheet.hairlineWidth * 2, borderBottomWidth: 0 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 20 },
  title: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 22, marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: StyleSheet.hairlineWidth * 2, padding: 16, marginBottom: 10 },
  label: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 16 },
  note: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, lineHeight: 18, marginTop: 4 },
});
