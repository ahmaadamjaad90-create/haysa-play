import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, FlatList, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Avatar } from '@/components/Avatars';
import { GiftSheet } from '@/components/GiftSheet';
import { CrownIcon, EditIcon, ExitIcon, GiftIcon, MicIcon, MicOffIcon, PlusIcon, SendIcon } from '@/components/Icons';
import { BackButton, PillButton, Screen, T } from '@/components/ui';
import { errorText } from '@/lib/errors';
import { ar } from '@/lib/format';
import { giftByKey, type GiftEvent } from '@/lib/gifts';
import { getRoom, type RoomRow } from '@/lib/rooms';
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

  if (Platform.OS !== 'web') {
    return (
      <Screen>
        <View style={styles.header}>
          <BackButton fallback="/rooms" />
        </View>
        <T style={styles.center}>الصوت بيشتغل بنسخة الويب هلأ، وعالجوال قريباً.</T>
      </Screen>
    );
  }

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
  const v = useVoiceRoom(room.number, room.seats, String(room.number));
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
          const g = giftByKey(ev.gift_key);
          addLine({
            system: true,
            text: `🎁 ${ev.sender_name} أرسل ${g?.emoji ?? ''} ${g?.name ?? ''} ×${ar(ev.qty)} لـ ${ev.recipient_name}`,
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
          {v.error.includes('non-2xx') ? 'سيرفر الصوت لسا مش جاهز' : errorText(v.error)}
        </T>
      )}
      {v.status === 'closed' && <T w="bold" style={[styles.note, { color: colors.peach }]}>انقطع الاتصال بالغرفة</T>}
      {v.needsAudioTap && (
        <PillButton label="🔊 اضغط عشان تسمع الغرفة" onPress={v.startAudio} style={styles.audioTap} />
      )}

      <View style={styles.seats}>
        {v.seats.map((s, i) => (
          <SeatView
            key={i}
            index={i}
            seat={s}
            ownerSeat={i === 0}
            canTake={v.status === 'connected' && !s && v.mySeat === null && (i !== 0 || isOwner)}
            onTake={() => v.takeSeat(i).catch(() => {})}
            onLeave={() => v.leaveSeat().catch(() => {})}
          />
        ))}
      </View>

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
      <GiftSheet visible={giftOpen} onClose={() => setGiftOpen(false)} room={room.number} seats={v.seats} />
    </Screen>
  );
}

// الهدية بتطلع كبيرة بنص الغرفة وبتختفي
function GiftBurst({ ev, onDone }: { ev: GiftEvent; onDone: () => void }) {
  const [a] = useState(() => new Animated.Value(0));
  const g = giftByKey(ev.gift_key);
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
        <T style={{ fontSize: 96, lineHeight: 112 }}>{g?.emoji}</T>
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
  onTake,
  onLeave,
}: {
  index: number;
  seat: Seat | null;
  ownerSeat: boolean;
  canTake: boolean;
  onTake: () => void;
  onLeave: () => void;
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
        disabled={!seat.isMe}
        onPress={onLeave}
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
        {seat.isMe ? 'إنت' : seat.name}
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
  micBtn: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
});
