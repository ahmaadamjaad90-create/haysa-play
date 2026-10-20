import { useCallback, useEffect, useState } from 'react';

import { supabase } from './supabase';

export type TriviaCategory = 'mix' | 'general' | 'gulf' | 'sports' | 'proverbs' | 'truefalse';

export const CATEGORIES: { key: TriviaCategory; label: string; emoji: string }[] = [
  { key: 'mix', label: 'منوّعة', emoji: '🎲' },
  { key: 'general', label: 'معلومات عامة', emoji: '🌍' },
  { key: 'gulf', label: 'الخليج', emoji: '🐪' },
  { key: 'sports', label: 'رياضة', emoji: '⚽' },
  { key: 'proverbs', label: 'أكمل المثل', emoji: '📜' },
  { key: 'truefalse', label: 'صح أو خطأ', emoji: '✅' },
];

export type TriviaPlayer = {
  uid: string | null;
  pid: number | null;
  name: string;
  avatar: string;
  bot: boolean;
  left: boolean;
  score: number;
};

export type TriviaGame = {
  id: number;
  host: string | null;
  status: 'waiting' | 'playing' | 'finished';
  category: TriviaCategory;
  players: TriviaPlayer[];
  round: number;
  total: number;
  phase: 'question' | 'reveal' | null;
  question: { text: string; options: string[]; category: TriviaCategory } | null;
  answered: string[];
  reveal: { answer: number; gains: Record<string, number>; picks: Record<string, number> } | null;
  deadline: string | null;
  winner: string | null;
  updated_at: string;
};

// مفتاح اللاعب (نفس السيرفر)
export const playerKey = (p: TriviaPlayer, i: number) => p.uid ?? `bot-${i}`;

const rpc = async <T>(fn: string, args?: Record<string, unknown>) => {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data as T;
};

export const createTrivia = (cat: TriviaCategory) => rpc<number>('trivia_create', { cat });
export const joinTrivia = (id: number) => rpc<TriviaGame>('trivia_join', { gid: id });
export const addTriviaBot = (id: number) => rpc<TriviaGame>('trivia_add_bot', { gid: id });
export const startTrivia = (id: number) => rpc<TriviaGame>('trivia_start', { gid: id });
export const answerTrivia = (id: number, choice: number) => rpc<TriviaGame>('trivia_answer', { gid: id, choice });
export const tickTrivia = (id: number) => rpc<TriviaGame>('trivia_tick', { gid: id });
export const leaveTrivia = (id: number) => rpc<void>('trivia_leave', { gid: id });

// لحالك ضد 3 كمبيوتر
export async function playTriviaVsBots(cat: TriviaCategory) {
  const id = await createTrivia(cat);
  for (let i = 0; i < 3; i++) await addTriviaBot(id);
  await startTrivia(id);
  return id;
}

export async function listWaitingTrivia(): Promise<TriviaGame[]> {
  const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('trivia_games')
    .select('*')
    .eq('status', 'waiting')
    .gte('updated_at', since)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data as TriviaGame[];
}

export async function myTriviaResult(id: number, uid: string) {
  const { data } = await supabase
    .from('trivia_results')
    .select('won, score, coins, xp')
    .eq('game_id', id)
    .eq('user_id', uid)
    .maybeSingle<{ won: boolean; score: number; coins: number; xp: number }>();
  return data;
}

export function useTriviaGame(id: number) {
  const [game, setGame] = useState<TriviaGame | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let alive = true;
    supabase
      .from('trivia_games')
      .select('*')
      .eq('id', id)
      .single<TriviaGame>()
      .then(({ data, error: e }) => {
        if (!alive) return;
        if (e) setError(e);
        else setGame(data);
      });
    const ch = supabase
      .channel(`trivia-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'trivia_games', filter: `id=eq.${id}` }, (p) =>
        setGame((old) => newer(old, p.new as TriviaGame)),
      )
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(ch);
    };
  }, [id]);

  const apply = useCallback((g: TriviaGame | void) => {
    if (g && typeof g === 'object') setGame((old) => newer(old, g));
  }, []);

  return { game, error, apply };
}

function newer(old: TriviaGame | null, g: TriviaGame) {
  if (old && Date.parse(old.updated_at) > Date.parse(g.updated_at)) return old;
  return g;
}
