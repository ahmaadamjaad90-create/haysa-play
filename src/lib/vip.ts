import { supabase } from './supabase';

export type Tier = 'bronze' | 'silver' | 'gold' | 'diamond' | 'royal';

export type VipLevel = {
  level: number;
  tier: Tier;
  step: number;
  points: number;
  reward_coins: number;
  perk: string;
};

// اسم كل فئة ولونها (الإطار والنص)
export const TIERS: Record<Tier, { name: string; color: string; ring: string; text: string }> = {
  bronze: { name: 'برونزي', color: '#C8794A', ring: '#8A4E2C', text: '#E7A57C' },
  silver: { name: 'فضي', color: '#D7DCE6', ring: '#8F96A8', text: '#E4E8F0' },
  gold: { name: 'ذهبي', color: '#FFC93C', ring: '#B8860B', text: '#FFC93C' },
  diamond: { name: 'ماسي', color: '#5EE1FF', ring: '#1E8FB0', text: '#9BEEFF' },
  royal: { name: 'ملكي', color: '#FF5A3C', ring: '#FFC93C', text: '#FF8A6B' },
};

export const TIER_ORDER: Tier[] = ['bronze', 'silver', 'gold', 'diamond', 'royal'];

// هدايا قسم VIP بتفتح من الذهبي 1 (VIP 9)
export const VIP_GIFTS_LEVEL = 9;

// نقاط كل يوم بالسلسلة (يوم 1 لـ 7)
export const DAILY_POINTS = [10, 15, 20, 25, 30, 40, 50];

// نفس جدول vip_levels بالسيرفر، عشان المستوى يبين بدون ما نستنى
export const LEVEL_POINTS = [
  100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5500, 11000, 22000, 44000, 88000, 175000, 350000,
  700000, 1400000, 3000000,
];

export function levelOf(points: number) {
  let lvl = 0;
  while (lvl < LEVEL_POINTS.length && points >= LEVEL_POINTS[lvl]) lvl++;
  return lvl;
}

export function tierOf(level: number): Tier | null {
  if (level < 1) return null;
  return TIER_ORDER[Math.min(Math.floor((level - 1) / 4), 4)];
}

export type DailyState = { streak: number; lastClaim: string | null };

export type VipState = {
  levels: VipLevel[];
  claimed: Set<number>;
  daily: DailyState;
  // آخر رصيد من السيرفر (ممكن يكون تغيّر من جهاز تاني)
  points: number;
};

// اليوم بتوقيت الخليج (متل السيرفر)
export function gulfToday() {
  return new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);
}

function dayBefore(day: string) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function canClaimDaily(d: DailyState) {
  return d.lastClaim !== gulfToday();
}

// يوم السلسلة الجاي (1 لـ 7)
export function nextStreakDay(d: DailyState) {
  if (d.lastClaim === gulfToday()) return d.streak;
  return d.lastClaim === dayBefore(gulfToday()) ? (d.streak % 7) + 1 : 1;
}

// صندوق اليوم حسب المستوى (نفس vip_daily_box بالسيرفر)
export function dailyBox(level: number) {
  if (level >= 17) return { coins: 1500, gems: 150 };
  if (level >= 13) return { coins: 800, gems: 80 };
  if (level >= 9) return { coins: 400, gems: 40 };
  if (level >= 5) return { coins: 200, gems: 20 };
  if (level >= 1) return { coins: 100, gems: 5 };
  return { coins: 50, gems: 0 };
}

export async function loadDaily(uid: string): Promise<DailyState> {
  const { data, error } = await supabase
    .from('vip_daily')
    .select('streak, last_claim')
    .eq('user_id', uid)
    .maybeSingle<{ streak: number; last_claim: string | null }>();
  if (error) throw error;
  return { streak: data?.streak ?? 0, lastClaim: data?.last_claim ?? null };
}

export async function loadVip(uid: string): Promise<VipState> {
  const [levels, rewards, daily, me] = await Promise.all([
    supabase.from('vip_levels').select('level, tier, step, points, reward_coins, perk').order('level'),
    supabase.from('vip_rewards').select('level').eq('user_id', uid),
    loadDaily(uid),
    supabase.from('profiles').select('vip_points').eq('id', uid).single<{ vip_points: number }>(),
  ]);
  if (levels.error) throw levels.error;
  if (rewards.error) throw rewards.error;
  return {
    levels: levels.data as VipLevel[],
    claimed: new Set((rewards.data ?? []).map((r: { level: number }) => r.level)),
    daily,
    points: me.data?.vip_points ?? 0,
  };
}

export type DailyResult = {
  streak: number;
  points: number;
  box_coins: number;
  box_gems: number;
  coins: number;
  gems: number;
  vip_points: number;
};

export async function claimDaily(): Promise<DailyResult> {
  const { data, error } = await supabase.rpc('claim_vip_daily');
  if (error) throw error;
  return data as DailyResult;
}

// صندوق الترقية، بيرجّع رصيد العملات الجديد
export async function claimReward(level: number): Promise<number> {
  const { data, error } = await supabase.rpc('claim_vip_reward', { lvl: level });
  if (error) throw error;
  return data as number;
}

export async function convertGems(amount: number): Promise<{ gems: number; vip_points: number }> {
  const { data, error } = await supabase.rpc('convert_gems_to_vip', { amount });
  if (error) throw error;
  return (data as { gems: number; vip_points: number }[])[0];
}
