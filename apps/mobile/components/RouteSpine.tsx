import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { GOLD } from '@/lib/colors';

export type SpineStop = {
  name: string;
  /** Text on the right of the row, normally the fare. */
  right?: string;
  /** Where the passenger gets on: drawn with a bus marker. Rows above it are dimmed and cannot be picked. */
  here?: boolean;
  /** A stop behind the boarding point: shown for context, not selectable. */
  behind?: boolean;
};

const ROW = 58;
const RAIL = 36;

/**
 * The route drawn as a line with stops on it, like a transit map: you can see where you are, what is behind you, and the
 * road to your stop lights up as you pick it. Order is obvious without reading, which matters for first-time riders.
 */
export function RouteSpine({ stops, selected, onSelect, resettable = false, hereLabel = 'YOU GET ON HERE' }: { stops: SpineStop[]; selected: string | null; onSelect?: (name: string) => void; resettable?: boolean; hereLabel?: string }) {
  const colors = useColors();
  const hereIdx = stops.findIndex((s) => s.here);
  const selIdx = stops.findIndex((s) => s.name === selected);
  const idle = colors.border;
  const tint = colors.scheme === 'light' ? 'rgba(7,128,90,0.09)' : 'rgba(43,217,159,0.12)';

  return (
    <View accessibilityRole="radiogroup">
      {stops.map((s, i) => {
        const isSel = s.name === selected;
        const first = i === 0;
        const last = i === stops.length - 1;
        const selectable = !s.behind && (!s.here || resettable) && !!onSelect;
        const inRide = selIdx >= 0 && hereIdx >= 0 && i > hereIdx && i < selIdx;
        const rideOn = selIdx >= 0 && hereIdx >= 0;
        const aboveLit = rideOn && i > hereIdx && i <= selIdx;
        const belowLit = rideOn && i >= hereIdx && i < selIdx;
        return (
          <Pressable
            key={s.name}
            disabled={!selectable}
            onPress={() => onSelect?.(s.name)}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSel, disabled: !selectable }}
            accessibilityLabel={`${s.name}${s.right ? `, ${s.right}` : ''}${s.here ? ', you get on here' : ''}`}
            style={[styles.row, isSel && { backgroundColor: tint, borderRadius: colors.radius }]}
          >
            <View style={styles.rail}>
              <View style={[styles.line, { top: first ? ROW / 2 : 0, bottom: last ? ROW / 2 : 0, backgroundColor: idle }]} />
              {/* the road to the chosen stop lights up: half a segment above this stop, half below */}
              {aboveLit ? <View style={[styles.line, { top: 0, bottom: ROW / 2, backgroundColor: colors.primary }]} /> : null}
              {belowLit ? <View style={[styles.line, { top: ROW / 2, bottom: 0, backgroundColor: colors.primary }]} /> : null}
              {s.here ? (
                <View style={[styles.bus, { backgroundColor: GOLD, borderColor: colors.card }]}>
                  <Feather name="truck" size={12} color="#1A1405" />
                </View>
              ) : isSel ? (
                <View style={[styles.nodeSel, { backgroundColor: colors.primary, borderColor: colors.card }]}>
                  <Feather name="check" size={13} color={colors.primaryForeground} />
                </View>
              ) : (
                <View style={[styles.node, { backgroundColor: s.behind ? idle : colors.card, borderColor: inRide ? colors.primary : s.behind ? idle : colors.mutedForeground }]} />
              )}
            </View>
            <View style={styles.body}>
              <Text numberOfLines={1} style={[styles.name, { color: s.behind ? colors.mutedForeground : colors.foreground, fontFamily: isSel || s.here ? 'PlusJakartaSans_800ExtraBold' : 'PlusJakartaSans_600SemiBold', opacity: s.behind ? 0.6 : 1 }]}>
                {s.name}
              </Text>
              {s.here ? <Text style={[styles.sub, { color: GOLD }]}>{hereLabel}</Text> : null}
            </View>
            {s.right && !s.here ? (
              <Text style={[styles.fare, { color: isSel ? colors.primary : s.behind ? colors.mutedForeground : colors.foreground, opacity: s.behind ? 0.5 : 1 }]}>{s.right}</Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', height: ROW, paddingRight: 14 },
  rail: { width: RAIL, height: ROW, alignItems: 'center', justifyContent: 'center' },
  line: { position: 'absolute', width: 3, borderRadius: 2 },
  node: { width: 14, height: 14, borderRadius: 7, borderWidth: 3 },
  nodeSel: { width: 24, height: 24, borderRadius: 12, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  bus: { width: 26, height: 26, borderRadius: 13, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, paddingLeft: 6 },
  name: { fontSize: 17, letterSpacing: -0.2 },
  sub: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 10, letterSpacing: 1.2, marginTop: 1 },
  fare: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 17, letterSpacing: -0.3 },
});
