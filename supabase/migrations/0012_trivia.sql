-- تحدي الأسئلة
-- بينزل مرة وحدة من Supabase ← SQL Editor (بعد 0011)
--
-- ١٠ أسئلة بالجولة، كل سؤال ١٥ ثانية، والكل بيجاوب بنفس الوقت.
-- الجواب الصح بياخد من ٤٠٠ لـ ١٠٠٠ نقطة حسب السرعة.
-- الأجوبة الصح مخبّاية بالسيرفر وما بتبين إلا بعد ما يخلص وقت السؤال.

-- بنك الأسئلة (ما حدا بيقراه من التطبيق). أول خيار هو الصح، والسيرفر بيخلطهم.
create table public.trivia_questions (
  id bigint generated always as identity primary key,
  category text not null check (category in ('general', 'gulf', 'sports', 'proverbs', 'truefalse')),
  question text not null,
  options text[] not null,
  correct text not null
);
alter table public.trivia_questions enable row level security;
revoke all on public.trivia_questions from anon, authenticated;

-- معلومات عامة / الخليج / رياضة / أكمل المثل: الخيار الأول هو الصح
insert into public.trivia_questions (category, question, options, correct)
select c, q, o, o[1] from (values
  ('general', 'كم عدد أيام السنة الكبيسة؟', array['٣٦٦', '٣٦٥', '٣٦٤', '٣٦٠']),
  ('general', 'ما هو أكبر كوكب في المجموعة الشمسية؟', array['المشتري', 'المريخ', 'زحل', 'الأرض']),
  ('general', 'كم عدد قارات العالم؟', array['٧', '٥', '٦', '٨']),
  ('general', 'ما هي عاصمة اليابان؟', array['طوكيو', 'سيول', 'بكين', 'بانكوك']),
  ('general', 'ما هو أطول نهر في العالم؟', array['النيل', 'الأمازون', 'الفرات', 'المسيسيبي']),
  ('general', 'كم عدد أضلاع الشكل السداسي؟', array['٦', '٥', '٧', '٨']),
  ('general', 'ما الغاز الذي تحتاجه النباتات لصنع غذائها؟', array['ثاني أكسيد الكربون', 'الأكسجين', 'النيتروجين', 'الهيليوم']),
  ('general', 'ما هو أسرع حيوان بري؟', array['الفهد', 'الأسد', 'الحصان', 'الغزال']),
  ('general', 'ما هي عاصمة فرنسا؟', array['باريس', 'روما', 'مدريد', 'برلين']),
  ('general', 'ما هو أكبر محيط في العالم؟', array['المحيط الهادئ', 'المحيط الأطلسي', 'المحيط الهندي', 'المحيط المتجمد الشمالي']),
  ('general', 'كم عدد ألوان قوس قزح؟', array['٧', '٥', '٦', '٨']),
  ('general', 'ما هي أصغر دولة في العالم؟', array['الفاتيكان', 'موناكو', 'مالطا', 'البحرين']),
  ('general', 'ما هي عملة اليابان؟', array['الين', 'الوون', 'اليوان', 'الروبية']),
  ('general', 'كم عدد أسنان الإنسان البالغ؟', array['٣٢', '٢٨', '٣٠', '٣٤']),
  ('general', 'ما العضو المسؤول عن ضخ الدم في الجسم؟', array['القلب', 'الرئة', 'الكبد', 'الكلية']),
  ('general', 'في أي قارة تقع مصر؟', array['أفريقيا', 'آسيا', 'أوروبا', 'أستراليا']),
  ('general', 'ما هي عاصمة تركيا؟', array['أنقرة', 'إسطنبول', 'إزمير', 'بورصة']),
  ('general', 'ما هو أعلى جبل في العالم؟', array['إيفرست', 'كليمنجارو', 'مون بلان', 'فوجي']),
  ('general', 'ما هو أكبر حيوان في العالم؟', array['الحوت الأزرق', 'الفيل', 'الزرافة', 'القرش الأبيض']),
  ('general', 'عند كم درجة مئوية يغلي الماء عند سطح البحر؟', array['١٠٠', '٩٠', '١١٠', '١٢٠']),
  ('general', 'ما هو أقرب نجم إلى الأرض؟', array['الشمس', 'سهيل', 'الثريا', 'الشعرى']),
  ('general', 'ما هي عاصمة مصر؟', array['القاهرة', 'الإسكندرية', 'الجيزة', 'أسوان']),
  ('general', 'كم عدد كواكب المجموعة الشمسية؟', array['٨', '٧', '٩', '١٠']),
  ('general', 'ما المعدن الذي يكون سائلاً في درجة حرارة الغرفة؟', array['الزئبق', 'الحديد', 'النحاس', 'الألمنيوم']),
  ('general', 'أي حيوان يُلقّب بسفينة الصحراء؟', array['الجمل', 'الحصان', 'الغزال', 'الحمار']),
  ('general', 'ما هي عاصمة المغرب؟', array['الرباط', 'الدار البيضاء', 'مراكش', 'فاس']),
  ('general', 'كم عدد أرجل العنكبوت؟', array['٨', '٦', '١٠', '١٢']),
  ('general', 'ما هي أكبر دولة في العالم مساحةً؟', array['روسيا', 'كندا', 'الصين', 'أمريكا']),
  ('general', 'ما لون حجر الزمرد؟', array['أخضر', 'أحمر', 'أزرق', 'أصفر']),
  ('general', 'كم عدد الدقائق في الساعة؟', array['٦٠', '٥٠', '١٠٠', '٣٦']),

  ('gulf', 'ما هي عاصمة دولة الكويت؟', array['مدينة الكويت', 'الجهراء', 'الأحمدي', 'حولي']),
  ('gulf', 'ما هي عاصمة سلطنة عُمان؟', array['مسقط', 'صلالة', 'صحار', 'نزوى']),
  ('gulf', 'ما هي عاصمة مملكة البحرين؟', array['المنامة', 'المحرق', 'الرفاع', 'مدينة عيسى']),
  ('gulf', 'ما هي عاصمة دولة قطر؟', array['الدوحة', 'الوكرة', 'الخور', 'لوسيل']),
  ('gulf', 'ما هي عاصمة دولة الإمارات؟', array['أبوظبي', 'دبي', 'الشارقة', 'العين']),
  ('gulf', 'ما هي عاصمة المملكة العربية السعودية؟', array['الرياض', 'جدة', 'الدمام', 'مكة المكرمة']),
  ('gulf', 'ما هو أطول برج في العالم؟', array['برج خليفة', 'برج المملكة', 'برج إيفل', 'برج شنغهاي']),
  ('gulf', 'في أي مدينة يقع برج خليفة؟', array['دبي', 'أبوظبي', 'الشارقة', 'عجمان']),
  ('gulf', 'كم عدد إمارات دولة الإمارات؟', array['٧', '٥', '٦', '٨']),
  ('gulf', 'ما هي عملة قطر؟', array['الريال', 'الدينار', 'الدرهم', 'الليرة']),
  ('gulf', 'ما هي عملة الإمارات؟', array['الدرهم', 'الريال', 'الدينار', 'الجنيه']),
  ('gulf', 'ما هي عملة الكويت؟', array['الدينار', 'الريال', 'الدرهم', 'الروبية']),
  ('gulf', 'ما هي عملة البحرين؟', array['الدينار', 'الريال', 'الدرهم', 'الليرة']),
  ('gulf', 'أي دولة استضافت كأس العالم ٢٠٢٢؟', array['قطر', 'السعودية', 'الإمارات', 'الكويت']),
  ('gulf', 'أي دولة ستستضيف كأس العالم ٢٠٣٤؟', array['السعودية', 'قطر', 'الإمارات', 'عُمان']),
  ('gulf', 'ما اسم أكبر صحراء رملية متصلة في العالم؟', array['الربع الخالي', 'النفود', 'الدهناء', 'الصحراء الكبرى']),
  ('gulf', 'ما اسم الإناء اللي تنصب منه القهوة العربية؟', array['الدلّة', 'الإبريق', 'الطاسة', 'الجك']),
  ('gulf', 'أي طائر يرمز للتراث الخليجي ويُستخدم في الصيد؟', array['الصقر', 'النسر', 'البومة', 'الحمام']),
  ('gulf', 'ما اسم السفينة الخشبية الخليجية التقليدية؟', array['اللنج', 'الجندول', 'الكاياك', 'الغواصة']),
  ('gulf', 'ما المهنة البحرية اللي اشتهر فيها أهل الخليج قبل النفط؟', array['الغوص على اللؤلؤ', 'الزراعة', 'التعدين', 'الحدادة']),
  ('gulf', 'ما اسم قائد سفينة الغوص قديماً؟', array['النوخذة', 'السيب', 'الطواش', 'النهّام']),
  ('gulf', 'ما اسم المغني على سفينة الغوص؟', array['النهّام', 'النوخذة', 'الغيص', 'السيب']),
  ('gulf', 'جسر الملك فهد يربط بين أي دولتين؟', array['السعودية والبحرين', 'قطر والبحرين', 'الإمارات وعُمان', 'الكويت والسعودية']),
  ('gulf', 'أي مدينة سعودية تُلقّب بعروس البحر الأحمر؟', array['جدة', 'ينبع', 'الدمام', 'الخبر']),
  ('gulf', 'في أي دولة تقع جزيرة فيلكا؟', array['الكويت', 'البحرين', 'قطر', 'الإمارات']),
  ('gulf', 'في أي دولة تقع مدينة صلالة؟', array['عُمان', 'الإمارات', 'السعودية', 'قطر']),
  ('gulf', 'ما اللون الأساسي في علم قطر؟', array['العنابي', 'الأحمر', 'الأخضر', 'الأزرق']),
  ('gulf', 'ما اسم الرقصة الشعبية بالسيوف في السعودية؟', array['العرضة', 'الدبكة', 'التنورة', 'السامري']),
  ('gulf', 'كم عدد دول مجلس التعاون الخليجي؟', array['٦', '٥', '٧', '٨']),
  ('gulf', 'في أي مدينة مقر الأمانة العامة لمجلس التعاون الخليجي؟', array['الرياض', 'الكويت', 'الدوحة', 'مسقط']),

  ('sports', 'كم عدد لاعبي فريق كرة القدم داخل الملعب؟', array['١١', '٩', '١٠', '١٢']),
  ('sports', 'كم دقيقة مدة مباراة كرة القدم الأصلية؟', array['٩٠', '٨٠', '١٠٠', '١٢٠']),
  ('sports', 'كل كم سنة تنقام كأس العالم لكرة القدم؟', array['٤', '٢', '٣', '٥']),
  ('sports', 'أي منتخب فاز بكأس العالم ٢٠٢٢؟', array['الأرجنتين', 'فرنسا', 'البرازيل', 'كرواتيا']),
  ('sports', 'أي منتخب عربي وصل لنصف نهائي كأس العالم ٢٠٢٢؟', array['المغرب', 'السعودية', 'تونس', 'قطر']),
  ('sports', 'أي منتخب فاز على الأرجنتين بكأس العالم ٢٠٢٢؟', array['السعودية', 'المغرب', 'تونس', 'قطر']),
  ('sports', 'كم لاعب لكل فريق داخل ملعب كرة السلة؟', array['٥', '٦', '٧', '١١']),
  ('sports', 'بأي رياضة بنستخدم المضرب والريشة؟', array['الريشة الطائرة', 'التنس', 'الاسكواش', 'البيسبول']),
  ('sports', 'كم نقطة الرمية من ورا القوس بكرة السلة؟', array['٣', '١', '٢', '٤']),
  ('sports', 'ما اسم بطولة كرة القدم لمنتخبات الخليج؟', array['كأس الخليج', 'كأس آسيا', 'كأس العرب', 'الكأس الذهبية']),
  ('sports', 'كم حلقة في شعار الألعاب الأولمبية؟', array['٥', '٤', '٦', '٧']),
  ('sports', 'بأي رياضة اشتهر مايكل جوردان؟', array['كرة السلة', 'كرة القدم', 'التنس', 'الملاكمة']),
  ('sports', 'بأي لعبة بنقول "كش ملك"؟', array['الشطرنج', 'الداما', 'البلوت', 'الطاولة']),
  ('sports', 'كم كيلومتر تقريباً مسافة سباق الماراثون؟', array['٤٢', '٢١', '٥٠', '١٠']),
  ('sports', 'أي دولة نشأت فيها كرة القدم الحديثة؟', array['إنجلترا', 'البرازيل', 'إيطاليا', 'إسبانيا']),
  ('sports', 'ما اسم الركلة اللي تنلعب من علامة الجزاء؟', array['ركلة جزاء', 'ركلة ركنية', 'ركلة حرة', 'ضربة مرمى']),
  ('sports', 'كم بطاقة صفرا بنفس المباراة بتساوي بطاقة حمرا؟', array['٢', '١', '٣', '٤']),
  ('sports', 'من أي دولة اللاعب ليونيل ميسي؟', array['الأرجنتين', 'البرتغال', 'البرازيل', 'إسبانيا']),
  ('sports', 'أي رياضة خليجية شعبية بتعتمد على الإبل؟', array['سباق الهجن', 'البولو', 'قفز الحواجز', 'الرماية']),
  ('sports', 'كم لاعب لكل فريق داخل ملعب كرة الطائرة؟', array['٦', '٥', '٧', '٩']),
  ('sports', 'وين انقامت الألعاب الأولمبية الصيفية ٢٠٢٤؟', array['باريس', 'طوكيو', 'لندن', 'لوس أنجلوس']),
  ('sports', 'كم لاعب لكل فريق داخل ملعب كرة اليد؟', array['٧', '٦', '٨', '١١']),
  ('sports', 'أي نادي سعودي لقبه "الزعيم"؟', array['الهلال', 'النصر', 'الاتحاد', 'الشباب']),
  ('sports', 'بأي سنة لعب المنتخب الكويتي بكأس العالم؟', array['١٩٨٢', '١٩٩٠', '١٩٧٨', '١٩٩٤']),

  ('proverbs', 'اللي ما يعرف الصقر...', array['يشويه', 'يطيّره', 'يبيعه', 'يصيده']),
  ('proverbs', 'الجار قبل...', array['الدار', 'البيت', 'الأهل', 'الطريق']),
  ('proverbs', 'من جدّ...', array['وجد', 'نجح', 'فاز', 'تعب']),
  ('proverbs', 'الوقت كالسيف إن لم تقطعه...', array['قطعك', 'سبقك', 'ضيّعك', 'تركك']),
  ('proverbs', 'القرد في عين أمه...', array['غزال', 'قمر', 'أسد', 'جميل']),
  ('proverbs', 'يا غريب كن...', array['أديب', 'لطيف', 'ضيف', 'صبور']),
  ('proverbs', 'الصبر مفتاح...', array['الفرج', 'النجاح', 'الخير', 'الباب']),
  ('proverbs', 'اللي ما له أول...', array['ما له تالي', 'ما له آخر', 'ما له قيمة', 'ما له أهل']),
  ('proverbs', 'عصفور في اليد...', array['ولا عشرة على الشجرة', 'ولا عشرة بالسما', 'ولا ألف بالبر', 'ولا طير بالقفص']),
  ('proverbs', 'على قد لحافك...', array['مد رجليك', 'نام', 'تغطّى', 'اقعد']),
  ('proverbs', 'إذا كان الكلام من فضة فالسكوت من...', array['ذهب', 'ألماس', 'حرير', 'نحاس']),
  ('proverbs', 'كل إناء بما فيه...', array['ينضح', 'يمتلئ', 'يفيض', 'يُعرف']),
  ('proverbs', 'رُبّ أخٍ لك لم...', array['تلده أمك', 'تعرفه', 'تره', 'يزرك']),
  ('proverbs', 'درهم وقاية خير من قنطار...', array['علاج', 'دواء', 'ذهب', 'مال']),
  ('proverbs', 'من شبّ على شيء...', array['شاب عليه', 'تعوّد عليه', 'نسيه', 'تركه']),
  ('proverbs', 'الكلب ينبح والقافلة...', array['تسير', 'تقف', 'ترجع', 'تنام']),
  ('proverbs', 'لكل جواد...', array['كبوة', 'فارس', 'سرج', 'مضمار']),
  ('proverbs', 'ما كل ما يتمنى المرء...', array['يدركه', 'يناله', 'يحصل عليه', 'يشوفه']),
  ('proverbs', 'اللي فات...', array['مات', 'راح', 'انتهى', 'نسيناه']),
  ('proverbs', 'الطيور على أشكالها...', array['تقع', 'تطير', 'تعيش', 'تغني'])
) as t(c, q, o);

-- صح أو خطأ
insert into public.trivia_questions (category, question, options, correct)
select 'truefalse', q, array['صح', 'خطأ'], case when ok then 'صح' else 'خطأ' end from (values
  ('الشمس نجم.', true),
  ('الحوت من الأسماك.', false),
  ('عاصمة أستراليا هي سيدني.', false),
  ('الماء يتجمد عند صفر درجة مئوية.', true),
  ('للنحلة ست أرجل.', true),
  ('قطر استضافت كأس العالم ٢٠٢٢.', true),
  ('الإمارات تتكون من خمس إمارات.', false),
  ('القمر أكبر من الأرض.', false),
  ('الخفاش من الطيور.', false),
  ('الربع الخالي بشبه الجزيرة العربية.', true),
  ('البطريق بيقدر يطير.', false),
  ('دم الإنسان فيه حديد.', true),
  ('المحيط الهندي أكبر محيط بالعالم.', false),
  ('الطماطم نباتياً تُعتبر فاكهة.', true),
  ('الكويت تقع شمال السعودية.', true),
  ('الصوت أسرع من الضوء.', false),
  ('الذهب بيصدّي.', false),
  ('للأخطبوط تلات قلوب.', true),
  ('جسر الملك فهد بيربط السعودية بقطر.', false),
  ('الجمل بيخزّن المي بسنامه.', false),
  ('العملة الرسمية بعُمان هي الريال العُماني.', true),
  ('أول مباراة بكأس العالم ٢٠٢٢ كانت بين قطر والإكوادور.', true),
  ('العنكبوت من الحشرات.', false),
  ('برج خليفة بأبوظبي.', false)
) as t(q, ok);

-- الطاولة (اللي الكل بيشوفه)
create table public.trivia_games (
  id bigint generated always as identity (start with 9001) primary key,
  host uuid references public.profiles (id) on delete set null,
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'finished')),
  -- mix منوّعة، أو قسم واحد
  category text not null default 'mix' check (category in ('mix', 'general', 'gulf', 'sports', 'proverbs', 'truefalse')),
  -- [{uid, pid, name, avatar, bot, left, score}]
  players jsonb not null default '[]',
  round integer not null default 0,
  total integer not null default 10,
  -- question (السؤال مفتوح) أو reveal (عرض الجواب)
  phase text check (phase in ('question', 'reveal')),
  -- {text, options, category} بدون الجواب
  question jsonb,
  -- مين جاوب (بدون شو جاوب)
  answered jsonb not null default '[]',
  -- بعد السؤال: {answer, gains: {uid: نقاط}, picks: {uid: خيار}}
  reveal jsonb,
  deadline timestamptz,
  winner uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index trivia_games_waiting_idx on public.trivia_games (status, updated_at desc);
alter table public.trivia_games enable row level security;
revoke all on public.trivia_games from anon, authenticated;
grant select on public.trivia_games to authenticated;
create policy "everyone can watch trivia" on public.trivia_games for select to authenticated using (true);
alter publication supabase_realtime add table public.trivia_games;

-- أسئلة كل طاولة بترتيبها وخياراتها المخلوطة (مخبّاية)
create table public.trivia_rounds (
  game_id bigint not null references public.trivia_games (id) on delete cascade,
  round integer not null,
  question text not null,
  category text not null,
  options text[] not null,
  answer integer not null,
  primary key (game_id, round)
);
alter table public.trivia_rounds enable row level security;
revoke all on public.trivia_rounds from anon, authenticated;

-- الأجوبة (مخبّاية لحد ما يخلص السؤال)
create table public.trivia_answers (
  game_id bigint not null references public.trivia_games (id) on delete cascade,
  round integer not null,
  player text not null,
  choice integer not null,
  points integer not null,
  primary key (game_id, round, player)
);
alter table public.trivia_answers enable row level security;
revoke all on public.trivia_answers from anon, authenticated;

create table public.trivia_results (
  game_id bigint not null references public.trivia_games (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  won boolean not null,
  score integer not null,
  coins integer not null,
  xp integer not null,
  created_at timestamptz not null default now(),
  primary key (game_id, user_id)
);
create index trivia_results_user_idx on public.trivia_results (user_id, created_at desc);
alter table public.trivia_results enable row level security;
revoke all on public.trivia_results from anon, authenticated;
grant select on public.trivia_results to authenticated;
create policy "users read their trivia results" on public.trivia_results for select to authenticated
  using ((select auth.uid()) = user_id);

-- ===== دوال داخلية =====

-- مفتاح اللاعب: uid للناس، bot-رقم للكمبيوتر
create function public._trivia_key(p jsonb, i integer)
returns text
language sql
immutable
set search_path = ''
as $$ select coalesce(p ->> 'uid', 'bot-' || i) $$;

create function public._trivia_save(g public.trivia_games)
returns jsonb
language plpgsql
set search_path = ''
as $$
begin
  g.updated_at := now();
  update public.trivia_games set
    host = g.host, status = g.status, category = g.category, players = g.players, round = g.round,
    total = g.total, phase = g.phase, question = g.question, answered = g.answered, reveal = g.reveal,
    deadline = g.deadline, winner = g.winner, updated_at = g.updated_at
  where id = g.id;
  return to_jsonb(g);
end;
$$;

-- الجوائز: الأول ٥٠ XP و١٠٠ عملة (إذا في لاعبين حقيقيين اتنين أو أكتر، لحد ١٠ باليوم)، والباقي ١٥ XP
create function public._trivia_finish(g public.trivia_games)
returns public.trivia_games
language plpgsql
set search_path = ''
as $$
declare
  p jsonb;
  humans integer;
  best integer;
  won boolean;
  c integer;
  today integer;
begin
  select max((q ->> 'score')::integer) into best from jsonb_array_elements(g.players) q where not (q ->> 'left')::boolean;
  select (q ->> 'uid')::uuid into g.winner from jsonb_array_elements(g.players) q
  where not (q ->> 'left')::boolean and (q ->> 'score')::integer = best and q ->> 'uid' is not null limit 1;
  select count(*) into humans from jsonb_array_elements(g.players) q where not (q ->> 'bot')::boolean;
  g.status := 'finished';
  g.phase := null;
  g.deadline := null;

  for p in select * from jsonb_array_elements(g.players) loop
    continue when (p ->> 'bot')::boolean;
    won := (p ->> 'score')::integer = best and best > 0;
    c := 0;
    if won and humans >= 2 then
      select count(*) into today from public.trivia_results
      where user_id = (p ->> 'uid')::uuid and coins > 0 and created_at >= now() - interval '1 day';
      if today < 10 then c := 100; end if;
    end if;
    insert into public.trivia_results (game_id, user_id, won, score, coins, xp)
    values (g.id, (p ->> 'uid')::uuid, won, (p ->> 'score')::integer, c, case when won then 50 else 15 end)
    on conflict do nothing;
    if found then
      update public.profiles set xp = xp + case when won then 50 else 15 end, coins = coins + c
      where id = (p ->> 'uid')::uuid;
    end if;
  end loop;
  return g;
end;
$$;

-- السؤال الجاي (أو النهاية)
create function public._trivia_next(g public.trivia_games)
returns public.trivia_games
language plpgsql
set search_path = ''
as $$
declare
  r public.trivia_rounds;
begin
  g.round := g.round + 1;
  if g.round > g.total then
    return public._trivia_finish(g);
  end if;
  select * into r from public.trivia_rounds where game_id = g.id and round = g.round;
  g.question := jsonb_build_object('text', r.question, 'options', to_jsonb(r.options), 'category', r.category);
  g.phase := 'question';
  g.answered := '[]';
  g.reveal := null;
  g.deadline := now() + interval '15 seconds';
  return g;
end;
$$;

-- كشف الجواب: الكمبيوتر بيجاوب صح ٦٠٪ من المرات
create function public._trivia_reveal(g public.trivia_games)
returns public.trivia_games
language plpgsql
volatile
set search_path = ''
as $$
declare
  r public.trivia_rounds;
  i integer;
  p jsonb;
  k text;
  gains jsonb := '{}';
  picks jsonb := '{}';
  a public.trivia_answers;
  pts integer;
  pick integer;
begin
  select * into r from public.trivia_rounds where game_id = g.id and round = g.round;
  for i in 0..jsonb_array_length(g.players) - 1 loop
    p := g.players -> i;
    continue when (p ->> 'left')::boolean;
    k := public._trivia_key(p, i);
    if (p ->> 'bot')::boolean then
      if random() < 0.6 then
        pick := r.answer;
        pts := 400 + floor(random() * 450)::integer;
      else
        pick := (r.answer + 1 + floor(random() * (cardinality(r.options) - 1))::integer) % cardinality(r.options);
        pts := 0;
      end if;
    else
      select * into a from public.trivia_answers where game_id = g.id and round = g.round and player = k;
      pick := a.choice;
      pts := coalesce(a.points, 0);
    end if;
    gains := gains || jsonb_build_object(k, pts);
    if pick is not null then picks := picks || jsonb_build_object(k, pick); end if;
    g.players := jsonb_set(g.players, array[i::text, 'score'], to_jsonb((p ->> 'score')::integer + pts));
  end loop;
  g.phase := 'reveal';
  g.reveal := jsonb_build_object('answer', r.answer, 'gains', gains, 'picks', picks);
  g.deadline := now() + interval '4 seconds';
  return g;
end;
$$;

create function public._trivia_me_json()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('uid', id, 'pid', public_id, 'name', coalesce(name, 'لاعب'),
    'avatar', avatar, 'bot', false, 'left', false, 'score', 0)
  from public.profiles where id = auth.uid()
$$;

revoke execute on function public._trivia_key(jsonb, integer), public._trivia_save(public.trivia_games),
  public._trivia_finish(public.trivia_games), public._trivia_next(public.trivia_games),
  public._trivia_reveal(public.trivia_games), public._trivia_me_json()
from public, anon, authenticated;

-- ===== اللي بيناديه التطبيق =====

create function public.trivia_create(cat text default 'mix')
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  gid bigint;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.trivia_games (host, category, players)
  values (auth.uid(), cat, jsonb_build_array(public._trivia_me_json()))
  returning id into gid;
  return gid;
end;
$$;

create function public.trivia_join(gid bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.trivia_games;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into g from public.trivia_games where id = gid for update;
  if not found then raise exception 'game not found'; end if;
  if exists (select 1 from jsonb_array_elements(g.players) p where p ->> 'uid' = auth.uid()::text) then
    return to_jsonb(g);
  end if;
  if g.status <> 'waiting' then raise exception 'game started'; end if;
  if jsonb_array_length(g.players) >= 8 then raise exception 'game full'; end if;
  g.players := g.players || public._trivia_me_json();
  return public._trivia_save(g);
end;
$$;

create function public.trivia_add_bot(gid bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.trivia_games;
  bots integer;
begin
  select * into g from public.trivia_games where id = gid for update;
  if not found or g.host is distinct from auth.uid() then raise exception 'not host'; end if;
  if g.status <> 'waiting' then raise exception 'game started'; end if;
  if jsonb_array_length(g.players) >= 8 then raise exception 'game full'; end if;
  select count(*) into bots from jsonb_array_elements(g.players) p where (p ->> 'bot')::boolean;
  g.players := g.players || jsonb_build_object('uid', null, 'pid', null,
    'name', (array['الدلّة', 'الفنجان', 'المبخرة', 'التمرة', 'الصقر', 'السدو', 'الهيل'])[1 + bots % 7],
    'avatar', 'dalla', 'bot', true, 'left', false, 'score', 0);
  return public._trivia_save(g);
end;
$$;

-- البدء: ١٠ أسئلة عشوائية من القسم، والخيارات مخلوطة (إلا صح أو خطأ)
create function public.trivia_start(gid bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.trivia_games;
  q record;
  n integer := 0;
  opts text[];
begin
  select * into g from public.trivia_games where id = gid for update;
  if not found or g.host is distinct from auth.uid() then raise exception 'not host'; end if;
  if g.status <> 'waiting' then raise exception 'game started'; end if;

  for q in
    select * from public.trivia_questions
    where g.category = 'mix' or category = g.category
    order by random() limit g.total
  loop
    n := n + 1;
    if q.category = 'truefalse' then
      opts := q.options;
    else
      select array_agg(o order by random()) into opts from unnest(q.options) o;
    end if;
    insert into public.trivia_rounds (game_id, round, question, category, options, answer)
    values (g.id, n, q.question, q.category, opts, array_position(opts, q.correct) - 1);
  end loop;

  g.total := n;
  g.status := 'playing';
  g.round := 0;
  return public._trivia_save(public._trivia_next(g));
end;
$$;

-- الجواب: النقاط حسب السرعة (٤٠٠ لـ ١٠٠٠)
create function public.trivia_answer(gid bigint, choice integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.trivia_games;
  r public.trivia_rounds;
  me text := auth.uid()::text;
  left_s numeric;
  humans integer;
begin
  select * into g from public.trivia_games where id = gid for update;
  if not found or g.status <> 'playing' or g.phase <> 'question' then raise exception 'not answering'; end if;
  if not exists (select 1 from jsonb_array_elements(g.players) p
                 where p ->> 'uid' = me and not (p ->> 'left')::boolean) then
    raise exception 'not in game';
  end if;
  if g.answered ? me then return to_jsonb(g); end if;

  select * into r from public.trivia_rounds where game_id = gid and round = g.round;
  left_s := greatest(0, extract(epoch from (g.deadline - now())));
  insert into public.trivia_answers (game_id, round, player, choice, points)
  values (gid, g.round, me, choice,
    case when choice = r.answer then 400 + round(600 * least(1, left_s / 15))::integer else 0 end);
  g.answered := g.answered || to_jsonb(me);

  -- كل الناس جاوبوا؟ منكشف فوراً
  select count(*) into humans from jsonb_array_elements(g.players) p
  where not (p ->> 'bot')::boolean and not (p ->> 'left')::boolean;
  if jsonb_array_length(g.answered) >= humans then
    g := public._trivia_reveal(g);
  end if;
  return public._trivia_save(g);
end;
$$;

create function public.trivia_tick(gid bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.trivia_games;
begin
  select * into g from public.trivia_games where id = gid for update;
  if not found then raise exception 'game not found'; end if;
  if g.status <> 'playing' or g.deadline > now() then return to_jsonb(g); end if;
  if g.phase = 'question' then
    g := public._trivia_reveal(g);
  else
    g := public._trivia_next(g);
  end if;
  return public._trivia_save(g);
end;
$$;

create function public.trivia_leave(gid bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.trivia_games;
  i integer;
begin
  select * into g from public.trivia_games where id = gid for update;
  if not found or g.status = 'finished' then return; end if;
  select (ord - 1)::integer into i from jsonb_array_elements(g.players) with ordinality as x(p, ord)
  where p ->> 'uid' = auth.uid()::text;
  if i is null then return; end if;

  if g.status = 'waiting' then
    g.players := g.players - i;
    if g.host = auth.uid() then
      g.host := (select (p ->> 'uid')::uuid from jsonb_array_elements(g.players) p
                 where not (p ->> 'bot')::boolean limit 1);
    end if;
    if g.host is null then g.status := 'finished'; end if;
  else
    g.players := jsonb_set(g.players, array[i::text, 'left'], 'true');
    if not exists (select 1 from jsonb_array_elements(g.players) p
                   where not (p ->> 'left')::boolean and not (p ->> 'bot')::boolean) then
      g.status := 'finished';
      g.phase := null;
      g.deadline := null;
    end if;
  end if;
  perform public._trivia_save(g);
end;
$$;

grant execute on function public.trivia_create(text), public.trivia_join(bigint), public.trivia_add_bot(bigint),
  public.trivia_start(bigint), public.trivia_answer(bigint, integer), public.trivia_tick(bigint),
  public.trivia_leave(bigint)
to authenticated;
revoke execute on function public.trivia_create(text), public.trivia_join(bigint), public.trivia_add_bot(bigint),
  public.trivia_start(bigint), public.trivia_answer(bigint, integer), public.trivia_tick(bigint),
  public.trivia_leave(bigint)
from public, anon;
