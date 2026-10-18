import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/Avatars';
import { Dalla } from '@/components/Dalla';
import { BackButton, PillButton, Screen, T } from '@/components/ui';
import { listChats, type ChatSummary } from '@/lib/chat';
import { errorText } from '@/lib/errors';
import { ar, whenAr } from '@/lib/format';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme';

export default function Chats() {
  const { uid, user, loading } = useSession();
  const [chats, setChats] = useState<ChatSummary[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    try {
      setChats(await listChats());
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

  // أي رسالة جديدة إلي بتحدّث القائمة
  useEffect(() => {
    if (!uid) return;
    const ch = supabase
      .channel(`chats-${uid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `recipient=eq.${uid}` }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [uid, load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (!loading && !user) return <Redirect href="/login" />;

  return (
    <Screen>
      <View style={styles.header}>
        <BackButton fallback="/home" />
        <T w="heading" style={styles.h1}>الرسائل</T>
      </View>

      {!!err && <T w="bold" style={styles.err}>{err}</T>}

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.yellow} />}>
        {chats?.length === 0 && (
          <View style={styles.empty}>
            <Dalla width={100} />
            <T style={styles.emptyText}>لسا ما في رسائل. افتح صفحة الأصدقاء وابعت لصاحبك أول رسالة.</T>
            <PillButton label="الأصدقاء" onPress={() => router.push('/friends')} style={{ paddingHorizontal: 32 }} />
          </View>
        )}
        {chats?.map((c) => (
          <Pressable
            key={c.user_id}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/chat', params: { id: String(c.public_id) } })}
            style={styles.row}>
            <Avatar avatar={c.avatar} size={52} />
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <View style={styles.line}>
                <T w="black" style={{ fontSize: 16 }} numberOfLines={1}>{c.name || 'لاعب جديد'}</T>
                <T w="bold" style={{ fontSize: 12, color: c.unread ? colors.yellow : colors.textDim }}>{whenAr(c.last_at)}</T>
              </View>
              <View style={styles.line}>
                <T style={styles.preview} numberOfLines={1}>
                  {c.last_mine && (
                    <T style={{ color: c.last_read ? colors.sky : colors.textDim }}>{c.last_read ? '✓✓ ' : '✓ '}</T>
                  )}
                  {c.last_mine ? 'إنت: ' : ''}
                  {c.last_body}
                </T>
                {c.unread > 0 && (
                  <View style={styles.unread}>
                    <T w="black" style={{ fontSize: 12, color: colors.ink }}>{ar(c.unread)}</T>
                  </View>
                )}
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 12, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  h1: { fontSize: 32, lineHeight: 42 },
  err: { marginTop: 8, marginHorizontal: 20, fontSize: 13, color: colors.peach },
  row: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2A1450',
  },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  preview: { flex: 1, minWidth: 0, fontSize: 14, color: colors.textMuted },
  unread: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 12 },
  emptyText: { fontSize: 16, lineHeight: 26, color: colors.textMuted, textAlign: 'center' },
});
