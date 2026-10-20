import { router, type Href } from 'expo-router';
import { createElement, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toLatinDigits } from '@/lib/format';
import { colors, fonts } from '@/theme';
import { BackIcon } from './Icons';

type Weight = keyof typeof fonts;

// الأرقام العربية (من السيرفر مثلاً: أسئلة، مزايا VIP) بتنعرض إنجليزية
const latin = (c: ReactNode) => (typeof c === 'string' ? toLatinDigits(c) : c);

// نص بخطوط هيصة. ما نستخدم fontWeight مع الخطوط المخصصة، كل وزن إله خط.
// writingDirection: النص اللي بيبلش بحروف إنجليزية (متل "ID 102") بيضل عاليمين
export function T({ w = 'regular', style, children, ...rest }: TextProps & { w?: Weight }) {
  const kids = Array.isArray(children) ? children.map(latin) : [latin(children)];
  return createElement(Text, { ...rest, style: [{ fontFamily: fonts[w], color: colors.white, writingDirection: 'rtl' }, style] }, ...kids);
}

export function Screen({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }, style]}>
      <View style={styles.inner}>{children}</View>
    </View>
  );
}

export function BackButton({ fallback = '/login' }: { fallback?: Href }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="رجوع"
      onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback))}
      style={styles.back}>
      <BackIcon />
    </Pressable>
  );
}

export function PillButton({
  label,
  icon,
  bg = colors.yellow,
  fg = colors.ink,
  disabled,
  style,
  ...rest
}: PressableProps & {
  label: string;
  icon?: ReactNode;
  bg?: string;
  fg?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      {...rest}
      style={({ pressed }) => [
        styles.pill,
        { backgroundColor: disabled ? colors.surfaceHigh : bg, opacity: pressed ? 0.85 : 1 },
        style,
      ]}>
      {icon}
      <T w="black" style={{ fontSize: 17, color: disabled ? colors.textDim : fg }}>
        {label}
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  // على الويب والتابلت نحصر العرض بحجم الجوال
  inner: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center' },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
});
