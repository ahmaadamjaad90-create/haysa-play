import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Avatar } from '@/components/Avatars';
import { Dalla } from '@/components/Dalla';
import { AddFriendIcon, CloseIcon, SearchIcon } from '@/components/Icons';
import { Screen, T } from '@/components/ui';
import { errorText } from '@/lib/errors';
import { ar, toLatinDigits } from '@/lib/format';
import {
  findPlayer,
  listFriends,
  removeFriend,
  respondRequest,
  sendRequest,
  type Friend,
  type Player,
  type SendResult,
} from '@/lib/friends';
import { useSession } from '@/lib/session';
import { colors, fonts } from '@/theme';

type Tab = 'friends' | 'requests';

const SEND_MESSAGES: Record<SendResult, string> = {
  sent: 'انبعت الطلب ✅',
  accepted: 'صرتوا أصحاب 🎉',
  already_friends: 'إنتو أصحاب أصلاً',
  already_sent: 'بعتله طلب من قبل، استنى يرد',
  not_found: 'ما في لاعب بهالرقم',
  self: 'هاد رقمك إنت 😄',
};

export default function Friends() {
  const { user } = useSession();
  const [tab, setTab] = useState<Tab>('friends');
  const [items, setItems] = useState<Friend[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('');
  const [err, setErr] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await listFriends());
      setErr('');
    } catch (e) {
      setErr(errorText(e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // كل زر بيعمل الشغلة وبعدين بيحدّث القائمة
  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await load();
    } catch (e) {
      setErr(errorText(e));
    }
  };

  const q = toLatinDigits(filter.trim());
  const friends = items.filter(
    (f) => f.status === 'accepted' && (!q || (f.name ?? '').includes(q) || String(f.public_id).includes(q)),
  );
  const incoming = items.filter((f) => f.status === 'pending' && f.incoming);
  const outgoing = items.filter((f) => f.status === 'pending' && !f.incoming);

  return (
    <Screen>
      <View style={styles.header}>
        <T w="heading" style={styles.h1}>الأصدقاء</T>
        <Pressable
          accessibilityRole="button"
          onPress={() => setAdding((a) => !a)}
          style={[styles.addBtn, adding && { backgroundColor: colors.surfaceHigh }]}>
          {adding ? <CloseIcon /> : <AddFriendIcon />}
          <T w="black" style={{ fontSize: 15, color: adding ? colors.white : colors.ink }}>
            {adding ? 'إغلاق' : 'أضف صديق'}
          </T>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.yellow} />}>
        {adding && <AddFriend myId={user?.id} onDone={load} />}

        <View style={styles.search}>
          <SearchIcon />
          <TextInput
            accessibilityLabel="ابحث بالاسم أو رقم الحساب"
            value={filter}
            onChangeText={setFilter}
            placeholder="ابحث بالاسم أو رقم الحساب"
            placeholderTextColor={colors.textDim}
            style={styles.searchInput}
          />
        </View>

        <View style={styles.tabs}>
          <TabButton label="أصدقائي" active={tab === 'friends'} onPress={() => setTab('friends')} />
          <TabButton
            label="الطلبات"
            badge={incoming.length}
            active={tab === 'requests'}
            onPress={() => setTab('requests')}
          />
        </View>

        {!!err && <T w="bold" style={styles.err}>{err}</T>}

        {tab === 'friends' ? (
          <View style={styles.list}>
            <T w="black" style={styles.h2}>
              كل الأصدقاء <T w="bold" style={{ color: colors.textDim }}>· {ar(friends.length)}</T>
            </T>
            {friends.length === 0 ? (
              <Empty text={q ? 'ما لقينا حدا بهالاسم أو الرقم' : 'لسا ما عندك أصدقاء. اضغط "أضف صديق" وحط رقم الـ ID تبع صاحبك.'} />
            ) : (
              friends.map((f) => (
                <FriendRow key={f.public_id} f={f}>
                  <ConfirmButton label="حذف" confirmLabel="متأكد؟" onConfirm={() => act(() => removeFriend(f.public_id))} />
                </FriendRow>
              ))
            )}
          </View>
        ) : (
          <View style={styles.list}>
            <T w="black" style={styles.h2}>
              وصلتك <T w="bold" style={{ color: colors.textDim }}>· {ar(incoming.length)}</T>
            </T>
            {incoming.length === 0 && <Empty text="ما في طلبات جديدة" />}
            {incoming.map((f) => (
              <FriendRow key={f.public_id} f={f}>
                <SmallButton label="قبول" primary onPress={() => act(() => respondRequest(f.public_id, true))} />
                <SmallButton label="رفض" onPress={() => act(() => respondRequest(f.public_id, false))} />
              </FriendRow>
            ))}

            {outgoing.length > 0 && (
              <>
                <T w="black" style={[styles.h2, { marginTop: 10 }]}>
                  بعتّها <T w="bold" style={{ color: colors.textDim }}>· {ar(outgoing.length)}</T>
                </T>
                {outgoing.map((f) => (
                  <FriendRow key={f.public_id} f={f} note="بانتظار الرد">
                    <SmallButton label="إلغاء" onPress={() => act(() => removeFriend(f.public_id))} />
                  </FriendRow>
                ))}
              </>
            )}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function AddFriend({ myId, onDone }: { myId?: number; onDone: () => void }) {
  const [id, setId] = useState('');
  const [player, setPlayer] = useState<Player | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const digits = toLatinDigits(id).replace(/\D/g, '');

  const search = async () => {
    setBusy(true);
    setMsg('');
    setPlayer(null);
    try {
      const p = await findPlayer(Number(digits));
      if (!p) setMsg(SEND_MESSAGES.not_found);
      else if (p.public_id === myId) setMsg(SEND_MESSAGES.self);
      else setPlayer(p);
    } catch (e) {
      setMsg(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    if (!player) return;
    setBusy(true);
    try {
      setMsg(SEND_MESSAGES[await sendRequest(player.public_id)]);
      setPlayer(null);
      setId('');
      onDone();
    } catch (e) {
      setMsg(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.addCard}>
      <T w="black" style={{ fontSize: 15 }} nativeID="addIdLabel">رقم الـ ID تبع صاحبك</T>
      <View style={styles.addRow}>
        <TextInput
          accessibilityLabelledBy="addIdLabel"
          value={id}
          onChangeText={(t) => {
            setId(t);
            setMsg('');
            setPlayer(null);
          }}
          keyboardType="number-pad"
          placeholder="100000"
          placeholderTextColor={colors.placeholder}
          maxLength={9}
          autoFocus
          onSubmitEditing={search}
          style={styles.addInput}
        />
        <SmallButton label="ابحث" primary disabled={digits.length < 6 || busy} onPress={search} />
      </View>

      {player && (
        <View style={styles.found}>
          <Avatar avatar={player.avatar} size={48} />
          <View style={{ flex: 1, gap: 2 }}>
            <T w="black" style={{ fontSize: 16 }}>{player.name || 'لاعب جديد'}</T>
            <T style={{ fontSize: 13, color: colors.textDim }}>ID {ar(player.public_id)}</T>
          </View>
          <SmallButton label="أرسل طلب" primary disabled={busy} onPress={send} />
        </View>
      )}
      {!!msg && <T w="bold" style={styles.msg}>{msg}</T>}
    </View>
  );
}

function FriendRow({ f, note, children }: { f: Friend; note?: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Avatar avatar={f.avatar} size={48} />
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <T w="black" style={{ fontSize: 16 }} numberOfLines={1}>{f.name || 'لاعب جديد'}</T>
        <T style={{ fontSize: 13, color: colors.textDim }} numberOfLines={1}>
          {note ?? `ID ${ar(f.public_id)}`}
        </T>
      </View>
      {children}
    </View>
  );
}

function TabButton({ label, active, badge, onPress }: { label: string; active: boolean; badge?: number; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.tab, active && { backgroundColor: colors.yellow }]}>
      <T w={active ? 'black' : 'bold'} style={{ fontSize: 15, color: active ? colors.ink : colors.textMuted }}>
        {label}
      </T>
      {!!badge && (
        <View style={styles.badge}>
          <T w="black" style={{ fontSize: 12 }}>{ar(badge)}</T>
        </View>
      )}
    </Pressable>
  );
}

function SmallButton({
  label,
  primary,
  disabled,
  onPress,
}: {
  label: string;
  primary?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.small,
        { backgroundColor: primary ? colors.yellow : colors.surfaceHigh, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
      ]}>
      <T w="black" style={{ fontSize: 15, color: primary ? colors.ink : colors.white }}>{label}</T>
    </Pressable>
  );
}

// ضغطة أولى بتسأل، والتانية بتنفّذ
function ConfirmButton({ label, confirmLabel, onConfirm }: { label: string; confirmLabel: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => (armed ? onConfirm() : setArmed(true))}
      onBlur={() => setArmed(false)}
      style={[styles.small, { backgroundColor: armed ? colors.coral : colors.surfaceHigh }]}>
      <T w="black" style={{ fontSize: 15 }}>{armed ? confirmLabel : label}</T>
    </Pressable>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Dalla width={80} />
      <T style={{ fontSize: 15, lineHeight: 24, color: colors.textMuted, textAlign: 'center' }}>{text}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  h1: { fontSize: 32, lineHeight: 42 },
  addBtn: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: colors.yellow,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addCard: { marginTop: 8, marginHorizontal: 20, padding: 14, borderRadius: 20, backgroundColor: colors.surface, gap: 10 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  addInput: {
    flex: 1,
    minWidth: 0,
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.yellow,
    backgroundColor: colors.bg,
    color: colors.white,
    fontFamily: fonts.black,
    fontSize: 20,
    letterSpacing: 1,
  },
  found: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  msg: { fontSize: 14, color: colors.yellow },
  search: {
    marginTop: 12,
    marginHorizontal: 20,
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: { flex: 1, minWidth: 0, height: '100%', color: colors.white, fontFamily: fonts.regular, fontSize: 15 },
  tabs: {
    marginTop: 12,
    marginHorizontal: 20,
    height: 48,
    padding: 4,
    borderRadius: 24,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    gap: 4,
  },
  tab: { flex: 1, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: colors.alert,
    alignItems: 'center',
    justifyContent: 'center',
  },
  err: { marginTop: 12, marginHorizontal: 20, fontSize: 13, color: colors.peach },
  list: { marginTop: 16, marginHorizontal: 20, gap: 10 },
  h2: { fontSize: 17 },
  row: {
    minHeight: 72,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  small: { height: 40, paddingHorizontal: 16, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 24, paddingHorizontal: 16 },
});
