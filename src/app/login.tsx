import { Link, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Dalla } from '@/components/Dalla';
import { AppleIcon, FacebookIcon, GoogleIcon, PhoneIcon } from '@/components/Icons';
import { PillButton, T } from '@/components/ui';
import { errorText } from '@/lib/errors';
import { useSession, type Provider } from '@/lib/session';
import { colors } from '@/theme';

export default function Login() {
  const insets = useSafeAreaInsets();
  const { signIn, authError } = useSession();

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const social = async (p: Provider) => {
    setBusy(true);
    setErr('');
    try {
      const u = await signIn(p);
      // null: رايحين على صفحة Google
      if (!u) return;
      router.replace(u.ready ? '/home' : '/setup');
      setBusy(false);
    } catch (e) {
      setErr(errorText(e));
      setBusy(false);
    }
  };

  const shownErr = err || authError;

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <View style={styles.wrap}>
        <View style={[styles.hero, { paddingTop: insets.top }]}>
          <View style={[styles.blob, { top: -80, start: -80, width: 260, height: 260, backgroundColor: colors.purpleLight }]} />
          <View style={[styles.blob, { bottom: 40, end: -70, width: 200, height: 200, backgroundColor: colors.purpleDark }]} />
          <View style={[styles.dot, { top: 120, end: 46, width: 14, height: 14, backgroundColor: colors.yellow }]} />
          <View style={[styles.dot, { top: 90, start: 60, width: 10, height: 10, backgroundColor: colors.peach }]} />
          <View style={[styles.dot, { top: 200, start: 36, width: 18, height: 18, backgroundColor: colors.coral }]} />
          <View style={[styles.dot, { top: 230, end: 70, width: 8, height: 8, backgroundColor: colors.white }]} />

          <Dalla width={170} />
          <T w="heading" style={styles.logo}>
            هيصة <T w="heading" style={{ color: colors.yellow }}>بلاي</T>
          </T>
          <T w="bold" style={styles.tagline}>العب، سولف، وعيش الهيصة مع ربعك</T>
        </View>

        <View style={styles.buttons} accessibilityLabel="طرق تسجيل الدخول">
          <PillButton label="المتابعة مع Apple" bg={colors.white} fg="#000000" icon={<AppleIcon />} disabled={busy} onPress={() => social('apple')} />
          <PillButton label="المتابعة مع Google" bg={colors.white} fg="#1F1F1F" icon={<GoogleIcon />} disabled={busy} onPress={() => social('google')} />
          <PillButton label="المتابعة مع Facebook" bg="#1877F2" fg={colors.white} icon={<FacebookIcon />} disabled={busy} onPress={() => social('facebook')} />
          <PillButton label="المتابعة برقم الجوال" icon={<PhoneIcon />} onPress={() => router.push('/phone')} />
        </View>

        {!!shownErr && <T w="bold" style={styles.err}>{shownErr}</T>}

        <T style={styles.terms}>
          بالمتابعة إنت موافق على{' '}
          <Link href="/terms" style={styles.termsLink}>شروط الاستخدام</Link> و
          <Link href="/privacy" style={styles.termsLink}>سياسة الخصوصية</Link>
        </T>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  wrap: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center' },
  hero: {
    minHeight: 400,
    flexShrink: 0,
    backgroundColor: colors.purple,
    borderBottomStartRadius: 48,
    borderBottomEndRadius: 48,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 28,
  },
  blob: { position: 'absolute', borderRadius: 999 },
  dot: { position: 'absolute', borderRadius: 999 },
  logo: { marginTop: 10, fontSize: 50, lineHeight: 64 },
  tagline: { marginTop: 2, fontSize: 17, color: colors.textSoft },
  buttons: { marginTop: 28, marginHorizontal: 24, gap: 12 },
  terms: {
    marginTop: 'auto',
    marginHorizontal: 32,
    marginBottom: 24,
    paddingTop: 20,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 20,
    color: colors.textDim,
  },
  err: { marginTop: 12, marginHorizontal: 24, textAlign: 'center', fontSize: 13, color: colors.peach },
  termsLink: { color: colors.yellow, fontFamily: 'Tajawal_700Bold' },
});
