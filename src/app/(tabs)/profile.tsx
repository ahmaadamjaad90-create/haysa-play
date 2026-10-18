import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/Avatars';
import { CoinIcon, CopyIcon, GoogleIcon } from '@/components/Icons';
import { PillButton, Screen, T } from '@/components/ui';
import { errorText } from '@/lib/errors';
import { ar } from '@/lib/format';
import { useSession } from '@/lib/session';
import { colors } from '@/theme';

export default function Profile() {
  const { user, signOut, isGuest, linkGoogle, authError } = useSession();
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState('');
  const [confirmOut, setConfirmOut] = useState(false);
  if (!user) return null;

  const copy = async () => {
    await Clipboard.setStringAsync(String(user.id));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Screen>
      <View style={styles.top}>
        <View style={styles.ring}>
          <Avatar avatar={user.avatar} size={96} />
        </View>
        <T w="heading" style={styles.name}>{user.name}</T>
        <Pressable accessibilityRole="button" accessibilityLabel="نسخ الرقم" onPress={copy} style={styles.id}>
          <T w="black" style={{ fontSize: 16 }}>
            <T w="black" style={{ color: colors.yellow }}>ID</T> {ar(user.id)}
          </T>
          <CopyIcon size={14} />
          {copied && <T w="bold" style={{ fontSize: 13, color: colors.yellow }}>انتسخ</T>}
        </Pressable>
      </View>

      <View style={styles.wallet}>
        <View style={styles.cell}>
          <CoinIcon />
          <T w="black" style={styles.amount}>{ar(user.coins)}</T>
          <T style={styles.unit}>عملات</T>
        </View>
        <View style={styles.cell}>
          <T style={{ fontSize: 20 }}>💎</T>
          <T w="black" style={styles.amount}>{ar(user.gems)}</T>
          <T style={styles.unit}>جواهر</T>
        </View>
      </View>

      {isGuest && (
        <View style={styles.guest}>
          <T w="black" style={{ fontSize: 16 }}>حسابك لسا ضيف</T>
          <T style={{ fontSize: 14, lineHeight: 22, color: colors.textMuted }}>
            اربطه بـ Google عشان ما يضيع إذا غيّرت الجوال، ويضل رقمك {ar(user.id)} متل ما هو.
          </T>
          <PillButton
            label="اربط حسابي بـ Google"
            bg={colors.white}
            fg="#1F1F1F"
            icon={<GoogleIcon />}
            onPress={() => linkGoogle().catch((e) => setErr(errorText(e)))}
          />
        </View>
      )}
      {!!(err || authError) && <T w="bold" style={styles.err}>{err || authError}</T>}

      <PillButton
        label={confirmOut ? 'متأكد؟ حساب الضيف رح يضيع' : 'تسجيل الخروج'}
        bg={confirmOut ? colors.coral : colors.surface}
        fg={colors.white}
        onPress={async () => {
          // حساب الضيف ما بيرجع بعد الخروج، فمنسأل أول
          if (isGuest && !confirmOut) return setConfirmOut(true);
          await signOut();
          router.replace('/login');
        }}
        style={styles.out}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { marginTop: 32, alignItems: 'center', gap: 8 },
  ring: { padding: 4, borderRadius: 56, borderWidth: 4, borderColor: colors.yellow },
  name: { marginTop: 6, fontSize: 30, lineHeight: 40 },
  id: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: colors.surface,
  },
  wallet: { marginTop: 24, marginHorizontal: 20, flexDirection: 'row', gap: 12 },
  cell: {
    flex: 1,
    height: 72,
    borderRadius: 20,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  amount: { fontSize: 20 },
  unit: { fontSize: 14, color: colors.textMuted },
  guest: { marginTop: 20, marginHorizontal: 20, padding: 16, borderRadius: 20, backgroundColor: colors.surface, gap: 10 },
  err: { marginTop: 10, marginHorizontal: 20, textAlign: 'center', fontSize: 13, color: colors.peach },
  out: { marginTop: 'auto', marginHorizontal: 20, marginBottom: 24 },
});
