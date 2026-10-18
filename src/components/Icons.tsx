import Svg, { Circle, Path, Rect } from 'react-native-svg';

type P = { size?: number; color?: string };

const stroke = (color: string, w = 2) => ({
  fill: 'none',
  stroke: color,
  strokeWidth: w,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export const AppleIcon = ({ size = 22, color = '#000' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path fill={color} d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9 0 0-2.7-1-2.7-4.1zM13.9 5c.7-.9 1.2-2 1-3.2-1 0-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.1 1.2.1 2.3-.6 3.1-1.5z" />
  </Svg>
);

export const GoogleIcon = ({ size = 22 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4c-.2 1.2-.9 2.3-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z" />
    <Path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6C4.7 19.8 8.1 22 12 22z" />
    <Path fill="#FBBC05" d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1C2.4 8.8 2 10.4 2 12s.4 3.2 1.1 4.6L6.4 14z" />
    <Path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9C17 3 14.7 2 12 2 8.1 2 4.7 4.2 3.1 7.4L6.4 10C7.2 7.7 9.4 6 12 6z" />
  </Svg>
);

export const FacebookIcon = ({ size = 22 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle cx={12} cy={12} r={11} fill="#FFFFFF" />
    <Path fill="#1877F2" d="M13.3 21.9v-7.1h2.4l.4-2.8h-2.8v-1.8c0-.8.2-1.4 1.4-1.4h1.5V6.3c-.3 0-1.2-.1-2.2-.1-2.2 0-3.6 1.3-3.6 3.7V12H8v2.8h2.4v7.1h2.9z" />
  </Svg>
);

export const PhoneIcon = ({ size = 22, color = '#2B1259' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...stroke(color, 2.2)}>
    <Rect x={6} y={2} width={12} height={20} rx={3} />
    <Path d="M11 18h2" />
  </Svg>
);

export const ChatDotsIcon = ({ size = 36, color = '#FFC93C' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...stroke(color)}>
    <Path d="M4 5h16v11H9l-5 4z" />
    <Path d="M8 10h.01M12 10h.01M16 10h.01" strokeWidth={3} />
  </Svg>
);

// سهم الرجوع: بالعربي بيأشر لليمين
export const BackIcon = ({ size = 24, color = '#FFFFFF' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...stroke(color, 2.4)}>
    <Path d="M9 6l6 6-6 6" />
  </Svg>
);

export const CoinIcon = ({ size = 22 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle cx={12} cy={12} r={10} fill="#FFC93C" />
    <Circle cx={12} cy={12} r={6} fill="none" stroke="#2B1259" strokeWidth={2} />
  </Svg>
);

export const BellIcon = ({ size = 24, color = '#FFFFFF' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...stroke(color)}>
    <Path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7 2.5 7h-17S6 15 6 9z" />
    <Path d="M10 20a2 2 0 0 0 4 0" />
  </Svg>
);

export const PlusIcon = ({ size = 18, color = '#2B1259' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...stroke(color, 3)}>
    <Path d="M12 5v14M5 12h14" />
  </Svg>
);

export const HomeIcon = ({ size = 24, color = '#FFFFFF' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...stroke(color)}>
    <Path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
  </Svg>
);

export const MicIcon = ({ size = 24, color = '#FFFFFF' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...stroke(color)}>
    <Rect x={9} y={3} width={6} height={11} rx={3} />
    <Path d="M5 11a7 7 0 0 0 14 0" />
    <Path d="M12 18v3" />
  </Svg>
);

export const CrownIcon = ({ size = 24 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M3 18 L2 7 L8 11 L12 4 L16 11 L22 7 L21 18 Z" fill="#FFC93C" stroke="#FFFFFF" strokeWidth={1.6} strokeLinejoin="round" />
  </Svg>
);

export const FriendsIcon = ({ size = 24, color = '#FFFFFF' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...stroke(color)}>
    <Circle cx={9} cy={8} r={3.5} />
    <Path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6" />
    <Circle cx={17} cy={9} r={2.5} />
    <Path d="M17 14c2.5 0 4.5 1.8 4.5 4.5" />
  </Svg>
);

export const UserIcon = ({ size = 24, color = '#FFFFFF' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...stroke(color)}>
    <Circle cx={12} cy={8} r={4} />
    <Path d="M4 21c0-4 3.5-7 8-7s8 3 8 7" />
  </Svg>
);

export const CopyIcon = ({ size = 16, color = '#FFFFFF' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...stroke(color, 2.4)}>
    <Rect x={9} y={9} width={12} height={12} rx={2} />
    <Path d="M5 15V5a2 2 0 0 1 2-2h8" />
  </Svg>
);

export const ChevronDownIcon = ({ size = 14, color = '#A794D6' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...stroke(color, 3)}>
    <Path d="M6 9l6 6 6-6" />
  </Svg>
);

export const HeartIcon = ({ size = 28 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path fill="#FFFFFF" d="M12 20 C4 14 3 8 7.5 6.5 C10 5.8 12 7.5 12 9 C12 7.5 14 5.8 16.5 6.5 C21 8 20 14 12 20 Z" />
  </Svg>
);

export const HatIcon = ({ size = 28 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M6 15 V10 C6 5 18 5 18 10 V15 Z" fill="#FFFFFF" />
    <Path d="M6 12.5 H18 V14.5 H6 Z" fill="#2B1259" />
    <Path d="M3 16 a9 2.6 0 1 0 18 0 a9 2.6 0 1 0 -18 0" fill="#FFFFFF" />
  </Svg>
);

// أيقونات ألعاب النسخة الأولى
export const LudoArt = ({ size = 52 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <Rect x={10} y={10} width={44} height={44} rx={11} fill="#2B1259" />
    <Circle cx={23} cy={23} r={4.5} fill="#FFC93C" />
    <Circle cx={41} cy={23} r={4.5} fill="#FFC93C" />
    <Circle cx={32} cy={32} r={4.5} fill="#FFC93C" />
    <Circle cx={23} cy={41} r={4.5} fill="#FFC93C" />
    <Circle cx={41} cy={41} r={4.5} fill="#FFC93C" />
  </Svg>
);

export const SpyArt = ({ size = 52 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <Path d="M18 38 V26 C18 14 46 14 46 26 V38 Z" fill="#FFFFFF" />
    <Path d="M18 31 H46 V37 H18 Z" fill="#2B1259" />
    <Path d="M9 40 a23 6.5 0 1 0 46 0 a23 6.5 0 1 0 -46 0" fill="#FFFFFF" />
    <Circle cx={48} cy={12} r={2.5} fill="#FFC93C" />
    <Circle cx={14} cy={14} r={2} fill="#FFC93C" />
  </Svg>
);

export const ColorsArt = ({ size = 52 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <Rect x={10} y={14} width={26} height={38} rx={5} fill="#D9381E" stroke="#FFFFFF" strokeWidth={2} transform="rotate(-12 23 33)" />
    <Rect x={20} y={12} width={26} height={38} rx={5} fill="#FFC93C" stroke="#FFFFFF" strokeWidth={2} />
    <Rect x={30} y={14} width={26} height={38} rx={5} fill="#3FA9F5" stroke="#FFFFFF" strokeWidth={2} transform="rotate(12 43 33)" />
    <Circle cx={43} cy={33} r={6} fill="#FFFFFF" transform="rotate(12 43 33)" />
  </Svg>
);

export const AddFriendIcon = ({ size = 20, color = '#2B1259' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...stroke(color, 2.4)}>
    <Circle cx={9} cy={8} r={4} />
    <Path d="M2 21c0-4 3-7 7-7s7 3 7 7" />
    <Path d="M19 8v6M16 11h6" />
  </Svg>
);

export const SearchIcon = ({ size = 20, color = '#A794D6' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...stroke(color, 2.2)}>
    <Circle cx={11} cy={11} r={7} />
    <Path d="M20 20l-4-4" />
  </Svg>
);

export const CloseIcon = ({ size = 18, color = '#FFFFFF' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...stroke(color, 2.6)}>
    <Path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);

export const ChatIcon = ({ size = 22, color = '#FFFFFF' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...stroke(color, 2.2)}>
    <Path d="M4 5h16v11H9l-5 4z" />
  </Svg>
);

// سهم الإرسال: بالعربي بيأشر لليسار
export const SendIcon = ({ size = 22, color = '#2B1259' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...stroke(color, 2.4)}>
    <Path d="M20 12H5M11 5l-7 7 7 7" />
  </Svg>
);
