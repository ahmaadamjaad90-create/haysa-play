import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Dalla } from '@/components/Dalla';
import { Avatar } from '@/components/Avatars';
import { CloseIcon, MicIcon, MinusIcon, PlusIcon } from '@/components/Icons';
import { BackButton, PillButton, Screen, T } from '@/components/ui';
import { errorText } from '@/lib/errors';
import { ar, toLatinDigits } from '@/lib/format';
import {
  CATEGORIES,
  SEAT_PRESETS,
  addAdmin,
  deleteMyRoom,
  getMyRoom,
  listAdmins,
  removeAdmin,
  saveMyRoom,
  type RoomAdmin,
} from '@/lib/rooms';
import { useSession } from '@/lib/session';
import { colors, fonts } from '@/theme';

// إنشاء غرفتي أو تعديلها (كل لاعب إله غرفة وحدة)
export default function CreateRoom() {
  const { uid, user, loading } = useSession();
  const [exists, setExists] = useState(false);
  const [name, setName] = useState('');
  const [seats, setSeats] = useState(8);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [admins, setAdmins] = useState<RoomAdmin[]>([]);
  const [adminId, setAdminId] = useState('');
  const [adminMsg, setAdminMsg] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!uid) return;
    getMyRoom(uid)
      .then((r) => {
        if (!r) return;
        setExists(true);
        setName(r.name);
        setSeats(r.seats);
        setCategory(r.category);
        listAdmins(uid).then(setAdmins).catch(() => {});
      })
      .catch((e) => setErr(errorText(e)));
  }, [uid]);

  if (!loading && !user) return <Redirect href="/login" />;

  const save = async () => {
    if (!uid || !user) return;
    setBusy(true);
    setErr('');
    try {
      await saveMyRoom(exists, uid, { name: name.trim(), seats, category });
      router.replace({ pathname: '/room', params: { id: String(user.id) } });
    } catch (e) {
      setErr(errorText(e));
      setBusy(false);
    }
  };

  const add = async () => {
    if (!uid) return;
    setAdminMsg('');
    try {
      await addAdmin(Number(toLatinDigits(adminId)));
      setAdminId('');
      setAdmins(await listAdmins(uid));
    } catch (e) {
      const t = errorText(e);
      setAdminMsg(
        t.includes('not found') ? 'ما في لاعب بهالرقم'
        : t.includes('own the room') ? 'إنت صاحب الغرفة'
        : t.includes('too many') ? 'وصلت للحد: 10 مشرفين'
        : t,
      );
    }
  };

  const remove = async (pid: number) => {
    if (!uid) return;
    await removeAdmin(pid).catch((e) => setAdminMsg(errorText(e)));
    setAdmins(await listAdmins(uid));
  };

  const destroy = async () => {
    if (!uid) return;
    // ضغطتين: الأولى بتسأل
    if (!confirmDelete) return setConfirmDelete(true);
    setBusy(true);
    try {
      await deleteMyRoom(uid);
      router.replace('/rooms');
    } catch (e) {
      setErr(errorText(e));
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <BackButton fallback="/rooms" />
        <T w="heading" style={styles.h1}>{exists ? 'تعديل غرفتي' : 'غرفة جديدة'}</T>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 24, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={styles.cover}>
          <View style={styles.coverBox}>
            <View style={styles.coverBlob} />
            <View style={{ zIndex: 1 }}>
              <Dalla width={92} />
            </View>
          </View>
          <T style={{ fontSize: 13, color: colors.textMuted }}>صورة الغرفة من الجوال قريباً</T>
        </View>

        <View style={styles.block}>
          <T w="black" style={styles.label} nativeID="roomNameLabel">اسم الغرفة</T>
          <TextInput
            accessibilityLabelledBy="roomNameLabel"
            value={name}
            onChangeText={setName}
            maxLength={24}
            placeholder="اكتب اسم غرفتك"
            placeholderTextColor={colors.textDim}
            style={styles.input}
          />
        </View>

        <View style={[styles.block, styles.card]}>
          <View style={styles.rowBetween}>
            <T w="black" style={{ fontSize: 17 }}>عدد المقاعد على المايك</T>
            <T style={{ fontSize: 14, color: colors.textMuted }}>من 2 إلى 16</T>
          </View>
          <View style={styles.stepper}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="أنقص مقعد"
              onPress={() => setSeats((s) => Math.max(2, s - 1))}
              style={[styles.stepBtn, { backgroundColor: colors.surfaceHigh }]}>
              <MinusIcon />
            </Pressable>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <T w="heading" style={{ fontSize: 48, lineHeight: 56, color: colors.yellow }}>{ar(seats)}</T>
              <T style={{ fontSize: 14, color: colors.textMuted }}>مقاعد</T>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="زِد مقعد"
              onPress={() => setSeats((s) => Math.min(16, s + 1))}
              style={[styles.stepBtn, { backgroundColor: colors.yellow }]}>
              <PlusIcon size={26} />
            </Pressable>
          </View>
          <View style={styles.rowBetween}>
            {SEAT_PRESETS.map((n) => (
              <Pressable
                key={n}
                accessibilityRole="button"
                accessibilityState={{ selected: seats === n }}
                onPress={() => setSeats(n)}
                style={[styles.preset, seats === n && { backgroundColor: colors.yellow }]}>
                <T w="black" style={{ fontSize: 17, color: seats === n ? colors.ink : colors.white }}>{ar(n)}</T>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.block}>
          <T w="black" style={styles.label}>نوع الغرفة</T>
          <View style={styles.chips}>
            {CATEGORIES.map((c) => (
              <Pressable
                key={c}
                accessibilityRole="button"
                accessibilityState={{ selected: category === c }}
                onPress={() => setCategory(c)}
                style={[styles.chip, category === c && { backgroundColor: colors.yellow }]}>
                <T w="bold" style={{ fontSize: 15, color: category === c ? colors.ink : colors.white }}>{c}</T>
              </Pressable>
            ))}
          </View>
        </View>

        {exists && (
          <View style={[styles.block, styles.card]}>
            <View style={styles.rowBetween}>
              <T w="black" style={{ fontSize: 17 }}>المشرفين</T>
              <T style={{ fontSize: 13, color: colors.textMuted }}>{ar(admins.length)} من 10</T>
            </View>
            <T style={{ fontSize: 13, lineHeight: 20, color: colors.textMuted }}>
              المشرف بيقدر يكتم المايك، وينزّل حدا عن المقعد، ويطرد، ويفتح ألعاب بالغرفة.
            </T>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                value={adminId}
                onChangeText={(t) => setAdminId(t.replace(/[^0-9٠-٩]/g, ''))}
                keyboardType="number-pad"
                placeholder="رقم الـ ID"
                placeholderTextColor={colors.textDim}
                style={[styles.input, { flex: 1, height: 48, fontSize: 16 }]}
              />
              <Pressable
                accessibilityRole="button"
                disabled={!adminId}
                onPress={add}
                style={[styles.addBtn, !adminId && { opacity: 0.5 }]}>
                <T w="black" style={{ fontSize: 15, color: colors.ink }}>ضيف</T>
              </Pressable>
            </View>
            {!!adminMsg && <T w="bold" style={{ fontSize: 13, color: colors.peach }}>{adminMsg}</T>}
            {admins.map((a) => (
              <View key={a.uid} style={styles.admin}>
                <Avatar avatar={a.avatar} size={36} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T w="black" style={{ fontSize: 15 }} numberOfLines={1}>⭐ {a.name || 'لاعب'}</T>
                  <T style={{ fontSize: 12, color: colors.textMuted }}>ID {ar(a.pid)}</T>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`شيل ${a.name || 'المشرف'}`}
                  onPress={() => remove(a.pid)}
                  style={styles.removeBtn}>
                  <CloseIcon size={14} />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {!!err && <T w="bold" style={styles.err}>{err}</T>}

        <PillButton
          label={exists ? 'احفظ وادخل الغرفة' : 'افتح الغرفة'}
          icon={<MicIcon color={colors.ink} />}
          disabled={name.trim().length < 2 || busy}
          onPress={save}
          style={styles.cta}
        />
        {exists && (
          <Pressable accessibilityRole="button" disabled={busy} onPress={destroy} style={{ marginTop: 14, alignSelf: 'center' }}>
            <T w="bold" style={{ fontSize: 14, color: confirmDelete ? colors.alert : colors.textDim, textAlign: 'center' }}>
              {confirmDelete ? 'متأكد؟ الغرفة بتنحذف مع المشرفين. اضغط كمان مرة' : 'حذف الغرفة'}
            </T>
          </Pressable>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 12, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  h1: { fontSize: 30, lineHeight: 40 },
  cover: { marginTop: 8, alignItems: 'center', gap: 8 },
  coverBox: {
    width: 120,
    height: 120,
    borderRadius: 34,
    backgroundColor: colors.coral,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  coverBlob: {
    position: 'absolute',
    end: -30,
    bottom: -50,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: colors.coralLight,
  },
  block: { marginTop: 20, marginHorizontal: 20 },
  card: { padding: 16, borderRadius: 24, backgroundColor: colors.surface, gap: 12 },
  label: { marginBottom: 8, fontSize: 16 },
  input: {
    height: 56,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: colors.surfaceHigh,
    borderRadius: 18,
    backgroundColor: colors.surface,
    color: colors.white,
    fontFamily: fonts.bold,
    fontSize: 18,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  preset: {
    width: 54,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { height: 40, paddingHorizontal: 18, borderRadius: 20, backgroundColor: colors.surface, justifyContent: 'center' },
  addBtn: { height: 48, paddingHorizontal: 20, borderRadius: 18, backgroundColor: colors.yellow, alignItems: 'center', justifyContent: 'center' },
  admin: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  removeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  err: { marginTop: 12, marginHorizontal: 20, textAlign: 'center', fontSize: 13, color: colors.peach },
  cta: { marginTop: 'auto', marginHorizontal: 20, marginBottom: 8, paddingTop: 0 },
});
