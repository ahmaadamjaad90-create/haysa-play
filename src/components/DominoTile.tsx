import { StyleSheet, View } from 'react-native';

// مكان النقاط بشبكة 3×3 لكل رقم
const PIPS: Record<number, [number, number][]> = {
  0: [],
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
};

function Half({ n, size }: { n: number; size: number }) {
  const step = size / 3.4;
  const dot = size * 0.17;
  return (
    <View style={{ width: size, height: size }}>
      {PIPS[n].map(([c, r], i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            width: dot,
            height: dot,
            borderRadius: dot / 2,
            backgroundColor: n === 6 || n === 5 ? '#D9381E' : '#2B1259',
            left: size * 0.12 + c * step + (step - dot) / 2,
            top: size * 0.12 + r * step + (step - dot) / 2,
          }}
        />
      ))}
    </View>
  );
}

// حجر دومينو. vertical: النص فوق والنص تحت
export function DominoTile({
  a,
  b,
  size = 26,
  vertical,
  dim,
  glow,
}: {
  a: number;
  b: number;
  size?: number;
  vertical?: boolean;
  dim?: boolean;
  glow?: boolean;
}) {
  return (
    <View
      style={[
        styles.tile,
        { flexDirection: vertical ? 'column' : 'row', borderRadius: size * 0.18 },
        glow && styles.glow,
      ]}>
      <Half n={a} size={size} />
      <View style={vertical ? { height: 2, width: size * 0.8, backgroundColor: '#CBB8F0' } : { width: 2, height: size * 0.8, backgroundColor: '#CBB8F0' }} />
      <Half n={b} size={size} />
      {dim && <View style={[styles.dim, { borderRadius: size * 0.18 }]} />}
    </View>
  );
}

export function DominoBack({ size = 14 }: { size?: number }) {
  return <View style={{ width: size, height: size * 2, borderRadius: 3, backgroundColor: '#6A35C9', borderWidth: 1.5, borderColor: '#FFFFFF' }} />;
}

const styles = StyleSheet.create({
  tile: {
    direction: 'ltr',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBB8F0',
    boxShadow: '0 2px 0 rgba(0,0,0,0.25)',
  },
  glow: { borderColor: '#FFC93C', borderWidth: 3, transform: [{ translateY: -8 }] },
  dim: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, backgroundColor: 'rgba(20,7,41,0.5)' },
});
