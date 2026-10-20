import { LegalPage, type LegalSection } from '@/components/LegalPage';
import { CONTACT_EMAIL, LEGAL_UPDATED_AR, LEGAL_UPDATED_EN, withEmail } from '@/lib/legal';

// سياسة الخصوصية: صفحة عامة بتفتح بدون تسجيل دخول، ورابطها بينحط بالمتاجر
const AR: LegalSection[] = [
  {
    title: 'مين نحنا',
    body: [
      'هيصة بلاي تطبيق غرف صوتية وألعاب جماعية. هالصفحة بتشرح شو المعلومات اللي منجمعها، وليش، وكيف فيك تحذفها.',
    ],
  },
  {
    title: 'شو المعلومات اللي منجمعها',
    body: [
      '• الحساب: إذا دخلت بـ Google منحفظ إيميلك ومعرّف الحساب. إذا دخلت كضيف منعملّك حساب بدون إيميل.',
      '• البروفايل: الاسم والصورة اللي بتختارهم، ورقم الـ ID، والعملات والجواهر ونقاط VIP والـ XP.',
      '• الأصدقاء والرسائل الخاصة: منحفظهم عشان يوصلوا ويضلوا عندك.',
      '• الألعاب: الطاولات اللي لعبتها والنتائج والجوائز.',
      '• الهدايا والمشتريات: سجل الهدايا اللي بعتها وباقات الجواهر اللي اشتريتها. الدفع بيصير عن طريق App Store أو Google Play، ونحنا ما منشوف معلومات بطاقتك أبداً.',
      '• معلومات تقنية بسيطة لازمة لتشغيل الخدمة، متل وقت آخر دخول.',
    ],
  },
  {
    title: 'الصوت والدردشة بالغرف والألعاب',
    body: [
      'الصوت بالغرف والألعاب مباشر، وما منسجّله ولا منحفظه. رسائل الغرف والطاولات كمان بتنبعت مباشرة وما بتنحفظ عنا. المايك ما بيشتغل إلا لما إنت تفتحه.',
    ],
  },
  {
    title: 'ليش منستعملها',
    body: [
      '• عشان تشتغل حسابك والغرف والألعاب والرسائل.',
      '• عشان نحسب الجوائز والمستويات ونمنع الغش.',
      '• عشان نحمي التطبيق من الإساءة.',
      'ما منبيع معلوماتك لحدا.',
    ],
  },
  {
    title: 'الإعلانات',
    body: [
      'إذا ضفنا إعلانات بنسخة الجوال (مثلاً لما تتفرج على إعلان لتاخد جواهر)، شركة الإعلانات (Google AdMob) ممكن تستعمل معرّف الإعلانات بجهازك. فيك توقفه من إعدادات جوالك.',
    ],
  },
  {
    title: 'شركات بتساعدنا',
    body: [
      '• Supabase: قاعدة البيانات وتسجيل الدخول.',
      '• LiveKit: نقل الصوت المباشر.',
      '• Google: تسجيل الدخول، وبعدين الإعلانات والدفع على أندرويد.',
      '• Apple: الدفع على آيفون.',
      '• GitHub Pages: استضافة نسخة الويب.',
      'هالشركات بتشوف بس اللي بتحتاجه لتشغيل خدمتها.',
    ],
  },
  {
    title: 'شو بيشوفوا اللاعبين التانيين',
    body: ['اسمك وصورتك ورقم الـ ID ومستوى VIP، وصوتك ورسائلك بالغرف والطاولات اللي إنت فيها.'],
  },
  {
    title: 'حذف الحساب',
    body: [
      'من التطبيق: حسابي ← حذف الحساب. بينحذف حسابك وكل شي مربوط فيه فوراً (البروفايل، الأصدقاء، الرسائل، الغرفة، الهدايا، العملات والجواهر، ونتائج الألعاب)، وما بيرجع.',
      ...withEmail([`أو ابعتلنا من الإيميل ${CONTACT_EMAIL} مع رقم الـ ID تبعك، ومنحذفه خلال 30 يوم.`]),
    ],
  },
  {
    title: 'العمر',
    body: ['التطبيق مش للأولاد تحت 13 سنة، وما منجمع معلومات عنهم عن قصد. إذا عرفنا إنه في حساب لولد صغير، منحذفه.'],
  },
  {
    title: 'الأمان',
    body: ['المعلومات بتنبعت مشفّرة، والعملات والجواهر والجوائز بتتغير من السيرفر بس. ما في نظام أمان كامل 100%، بس منعمل جهدنا.'],
  },
  {
    title: 'التغييرات والتواصل',
    body: [
      'إذا غيّرنا هالسياسة منحدّث التاريخ فوق.',
      ...withEmail([`لأي سؤال: ${CONTACT_EMAIL}`]),
    ],
  },
];

const EN: LegalSection[] = [
  {
    title: 'Who we are',
    body: ['Haysa Play is a voice rooms and multiplayer games app. This page explains what we collect, why, and how to delete it.'],
  },
  {
    title: 'What we collect',
    body: [
      '• Account: if you sign in with Google, your email and account identifier. Guest accounts have no email.',
      '• Profile: the name and avatar you choose, your public ID, coins, gems, VIP points and XP.',
      '• Friends and private messages, stored so they can be delivered.',
      '• Games: tables you played, results and rewards.',
      '• Gifts and purchases: gifts you sent and gem packs you bought. Payments are handled by the App Store or Google Play; we never see your card details.',
      '• Basic technical data needed to run the service.',
    ],
  },
  {
    title: 'Voice and chat in rooms and games',
    body: ['Voice is live and is not recorded or stored. Room and game table chat is relayed live and not stored. Your microphone is only used when you turn it on.'],
  },
  {
    title: 'How we use it',
    body: ['To run your account, rooms, games and messages; to calculate rewards and levels and prevent cheating; and to protect the app from abuse. We do not sell your data.'],
  },
  {
    title: 'Ads',
    body: ['If the mobile app shows ads (for example, rewarded ads for gems), Google AdMob may use your device advertising ID. You can reset or limit it in your device settings.'],
  },
  {
    title: 'Service providers',
    body: ['Supabase (database and sign-in), LiveKit (live voice), Google (sign-in, ads and payments on Android), Apple (payments on iOS) and GitHub Pages (web hosting). They only receive what they need to provide their service.'],
  },
  {
    title: 'What other players see',
    body: ['Your name, avatar, public ID and VIP level, and your voice and messages in rooms and tables you join.'],
  },
  {
    title: 'Deleting your account',
    body: [
      'In the app: Profile → Delete account. Your account and everything linked to it (profile, friends, messages, room, gifts, coins, gems and game results) is deleted immediately and cannot be restored.',
      ...withEmail([`Or email ${CONTACT_EMAIL} with your ID and we will delete it within 30 days.`]),
    ],
  },
  {
    title: 'Children',
    body: ['The app is not intended for children under 13 and we do not knowingly collect their data. If we learn an account belongs to a child under 13, we delete it.'],
  },
  {
    title: 'Security',
    body: ['Data is sent encrypted, and coins, gems and rewards can only be changed by the server. No system is 100% secure, but we do our best.'],
  },
  {
    title: 'Changes and contact',
    body: ['If we change this policy, we will update the date above.', ...withEmail([`Questions: ${CONTACT_EMAIL}`])],
  },
];

export default function Privacy() {
  return (
    <LegalPage
      title="سياسة الخصوصية"
      updated={LEGAL_UPDATED_AR}
      ar={AR}
      en={{ title: `Privacy Policy (updated ${LEGAL_UPDATED_EN})`, sections: EN }}
    />
  );
}
