-- ٥ أقسام للهدايا وأكتر من ٥٠ هدية
-- بينزل مرة وحدة من Supabase ← SQL Editor (بعد 0005)
-- لتعديل اسم أو سعر بعدين: Table Editor ← gift_catalog

alter table public.gift_catalog add column if not exists category text not null default 'popular';

-- اسم الهدية ورمزها بينحفظوا مع كل هدية انبعتت (للشريط والدردشة)
alter table public.gift_events add column if not exists gift_name text not null default '';
alter table public.gift_events add column if not exists gift_emoji text not null default '🎁';

-- القسم: popular شعبيات · gulf خليجية · luxury فخمة · occasions مناسبات · vip
-- announce: بيطلع شريط بالرئيسية (من قيمة الأسد ٥٠٠٠ جوهرة وفوق)
insert into public.gift_catalog (key, name, emoji, currency, price, announce, category, sort) values
  -- شعبيات (بالعملات، رخيصة)
  ('heart',     'قلب',          '❤️', 'coins', 5,     false, 'popular', 1),
  ('rose',      'وردة',         '🌹', 'coins', 10,    false, 'popular', 2),
  ('tea',       'استكانة شاي',  '🍵', 'coins', 15,    false, 'popular', 3),
  ('coffee',    'فنجان قهوة',   '☕', 'coins', 20,    false, 'popular', 4),
  ('icecream',  'آيس كريم',     '🍦', 'coins', 25,    false, 'popular', 5),
  ('clap',      'تصفيق',        '👏', 'coins', 30,    false, 'popular', 6),
  ('balloon',   'بالون',        '🎈', 'coins', 40,    false, 'popular', 7),
  ('sweets',    'حلاوة',        '🍬', 'coins', 50,    false, 'popular', 8),
  ('star',      'نجمة',         '⭐', 'coins', 60,    false, 'popular', 9),
  ('haysa',     'هيصة',         '🎉', 'coins', 100,   false, 'popular', 10),

  -- خليجية
  ('dates',     'تمر',          '🌴', 'coins', 80,    false, 'gulf', 1),
  ('honey',     'عسل',          '🍯', 'coins', 120,   false, 'gulf', 2),
  ('incense',   'مبخرة',        '🪔', 'coins', 150,   false, 'gulf', 3),
  ('drum',      'طبل العرضة',   '🥁', 'coins', 200,   false, 'gulf', 4),
  ('machboos',  'مچبوس',        '🍛', 'coins', 300,   false, 'gulf', 5),
  ('tent',      'خيمة البر',    '⛺', 'gems',  300,   false, 'gulf', 6),
  ('sheep',     'خروف',         '🐑', 'gems',  600,   false, 'gulf', 7),
  ('camel',     'ناقة',         '🐪', 'gems',  1000,  false, 'gulf', 8),
  ('dhow',      'سنبوك',        '⛵', 'gems',  1500,  false, 'gulf', 9),
  ('falcon',    'صقر',          '🦅', 'gems',  2500,  false, 'gulf', 10),
  ('horse',     'خيل عربي',     '🐎', 'gems',  4000,  false, 'gulf', 11),
  ('sword',     'سيف العرضة',   '⚔️', 'gems',  6000,  true,  'gulf', 12),

  -- فخمة (بالجواهر)
  ('ring',      'خاتم',         '💍', 'gems',  200,   false, 'luxury', 1),
  ('bouquet',   'باقة ورد',     '💐', 'gems',  300,   false, 'luxury', 2),
  ('crown',     'تاج',          '👑', 'gems',  500,   false, 'luxury', 3),
  ('watch',     'ساعة',         '⌚', 'gems',  800,   false, 'luxury', 4),
  ('diamond',   'ألماس',        '💎', 'gems',  1500,  false, 'luxury', 5),
  ('lion',      'أسد',          '🦁', 'gems',  5000,  true,  'luxury', 6),
  ('car',       'سيارة',        '🏎️', 'gems',  10000, true,  'luxury', 7),
  ('yacht',     'يخت',          '🛥️', 'gems',  20000, true,  'luxury', 8),
  ('jet',       'طيارة خاصة',   '✈️', 'gems',  30000, true,  'luxury', 9),
  ('palace',    'قصر',          '🏰', 'gems',  50000, true,  'luxury', 10),

  -- مناسبات
  ('cake',      'كيكة',         '🎂', 'coins', 100,   false, 'occasions', 1),
  ('present',   'هدية',         '🎁', 'coins', 150,   false, 'occasions', 2),
  ('grad',      'تخرج',         '🎓', 'coins', 200,   false, 'occasions', 3),
  ('baby',      'مولود جديد',   '🍼', 'coins', 200,   false, 'occasions', 4),
  ('trophy',    'كأس الفوز',    '🏆', 'coins', 300,   false, 'occasions', 5),
  ('ramadan',   'رمضان كريم',   '🌙', 'gems',  300,   false, 'occasions', 6),
  ('eid',       'عيدكم مبارك',  '🎊', 'gems',  500,   false, 'occasions', 7),
  ('fireworks', 'ألعاب نارية',  '🎆', 'gems',  1000,  false, 'occasions', 8),
  ('kw',        'علم الكويت',   '🇰🇼', 'gems', 1000,  false, 'occasions', 9),
  ('sa',        'علم السعودية', '🇸🇦', 'gems', 1000,  false, 'occasions', 10),
  ('ae',        'علم الإمارات', '🇦🇪', 'gems', 1000,  false, 'occasions', 11),
  ('qa',        'علم قطر',      '🇶🇦', 'gems', 1000,  false, 'occasions', 12),
  ('bh',        'علم البحرين',  '🇧🇭', 'gems', 1000,  false, 'occasions', 13),
  ('om',        'علم عُمان',    '🇴🇲', 'gems', 1000,  false, 'occasions', 14),
  ('wedding',   'عرس',          '💒', 'gems',  5000,  true,  'occasions', 15),

  -- VIP (أغلى الهدايا)
  ('fire',      'نار الهيصة',   '🔥', 'gems',  3000,  false, 'vip', 1),
  ('lightning', 'برق',          '⚡', 'gems',  5000,  true,  'vip', 2),
  ('unicorn',   'حصان أسطوري',  '🦄', 'gems',  8000,  true,  'vip', 3),
  ('meteor',    'شهاب',         '🌠', 'gems',  12000, true,  'vip', 4),
  ('dragon',    'تنين',         '🐉', 'gems',  25000, true,  'vip', 5),
  ('rocket',    'صاروخ',        '🚀', 'gems',  40000, true,  'vip', 6),
  ('planet',    'كوكب',         '🪐', 'gems',  60000, true,  'vip', 7),
  ('island',    'جزيرة',        '🏝️', 'gems',  75000, true,  'vip', 8),
  ('galaxy',    'مجرة',         '🌌', 'gems',  100000, true, 'vip', 9)
on conflict (key) do update set
  name = excluded.name, emoji = excluded.emoji, currency = excluded.currency, price = excluded.price,
  announce = excluded.announce, category = excluded.category, sort = excluded.sort;

-- نفس دالة الإرسال، بس بتحفظ اسم الهدية ورمزها كمان
create or replace function public.send_gift(room bigint, gift text, qty integer, recipients bigint[])
returns table (coins integer, gems integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  g public.gift_catalog;
  r public.rooms;
  my_name text;
  n integer;
  total integer;
  rec record;
begin
  if me is null then raise exception 'not signed in'; end if;
  if qty not in (1, 5, 10) then raise exception 'bad qty'; end if;

  select * into g from public.gift_catalog where key = gift;
  if not found then raise exception 'unknown gift'; end if;

  select * into r from public.rooms where number = room;
  if not found then raise exception 'room not found'; end if;

  select count(*) into n from public.profiles
  where public_id = any (recipients) and id <> me;
  if n = 0 or n > 16 then raise exception 'bad recipients'; end if;

  total := g.price * qty * n;

  select name into my_name from public.profiles where id = me for update;
  if g.currency = 'coins' then
    update public.profiles p set coins = p.coins - total, xp = p.xp + total / 10
    where p.id = me and p.coins >= total;
  else
    update public.profiles p set gems = p.gems - total, vip_points = p.vip_points + total
    where p.id = me and p.gems >= total;
  end if;
  if not found then raise exception 'insufficient balance'; end if;

  for rec in
    select id, coalesce(name, 'لاعب') as name from public.profiles
    where public_id = any (recipients) and id <> me
  loop
    update public.profiles set popularity = popularity + g.price * qty where id = rec.id;
    insert into public.gift_events
      (room_number, room_name, sender, sender_name, recipient, recipient_name,
       gift_key, gift_name, gift_emoji, qty, announce)
    values
      (room, r.name, me, coalesce(my_name, 'لاعب'), rec.id, rec.name,
       g.key, g.name, g.emoji, qty, g.announce);
  end loop;

  return query select p.coins, p.gems from public.profiles p where p.id = me;
end;
$$;
