import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { errorText } from '@/lib/errors';
import { ar } from '@/lib/format';
import { CATEGORIES, sendGift, useGifts, type Gift, type GiftCategory } from '@/lib/gifts';
import { useSession } from '@/lib/session';
import type { Seat } from '@/lib/useVoiceRoom';
import { colors } from '@/theme';
import { Avatar } from './Avatars';
import { CoinIcon } from './Icons';
import { T } from './ui';

const QTYS = [1, 5, 10];

// قائمة "أرسل هدية" من تحت الشاشة
export function GiftSheet({
  visible,
  onClose,
  room,
  seats,
}: {
  visible: boolean;
  onClose: () => void;
  room: number;
  seats: (Seat | null)[];
}) {
  const insets = useSafeAreaInsets();
  const { user, setBalance } = useSession();
  // المستلمين: كل اللي على المايك إلا أنا
  const people = seats.filter((s): s is Seat => !!s && !s.isMe);
  const [to, setTo] = useState<string | 'all' | null>(null);
  const { gifts, error } = useGifts();
  const [category, setCategory] = useState<GiftCategory>('popular');
  const [picked, setPicked] = useState<Gift | null>(null);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const shown = gifts.filter((g) => g.category === category);
  const gift = picked ?? shown[0] ?? null;
  const target = to ?? people[0]?.identity ?? null;
  const recipients = target === 'all' ? people.map((p) => p.identity) : target ? [target] : [];
  const total = gift ? gift.price * qty * recipients.length : 0;
  const balance = gift?.currency === 'gems' ? (user?.gems ?? 0) : (user?.coins ?? 0);
  const enough = total > 0 && total <= balance;

  const send = async () => {
    if (!gift) return;
    setBusy(true);
    setMsg('');
    try {
      const b = await sendGift(room, gift.key, qty, recipients.map(Number));
      setBalance(b.coins, b.gems);
      onClose();
    } catch (e) {
      const text = errorText(e);
      setMsg(text.includes('insufficient') ? 'رصيدك ما بيكفي' : text);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityLabel="إغلاق" style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.inner}>
          <View style={styles.handle} />
          <View style={styles.titleRow}>
            <T w="heading" style={{ flex: 1, fontSize: 26, lineHeight: 34 }}>أرسل هدية 🎁</T>
            <View style={styles.balance}>
              <CoinIcon size={15} />
              <T w="black" style={{ fontSize: 13 }}>{ar(user?.coins ?? 0)}</T>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="متجر الجواهر"
              onPress={() => {
                onClose();
                router.push('/store');
              }}
              style={styles.balance}>
              <T style={{ fontSize: 13 }}>💎</T>
              <T w="black" style={{ fontSize: 13 }}>{ar(user?.gems ?? 0)}</T>
              <T w="black" style={{ fontSize: 14, color: colors.yellow }}>+</T>
            </Pressable>
          </View>

          <T w="black" style={styles.h3}>لمين؟</T>
          {people.length === 0 ? (
            <T style={{ fontSize: 14, color: colors.textDim }}>ما في حدا على المايك هلأ</T>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, padding: 2 }}>
              {people.length > 1 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: target === 'all' }}
                  onPress={() => setTo('all')}
                  style={styles.person}>
                  <View style={[styles.allCircle, target === 'all' && styles.selectedRing]}>
                    <T w="black" style={{ fontSize: 13 }}>الكل</T>
                  </View>
                  <T w="black" style={{ fontSize: 12 }}>كل المايك</T>
                </Pressable>
              )}
              {people.map((p) => (
                <Pressable
                  key={p.identity}
                  accessibilityRole="button"
                  accessibilityState={{ selected: target === p.identity }}
                  onPress={() => setTo(p.identity)}
                  style={styles.person}>
                  <View style={[styles.circle, target === p.identity && styles.selectedRing]}>
                    <Avatar avatar={p.avatar} size={44} />
                  </View>
                  <T w="black" style={{ fontSize: 12, color: target === p.identity ? colors.yellow : colors.white }} numberOfLines={1}>
                    {p.name}
                  </T>
                </Pressable>
              ))}
            </ScrollView>
          )}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
            {CATEGORIES.map((c) => (
              <Pressable
                key={c.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: category === c.key }}
                onPress={() => {
                  setCategory(c.key);
                  setPicked(null);
                }}
                style={[styles.tab, category === c.key && { backgroundColor: colors.purple }]}>
                <T w={category === c.key ? 'black' : 'bold'} style={{ fontSize: 14, color: category === c.key ? colors.white : colors.textMuted }}>
                  {c.label}
                </T>
              </Pressable>
            ))}
          </ScrollView>

          {!!error && <T w="bold" style={[styles.note, { color: colors.peach }]}>{errorText(error)}</T>}
          <ScrollView style={styles.gridScroll} contentContainerStyle={styles.grid}>
            {shown.map((g) => (
              <Pressable
                key={g.key}
                accessibilityRole="button"
                accessibilityState={{ selected: gift?.key === g.key }}
                onPress={() => setPicked(g)}
                style={[styles.gift, gift?.key === g.key && styles.giftOn]}>
                <T style={{ fontSize: 32, lineHeight: 40 }}>{g.emoji}</T>
                <T w="bold" style={{ fontSize: 12 }} numberOfLines={1}>{g.name}</T>
                <T w="black" style={{ fontSize: 12, color: g.currency === 'coins' ? colors.yellow : '#FF8FA3' }}>
                  {g.currency === 'coins' ? '🪙' : '💎'} {ar(g.price.toLocaleString('en'))}
                </T>
              </Pressable>
            ))}
          </ScrollView>

          {gift?.announce && <T w="bold" style={styles.note}>📣 {gift.name} بيطلع إعلان بالرئيسية باسمك</T>}
          {!!msg && <T w="bold" style={[styles.note, { color: colors.peach }]}>{msg}</T>}

          <View style={styles.footer}>
            {QTYS.map((q) => (
              <Pressable
                key={q}
                accessibilityRole="button"
                accessibilityState={{ selected: qty === q }}
                onPress={() => setQty(q)}
                style={[styles.qty, qty === q && { backgroundColor: colors.yellow }]}>
                <T w="black" style={{ fontSize: 14, color: qty === q ? colors.ink : colors.white }}>×{ar(q)}</T>
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="button"
              disabled={!enough || busy}
              onPress={send}
              style={[styles.send, (!enough || busy) && { opacity: 0.5 }]}>
              <T w="black" style={{ fontSize: 17, color: colors.ink }}>
                {total > balance ? 'رصيدك ما بيكفي' : `أرسل ${gift?.currency === 'gems' ? '💎' : '🪙'} ${ar(total.toLocaleString('en'))}`}
              </T>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(10,3,24,0.6)' },
  sheet: { backgroundColor: '#24104A', borderTopStartRadius: 28, borderTopEndRadius: 28, paddingTop: 10 },
  inner: { width: '100%', maxWidth: 480, alignSelf: 'center', paddingHorizontal: 16 },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: colors.surfaceHigh },
  titleRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  balance: {
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  h3: { marginTop: 14, marginBottom: 8, fontSize: 14, color: colors.textMuted },
  person: { width: 60, alignItems: 'center', gap: 5 },
  circle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  allCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.placeholder,
    backgroundColor: '#3A1D72',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedRing: { borderWidth: 3, borderStyle: 'solid', borderColor: colors.yellow },
  tabs: { marginTop: 12, gap: 6, paddingHorizontal: 2 },
  tab: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridScroll: { marginTop: 10, maxHeight: 300 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  gift: { width: '25%', height: 92, paddingVertical: 6, borderRadius: 16, alignItems: 'center', gap: 2 },
  giftOn: { backgroundColor: '#3A1D72', borderWidth: 2, borderColor: colors.yellow },
  note: { marginTop: 8, textAlign: 'center', fontSize: 12, color: colors.peach },
  footer: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  qty: {
    height: 36,
    minWidth: 44,
    paddingHorizontal: 10,
    borderRadius: 18,
    backgroundColor: '#3A1D72',
    alignItems: 'center',
    justifyContent: 'center',
  },
  send: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
