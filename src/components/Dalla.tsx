import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

const INK = '#2B1259';

// الدلّة المبتسمة، شخصية هيصة بلاي
export function Dalla({ width = 120 }: { width?: number }) {
  return (
    <Svg viewBox="0 0 120 132" width={width} height={(width * 132) / 120}>
      <Path d="M54 16 C48 11 60 8 54 3" fill="none" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" opacity={0.85} />
      <Path d="M67 14 C61 9 73 6 67 1" fill="none" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" opacity={0.85} />
      <Path d="M30 74 C14 68 8 52 4 42 L14 38 C20 52 28 60 38 66 Z" fill="#F5A623" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
      <Path d="M94 70 C116 70 118 106 94 108" fill="none" stroke={INK} strokeWidth={11} strokeLinecap="round" />
      <Path d="M94 70 C116 70 118 106 94 108" fill="none" stroke="#7A2BB8" strokeWidth={5} strokeLinecap="round" />
      <Path d="M46 40 L74 40 L80 54 L40 54 Z" fill="#F5A623" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
      <Path d="M40 54 C12 68 12 114 38 120 L82 120 C108 114 108 68 80 54 Z" fill="#FFC93C" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
      <Path d="M30 78 C26 90 28 102 34 110" fill="none" stroke="#FFE08A" strokeWidth={4} strokeLinecap="round" />
      <Rect x={34} y={118} width={52} height={9} rx={4.5} fill={INK} />
      <Path d="M42 40 C42 28 78 28 78 40 Z" fill="#FFC93C" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
      <Circle cx={60} cy={24} r={5} fill="#FFC93C" stroke={INK} strokeWidth={3} />
      <Ellipse cx={50} cy={88} rx={5} ry={6.5} fill={INK} />
      <Ellipse cx={70} cy={88} rx={5} ry={6.5} fill={INK} />
      <Circle cx={51.6} cy={85.6} r={1.8} fill="#FFFFFF" />
      <Circle cx={71.6} cy={85.6} r={1.8} fill="#FFFFFF" />
      <Path d="M50 98 Q60 108 70 98" fill="none" stroke={INK} strokeWidth={3.5} strokeLinecap="round" />
      <Ellipse cx={40} cy={98} rx={6} ry={4} fill="#FF8A6B" opacity={0.75} />
      <Ellipse cx={80} cy={98} rx={6} ry={4} fill="#FF8A6B" opacity={0.75} />
    </Svg>
  );
}
