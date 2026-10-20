import { useCallback, useEffect, useRef, useState } from 'react';

import { supabase } from './supabase';

export type MafiaRole = 'mafia' | 'doctor' | 'cop' | 'citizen';

export const ROLES: Record<MafiaRole, { name: string; emoji: string; color: string; job: string }> = {
  mafia: { name: 'مافيا', emoji: '🔪', color: '#D9381E', job: 'كل ليلة إنت وجماعتك بتختاروا مين تطلّعوا من اللعبة. لا تنكشف بالنهار!' },
  doctor: { name: 'دكتور', emoji: '💉', color: '#2FB760', job: 'كل ليلة بتختار واحد تحميه، وإذا المافيا اختارته بيعيش.' },
  cop: { name: 'شرطي', emoji: '👮', color: '#4FC3F7', job: 'كل ليلة بتفحص واحد وبتعرف إذا هو مافيا أو لا.' },
  citizen: { name: 'مواطن', emoji: '👤', color: '#CBB8F0', job: 'نام بالليل، وبالنهار اسمع منيح وصوّت على اللي بتشك فيه.' },
};

export type MafiaPlayer = {
  key: string;
  uid: string | null;
  pid: number | null;
  name: string;
  avatar: string;
  bot: boolean;
  alive: boolean;
  left: boolean;
  role?: MafiaRole;
};

export type MafiaGame = {
  id: number;
  host: string | null;
  status: 'waiting' | 'playing' | 'finished';
  players: MafiaPlayer[];
  phase: 'night' | 'morning' | 'day' | 'vote' | 'verdict' | null;
  day: number;
  votes: Record<string, string>;
  last: { killed?: string | null; saved?: boolean; out?: string | null; role?: MafiaRole } | null;
  winner: 'town' | 'mafia' | null;
  roles: Record<string, MafiaRole> | null;
  deadline: string | null;
  updated_at: string;
};

export type MafiaInfo = {
  key: string;
  role: MafiaRole;
  team: string[] | null;
  picks: Record<string, string> | null;
  my_pick: string | null;
  checks: { target: string; is_mafia: boolean; night: number }[] | null;
};

export type MafiaChat = { id: string; uid: string; name: string; text: string };

const rpc = async <T>(fn: string, args?: Record<string, unknown>) => {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data as T;
};

export const createMafia = () => rpc<number>('mafia_create');
export const joinMafia = (id: number) => rpc<MafiaGame>('mafia_join', { gid: id });
export const addMafiaBot = (id: number) => rpc<MafiaGame>('mafia_add_bot', { gid: id });
export const startMafia = (id: number) => rpc<MafiaGame>('mafia_start', { gid: id });
export const mafiaInfo = (id: number) => rpc<MafiaInfo | null>('mafia_info', { gid: id });
export const nightAct = (id: number, target: string) => rpc<MafiaGame>('mafia_act', { gid: id, target });
export const callMafiaVote = (id: number) => rpc<MafiaGame>('mafia_call_vote', { gid: id });
export const mafiaVote = (id: number, target: string) => rpc<MafiaGame>('mafia_vote', { gid: id, target });
export const tickMafia = (id: number) => rpc<MafiaGame>('mafia_tick', { gid: id });
export const leaveMafia = (id: number) => rpc<void>('mafia_leave', { gid: id });

// لحالك مع ٦ كمبيوتر
export async function playMafiaVsBots() {
  const id = await createMafia();
  for (let i = 0; i < 6; i++) await addMafiaBot(id);
  await startMafia(id);
  return id;
}

export async function listWaitingMafia(): Promise<MafiaGame[]> {
  const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('mafia_games')
    .select('*')
    .eq('status', 'waiting')
    .gte('updated_at', since)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data as MafiaGame[];
}

export async function myMafiaResult(id: number, uid: string) {
  const { data } = await supabase
    .from('mafia_results')
    .select('won, role, coins, xp')
    .eq('game_id', id)
    .eq('user_id', uid)
    .maybeSingle<{ won: boolean; role: MafiaRole; coins: number; xp: number }>();
  return data;
}

// الطاولة لحظياً + شات النهار
export function useMafiaGame(id: number, me: { uid: string | null; name: string }) {
  const [game, setGame] = useState<MafiaGame | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [chat, setChat] = useState<MafiaChat[]>([]);
  const channel = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    let alive = true;
    supabase
      .from('mafia_games')
      .select('*')
      .eq('id', id)
      .single<MafiaGame>()
      .then(({ data, error: e }) => {
        if (!alive) return;
        if (e) setError(e);
        else setGame(data);
      });
    const ch = supabase
      .channel(`mafia-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'mafia_games', filter: `id=eq.${id}` }, (p) =>
        setGame((old) => newer(old, p.new as MafiaGame)),
      )
      .on('broadcast', { event: 'msg' }, ({ payload }) => setChat((c) => [...c.slice(-60), payload as MafiaChat]))
      .subscribe();
    channel.current = ch;
    return () => {
      alive = false;
      supabase.removeChannel(ch);
    };
  }, [id]);

  const apply = useCallback((g: MafiaGame | void) => {
    if (g && typeof g === 'object') setGame((old) => newer(old, g));
  }, []);

  const say = useCallback(
    (text: string) => {
      if (!me.uid || !text.trim() || !channel.current) return;
      const line: MafiaChat = { id: `${Date.now()}-${Math.random()}`, uid: me.uid, name: me.name, text: text.trim().slice(0, 200) };
      setChat((c) => [...c.slice(-60), line]);
      channel.current.send({ type: 'broadcast', event: 'msg', payload: line });
    },
    [me.uid, me.name],
  );

  return { game, error, apply, chat, say };
}

function newer(old: MafiaGame | null, g: MafiaGame) {
  if (old && Date.parse(old.updated_at) > Date.parse(g.updated_at)) return old;
  return g;
}
