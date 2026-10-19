import { supabase } from './supabase';

export type GemPackage = {
  key: string;
  name: string;
  gems: number;
  price_usd: number;
  store_product_id: string;
};

export type StoreState = {
  packages: GemPackage[];
  // الباقات اللي اشتراها قبل (ما بقى إلها ضعف)
  bought: Set<string>;
  adsToday: number;
  isTester: boolean;
};

export const ADS_PER_DAY = 10;

export async function loadStore(uid: string): Promise<StoreState> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const [packages, purchases, ads, tester] = await Promise.all([
    supabase.from('gem_packages').select('key, name, gems, price_usd, store_product_id').order('sort'),
    supabase.from('gem_purchases').select('package').eq('user_id', uid),
    supabase
      .from('ad_rewards')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', uid)
      .gte('created_at', startOfDay.toISOString()),
    supabase.rpc('am_i_tester'),
  ]);
  if (packages.error) throw packages.error;
  return {
    packages: packages.data as GemPackage[],
    bought: new Set((purchases.data ?? []).map((p: { package: string }) => p.package)),
    adsToday: ads.count ?? 0,
    isTester: !!tester.data,
  };
}

// شراء تجريبي لحسابات التجربة. الشراء الحقيقي بيجي مع RevenueCat بنسخة الجوال.
export async function testerPurchase(pkg: string): Promise<number> {
  const { data, error } = await supabase.rpc('tester_purchase', { pkg });
  if (error) throw error;
  return data as number;
}
