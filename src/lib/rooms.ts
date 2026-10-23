import { supabase } from './supabase';

export type RoomRow = {
  owner: string;
  number: number;
  name: string;
  seats: number;
  category: string;
  profiles: { name: string | null; avatar: string } | null;
  // اللعبة المفتوحة بالغرفة هلأ
  game: RoomGame | null;
};

export type RoomGame = { game: string; id: number; by: string };
export type RoomAdmin = { uid: string; pid: number; name: string | null; avatar: string };

export type RoomStats = Record<string, { listeners: number; onMic: number }>;

export const CATEGORIES = ['سوالف', 'ألعاب', 'أغاني', 'شعر', 'عائلة', 'هزار'];
export const SEAT_PRESETS = [2, 4, 8, 12, 16];

const SELECT = 'owner, number, name, seats, category, game, profiles(name, avatar)';

export async function listRooms(): Promise<RoomRow[]> {
  const { data, error } = await supabase.from('rooms').select(SELECT).order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  return data as unknown as RoomRow[];
}

export async function getRoom(number: number): Promise<RoomRow | null> {
  const { data, error } = await supabase.from('rooms').select(SELECT).eq('number', number).maybeSingle();
  if (error) throw error;
  return data as unknown as RoomRow | null;
}

export async function getMyRoom(uid: string): Promise<RoomRow | null> {
  const { data, error } = await supabase.from('rooms').select(SELECT).eq('owner', uid).maybeSingle();
  if (error) throw error;
  return data as unknown as RoomRow | null;
}

export async function saveMyRoom(exists: boolean, uid: string, room: { name: string; seats: number; category: string }) {
  const q = exists ? supabase.from('rooms').update(room).eq('owner', uid) : supabase.from('rooms').insert(room);
  const { error } = await q;
  if (error) throw error;
}

export async function deleteMyRoom(uid: string) {
  const { error } = await supabase.from('rooms').delete().eq('owner', uid);
  if (error) throw error;
}

// الدالة بترجّع سبب الخطأ بالـ body (متل banned)، فمنقراه بدل الرسالة العامة
async function invokeLivekit<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('livekit', { body });
  if (error) {
    const res = (error as { context?: Response }).context;
    const detail = await res?.json?.().catch(() => null);
    throw new Error(detail?.error ?? error.message);
  }
  return data as T;
}

// تذكرة الدخول لصوت LiveKit من الدالة على Supabase
export const getVoiceToken = (number: number) =>
  invokeLivekit<{ token: string; url: string; isOwner: boolean }>({ action: 'token', room: number });

// المشرف: كتم أو تنزيل عن المقعد أو طرد
export const modAction = (room: number, identity: string, op: 'mute' | 'unseat' | 'kick') =>
  invokeLivekit<{ ok: true }>({ action: 'mod', room, identity, op });

export async function listAdmins(owner: string): Promise<RoomAdmin[]> {
  const { data, error } = await supabase
    .from('room_admins')
    .select('user_id, profiles(public_id, name, avatar)')
    .eq('room_owner', owner)
    .order('created_at');
  if (error) throw error;
  type Row = { user_id: string; profiles: { public_id: number; name: string | null; avatar: string } | null };
  return (data as unknown as Row[]).map((r) => ({
    uid: r.user_id,
    pid: r.profiles?.public_id ?? 0,
    name: r.profiles?.name ?? null,
    avatar: r.profiles?.avatar ?? 'dalla',
  }));
}

export async function addAdmin(pid: number) {
  const { error } = await supabase.rpc('room_add_admin', { pid });
  if (error) throw error;
}

export async function removeAdmin(pid: number) {
  const { error } = await supabase.rpc('room_remove_admin', { pid });
  if (error) throw error;
}

export async function setRoomGame(num: number, game: { game: string; id: number } | null) {
  const { error } = await supabase.rpc('room_set_game', { num, g: game });
  if (error) throw error;
}

// كم واحد بكل غرفة شغّالة هلأ (مفتاحها رقم الغرفة)
export async function getRoomStats(): Promise<RoomStats> {
  const { data, error } = await supabase.functions.invoke('livekit', { body: { action: 'stats' } });
  if (error) throw error;
  return data as RoomStats;
}
