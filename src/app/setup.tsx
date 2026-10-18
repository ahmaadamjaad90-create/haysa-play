import * as Clipboard from 'expo-clipboard';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AVATARS, Avatar } from '@/components/Avatars';
import { CopyIcon } from '@/components/Icons';
import { PillButton, Screen, T } from '@/components/ui';
import { ar } from '@/lib/format';
import { useSession } from '@/lib/session';
import { colors, fonts } from '@/theme';

const MAX_NAME = 16;

export default function Setup() {
  const { user, completeSetup } = useSession();
  const [avatar, setAvatar] = useState(user?.avatar ?? 'dalla');
  const [name, setName] = useState(user?.name ?? '');
  const [copied, setCopied] = useState(false);

  if (!user) return <Redirect href="/login" />;

  const copy = async () => {
    await Clipboard.setStringAsync(String(user.id));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const done = async () => {
    await completeSetup(name.trim(), avatar);
    router.replace('/home');
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <T w="heading" style={styles.h1}>خلّينا نعرفك 👋</T>
          <T style={styles.lead}>اختار صورتك واسمك، وبتقدر تغيرهم بعدين من حسابي</T>
        </View>

        <View style={styles.photo}>
          <View style={styles.photoRing}>
            <Avatar avatar={avatar} size={112} />
          </View>
          <T w="bold" style={styles.photoHint}>الصورة من الجوال قريباً</T>
        </View>

        <T w="black" style={styles.h2}>اختار شخصية</T>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.avatars}>
          {AVATARS.map((a) => {
            const on = a.key === avatar;
            return (
              <Pressable
                key={a.key}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => setAvatar(a.key)}
                style={styles.avatarBtn}>
                <View style={[styles.avatarRing, on && { borderColor: colors.yellow }]}>
                  <Avatar avatar={a.key} size={56} />
                </View>
                <T w="bold" style={{ fontSize: 12 }}>{a.name}</T>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.field}>
          <View style={styles.labelRow}>
            <T w="black" style={{ fontSize: 15 }} nativeID="nameLabel">اسمك</T>
            <T w="bold" style={{ fontSize: 15, color: colors.textDim }}>
              {ar(name.length)}/{ar(MAX_NAME)}
            </T>
          </View>
          <TextInput
            accessibilityLabelledBy="nameLabel"
            value={name}
            onChangeText={setName}
            maxLength={MAX_NAME}
            placeholder="اكتب اسمك"
            placeholderTextColor={colors.placeholder}
            style={styles.input}
          />
        </View>

        <View style={styles.idCard}>
          <View style={{ flex: 1, gap: 2 }}>
            <T style={{ fontSize: 13, color: colors.textMuted }}>رقمك بهيصة (ثابت وما بيتغير)</T>
            <T w="black" style={{ fontSize: 22, letterSpacing: 1 }}>
              <T w="black" style={{ color: colors.yellow }}>ID</T> {ar(user.id)}
            </T>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="نسخ الرقم" onPress={copy} style={styles.copy}>
            <CopyIcon />
            <T w="black" style={{ fontSize: 14 }}>{copied ? 'انتسخ' : 'نسخ'}</T>
          </Pressable>
        </View>

        <PillButton
          label="يلا نبلش الهيصة! 🎉"
          disabled={name.trim().length < 2}
          onPress={done}
          style={styles.cta}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 24, paddingHorizontal: 24 },
  h1: { fontSize: 32, lineHeight: 42 },
  lead: { marginTop: 4, fontSize: 15, color: colors.textMuted },
  photo: { marginTop: 20, alignItems: 'center' },
  photoRing: { padding: 4, borderRadius: 64, borderWidth: 4, borderColor: colors.yellow },
  photoHint: { marginTop: 10, fontSize: 14, color: colors.yellow },
  h2: { marginTop: 18, marginHorizontal: 24, marginBottom: 10, fontSize: 15 },
  avatars: { paddingHorizontal: 24, paddingVertical: 6, gap: 14 },
  avatarBtn: { alignItems: 'center', gap: 6 },
  avatarRing: { padding: 3, borderRadius: 34, borderWidth: 3, borderColor: 'transparent' },
  field: { marginTop: 18, marginHorizontal: 24 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  input: {
    height: 56,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: colors.yellow,
    borderRadius: 18,
    backgroundColor: colors.surface,
    color: colors.white,
    fontFamily: fonts.black,
    fontSize: 18,
  },
  idCard: {
    marginTop: 14,
    marginBottom: 24,
    marginHorizontal: 24,
    minHeight: 72,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  copy: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: colors.surfaceHigh,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cta: { marginTop: 'auto', marginHorizontal: 24, marginBottom: 24, height: 58 },
});
