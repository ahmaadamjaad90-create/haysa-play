import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputInstance } from 'react-native';

import { ChatDotsIcon } from '@/components/Icons';
import { BackButton, PillButton, Screen, T } from '@/components/ui';
import { errorText } from '@/lib/errors';
import { ar } from '@/lib/format';
import { useSession } from '@/lib/session';
import { colors, fonts } from '@/theme';

const LEN = 6;
const RESEND_SECONDS = 45;

export default function Otp() {
  const { phone = '' } = useLocalSearchParams<{ phone: string }>();
  const { signIn } = useSession();
  const [code, setCode] = useState('');
  const [left, setLeft] = useState(RESEND_SECONDS);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const input = useRef<TextInputInstance>(null);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  const confirm = async () => {
    // TODO(Supabase): التحقق من الكود بالسيرفر. هلأ أي ٦ أرقام بتمشي.
    setBusy(true);
    setErr('');
    try {
      const u = await signIn('phone', phone);
      if (u) router.replace(u.ready ? '/home' : '/setup');
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, '0');

  return (
    <Screen>
      <View style={styles.header}>
        <BackButton />
      </View>

      <View style={styles.intro}>
        <View style={styles.badge}>
          <ChatDotsIcon />
        </View>
        <T w="heading" style={styles.h1}>أدخل الكود</T>
        <T style={styles.lead}>
          بعتنا كود على <T w="black" style={{ color: colors.white }}>{`⁦${phone}⁩`}</T>{' '}
          <T w="black" style={{ color: colors.yellow }} onPress={() => router.back()}>تعديل الرقم</T>
        </T>
      </View>

      {/* خانات الكود: حقل واحد مخفي فوق ٦ مربعات */}
      <Pressable accessibilityLabel="الكود" onPress={() => input.current?.focus()} style={styles.boxes}>
        {Array.from({ length: LEN }, (_, i) => {
          const active = i === code.length;
          const filled = i < code.length;
          return (
            <View
              key={i}
              style={[
                styles.box,
                { borderColor: active ? colors.yellow : filled ? colors.purple : colors.surfaceHigh },
              ]}>
              {filled ? (
                <T w="black" style={styles.digit}>{code[i]}</T>
              ) : active ? (
                <View style={styles.caret} />
              ) : null}
            </View>
          );
        })}
        <TextInput
          ref={input}
          value={code}
          onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, LEN))}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          autoFocus
          maxLength={LEN}
          caretHidden
          style={styles.hidden}
        />
      </Pressable>

      <T style={styles.resend}>
        {left > 0 ? (
          <>
            ما وصلك؟ إعادة الإرسال بعد <T w="black" style={{ color: colors.white }}>{ar(`${mm}:${ss}`)}</T>
          </>
        ) : (
          <T w="black" style={{ color: colors.yellow }} onPress={() => setLeft(RESEND_SECONDS)}>
            أعد إرسال الكود
          </T>
        )}
      </T>
      <T style={styles.demo}>نسخة تجريبية: أي ٦ أرقام بتمشي لحد ما نربط الرسائل.</T>

      {!!err && <T w="bold" style={styles.err}>{err}</T>}

      <PillButton label="تأكيد" disabled={code.length < LEN || busy} onPress={confirm} style={styles.cta} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 12, flexDirection: 'row' },
  intro: { marginTop: 16, marginHorizontal: 24, gap: 10, alignItems: 'flex-start' },
  badge: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  h1: { marginTop: 10, fontSize: 32, lineHeight: 42 },
  lead: { fontSize: 16, lineHeight: 26, color: colors.textMuted },
  boxes: {
    marginTop: 32,
    marginHorizontal: 24,
    direction: 'ltr',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  box: {
    width: 48,
    height: 60,
    borderRadius: 16,
    borderWidth: 2,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: { fontSize: 26 },
  caret: { width: 2, height: 28, backgroundColor: colors.yellow },
  hidden: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    start: 0,
    end: 0,
    opacity: 0,
    color: 'transparent',
    fontFamily: fonts.regular,
  },
  resend: { marginTop: 20, marginHorizontal: 24, textAlign: 'center', fontSize: 15, color: colors.textDim },
  demo: { marginTop: 8, marginHorizontal: 24, textAlign: 'center', fontSize: 12, color: colors.placeholder },
  err: { marginTop: 12, marginHorizontal: 24, textAlign: 'center', fontSize: 13, color: colors.peach },
  cta: { marginTop: 'auto', marginHorizontal: 24, marginBottom: 24, height: 58 },
});
