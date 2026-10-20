import { ScrollView, StyleSheet, View } from 'react-native';

import { BackButton, Screen, T } from '@/components/ui';
import { colors } from '@/theme';

export type LegalSection = { title: string; body: string[] };

// صفحة نصوص قانونية (الخصوصية والشروط): عربي، وبعده نسخة إنجليزية لمراجعة المتاجر
export function LegalPage({
  title,
  updated,
  ar,
  en,
}: {
  title: string;
  updated: string;
  ar: LegalSection[];
  en: { title: string; sections: LegalSection[] };
}) {
  return (
    <Screen>
      <View style={styles.header}>
        <BackButton fallback="/login" />
        <T w="heading" style={styles.h1}>{title}</T>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <T style={styles.updated}>آخر تحديث: {updated}</T>
        {ar.filter((s) => s.body.length).map((s) => (
          <Section key={s.title} s={s} />
        ))}
        <View style={styles.divider} />
        <View style={{ direction: 'ltr', gap: 14 }}>
          <T w="heading" style={[styles.h2, styles.ltr]}>{en.title}</T>
          {en.sections.filter((s) => s.body.length).map((s) => (
            <Section key={s.title} s={s} ltr />
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

function Section({ s, ltr }: { s: LegalSection; ltr?: boolean }) {
  return (
    <View style={{ gap: 6 }}>
      <T w="black" style={[{ fontSize: 17, color: colors.yellow }, ltr && styles.ltr]}>{s.title}</T>
      {s.body.map((p, i) => (
        <T key={i} style={[styles.p, ltr && styles.ltr]}>{p}</T>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 12, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  h1: { fontSize: 28, lineHeight: 38 },
  h2: { fontSize: 22, lineHeight: 30 },
  body: { padding: 20, paddingBottom: 40, gap: 14 },
  updated: { fontSize: 13, color: colors.textDim },
  p: { fontSize: 15, lineHeight: 25, color: colors.textSoft },
  ltr: { writingDirection: 'ltr', textAlign: 'left' },
  divider: { height: 1, marginVertical: 10, backgroundColor: colors.surfaceHigh },
});
