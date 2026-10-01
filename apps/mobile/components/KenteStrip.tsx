import React from 'react';
import { View } from 'react-native';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';

/**
 * A narrow woven band in gold, emerald, ink and red: the one decorative motif in TrotroLink, taken from kente cloth.
 * It marks the "official" surfaces (the trip card, the vehicle card, the profile card) so they feel like a ticket
 * issued by the union rather than a generic dark box. Purely decorative; hidden from screen readers.
 */
export function KenteStrip({ height = 6, opacity = 0.95 }: { height?: number; opacity?: number }) {
  const u = height;
  const w = u * 8;
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ height, width: '100%', opacity }}>
      <Svg width="100%" height={height}>
        <Defs>
          <Pattern id="kente" patternUnits="userSpaceOnUse" width={w} height={u}>
            <Rect x={0} y={0} width={u * 3} height={u} fill="#D4A437" />
            <Rect x={u * 3} y={0} width={u} height={u} fill="#0B1220" />
            <Rect x={u * 4} y={0} width={u * 2} height={u} fill="#12A576" />
            <Rect x={u * 6} y={0} width={u} height={u} fill="#0B1220" />
            <Rect x={u * 7} y={0} width={u} height={u} fill="#C8412B" />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width="100%" height={height} fill="url(#kente)" />
      </Svg>
    </View>
  );
}
