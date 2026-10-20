import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { supabase } from './supabase';

// كل مستوى بدّه 100 XP أكتر من اللي قبله: 2 بـ 100، 3 بـ 300، 4 بـ 600...
const startOf = (level: number) => 50 * level * (level - 1);

export function xpLevel(xp: number) {
  let level = 1;
  while (startOf(level + 1) <= xp) level++;
  return { level, into: xp - startOf(level), need: level * 100 };
}

export const LEVEL_TITLES: [number, string][] = [
  [1, 'مبتدئ'],
  [5, 'لاعب'],
  [10, 'محترف'],
  [20, 'خبير'],
  [30, 'أسطورة'],
];

export function levelTitle(level: number) {
  return LEVEL_TITLES.filter(([min]) => level >= min).at(-1)![1];
}

// الـ XP بيزيد من الألعاب والهدايا على السيرفر، فمنجيبه كل ما تنفتح الصفحة
export function useXp(uid: string | null) {
  const [xp, setXp] = useState<number | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!uid) return;
      supabase
        .from('profiles')
        .select('xp')
        .eq('id', uid)
        .single<{ xp: number }>()
        .then(({ data }) => data && setXp(data.xp));
    }, [uid]),
  );
  return xp;
}
