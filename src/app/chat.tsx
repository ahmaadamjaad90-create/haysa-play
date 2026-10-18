import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Avatar } from '@/components/Avatars';
import { SendIcon } from '@/components/Icons';
import { BackButton, Screen, T } from '@/components/ui';
import { getPeer, loadMessages, markRead, sendMessage, type ChatPeer, type Message } from '@/lib/chat';
import { errorText } from '@/lib/errors';
import { ar, dayAr, timeAr } from '@/lib/format';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { colors, fonts } from '@/theme';

// محادثة مع صديق: /chat?id=100003
export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { uid, user, loading } = useSession();
  const [peer, setPeer] = useState<ChatPeer | null>(null);
  // الأحدث أول (القائمة مقلوبة)
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!uid || !id) return;
    let cancelled = false;
    (async () => {
      try {
        const p = await getPeer(Number(id));
        if (cancelled) return;
        if (!p) return setErr('ما لقينا هاد اللاعب');
        setPeer(p);
        setMessages(await loadMessages(uid, p.id));
        await markRead(p.id);
      } catch (e) {
        if (!cancelled) setErr(errorText(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, id]);

  // رسائل جديدة منه، وعلامة القراءة على رسايلي
  useEffect(() => {
    if (!uid || !peer) return;
    const ch = supabase
      .channel(`chat-${uid}-${peer.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `recipient=eq.${uid}` },
        ({ new: m }) => {
          const msg = m as Message;
          if (msg.sender !== peer.id) return;
          setMessages((list) => (list.some((x) => x.id === msg.id) ? list : [msg, ...list]));
          markRead(peer.id).catch(() => {});
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `sender=eq.${uid}` },
        ({ new: m }) => {
          const msg = m as Message;
          setMessages((list) => list.map((x) => (x.id === msg.id ? msg : x)));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [uid, peer]);

  const send = async () => {
    const body = text.trim();
    if (!body || !peer || sending) return;
    setSending(true);
    setErr('');
    try {
      const msg = await sendMessage(peer.id, body);
      setMessages((list) => [msg, ...list]);
      setText('');
    } catch (e) {
      setErr(String(e).includes('not friends') ? 'لازم تكونوا أصدقاء عشان تتراسلوا' : errorText(e));
    } finally {
      setSending(false);
    }
  };

  if (!loading && !user) return <Redirect href="/login" />;

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <BackButton fallback="/chats" />
          {peer && <Avatar avatar={peer.avatar} size={44} />}
          <View style={{ flex: 1, minWidth: 0 }}>
            <T w="black" style={{ fontSize: 17 }} numberOfLines={1}>{peer?.name || 'لاعب جديد'}</T>
            {peer && <T style={{ fontSize: 12, color: colors.textDim }}>ID {ar(peer.public_id)}</T>}
          </View>
        </View>

        <FlatList
          inverted
          data={messages}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => {
            const older = messages[index + 1];
            const newDay = !older || dayAr(older.created_at) !== dayAr(item.created_at);
            return (
              <View>
                {newDay && (
                  <View style={styles.day}>
                    <T w="bold" style={{ fontSize: 12, color: colors.textMuted }}>{dayAr(item.created_at)}</T>
                  </View>
                )}
                <Bubble m={item} mine={item.sender === uid} />
              </View>
            );
          }}
          ListEmptyComponent={
            peer ? <T style={styles.empty}>ابعت أول رسالة لـ {peer.name || 'صاحبك'} 👋</T> : undefined
          }
        />

        {!!err && <T w="bold" style={styles.err}>{err}</T>}

        <View style={styles.inputBar}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="اكتب رسالة..."
            placeholderTextColor={colors.textDim}
            multiline
            maxLength={1000}
            style={styles.input}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="إرسال"
            disabled={!text.trim() || sending || !peer}
            onPress={send}
            style={[styles.send, (!text.trim() || !peer) && { opacity: 0.5 }]}>
            <SendIcon />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Bubble({ m, mine }: { m: Message; mine: boolean }) {
  return (
    <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
      <T style={{ fontSize: 15, lineHeight: 22 }}>{m.body}</T>
      <T w="bold" style={styles.meta}>
        {timeAr(m.created_at)}
        {mine && <T style={{ color: m.read_at ? colors.sky : colors.textMuted }}>{m.read_at ? '  ✓✓' : '  ✓'}</T>}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.tabBar,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface,
  },
  list: { paddingHorizontal: 16, paddingVertical: 12, gap: 8, flexGrow: 1 },
  day: {
    alignSelf: 'center',
    height: 24,
    paddingHorizontal: 12,
    marginVertical: 6,
    borderRadius: 12,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  bubble: { maxWidth: '78%', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6, borderRadius: 18 },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.purple, borderBottomEndRadius: 4 },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderBottomStartRadius: 4 },
  meta: { marginTop: 2, fontSize: 11, color: colors.textMuted, alignSelf: 'flex-end' },
  empty: { textAlign: 'center', fontSize: 15, color: colors.textMuted, padding: 24 },
  err: { marginHorizontal: 16, marginBottom: 6, fontSize: 13, color: colors.peach, textAlign: 'center' },
  inputBar: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    backgroundColor: colors.tabBar,
    borderTopWidth: 1,
    borderTopColor: colors.surface,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 11,
    borderRadius: 22,
    backgroundColor: colors.surface,
    color: colors.white,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  send: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
