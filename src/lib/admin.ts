import { supabase } from './supabase';

// أدوات أدمن التطبيق (السيرفر بيتأكد إنك أدمن بكل وحدة)
const rpc = async <T>(fn: string, args?: Record<string, unknown>) => {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data as T;
};

export type AdminStats = {
  players: number;
  new_today: number;
  rooms: number;
  banned: number;
  baloot_today: number;
  gifts_today: number;
};

export type AdminPlayer = {
  pid: number;
  name: string | null;
  avatar: string;
  coins: number;
  gems: number;
  xp: number;
  vip_points: number;
  banned_until: string | null;
  is_admin: boolean;
  created_at: string;
  has_room: boolean;
};

export const adminStats = () => rpc<AdminStats>('admin_stats');
export const adminPlayer = (pid: number) => rpc<AdminPlayer>('admin_player', { pid });
// days = null: حظر دايم
export const adminBan = (pid: number, days: number | null) => rpc<void>('admin_ban', { pid, days });
export const adminUnban = (pid: number) => rpc<void>('admin_unban', { pid });
export const adminGrant = (pid: number, coins: number, gems: number) =>
  rpc<{ name: string | null; coins: number; gems: number }>('admin_grant', { pid, add_coins: coins, add_gems: gems });
export const adminDeleteRoom = (num: number) => rpc<void>('admin_delete_room', { num });

export const isBanned = (until: string | null) => !!until && (until === 'infinity' || Date.parse(until) > Date.now());
