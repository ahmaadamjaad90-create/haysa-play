import { supabase } from './supabase';

export type RoomRow = {
  owner: string;
  number: number;
  name: string;
  seats: number;
  category: string;
  profiles: { name: string | null; avatar: string } | null;
};

export type RoomStats = Record<string, { listeners: number; onMic: number }>;

export const CATEGORIES = ['سوالف', 'ألعاب', 'أغاني', 'شعر', 'عائلة', 'هزار'];
export const SEAT_PRESETS = [2, 4, 8, 12, 16];

const SELECT = 'owner, number, name, seats, category, profiles(name, avatar)';

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

// تذكرة الدخول لصوت LiveKit من الدالة على Supabase
export async function getVoiceToken(number: number): Promise<{ token: string; url: string; isOwner: boolean }> {
  const { data, error } = await supabase.functions.invoke('livekit', { body: { action: 'token', room: number } });
  if (error) throw error;
  return data;
}

// كم واحد بكل غرفة شغّالة هلأ (مفتاحها رقم الغرفة)
export async function getRoomStats(): Promise<RoomStats> {
  const { data, error } = await supabase.functions.invoke('livekit', { body: { action: 'stats' } });
  if (error) throw error;
  return data as RoomStats;
}
