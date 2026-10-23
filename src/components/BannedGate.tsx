import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Dalla } from '@/components/Dalla';
import { PillButton, T } from '@/components/ui';
import { useSession } from '@/lib/session';
import { colors } from '@/theme';

// اللاعب المحظور بيشوف هالشاشة بس، لحد ما يخلص الحظر
export function BannedGate({ children }: { children: ReactNode }) {
  const { user, signOut } = useSession();
  // وقت فتح الصفحة (الحظر بيتحدّث مع أي تحديث للحساب)
  const [now] = useState(() => Date.now());
  const until = user?.bannedUntil ? Date.parse(user.bannedUntil) : NaN;
  // infinity بترجع NaN من Date.parse، وهي حظر دايم
  const forever = !!user?.bannedUntil && Number.isNaN(until);
  if (!user?.bannedUntil || (!forever && until <= now)) return <>{children}</>;
  const date = forever ? null : new Date(until);
  return (
    <View style={styles.wrap}>
      <Dalla width={110} />
      <T w="heading" style={{ fontSize: 28, lineHeight: 38, textAlign: 'center' }}>حسابك محظور</T>
      <T style={{ fontSize: 15, lineHeight: 24, color: colors.textMuted, textAlign: 'center' }}>
        {date
          ? `الحظر بيخلص ${date.toLocaleDateString('en-GB')} الساعة ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
          : 'الحظر دايم.'}
        {'\n'}إذا بتفكر في غلط، تواصل معنا من صفحة سياسة الخصوصية.
      </T>
      <PillButton label="تسجيل الخروج" bg={colors.surface} fg={colors.white} onPress={() => signOut()} style={{ alignSelf: 'stretch' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 },
});
