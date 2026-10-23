import * as Clipboard from 'expo-clipboard';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CoinIcon, CopyIcon, GoogleIcon } from '@/components/Icons';
import { Avatar } from '@/components/Avatars';
import { PillButton, Screen, T } from '@/components/ui';
import { FramedAvatar, VipBadge } from '@/components/Vip';
import { errorText } from '@/lib/errors';
import { ar } from '@/lib/format';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { levelTitle, useXp, xpLevel } from '@/lib/level';
import { levelOf } from '@/lib/vip';
import { colors } from '@/theme';

export default function Profile() {
  const { user, uid, signOut, isGuest, linkGoogle, authError } = useSession();
  const xp = useXp(uid);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState('');
  const [confirmOut, setConfirmOut] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  if (!user) return null;
  const level = levelOf(user.vipPoints);

  const copy = async () => {
    await Clipboard.setStringAsync(String(user.id));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Screen>
      <View style={styles.top}>
        {level > 0 ? (
          <FramedAvatar avatar={user.avatar} level={level} size={96} />
        ) : (
          <View style={styles.ring}>
            <Avatar avatar={user.avatar} size={96} />
          </View>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <T w="heading" style={styles.name}>{user.name}</T>
          <VipBadge level={level} />
          {user.isAdmin && <T style={{ fontSize: 22 }}>👑</T>}
        </View>
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
          <T w="black" style={styles.amount}>{ar(user.coins.toLocaleString('en'))}</T>
          <T style={styles.unit}>عملات</T>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="متجر الجواهر" onPress={() => router.push('/store')} style={styles.cell}>
          <T style={{ fontSize: 20 }}>💎</T>
          <T w="black" style={styles.amount}>{ar(user.gems.toLocaleString('en'))}</T>
          <T style={styles.unit}>جواهر</T>
          <View style={styles.plus}>
            <T w="black" style={{ fontSize: 16, color: colors.ink }}>+</T>
          </View>
        </Pressable>
      </View>

      {xp !== null && <XpCard xp={xp} />}

      {(user.isAdmin || user.isOrganizer) && (
        <PillButton
          label={user.isAdmin ? '👑 لوحة الأدمن' : '🏆 نظّم بطولة'}
          bg={colors.surfaceHigh}
          fg={colors.white}
          onPress={() => router.push('/admin')}
          style={{ marginTop: 12, marginHorizontal: 20 }}
        />
      )}

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
      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          disabled={deleting}
          onPress={async () => {
            // ضغطتين: الأولى بتسأل، التانية بتحذف كل شي وما بيرجع
            if (!confirmDelete) return setConfirmDelete(true);
            setDeleting(true);
            const { error } = await supabase.rpc('delete_my_account');
            if (error) {
              setErr(errorText(error));
              setDeleting(false);
              return;
            }
            await signOut();
            router.replace('/login');
          }}>
          <T w="bold" style={{ fontSize: 13, color: confirmDelete ? colors.alert : colors.textDim, textAlign: 'center' }}>
            {deleting ? 'عم ينحذف...' : confirmDelete ? 'متأكد؟ كل شي بينحذف وما بيرجع. اضغط كمان مرة' : 'حذف الحساب'}
          </T>
        </Pressable>
        <T style={{ fontSize: 12, color: colors.textDim, textAlign: 'center' }}>
          <Link href="/privacy" style={styles.link}>سياسة الخصوصية</Link>
          {' · '}
          <Link href="/terms" style={styles.link}>شروط الاستخدام</Link>
        </T>
      </View>
    </Screen>
  );
}

// المستوى من الـ XP اللي بيجمعه اللاعب من الألعاب والهدايا
function XpCard({ xp }: { xp: number }) {
  const { level, into, need } = xpLevel(xp);
  return (
    <View style={styles.xp}>
      <View style={styles.levelBadge}>
        <T w="heading" style={{ fontSize: 22, lineHeight: 28, color: colors.ink }}>{ar(level)}</T>
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <T w="black" style={{ fontSize: 16 }}>المستوى {ar(level)} · {levelTitle(level)}</T>
          <T w="bold" style={{ fontSize: 13, color: colors.textMuted }}>{ar(xp.toLocaleString('en'))} XP</T>
        </View>
        <View style={styles.bar}>
          <View style={[styles.barFill, { width: `${Math.max(4, (into / need) * 100)}%` }]} />
        </View>
        <T style={{ fontSize: 12, color: colors.textMuted }}>باقي {ar(need - into)} XP للمستوى {ar(level + 1)}</T>
      </View>
    </View>
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
  plus: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amount: { fontSize: 20 },
  unit: { fontSize: 14, color: colors.textMuted },
  xp: {
    marginTop: 12,
    marginHorizontal: 20,
    padding: 14,
    borderRadius: 20,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  levelBadge: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.yellow, alignItems: 'center', justifyContent: 'center' },
  bar: { height: 10, borderRadius: 5, backgroundColor: colors.surfaceHigh, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 5, backgroundColor: colors.yellow },
  guest: { marginTop: 20, marginHorizontal: 20, padding: 16, borderRadius: 20, backgroundColor: colors.surface, gap: 10 },
  err: { marginTop: 10, marginHorizontal: 20, textAlign: 'center', fontSize: 13, color: colors.peach },
  out: { marginTop: 'auto', marginHorizontal: 20 },
  footer: { marginTop: 12, marginBottom: 16, marginHorizontal: 20, gap: 10 },
  link: { color: colors.textMuted, textDecorationLine: 'underline' },
});
