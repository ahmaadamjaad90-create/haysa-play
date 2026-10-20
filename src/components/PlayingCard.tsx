import { StyleSheet, View } from 'react-native';

import { T } from './ui';

// الورقة: النوع (s h d c) + الرقم (A K Q J T 9 8 7 6)، والجوكر JR أو JB
export const SUITS: Record<string, { sym: string; red: boolean; name: string }> = {
  s: { sym: '♠', red: false, name: 'سبيت' },
  h: { sym: '♥', red: true, name: 'هاص' },
  d: { sym: '♦', red: true, name: 'ديمن' },
  c: { sym: '♣', red: false, name: 'شريا' },
};

export const rankLabel = (c: string) => (c[1] === 'T' ? '10' : c.slice(1));

export function PlayingCard({ card, width = 52, dim, glow }: { card: string; width?: number; dim?: boolean; glow?: boolean }) {
  const h = width * 1.42;
  const joker = card === 'JR' || card === 'JB';
  const suit = SUITS[card[0]];
  const color = joker ? (card === 'JR' ? '#D9381E' : '#1C0A3A') : suit.red ? '#D9381E' : '#1C0A3A';
  return (
    <View style={[styles.card, { width, height: h, borderRadius: width * 0.12 }, glow && styles.glow]}>
      {joker ? (
        <>
          <T w="black" style={{ fontSize: width * 0.2, color, position: 'absolute', top: 3, start: 5 }}>جوكر</T>
          <T style={{ fontSize: width * 0.55, lineHeight: width * 0.7 }}>🃏</T>
        </>
      ) : (
        <>
          <View style={[styles.corner, { top: width * 0.04, start: width * 0.08 }]}>
            <T w="black" style={{ fontSize: width * 0.3, lineHeight: width * 0.34, color }}>{rankLabel(card)}</T>
            <T style={{ fontSize: width * 0.24, lineHeight: width * 0.26, color }}>{suit.sym}</T>
          </View>
          <T style={{ fontSize: width * 0.62, lineHeight: width * 0.72, color, marginTop: width * 0.2 }}>{suit.sym}</T>
        </>
      )}
      {dim && <View style={[styles.dim, { borderRadius: width * 0.1 }]} />}
    </View>
  );
}

export function CardBackSmall({ width = 22 }: { width?: number }) {
  return <View style={{ width, height: width * 1.42, borderRadius: 4, backgroundColor: '#6A35C9', borderWidth: 1.5, borderColor: '#FFFFFF' }} />;
}

const styles = StyleSheet.create({
  card: {
    direction: 'ltr',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBB8F0',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 0 rgba(0,0,0,0.25)',
  },
  corner: { position: 'absolute', alignItems: 'center' },
  glow: { borderColor: '#FFC93C', borderWidth: 3, transform: [{ translateY: -12 }] },
  dim: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, backgroundColor: 'rgba(20,7,41,0.5)' },
});
