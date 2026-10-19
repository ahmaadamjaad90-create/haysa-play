import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Path, Polygon, Rect } from 'react-native-svg';

import {
  BASE_ORIGIN,
  SAFE,
  SEAT_COLORS,
  SEAT_DARK,
  TRACK,
  homeColumn,
  tokenCenter,
  type LudoGame,
} from '@/lib/ludo';

const BOARD_BG = '#F7F1FF';
const LINE = '#D9CCF2';

// نجمة صغيرة للمربعات الآمنة
function star(cx: number, cy: number, r: number) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push(`${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)}`);
  }
  return pts.join(' ');
}

// اللوح الثابت (المربعات والبيوت والوسط) برسمة وحدة
function BoardArt({ size, seats }: { size: number; seats: number[] }) {
  const u = size / 15;
  const startOf = (s: number) => TRACK[s * 13];
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Rect x={0} y={0} width={size} height={size} rx={u * 0.8} fill={BOARD_BG} />

      {TRACK.map(([c, r], i) => (
        <Rect key={i} x={c * u} y={r * u} width={u} height={u} fill="#FFFFFF" stroke={LINE} strokeWidth={1} />
      ))}

      {[0, 1, 2, 3].map((s) => {
        const [c, r] = startOf(s);
        const on = seats.includes(s);
        return (
          <G key={s}>
            {homeColumn(s).map(([hc, hr], i) => (
              <Rect key={i} x={hc * u} y={hr * u} width={u} height={u} fill={SEAT_COLORS[s]} stroke={LINE} strokeWidth={1} opacity={on ? 1 : 0.35} />
            ))}
            <Rect x={c * u} y={r * u} width={u} height={u} fill={SEAT_COLORS[s]} stroke={LINE} strokeWidth={1} opacity={on ? 1 : 0.35} />
          </G>
        );
      })}

      {SAFE.filter((i) => i % 13 !== 0).map((i) => {
        const [c, r] = TRACK[i];
        return <Polygon key={i} points={star((c + 0.5) * u, (r + 0.5) * u, u * 0.36)} fill="#CBB8F0" />;
      })}

      {BASE_ORIGIN.map(([c, r], s) => {
        const on = seats.includes(s);
        return (
          <G key={s} opacity={on ? 1 : 0.35}>
            <Rect x={c * u} y={r * u} width={u * 6} height={u * 6} rx={u * 0.8} fill={SEAT_COLORS[s]} />
            <Rect x={(c + 0.8) * u} y={(r + 0.8) * u} width={u * 4.4} height={u * 4.4} rx={u * 0.9} fill="#FFFFFF" />
            {[
              [2, 2],
              [4, 2],
              [2, 4],
              [4, 4],
            ].map(([dc, dr], k) => (
              <Circle key={k} cx={(c + dc) * u} cy={(r + dr) * u} r={u * 0.62} fill={SEAT_COLORS[s]} opacity={0.3} />
            ))}
          </G>
        );
      })}

      <Polygon points={`${6 * u},${6 * u} ${6 * u},${9 * u} ${7.5 * u},${7.5 * u}`} fill={SEAT_COLORS[0]} />
      <Polygon points={`${6 * u},${6 * u} ${9 * u},${6 * u} ${7.5 * u},${7.5 * u}`} fill={SEAT_COLORS[1]} />
      <Polygon points={`${9 * u},${6 * u} ${9 * u},${9 * u} ${7.5 * u},${7.5 * u}`} fill={SEAT_COLORS[2]} />
      <Polygon points={`${6 * u},${9 * u} ${9 * u},${9 * u} ${7.5 * u},${7.5 * u}`} fill={SEAT_COLORS[3]} />
      <Path d={`M${6 * u} ${6 * u} L${9 * u} ${9 * u} M${9 * u} ${6 * u} L${6 * u} ${9 * u}`} stroke="#FFFFFF" strokeWidth={1.5} />
    </Svg>
  );
}

// حجر واحد، بيتزحلق لمكانه الجديد
function Token({
  x,
  y,
  d,
  color,
  dark,
  active,
  onPress,
}: {
  x: number;
  y: number;
  d: number;
  color: string;
  dark: string;
  active: boolean;
  onPress?: () => void;
}) {
  const [pos] = useState(() => new Animated.ValueXY({ x, y }));
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(pos, { toValue: { x, y }, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
  }, [pos, x, y]);

  useEffect(() => {
    if (!active) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 450, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: 450, useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });

  return (
    <Animated.View
      pointerEvents={onPress ? 'auto' : 'none'}
      style={[styles.tokenWrap, { width: d, height: d, left: pos.x, top: pos.y, zIndex: active ? 3 : 2, transform: [{ scale }] }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="حرّك الحجر"
        disabled={!onPress}
        onPress={onPress}
        hitSlop={8}
        style={[
          styles.token,
          { borderRadius: d / 2, backgroundColor: color, borderColor: active ? '#FFFFFF' : dark, borderWidth: active ? 3 : 2 },
          active && styles.tokenActive,
        ]}>
        <View style={[styles.tokenDot, { width: d * 0.36, height: d * 0.36, borderRadius: d * 0.18, backgroundColor: dark }]} />
      </Pressable>
    </Animated.View>
  );
}

// اللوح كامل مع الأحجار. mySeat بيتدوّر لتحت عاليسار.
export function LudoBoard({
  game,
  size,
  mySeat,
  movable,
  onMove,
}: {
  game: LudoGame;
  size: number;
  mySeat: number | null;
  movable: number[];
  onMove: (token: number) => void;
}) {
  const u = size / 15;
  const seats = game.players.map((p) => p.seat);
  const rotate = `${((3 - (mySeat ?? 3)) * 90) % 360}deg`;

  // كم حجر بنفس المربع، عشان نصغّرهم ونفرّقهم
  const groups = new Map<string, number[]>();
  const items: { seat: number; t: number; cx: number; cy: number }[] = [];
  for (const s of seats) {
    for (let t = 0; t < 4; t++) {
      const [cx, cy] = tokenCenter(s, t, game.tokens[s * 4 + t]);
      const key = `${cx},${cy}`;
      groups.set(key, [...(groups.get(key) ?? []), items.length]);
      items.push({ seat: s, t, cx, cy });
    }
  }

  return (
    <View style={{ width: size, height: size, direction: 'ltr', transform: [{ rotate }] }}>
      <BoardArt size={size} seats={seats} />
      {items.map((it, i) => {
        const group = groups.get(`${it.cx},${it.cy}`) ?? [i];
        const n = group.length;
        const k = group.indexOf(i);
        const d = u * (n > 1 ? 0.62 : 0.82);
        const off = n > 1 ? u * 0.2 : 0;
        const dx = n > 1 ? (k % 2 === 0 ? -off : off) : 0;
        const dy = n > 2 ? (k < 2 ? -off : off) : 0;
        const active = it.seat === game.turn && it.seat === mySeat && movable.includes(it.t);
        return (
          <Token
            key={`${it.seat}-${it.t}`}
            x={it.cx * u - d / 2 + dx}
            y={it.cy * u - d / 2 + dy}
            d={d}
            color={SEAT_COLORS[it.seat]}
            dark={SEAT_DARK[it.seat]}
            active={active}
            onPress={active ? () => onMove(it.t) : undefined}
          />
        );
      })}
    </View>
  );
}

// الزهر بنقاطه
export function Dice({ value, size = 64, rolling }: { value: number | null; size?: number; rolling?: boolean }) {
  const [spin] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!rolling) return;
    spin.setValue(0);
    Animated.timing(spin, { toValue: 1, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [rolling, value, spin]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const v = value ?? 0;
  const pips: Record<number, [number, number][]> = {
    1: [[1, 1]],
    2: [[0, 0], [2, 2]],
    3: [[0, 0], [1, 1], [2, 2]],
    4: [[0, 0], [2, 0], [0, 2], [2, 2]],
    5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
    6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
  };
  const p = size / 4;
  return (
    <Animated.View style={[styles.dice, { width: size, height: size, borderRadius: size * 0.22, transform: [{ rotate }] }]}>
      {(pips[v] ?? []).map(([c, r], i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            width: size * 0.18,
            height: size * 0.18,
            borderRadius: size * 0.09,
            backgroundColor: v === 6 ? '#D9381E' : '#2B1259',
            left: p * (c + 0.5) + size * 0.035,
            top: p * (r + 0.5) + size * 0.035,
          }}
        />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tokenWrap: { position: 'absolute' },
  token: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tokenActive: { boxShadow: '0 0 0 3px rgba(255,201,60,0.9)' },
  tokenDot: { opacity: 0.55 },
  dice: { backgroundColor: '#FFFFFF', direction: 'ltr', boxShadow: '0 4px 0 #CBB8F0' },
});
