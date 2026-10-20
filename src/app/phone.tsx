import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ChevronDownIcon, PhoneIcon } from '@/components/Icons';
import { BackButton, PillButton, Screen, T } from '@/components/ui';
import { colors, fonts } from '@/theme';

const COUNTRIES = [
  { code: '+965', flag: '🇰🇼', name: 'الكويت', len: 8 },
  { code: '+966', flag: '🇸🇦', name: 'السعودية', len: 9 },
  { code: '+971', flag: '🇦🇪', name: 'الإمارات', len: 9 },
  { code: '+974', flag: '🇶🇦', name: 'قطر', len: 8 },
  { code: '+973', flag: '🇧🇭', name: 'البحرين', len: 8 },
  { code: '+968', flag: '🇴🇲', name: 'عُمان', len: 8 },
] as const;

export default function Phone() {
  const [country, setCountry] = useState<(typeof COUNTRIES)[number]>(COUNTRIES[0]);
  const [open, setOpen] = useState(false);
  const [number, setNumber] = useState('');
  const digits = number.replace(/\D/g, '');
  const valid = digits.length >= country.len;

  const send = () => {
    // TODO(Supabase): إرسال كود SMS حقيقي
    router.push({ pathname: '/otp', params: { phone: `${country.code} ${digits}` } });
  };

  return (
    <Screen>
      <View style={styles.header}>
        <BackButton />
      </View>

      <View style={styles.intro}>
        <View style={styles.badge}>
          <PhoneIcon size={36} color={colors.yellow} />
        </View>
        <T w="heading" style={styles.h1}>رقم جوالك</T>
        <T style={styles.lead}>رح نبعتلك كود من 6 أرقام بالرسائل عشان نتأكد إنه رقمك.</T>
      </View>

      <View style={styles.field}>
        <T w="black" style={styles.label} nativeID="phoneLabel">رقم الجوال</T>
        {/* الرقم يُكتب من اليسار لليمين */}
        <View style={styles.row}>
          <TextInput
            accessibilityLabelledBy="phoneLabel"
            value={number}
            onChangeText={setNumber}
            keyboardType="phone-pad"
            placeholder="5XXX XXXX"
            placeholderTextColor={colors.placeholder}
            autoFocus
            maxLength={12}
            style={styles.input}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="اختيار الدولة"
            onPress={() => setOpen((o) => !o)}
            style={styles.country}>
            <ChevronDownIcon />
            <T w="black" style={styles.code}>{country.code}</T>
            <T style={{ fontSize: 22 }}>{country.flag}</T>
          </Pressable>
        </View>

        {open && (
          <View style={styles.list}>
            {COUNTRIES.map((c) => (
              <Pressable
                key={c.code}
                accessibilityRole="button"
                onPress={() => {
                  setCountry(c);
                  setOpen(false);
                }}
                style={[styles.item, c.code === country.code && { backgroundColor: colors.surfaceHigh }]}>
                <T style={{ fontSize: 20 }}>{c.flag}</T>
                <T w="bold" style={{ flex: 1, fontSize: 16 }}>{c.name}</T>
                <T w="bold" style={{ fontSize: 15, color: colors.textDim }}>{c.code}</T>
              </Pressable>
            ))}
          </View>
        )}
        <T style={styles.hint}>الكويت، السعودية، الإمارات، قطر، البحرين، عُمان</T>
      </View>

      <PillButton label="أرسل الكود" disabled={!valid} onPress={send} style={styles.cta} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 12, flexDirection: 'row' },
  intro: { marginTop: 16, marginHorizontal: 24, gap: 10, alignItems: 'flex-start' },
  badge: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  h1: { marginTop: 10, fontSize: 32, lineHeight: 42 },
  lead: { fontSize: 16, lineHeight: 26, color: colors.textMuted },
  field: { marginTop: 28, marginHorizontal: 24 },
  label: { marginBottom: 8, fontSize: 15 },
  // نثبت الاتجاه من اليسار لليمين عشان يطلع +965 قبل الرقم
  row: { direction: 'ltr', flexDirection: 'row-reverse', gap: 10, height: 60 },
  country: {
    height: 60,
    paddingHorizontal: 12,
    borderWidth: 2,
    borderColor: colors.surfaceHigh,
    borderRadius: 18,
    backgroundColor: colors.surface,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  code: { fontSize: 17 },
  input: {
    flex: 1,
    minWidth: 0,
    height: 60,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: colors.yellow,
    borderRadius: 18,
    backgroundColor: colors.surface,
    color: colors.white,
    fontFamily: fonts.black,
    fontSize: 22,
    letterSpacing: 1,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  list: { marginTop: 8, borderRadius: 18, backgroundColor: colors.surface, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, height: 52 },
  hint: { marginTop: 10, fontSize: 13, color: colors.textDim },
  cta: { marginTop: 'auto', marginHorizontal: 24, marginBottom: 24, height: 58 },
});
