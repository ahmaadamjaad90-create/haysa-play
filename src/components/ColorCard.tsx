import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { ar } from '@/lib/format';
import { CARD_COLORS, isWild, type ColorKey } from '@/lib/colors';
import { colors } from '@/theme';
import { T } from './ui';

// الرمز اللي بينكتب عالورقة
function label(card: string) {
  const v = isWild(card) ? card : card.slice(1);
  switch (v) {
    case 's':
      return '⊘';
    case 'r':
      return '⇄';
    case 'd':
      return '+٢';
    case 'w4':
      return '+٤';
    case 'w':
      return '';
    default:
      return ar(Number(v));
  }
}

// دائرة بأربع ألوان (لورق الألوان)
function Wheel({ size }: { size: number }) {
  const r = size / 2;
  const q = (a: number, b: number) => {
    const x1 = r + r * Math.cos(a);
    const y1 = r + r * Math.sin(a);
    const x2 = r + r * Math.cos(b);
    const y2 = r + r * Math.sin(b);
    return `M${r} ${r} L${x1} ${y1} A${r} ${r} 0 0 1 ${x2} ${y2} Z`;
  };
  const keys: ColorKey[] = ['r', 'y', 'g', 'b'];
  return (
    <Svg width={size} height={size}>
      {keys.map((k, i) => (
        <Path key={k} d={q((i * Math.PI) / 2 - Math.PI, ((i + 1) * Math.PI) / 2 - Math.PI)} fill={CARD_COLORS[k].bg} />
      ))}
    </Svg>
  );
}

export function ColorCard({
  card,
  width = 64,
  pick,
  dim,
}: {
  card: string;
  width?: number;
  // لون ورقة الألوان بعد ما انختار
  pick?: ColorKey | null;
  dim?: boolean;
}) {
  const h = width * 1.45;
  const wild = isWild(card);
  const bg = wild ? (pick ? CARD_COLORS[pick].bg : '#2B1259') : CARD_COLORS[card[0] as ColorKey].bg;
  const ink = wild ? (pick ? CARD_COLORS[pick].dark : colors.ink) : CARD_COLORS[card[0] as ColorKey].dark;
  const text = label(card);
  return (
    <View style={[styles.card, { width, height: h, borderRadius: width * 0.16, backgroundColor: bg }]}>
      <View style={[styles.oval, { width: width * 0.78, height: h * 0.66, borderRadius: width * 0.4, transform: [{ rotate: '-18deg' }] }]}>
        {wild && card === 'w' ? (
          <Wheel size={width * 0.62} />
        ) : wild ? (
          <View style={{ alignItems: 'center' }}>
            <Wheel size={width * 0.36} />
            <T w="heading" style={{ fontSize: width * 0.34, lineHeight: width * 0.44, color: ink }}>{text}</T>
          </View>
        ) : (
          <T w="heading" style={{ fontSize: width * (text.length > 1 ? 0.42 : 0.56), lineHeight: width * 0.7, color: ink }}>{text}</T>
        )}
      </View>
      {!!text && (
        <T w="black" style={[styles.corner, { fontSize: width * 0.2, top: width * 0.05, start: width * 0.09 }]}>{text}</T>
      )}
      {dim && <View style={[styles.dim, { borderRadius: width * 0.14 }]} />}
    </View>
  );
}

// ظهر الورقة (الكومة وورق الخصم)
export function CardBack({ width = 64, count }: { width?: number; count?: number }) {
  const h = width * 1.45;
  return (
    <View style={[styles.card, styles.back, { width, height: h, borderRadius: width * 0.16 }]}>
      <View style={[styles.backOval, { width: width * 0.78, height: h * 0.66, borderRadius: width * 0.4 }]}>
        <T w="heading" style={{ fontSize: width * 0.24, lineHeight: width * 0.34, color: colors.yellow }}>ألوان</T>
        {count !== undefined && <T w="black" style={{ fontSize: width * 0.2 }}>{ar(count)}</T>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    boxShadow: '0 3px 0 rgba(0,0,0,0.25)',
  },
  oval: { backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  corner: { position: 'absolute', color: '#FFFFFF' },
  dim: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, backgroundColor: 'rgba(20,7,41,0.55)' },
  back: { backgroundColor: colors.purple },
  backOval: { backgroundColor: colors.coral, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-18deg' }] },
});
