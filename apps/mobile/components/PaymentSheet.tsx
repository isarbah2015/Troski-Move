import React from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { formatCedis } from '@/lib/api';
import { EMERALD, ERROR, SCRIM_STRONG } from '@/lib/colors';

export type PaymentPhase = 'sending' | 'pending' | 'success' | 'failed' | 'timeout';

type Props = {
  phase: PaymentPhase | null;
  amount: number;
  destination: string;
  message?: string;
  simulator: boolean;
  onRetry: () => void;
  onClose: () => void;
};

const COPY: Record<PaymentPhase, { title: string; body: string }> = {
  sending: { title: 'Sending request…', body: 'Sending request to your phone…' },
  pending: { title: 'Approve on your phone', body: 'Check your phone for the MoMo prompt and enter your PIN.' },
  success: { title: 'Payment received', body: 'Your trip is starting.' },
  failed: { title: 'Payment failed', body: 'The payment did not go through.' },
  timeout: { title: 'Payment timed out', body: 'Payment timed out. Try again.' },
};

/** Blocks the screen while a MoMo payment is in flight; a failed or timed-out payment offers Try again. */
export function PaymentSheet({ phase, amount, destination, message, simulator, onRetry, onClose }: Props) {
  const colors = useColors();
  const busy = phase === 'sending' || phase === 'pending';
  const copy = phase ? COPY[phase] : null;
  const bad = phase === 'failed' || phase === 'timeout';

  return (
    <Modal visible={!!phase} transparent animationType="fade" onRequestClose={() => (bad ? onClose() : undefined)}>
      <View style={[styles.root, { backgroundColor: SCRIM_STRONG }]}>
        {copy ? (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: bad ? colors.destructive : colors.border, borderRadius: colors.radiusModal }]} accessibilityLiveRegion="polite">
            <View style={[styles.badge, { backgroundColor: colors.secondary }]}>
              {busy ? (
                <ActivityIndicator color={EMERALD} />
              ) : (
                <Feather name={phase === 'success' ? 'check-circle' : phase === 'timeout' ? 'clock' : 'x-circle'} size={30} color={bad ? ERROR : EMERALD} />
              )}
            </View>
            <Text style={[styles.title, { color: colors.foreground }]}>{copy.title}</Text>
            <Text style={[styles.amount, { color: colors.foreground }]}>{formatCedis(amount)}</Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>to {destination}</Text>
            <Text style={[styles.body, { color: bad ? colors.destructive : colors.mutedForeground }]}>{phase === 'failed' && message ? message : copy.body}</Text>

            {simulator && busy ? (
              <View style={[styles.sim, { borderColor: colors.accent, borderRadius: colors.radiusPill }]}>
                <Text style={[styles.simText, { color: colors.accent }]}>Simulator mode · no money moves</Text>
              </View>
            ) : null}

            {bad ? (
              <View style={styles.actions}>
                <Pressable onPress={onRetry} accessibilityRole="button" style={[styles.primary, { backgroundColor: colors.primary, borderRadius: colors.radiusPill }]}>
                  <Text style={[styles.primaryText, { color: colors.primaryForeground }]}>Try again</Text>
                </Pressable>
                <Pressable onPress={onClose} accessibilityRole="button" style={styles.cancel}>
                  <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Cancel</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 380, borderWidth: 1, padding: 28, alignItems: 'center' },
  badge: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 22, textAlign: 'center' },
  amount: { fontFamily: 'Inter_700Bold', fontSize: 34, marginTop: 14 },
  sub: { fontFamily: 'Inter_500Medium', fontSize: 14, marginTop: 2 },
  body: { fontFamily: 'Inter_500Medium', fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 18 },
  sim: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 5, marginTop: 16 },
  simText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  actions: { alignSelf: 'stretch', marginTop: 22 },
  primary: { height: 52, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  cancel: { alignItems: 'center', paddingVertical: 14 },
  cancelText: { fontFamily: 'Inter_500Medium', fontSize: 15 },
});
