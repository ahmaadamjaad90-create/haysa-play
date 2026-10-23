import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, FlatList, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Avatar } from '@/components/Avatars';
import { GiftSheet } from '@/components/GiftSheet';
import { CloseIcon, CrownIcon, EditIcon, ExitIcon, GiftIcon, MicIcon, MicOffIcon, PlusIcon, SendIcon } from '@/components/Icons';
import { BackButton, PillButton, Screen, T } from '@/components/ui';
import { errorText } from '@/lib/errors';
import { ar } from '@/lib/format';
import { type GiftEvent } from '@/lib/gifts';
import { getRoom, listAdmins, modAction, setRoomGame, type RoomAdmin, type RoomRow } from '@/lib/rooms';
import { ROOM_GAMES, roomGame, roomGameHref, roomGameStatus, type RoomGameDef } from '@/lib/roomGames';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useVoiceRoom, type Seat } from '@/lib/useVoiceRoom';
import { colors, fonts } from '@/theme';

// داخل الغرفة: /room?id=100002 (رقم الغرفة = رقم صاحبها)
export default function RoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, loading } = useSession();
  const [room, setRoom] = useState<RoomRow | null>(null);
  const [err, setErr] = useState('');
  const number = Number(id);

  useEffect(() => {
    if (!user || !number) return;
    getRoom(number)
      .then((r) => (r ? setRoom(r) : setErr('ما في غرفة بهالرقم')))
      .catch((e) => setErr(errorText(e)));

    // لو صاحب الغرفة غيّر الاسم أو عدد المقاعد
    const ch = supabase
      .channel(`room-${number}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `number=eq.${number}` }, (p) =>
        setRoom((r) => (r ? { ...r, ...(p.new as Partial<RoomRow>) } : r)),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, number]);

  if (!loading && !user) return <Redirect href="/login" />;

  if (!room) {
    return (
      <Screen>
        <View style={styles.header}>
          <BackButton fallback="/rooms" />
        </View>
        <T style={styles.center}>{err || 'لحظة...'}</T>
      </Screen>
    );
  }

  return <Voice room={room} isOwner={room.number === user?.id} />;
}

function Voice({ room, isOwner }: { room: RoomRow; isOwner: boolean }) {
  const { uid } = useSession();
  const v = useVoiceRoom(room.number, room.seats, String(room.number));
  const [admins, setAdmins] = useState<RoomAdmin[]>([]);
  const isMod = isOwner || admins.some((a) => a.uid === uid);
  const adminIds = new Set(admins.map((a) => String(a.pid)));
  const [menu, setMenu] = useState<Seat | null>(null);
  const [picker, setPicker] = useState(false);
  const [modMsg, setModMsg] = useState('');

  // المشرفين (وأي تغيير عليهم فوراً)
  useEffect(() => {
    const load = () => listAdmins(room.owner).then(setAdmins).catch(() => {});
    load();
    const ch = supabase
      .channel(`room-admins-${room.number}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_admins', filter: `room_owner=eq.${room.owner}` }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [room.owner, room.number]);

  const doMod = async (seat: Seat, op: 'mute' | 'unseat' | 'kick') => {
    setMenu(null);
    setModMsg('');
    try {
      await modAction(room.number, seat.identity, op);
      const what = op === 'mute' ? 'انكتم' : op === 'unseat' ? 'نزل عن المايك' : 'انطرد من الغرفة';
      v.addLine({ system: true, text: `🛡️ ${seat.name} ${what}` });
    } catch (e) {
      const t = errorText(e);
      setModMsg(t.includes('admin') ? 'ما بتقدر على مشرف تاني' : t.includes('owner') ? 'ما بتقدر على صاحب الغرفة' : t);
    }
  };
  const [text, setText] = useState('');
  const [giftOpen, setGiftOpen] = useState(false);
  const [burst, setBurst] = useState<GiftEvent | null>(null);
  const listRef = useRef<FlatList>(null);
  const onMic = v.seats.filter(Boolean).length;
  const { addLine } = v;

  // الهدايا بهالغرفة: سطر بالدردشة وهدية كبيرة بنص الشاشة
  useEffect(() => {
    const ch = supabase
      .channel(`gifts-${room.number}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'gift_events', filter: `room_number=eq.${room.number}` },
        ({ new: e }) => {
          const ev = e as GiftEvent;
          addLine({
            system: true,
            text: `🎁 ${ev.sender_name} أرسل ${ev.gift_emoji} ${ev.gift_name} ×${ar(ev.qty)} لـ ${ev.recipient_name}`,
          });
          setBurst(ev);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [room.number, addLine]);

  const send = () => {
    v.sendChat(text).catch(() => {});
    setText('');
  };

  return (
    <Screen>
      <View style={styles.header}>
        <BackButton fallback="/rooms" />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <T w="black" style={{ fontSize: 19 }} numberOfLines={1}>{room.name}</T>
          <T style={{ fontSize: 13, color: colors.textMuted }}>
            {ar(v.listeners)} في الغرفة · رقم الغرفة {ar(room.number)}
          </T>
        </View>
        {isOwner && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="تعديل الغرفة"
            onPress={() => router.push('/create-room')}
            style={styles.roundBtn}>
            <EditIcon />
          </Pressable>
        )}
      </View>

      <View style={styles.micChip}>
        <MicIcon size={14} color={colors.yellow} />
        <T w="black" style={{ fontSize: 14, color: colors.yellow }}>
          {ar(onMic)} من {ar(room.seats)} على المايك
        </T>
      </View>

      {v.status === 'connecting' && <T style={styles.note}>عم نوصل للغرفة...</T>}
      {v.status === 'error' && (
        <T w="bold" style={[styles.note, { color: colors.peach }]}>
          {v.error.includes('banned')
            ? 'انطردت من هالغرفة. فيك ترجع بعد 10 دقايق'
            : v.error.includes('non-2xx')
              ? 'سيرفر الصوت لسا مش جاهز'
              : errorText(v.error)}
        </T>
      )}
      {v.status === 'closed' && <T w="bold" style={[styles.note, { color: colors.peach }]}>انقطع الاتصال بالغرفة</T>}
      {v.needsAudioTap && (
        <PillButton label="🔊 اضغط عشان تسمع الغرفة" onPress={v.startAudio} style={styles.audioTap} />
      )}

      {room.game && <GameBanner room={room} isMod={isMod} />}

      <View style={styles.seats}>
        {v.seats.map((s, i) => (
          <SeatView
            key={i}
            index={i}
            seat={s}
            ownerSeat={i === 0}
            canTake={v.status === 'connected' && !s && v.mySeat === null && (i !== 0 || isOwner)}
            admin={!!s && adminIds.has(s.identity)}
            onTake={() => v.takeSeat(i).catch(() => {})}
            onLeave={() => v.leaveSeat().catch(() => {})}
            onManage={isMod && s && !s.isMe && i !== 0 ? () => setMenu(s) : undefined}
          />
        ))}
      </View>

      {!!modMsg && <T w="bold" style={[styles.note, { color: colors.peach }]}>{modMsg}</T>}

      <FlatList
        ref={listRef}
        data={v.chat}
        keyExtractor={(l) => l.id}
        style={styles.chat}
        contentContainerStyle={{ gap: 8, paddingVertical: 8 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) =>
          item.system ? (
            <T style={styles.system}>{item.text}</T>
          ) : (
            <View style={styles.line}>
              <T style={{ fontSize: 15, lineHeight: 21 }}>
                <T w="black" style={{ color: colors.yellow }}>{item.name} </T>
                {item.text}
              </T>
            </View>
          )
        }
      />

      <View style={styles.bar}>
        <TextInput
          value={text}
          onChangeText={setText}
          onSubmitEditing={send}
          placeholder="اكتب رسالة..."
          placeholderTextColor={colors.textDim}
          maxLength={200}
          style={styles.input}
        />
        {isMod && (
          <Pressable accessibilityRole="button" accessibilityLabel="افتح لعبة بالغرفة" onPress={() => setPicker(true)} style={styles.barBtn}>
            <T style={{ fontSize: 22 }}>🎮</T>
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="إرسال هدية"
          onPress={() => setGiftOpen(true)}
          style={styles.barBtn}>
          <GiftIcon />
        </Pressable>
        {!!text.trim() && (
          <Pressable accessibilityRole="button" accessibilityLabel="إرسال" onPress={send} style={[styles.barBtn, { backgroundColor: colors.yellow }]}>
            <SendIcon size={20} />
          </Pressable>
        )}
        {v.mySeat !== null && (
          <>
            <Pressable accessibilityRole="button" accessibilityLabel="انزل عن المايك" onPress={() => v.leaveSeat()} style={styles.barBtn}>
              <ExitIcon />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={v.micOn ? 'اكتم المايك' : 'شغّل المايك'}
              onPress={() => v.toggleMic()}
              style={[styles.micBtn, { backgroundColor: v.micOn ? colors.coral : colors.surfaceHigh }]}>
              {v.micOn ? <MicIcon size={26} /> : <MicOffIcon size={26} />}
            </Pressable>
          </>
        )}
      </View>
      {burst && <GiftBurst key={burst.id} ev={burst} onDone={() => setBurst(null)} />}
      {menu && (
        <Sheet onClose={() => setMenu(null)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Avatar avatar={menu.avatar} size={44} />
            <T w="black" style={{ fontSize: 18, flex: 1 }} numberOfLines={1}>{menu.name}</T>
          </View>
          <PillButton label="🔇 اكتم المايك" bg={colors.surfaceHigh} fg={colors.white} onPress={() => doMod(menu, 'mute')} />
          <PillButton label="⬇️ نزّله عن المايك" bg={colors.surfaceHigh} fg={colors.white} onPress={() => doMod(menu, 'unseat')} />
          <PillButton label="🚪 اطرده من الغرفة" bg={colors.coral} fg={colors.white} onPress={() => doMod(menu, 'kick')} />
        </Sheet>
      )}
      {picker && <GamePicker room={room} onClose={() => setPicker(false)} />}
      <GiftSheet visible={giftOpen} onClose={() => setGiftOpen(false)} room={room.number} seats={v.seats} />
    </Screen>
  );
}

function Sheet({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <View style={styles.sheetBackdrop}>
      <Pressable accessibilityRole="button" accessibilityLabel="سكّر" style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={styles.sheet}>{children}</View>
    </View>
  );
}

// المشرف بيختار لعبة: بتنفتح طاولة جديدة والكل بالغرفة بيشوفوها وبيدخلوا
function GamePicker({ room, onClose }: { room: RoomRow; onClose: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const open = async (g: RoomGameDef) => {
    setBusy(g.key);
    setErr('');
    try {
      const id = await g.create();
      await setRoomGame(room.number, { game: g.key, id });
      onClose();
      router.push(roomGameHref(g, id, room.number));
    } catch (e) {
      setErr(errorText(e));
      setBusy(null);
    }
  };
  return (
    <Sheet onClose={onClose}>
      <T w="heading" style={{ fontSize: 22, lineHeight: 30 }}>العبوا بالغرفة 🎮</T>
      <T style={{ fontSize: 13, color: colors.textMuted }}>بتنفتح طاولة، والكل بالغرفة بيقدر يدخل وانتو عم تحكوا</T>
      <View style={styles.gameGrid}>
        {ROOM_GAMES.map((g) => (
          <Pressable
            key={g.key}
            accessibilityRole="button"
            disabled={!!busy}
            onPress={() => open(g)}
            style={[styles.gameTile, busy === g.key && { opacity: 0.5 }]}>
            <T style={{ fontSize: 28, lineHeight: 36 }}>{g.emoji}</T>
            <T w="black" style={{ fontSize: 12, textAlign: 'center' }} numberOfLines={1}>{g.name}</T>
          </Pressable>
        ))}
      </View>
      {!!err && <T w="bold" style={{ fontSize: 13, color: colors.peach, textAlign: 'center' }}>{err}</T>}
    </Sheet>
  );
}

// اللعبة المفتوحة بالغرفة: الكل بيقدر يدخل، والمشرف بيسكّرها
function GameBanner({ room, isMod }: { room: RoomRow; isMod: boolean }) {
  const g = room.game ? roomGame(room.game.game) : undefined;
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const id = room.game?.id ?? 0;

  useEffect(() => {
    if (!g || !id) return;
    let alive = true;
    const check = () => roomGameStatus(g, id).then((s) => alive && setStatus(s));
    check();
    const t = setInterval(check, 8000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [g, id]);

  if (!g || !room.game) return null;
  const done = status === 'finished';

  const join = async () => {
    setBusy(true);
    setErr('');
    try {
      await g.join(id).catch((e) => {
        // اللعب بلّش أو الطاولة مليانة: بتدخل تتفرج (أو إنت أصلاً عليها)
        if (!errorText(e).match(/started|full/)) throw e;
      });
      router.push(roomGameHref(g, id, room.number));
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.banner}>
      <T style={{ fontSize: 30, lineHeight: 38 }}>{g.emoji}</T>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T w="black" style={{ fontSize: 16 }} numberOfLines={1}>{g.name}</T>
        <T style={{ fontSize: 12, color: colors.textMuted }} numberOfLines={1}>
          {done ? 'خلصت اللعبة' : status === 'playing' ? 'اللعب شغّال' : `فتحها ${room.game.by} · بنستنى لاعبين`}
        </T>
        {!!err && <T w="bold" style={{ fontSize: 12, color: colors.peach }}>{err}</T>}
      </View>
      {!done && (
        <Pressable accessibilityRole="button" disabled={busy} onPress={join} style={[styles.joinBtn, busy && { opacity: 0.5 }]}>
          <T w="black" style={{ fontSize: 14, color: colors.ink }}>{status === 'playing' ? 'تفرّج' : 'انضم'}</T>
        </Pressable>
      )}
      {isMod && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="سكّر اللعبة"
          onPress={() => setRoomGame(room.number, null).catch((e) => setErr(errorText(e)))}
          style={styles.closeBtn}>
          <CloseIcon size={14} />
        </Pressable>
      )}
    </View>
  );
}

// الهدية بتطلع كبيرة بنص الغرفة وبتختفي
function GiftBurst({ ev, onDone }: { ev: GiftEvent; onDone: () => void }) {
  const [a] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const native = Platform.OS !== 'web';
    Animated.sequence([
      Animated.spring(a, { toValue: 1, useNativeDriver: native }),
      Animated.delay(1800),
      Animated.timing(a, { toValue: 0, duration: 400, useNativeDriver: native }),
    ]).start(onDone);
  }, [a, onDone]);
  return (
    <View pointerEvents="none" style={styles.burstWrap}>
      <Animated.View style={[styles.burst, { opacity: a, transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] }]}>
        <T style={{ fontSize: 96, lineHeight: 112 }}>{ev.gift_emoji}</T>
        <T w="black" style={{ fontSize: 16, textAlign: 'center' }}>
          <T w="black" style={{ color: colors.yellow }}>{ev.sender_name}</T> ← {ev.recipient_name} ×{ar(ev.qty)}
        </T>
      </Animated.View>
    </View>
  );
}

function SeatView({
  index,
  seat,
  ownerSeat,
  canTake,
  admin,
  onTake,
  onLeave,
  onManage,
}: {
  index: number;
  seat: Seat | null;
  ownerSeat: boolean;
  canTake: boolean;
  admin: boolean;
  onTake: () => void;
  onLeave: () => void;
  onManage?: () => void;
}) {
  if (!seat) {
    return (
      <View style={styles.seat}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`مقعد ${ar(index + 1)} فاضي`}
          disabled={!canTake}
          onPress={onTake}
          style={[styles.empty, !canTake && { opacity: 0.5 }]}>
          {ownerSeat ? <CrownIcon size={26} /> : <PlusIcon size={26} color={colors.textDim} />}
        </Pressable>
        <T w="bold" style={{ fontSize: 13, color: colors.textDim }} numberOfLines={1}>
          {ownerSeat ? 'صاحب الغرفة' : ar(index + 1)}
        </T>
      </View>
    );
  }
  return (
    <View style={styles.seat}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={seat.isMe ? 'انزل عن المايك' : seat.name}
        disabled={!seat.isMe && !onManage}
        onPress={seat.isMe ? onLeave : onManage}
        style={[styles.taken, seat.speaking && !seat.muted && styles.speaking]}>
        <Avatar avatar={seat.avatar} size={60} />
        {ownerSeat && (
          <View style={styles.crown}>
            <CrownIcon size={22} />
          </View>
        )}
        {seat.muted && (
          <View style={styles.mutedBadge}>
            <MicOffIcon size={12} color={colors.peach} />
          </View>
        )}
      </Pressable>
      <T w="bold" style={{ fontSize: 13, maxWidth: 80 }} numberOfLines={1}>
        {admin ? '⭐ ' : ''}{seat.isMe ? 'إنت' : seat.name}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 12, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  center: { marginTop: 60, marginHorizontal: 32, textAlign: 'center', fontSize: 16, lineHeight: 26, color: colors.textMuted },
  roundBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micChip: {
    marginTop: 10,
    marginHorizontal: 20,
    alignSelf: 'flex-start',
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  note: { marginTop: 8, marginHorizontal: 20, fontSize: 14, color: colors.textMuted },
  audioTap: { marginTop: 10, marginHorizontal: 20, height: 48 },
  seats: { marginTop: 16, marginHorizontal: 12, flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 },
  seat: { width: '25%', alignItems: 'center', gap: 6 },
  empty: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.placeholder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taken: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  speaking: { borderWidth: 3, borderColor: colors.yellow, shadowColor: colors.yellow, shadowOpacity: 0.6, shadowRadius: 8 },
  crown: { position: 'absolute', top: -14 },
  mutedBadge: {
    position: 'absolute',
    bottom: -2,
    start: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.tabBar,
    borderWidth: 2,
    borderColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chat: { flex: 1, marginTop: 12, marginHorizontal: 20 },
  system: { alignSelf: 'center', fontSize: 13, color: colors.textDim },
  line: {
    alignSelf: 'flex-start',
    maxWidth: '85%',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  bar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.tabBar,
    borderTopWidth: 1,
    borderTopColor: colors.surface,
  },
  input: {
    flex: 1,
    minWidth: 0,
    height: 48,
    paddingHorizontal: 18,
    borderRadius: 24,
    backgroundColor: colors.surface,
    color: colors.white,
    fontFamily: fonts.regular,
    fontSize: 16,
  },
  barBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  burstWrap: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, alignItems: 'center', justifyContent: 'center' },
  burst: { alignItems: 'center', padding: 20, borderRadius: 28, backgroundColor: 'rgba(28,10,58,0.75)' },
  sheetBackdrop: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, backgroundColor: 'rgba(10,3,24,0.6)', justifyContent: 'flex-end' },
  sheet: { padding: 20, gap: 12, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#24104A', borderTopWidth: 2, borderColor: colors.yellow },
  gameGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  gameTile: { width: '30%', height: 84, borderRadius: 18, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: 2, padding: 6 },
  banner: {
    marginTop: 12,
    marginHorizontal: 20,
    padding: 12,
    borderRadius: 20,
    backgroundColor: '#1F6B4A',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  joinBtn: { height: 38, paddingHorizontal: 16, borderRadius: 19, backgroundColor: colors.yellow, justifyContent: 'center' },
  closeBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
  micBtn: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
});
