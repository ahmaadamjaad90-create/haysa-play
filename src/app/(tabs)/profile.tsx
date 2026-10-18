import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/Avatars';
import { CoinIcon, CopyIcon } from '@/components/Icons';
import { PillButton, Screen, T } from '@/components/ui';
import { ar } from '@/lib/format';
import { useSession } from '@/lib/session';
import { colors } from '@/theme';

export default function Profile() {
  const { user, signOut } = useSession();
  const [copied, setCopied] = useState(false);
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

      <PillButton
        label="تسجيل الخروج"
        bg={colors.surface}
        fg={colors.white}
        onPress={async () => {
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
  out: { marginTop: 'auto', marginHorizontal: 20, marginBottom: 24 },
});
