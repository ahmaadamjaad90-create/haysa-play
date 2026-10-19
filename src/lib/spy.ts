import { useCallback, useEffect, useRef, useState } from 'react';

import { supabase } from './supabase';

export type SpyPlayer = { uid: string; pid: number; name: string; avatar: string; left: boolean };

export type SpyGame = {
  id: number;
  host: string | null;
  status: 'waiting' | 'playing' | 'voting' | 'guessing' | 'finished';
  players: SpyPlayer[];
  first_asker: string | null;
  deadline: string | null;
  votes: Record<string, string>;
  accused: string | null;
  winner: 'spy' | 'players' | null;
  reveal: {
    spy: string;
    location: string;
    name: string;
    emoji: string;
    reason: 'guessed' | 'bad_guess' | 'tie' | 'wrong' | 'no_guess' | 'spy_left' | 'too_few';
    guess?: string;
  } | null;
  updated_at: string;
};

export type SpyLocation = { key: string; name: string; emoji: string };
// location فاضي = إنت الجاسوس
export type SpyCard = { location: string | null; role: string | null };

const rpc = async <T>(fn: string, args?: Record<string, unknown>) => {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data as T;
};

export const createSpy = () => rpc<number>('spy_create');
export const joinSpy = (id: number) => rpc<SpyGame>('spy_join', { gid: id });
export const startSpy = (id: number) => rpc<SpyGame>('spy_start', { gid: id });
export const callVote = (id: number) => rpc<SpyGame>('spy_call_vote', { gid: id });
export const vote = (id: number, target: string) => rpc<SpyGame>('spy_vote', { gid: id, target });
export const guessLocation = (id: number, loc: string) => rpc<SpyGame>('spy_guess', { gid: id, loc });
export const tickSpy = (id: number) => rpc<SpyGame>('spy_tick', { gid: id });
export const leaveSpy = (id: number) => rpc<void>('spy_leave', { gid: id });

let locations: SpyLocation[] | null = null;
export async function loadLocations() {
  if (locations) return locations;
  const { data, error } = await supabase.from('spy_locations').select('key, name, emoji').order('name');
  if (error) throw error;
  locations = data as SpyLocation[];
  return locations;
}

export async function loadCard(id: number, uid: string): Promise<SpyCard | null> {
  const { data } = await supabase
    .from('spy_cards')
    .select('location, role')
    .eq('game_id', id)
    .eq('user_id', uid)
    .maybeSingle<SpyCard>();
  return data;
}

export async function listWaitingSpy(): Promise<SpyGame[]> {
  const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('spy_games')
    .select('*')
    .eq('status', 'waiting')
    .gte('updated_at', since)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data as SpyGame[];
}

export async function mySpyResult(id: number, uid: string) {
  const { data } = await supabase
    .from('spy_results')
    .select('won, coins, xp')
    .eq('game_id', id)
    .eq('user_id', uid)
    .maybeSingle<{ won: boolean; coins: number; xp: number }>();
  return data;
}

export type SpyChatLine = { id: string; uid: string; name: string; text: string };

// الطاولة لحظياً + شات الأسئلة (رسائل مؤقتة ما بتنحفظ)
export function useSpyGame(id: number, me: { uid: string | null; name: string }) {
  const [game, setGame] = useState<SpyGame | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [chat, setChat] = useState<SpyChatLine[]>([]);
  const channel = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    let alive = true;
    supabase
      .from('spy_games')
      .select('*')
      .eq('id', id)
      .single<SpyGame>()
      .then(({ data, error: e }) => {
        if (!alive) return;
        if (e) setError(e);
        else setGame(data);
      });
    const ch = supabase
      .channel(`spy-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'spy_games', filter: `id=eq.${id}` }, (p) =>
        setGame((old) => newer(old, p.new as SpyGame)),
      )
      .on('broadcast', { event: 'chat' }, ({ payload }) => setChat((c) => [...c.slice(-80), payload as SpyChatLine]))
      .subscribe();
    channel.current = ch;
    return () => {
      alive = false;
      supabase.removeChannel(ch);
    };
  }, [id]);

  const apply = useCallback((g: SpyGame | void) => {
    if (g && typeof g === 'object') setGame((old) => newer(old, g));
  }, []);

  const send = useCallback(
    (text: string) => {
      if (!channel.current || !me.uid || !text.trim()) return;
      const line: SpyChatLine = { id: `${Date.now()}-${Math.random()}`, uid: me.uid, name: me.name, text: text.trim().slice(0, 200) };
      setChat((c) => [...c.slice(-80), line]);
      channel.current.send({ type: 'broadcast', event: 'chat', payload: line });
    },
    [me.uid, me.name],
  );

  return { game, error, apply, chat, send };
}

function newer(old: SpyGame | null, g: SpyGame) {
  if (old && Date.parse(old.updated_at) > Date.parse(g.updated_at)) return old;
  return g;
}
