import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Polygon, Rect } from 'react-native-svg';

import { barOf, offOf, type BgGame } from '@/lib/backgammon';
import { T } from './ui';

const WOOD = '#8A4E2C';
const FELT = '#1F6B4A';
const TRI = ['#F2D7A6', '#C8794A'];
export const CHECKER = [
  { fill: '#F7F1FF', ring: '#CBB8F0', text: '#2B1259' },
  { fill: '#B4297A', ring: '#6E1149', text: '#FFFFFF' },
];

// العمود (0..12) والصف (فوق/تحت) لكل بيت، والبار بالعمود 6
function slot(p: number): { col: number; top: boolean } {
  if (p >= 13 && p <= 18) return { col: p - 13, top: true };
  if (p >= 19) return { col: p - 19 + 7, top: true };
  if (p >= 7) return { col: 12 - p, top: false };
  return { col: 6 - p + 7, top: false };
}

// لوح الطاولة. اللاعب 1 بيشوفه مقلوب عشان بيته يكون قدامه
export function BgBoard({
  game,
  width,
  mySeat,
  selected,
  sources,
  targets,
  onTap,
}: {
  game: BgGame;
  width: number;
  mySeat: number | null;
  selected: number | null;
  sources: Set<number>;
  targets: Set<number>;
  onTap: (p: number) => void;
}) {
  const c = width / 14;
  const h = c * 11;
  const r = c * 0.44;
  const flip = mySeat === 1;
  const checkers: { x: number; y: number; seat: number; label?: string }[] = [];

  const stack = (col: number, top: boolean, n: number, seat: number) => {
    const show = Math.min(n, 5);
    for (let i = 0; i < show; i++) {
      const y = top ? c * 0.55 + i * c * 0.92 : h - c * 0.55 - i * c * 0.92;
      checkers.push({ x: (col + 0.5) * c, y, seat, label: i === show - 1 && n > 5 ? String(n) : undefined });
    }
  };

  game.board.forEach((v, i) => {
    if (!v) return;
    const { col, top } = slot(i + 1);
    stack(col, top, Math.abs(v), v > 0 ? 0 : 1);
  });
  // البار: اللاعب 0 فوق، واللاعب 1 تحت
  if (game.bar[0]) stack(6, true, game.bar[0], 0);
  if (game.bar[1]) stack(6, false, game.bar[1], 1);

  const hot = (p: number) => targets.has(p);
  const src = (p: number) => sources.has(p);

  // مناطق اللمس: كل بيت، والبار، والطلوع
  const zones: { key: string; p: number; x: number; y: number; w: number; hh: number }[] = [];
  for (let p = 1; p <= 24; p++) {
    const { col, top } = slot(p);
    zones.push({ key: `p${p}`, p, x: col * c, y: top ? 0 : h / 2, w: c, hh: h / 2 });
  }
  const me = mySeat ?? 0;
  zones.push({ key: 'bar', p: barOf(me), x: 6 * c, y: me === 0 ? 0 : h / 2, w: c, hh: h / 2 });
  zones.push({ key: 'off', p: offOf(me), x: 13 * c, y: me === 0 ? h / 2 : 0, w: c, hh: h / 2 });

  return (
    <View style={{ width, height: h, direction: 'ltr', transform: flip ? [{ rotate: '180deg' }] : [] }}>
      <Svg width={width} height={h}>
        <Rect x={0} y={0} width={width} height={h} rx={c * 0.3} fill={WOOD} />
        <Rect x={c * 0.15} y={c * 0.15} width={c * 12.7} height={h - c * 0.3} fill={FELT} />
        <Rect x={6 * c} y={0} width={c} height={h} fill={WOOD} />
        <Rect x={13 * c + c * 0.1} y={c * 0.15} width={c * 0.8} height={h - c * 0.3} rx={c * 0.15} fill="#5E3219" />
        {Array.from({ length: 24 }, (_, i) => {
          const p = i + 1;
          const { col, top } = slot(p);
          const x = col * c;
          const tipY = top ? h * 0.42 : h * 0.58;
          const baseY = top ? c * 0.15 : h - c * 0.15;
          return (
            <Polygon
              key={p}
              points={`${x + c * 0.06},${baseY} ${x + c * 0.94},${baseY} ${x + c / 2},${tipY}`}
              fill={hot(p) ? '#FFC93C' : TRI[p % 2]}
              opacity={hot(p) ? 0.9 : 1}
            />
          );
        })}
      </Svg>

      {checkers.map((k, i) => (
        <View
          key={i}
          pointerEvents="none"
          style={[
            styles.checker,
            {
              left: k.x - r,
              top: k.y - r,
              width: r * 2,
              height: r * 2,
              borderRadius: r,
              backgroundColor: CHECKER[k.seat].fill,
              borderColor: CHECKER[k.seat].ring,
            },
          ]}>
          {k.label && (
            <T w="black" style={{ fontSize: r * 0.9, color: CHECKER[k.seat].text, transform: flip ? [{ rotate: '180deg' }] : [] }}>
              {k.label}
            </T>
          )}
        </View>
      ))}

      {/* الأحجار اللي طلعت */}
      {[0, 1].map((s) =>
        Array.from({ length: game.off[s] }, (_, i) => (
          <View
            key={`off${s}-${i}`}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 13 * c + c * 0.18,
              top: s === 0 ? h - c * 0.3 - (i + 1) * c * 0.3 : c * 0.3 + i * c * 0.3,
              width: c * 0.64,
              height: c * 0.24,
              borderRadius: 3,
              backgroundColor: CHECKER[s].fill,
              borderWidth: 1,
              borderColor: CHECKER[s].ring,
            }}
          />
        )),
      )}

      {zones.map((z) => {
        const isSel = selected === z.p && (z.key.startsWith('p') || z.key === 'bar');
        return (
          <Pressable
            key={z.key}
            accessibilityRole="button"
            accessibilityLabel={z.key}
            onPress={() => onTap(z.p)}
            style={[
              styles.zone,
              { left: z.x, top: z.y, width: z.w, height: z.hh },
              src(z.p) && !isSel && styles.zoneSource,
              isSel && styles.zoneSelected,
              hot(z.p) && (z.key === 'off' || z.key === 'bar') && styles.zoneTarget,
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  checker: { position: 'absolute', borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  zone: { position: 'absolute', borderRadius: 6 },
  zoneSource: { backgroundColor: 'rgba(255,201,60,0.18)' },
  zoneSelected: { backgroundColor: 'rgba(255,201,60,0.4)', borderWidth: 2, borderColor: '#FFC93C' },
  zoneTarget: { backgroundColor: 'rgba(255,201,60,0.55)', borderWidth: 2, borderColor: '#FFC93C' },
});
