import { supabase } from './supabase';

export type Gift = {
  key: string;
  name: string;
  emoji: string;
  currency: 'coins' | 'gems';
  price: number;
  announce: boolean;
};

export type GiftEvent = {
  id: number;
  room_number: number;
  room_name: string;
  sender_name: string;
  recipient_name: string;
  gift_key: string;
  qty: number;
  announce: boolean;
  created_at: string;
};

// نفس القائمة اللي بقاعدة البيانات (gift_catalog). السيرفر هو اللي بيحسب السعر.
export const GIFTS: Gift[] = [
  { key: 'rose', name: 'وردة', emoji: '🌹', currency: 'coins', price: 10, announce: false },
  { key: 'coffee', name: 'فنجان قهوة', emoji: '☕', currency: 'coins', price: 20, announce: false },
  { key: 'clap', name: 'تصفيق', emoji: '👏', currency: 'coins', price: 30, announce: false },
  { key: 'sweets', name: 'حلاوة', emoji: '🍬', currency: 'coins', price: 50, announce: false },
  { key: 'haysa', name: 'هيصة', emoji: '🎉', currency: 'coins', price: 100, announce: false },
  { key: 'ring', name: 'خاتم', emoji: '💍', currency: 'gems', price: 200, announce: false },
  { key: 'crown', name: 'تاج', emoji: '👑', currency: 'gems', price: 500, announce: false },
  { key: 'camel', name: 'ناقة', emoji: '🐪', currency: 'gems', price: 1000, announce: false },
  { key: 'falcon', name: 'صقر', emoji: '🦅', currency: 'gems', price: 2500, announce: false },
  { key: 'lion', name: 'أسد', emoji: '🦁', currency: 'gems', price: 5000, announce: true },
  { key: 'car', name: 'سيارة', emoji: '🏎️', currency: 'gems', price: 10000, announce: true },
  { key: 'yacht', name: 'يخت', emoji: '🛥️', currency: 'gems', price: 20000, announce: true },
  { key: 'palace', name: 'قصر', emoji: '🏰', currency: 'gems', price: 50000, announce: true },
];

export const giftByKey = (key: string) => GIFTS.find((g) => g.key === key);

export async function sendGift(room: number, gift: string, qty: number, recipients: number[]) {
  const { data, error } = await supabase.rpc('send_gift', { room, gift, qty, recipients });
  if (error) throw error;
  return (data as { coins: number; gems: number }[])[0];
}

// آخر هدية كبيرة (الأسد وفوق) بآخر ٢٤ ساعة، لشريط الرئيسية
export async function latestAnnouncement(): Promise<GiftEvent | null> {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data, error } = await supabase
    .from('gift_events')
    .select('*')
    .eq('announce', true)
    .gte('created_at', since)
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle<GiftEvent>();
  if (error) throw error;
  return data;
}
