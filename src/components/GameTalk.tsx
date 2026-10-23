import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View, type ScrollViewInstance } from 'react-native';

import { ChatIcon, CloseIcon, MicIcon, MicOffIcon, SendIcon } from '@/components/Icons';
import { T } from '@/components/ui';
import { ar } from '@/lib/format';
import { setMusicDucked, useGameMusic, useSoundSettings } from '@/lib/sound';
import { useGameVoice } from '@/lib/useGameVoice';
import { colors } from '@/theme';

type Player = { uid?: string | null; left?: boolean };

// زر الصوت والموسيقى فوق شاشة اللعبة، ومايك ورسائل إذا في لاعبين حقيقيين اتنين أو أكتر.
// الجاسوس والمافيا عندهم رسائل خاصة باللعبة، فهناك المايك بس (withChat=false).
// اللاعبين الحقيقيين (مش كمبيوتر ومش طالعين)، والمايك بيشتغل إذا في اتنين ع الأقل وأنا منهم
export function talkOn(players: Player[], uid: string | null, finished: boolean) {
  const humans = players.filter((p) => p.uid && !p.left);
  return !finished && humans.length >= 2 && humans.some((p) => p.uid === uid);
}

// عرض الأزرار فوق (الصوت دايماً، والمايك والرسائل إذا شغّالين)، عشان الشاشات اللي عندها شي بآخر العنوان تترك محلّها
export const talkWidth = (on: boolean, withChat = true) => (1 + (on ? (withChat ? 2 : 1) : 0)) * 52 - 20;

export function GameTalk({
  game,
  id,
  players,
  uid,
  finished,
  withChat = true,
  inRoom = false,
}: {
  game: string;
  id: number;
  players: Player[];
  uid: string | null;
  finished: boolean;
  withChat?: boolean;
  // من غرفة صوتية: الصوت والرسائل من الغرفة، فما منفتح صوت تاني ولا موسيقى
  inRoom?: boolean;
}) {
  const enabled = !inRoom && talkOn(players, uid, finished);
  const v = useGameVoice(game, id, enabled);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [seenId, setSeenId] = useState<string | null>(null);
  const [hiddenToast, setHiddenToast] = useState<string | null>(null);
  const scroll = useRef<ScrollViewInstance>(null);
  const sound = useSoundSettings();
  const soundOn = sound.music || sound.sfx;
  useGameMusic(!finished && !inRoom);
  useEffect(() => {
    setMusicDucked(v.micOn);
    return () => setMusicDucked(false);
  }, [v.micOn]);

  const theirs = v.chat.filter((l) => !l.mine);
  const last = theirs.at(-1);
  const seenAt = v.chat.findIndex((l) => l.id === seenId);
  const unread = open ? 0 : v.chat.slice(seenAt + 1).filter((l) => !l.mine).length;

  // آخر رسالة بتطلع شوي تحت الأزرار وبتختفي
  useEffect(() => {
    if (!last) return;
    const t = setTimeout(() => setHiddenToast(last.id), 4000);
    return () => clearTimeout(t);
  }, [last]);

  const markSeen = () => setSeenId(v.chat.at(-1)?.id ?? null);
  const send = () => {
    v.sendChat(text).catch(() => {});
    setText('');
  };

  return (
    <>
      <View style={styles.bar} pointerEvents="box-none">
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={soundOn ? 'سكّر الصوت' : 'شغّل الصوت'}
            onPress={sound.toggle}
            style={[styles.btn, !soundOn && { opacity: 0.6 }]}>
            <T style={{ fontSize: 18 }}>{soundOn ? '🔊' : '🔇'}</T>
          </Pressable>
          {enabled && withChat && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="الرسائل"
              onPress={() => {
                markSeen();
                setOpen(true);
              }}
              style={styles.btn}>
              <ChatIcon size={20} />
              {unread > 0 && (
                <View style={styles.badge}>
                  <T w="black" style={{ fontSize: 10, color: colors.white }}>{ar(Math.min(unread, 9))}</T>
                </View>
              )}
            </Pressable>
          )}
          {enabled && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={v.micOn ? 'سكّر المايك' : 'افتح المايك'}
            disabled={!v.connected}
            onPress={v.toggleMic}
            style={[styles.btn, v.micOn && { backgroundColor: colors.purple, borderWidth: 2, borderColor: colors.yellow }, !v.connected && { opacity: 0.5 }]}>
            {v.micOn ? <MicIcon size={20} /> : <MicOffIcon size={20} />}
          </Pressable>
          )}
        </View>
        {enabled && v.needsAudioTap && (
          <Pressable accessibilityRole="button" onPress={v.startAudio} style={styles.pill}>
            <T w="black" style={{ fontSize: 11, color: colors.ink }}>🔈 اضغط لتسمع</T>
          </Pressable>
        )}
        {v.error === 'mic' && <T w="bold" style={styles.note}>اسمح للمايك من المتصفح</T>}
        {v.speaking.length > 0 && (
          <T w="bold" style={styles.note} numberOfLines={1}>🔊 {v.speaking.join('، ')}</T>
        )}
        {enabled && withChat && !open && last && last.id !== hiddenToast && (
          <View style={styles.toast}>
            <T w="black" style={{ fontSize: 11, color: colors.yellow }} numberOfLines={1}>{last.name}</T>
            <T style={{ fontSize: 12 }} numberOfLines={2}>{last.text}</T>
          </View>
        )}
      </View>

      {enabled && open && (
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <T w="heading" style={{ fontSize: 18, lineHeight: 26 }}>رسائل الطاولة</T>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="سكّر"
              onPress={() => {
                markSeen();
                setOpen(false);
              }}
              style={styles.close}>
              <CloseIcon size={16} />
            </Pressable>
          </View>
          <ScrollView
            ref={scroll}
            style={{ flex: 1 }}
            contentContainerStyle={{ gap: 6, paddingVertical: 8 }}
            onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
            {v.chat.length === 0 && <T style={{ fontSize: 13, color: colors.textDim, textAlign: 'center' }}>قول مرحبا للطاولة 👋</T>}
            {v.chat.map((l) => (
              <View key={l.id} style={[styles.line, l.mine && styles.mine]}>
                <T w="black" style={{ fontSize: 11, color: l.mine ? colors.ink : colors.yellow }}>{l.name}</T>
                <T style={{ fontSize: 14, color: l.mine ? colors.ink : colors.white }}>{l.text}</T>
              </View>
            ))}
          </ScrollView>
          <View style={styles.inputRow}>
            <TextInput
              value={text}
              onChangeText={setText}
              onSubmitEditing={send}
              placeholder={v.connected ? 'اكتب رسالة...' : 'لحظة، عم يتصل...'}
              editable={v.connected}
              placeholderTextColor={colors.placeholder}
              maxLength={200}
              style={styles.input}
            />
            <Pressable accessibilityRole="button" accessibilityLabel="ابعت" disabled={!text.trim() || !v.connected} onPress={send} style={styles.send}>
              <SendIcon size={18} />
            </Pressable>
          </View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', top: 12, end: 16, alignItems: 'flex-end', gap: 6, maxWidth: 190 },
  btn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: -2,
    end: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: { height: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: colors.yellow, justifyContent: 'center' },
  note: { fontSize: 11, color: colors.textSoft },
  toast: { padding: 8, borderRadius: 14, backgroundColor: 'rgba(36,16,74,0.95)', borderWidth: 1, borderColor: colors.surfaceHigh, maxWidth: 190 },
  sheet: {
    position: 'absolute',
    start: 0,
    end: 0,
    bottom: 0,
    height: '55%',
    padding: 14,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#24104A',
    borderTopWidth: 2,
    borderColor: colors.yellow,
  },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  line: { alignSelf: 'flex-end', maxWidth: '85%', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 14, backgroundColor: colors.surface },
  mine: { alignSelf: 'flex-start', backgroundColor: colors.yellow },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    flex: 1,
    minWidth: 0,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: colors.surface,
    color: colors.white,
    fontFamily: 'Tajawal_700Bold',
    fontSize: 15,
    textAlign: 'right',
  },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.yellow, alignItems: 'center', justifyContent: 'center' },
});
