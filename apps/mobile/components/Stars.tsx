import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

/** Five stars: gold up to the rating, muted after. Unrated shows a muted label. */
export function Stars({ rating }: { rating: number | null }) {
  const colors = useColors();
  if (rating === null) return <Text style={[styles.unrated, { color: colors.mutedForeground }]}>Not rated</Text>;
  return (
    <View style={styles.row} accessibilityLabel={`Rated ${rating.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons key={n} name={n <= Math.round(rating) ? 'star' : 'star-outline'} size={15} color={n <= Math.round(rating) ? colors.accent : colors.border} />
      ))}
      <Text style={[styles.value, { color: colors.mutedForeground }]}>{rating.toFixed(1)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  value: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, marginLeft: 6 },
  unrated: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12 },
});
