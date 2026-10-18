import { View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

import { colors } from '@/theme';
import { Dalla } from './Dalla';

const INK = '#2B1259';

function Face({ bg, children }: { bg: string; children?: React.ReactNode }) {
  return (
    <Svg viewBox="0 0 56 56" width="100%" height="100%">
      <Circle cx={28} cy={28} r={28} fill={bg} />
      <Ellipse cx={21} cy={27} rx={3} ry={4} fill={INK} />
      <Ellipse cx={35} cy={27} rx={3} ry={4} fill={INK} />
      <Path d="M20 36 Q28 43 36 36" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
      <Ellipse cx={15} cy={34} rx={4} ry={2.5} fill="#FF8A6B" opacity={0.7} />
      <Ellipse cx={41} cy={34} rx={4} ry={2.5} fill="#FF8A6B" opacity={0.7} />
      {children}
    </Svg>
  );
}

export const AVATARS = [
  { key: 'dalla', name: 'الدلّة' },
  { key: 'shater', name: 'الشاطر' },
  { key: 'ameera', name: 'الأميرة' },
  { key: 'kashkha', name: 'الكشخة' },
  { key: 'abushabab', name: 'أبو الشباب' },
] as const;

export function Avatar({ avatar, size }: { avatar: string; size: number }) {
  if (avatar === 'dalla') {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.coral,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'flex-end',
        }}>
        <Dalla width={size * 0.82} />
      </View>
    );
  }
  const face = {
    shater: (
      <Face bg="#4FC3F7">
        <Path d="M12 22 Q28 4 44 22" fill="none" stroke={INK} strokeWidth={3} />
        <Rect x={8} y={20} width={40} height={5} rx={2.5} fill="#FFFFFF" stroke={INK} strokeWidth={2} />
      </Face>
    ),
    ameera: (
      <Face bg="#FF8FB1">
        <Path d="M16 14 l4 -8 l4 6 l4 -8 l4 8 l4 -6 l4 8 z" fill="#FFC93C" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
      </Face>
    ),
    kashkha: (
      <Face bg="#7BD88F">
        <Rect x={13} y={22} width={12} height={9} rx={3} fill={INK} />
        <Rect x={31} y={22} width={12} height={9} rx={3} fill={INK} />
        <Path d="M25 26 h6" stroke={INK} strokeWidth={2} />
      </Face>
    ),
    abushabab: (
      <Face bg="#FFB74D">
        <Path d="M6 18 Q28 0 50 18 L46 22 Q28 10 10 22 Z" fill="#FFFFFF" stroke={INK} strokeWidth={2} />
        <Path d="M10 20 Q28 14 46 20" fill="none" stroke={INK} strokeWidth={3} />
      </Face>
    ),
  }[avatar] ?? <Face bg={colors.purple} />;
  return <View style={{ width: size, height: size }}>{face}</View>;
}
