import { useEffect, useState } from 'react';

import { supabase } from './supabase';

export type GiftCategory = 'popular' | 'gulf' | 'luxury' | 'occasions' | 'vip';

export type Gift = {
  key: string;
  name: string;
  emoji: string;
  currency: 'coins' | 'gems';
  price: number;
  announce: boolean;
  category: GiftCategory;
};

export type GiftEvent = {
  id: number;
  room_number: number;
  room_name: string;
  sender_name: string;
  recipient_name: string;
  gift_key: string;
  gift_name: string;
  gift_emoji: string;
  qty: number;
  announce: boolean;
  created_at: string;
};

export const CATEGORIES: { key: GiftCategory; label: string }[] = [
  { key: 'popular', label: 'شعبيات' },
  { key: 'gulf', label: 'خليجية' },
  { key: 'luxury', label: 'فخمة' },
  { key: 'occasions', label: 'مناسبات' },
  { key: 'vip', label: 'VIP' },
];

// القائمة بتنقرا من قاعدة البيانات (gift_catalog) مرة وحدة وبتنحفظ
let cache: Gift[] | null = null;

export async function loadGifts(): Promise<Gift[]> {
  if (cache) return cache;
  const { data, error } = await supabase
    .from('gift_catalog')
    .select('key, name, emoji, currency, price, announce, category')
    .order('category')
    .order('sort');
  if (error) throw error;
  cache = data as Gift[];
  return cache;
}

export function useGifts() {
  const [gifts, setGifts] = useState<Gift[]>(cache ?? []);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    if (cache) return;
    loadGifts().then(setGifts).catch(setError);
  }, []);
  return { gifts, error };
}

export async function sendGift(room: number, gift: string, qty: number, recipients: number[]) {
  const { data, error } = await supabase.rpc('send_gift', { room, gift, qty, recipients });
  if (error) throw error;
  return (data as { coins: number; gems: number }[])[0];
}

// آخر هدية كبيرة (الأسد وفوق) بآخر 24 ساعة، لشريط الرئيسية
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
