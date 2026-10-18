import { StyleSheet, View } from 'react-native';

import { Dalla } from './Dalla';
import { Screen, T } from './ui';
import { colors } from '@/theme';

export function ComingSoon({ title, note }: { title: string; note: string }) {
  return (
    <Screen>
      <View style={styles.wrap}>
        <Dalla width={130} />
        <T w="heading" style={styles.title}>{title}</T>
        <T style={styles.note}>{note}</T>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 8 },
  title: { marginTop: 12, fontSize: 32, lineHeight: 42 },
  note: { fontSize: 16, lineHeight: 26, color: colors.textMuted, textAlign: 'center' },
});
