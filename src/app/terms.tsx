import { LegalPage, type LegalSection } from '@/components/LegalPage';
import { CONTACT_EMAIL, LEGAL_UPDATED_AR, LEGAL_UPDATED_EN, withEmail } from '@/lib/legal';

// شروط الاستخدام: صفحة عامة بتفتح بدون تسجيل دخول
const AR: LegalSection[] = [
  { title: 'الموافقة', body: ['باستعمالك لهيصة بلاي إنت موافق على هالشروط وعلى سياسة الخصوصية.'] },
  { title: 'العمر', body: ['لازم يكون عمرك 13 سنة أو أكتر.'] },
  {
    title: 'الاحترام',
    body: [
      'ممنوع السب والتحرّش والتهديد والعنصرية، والمحتوى الجنسي أو العنيف، والنصب والإزعاج، وانتحال شخصية حدا.',
      'ممنوع الغش بالألعاب أو استغلال أي خطأ بالتطبيق.',
      'منقدر نوقف أو نحذف أي حساب بيخالف هالشروط.',
    ],
  },
  {
    title: 'العملات والجواهر والهدايا',
    body: [
      'العملات والجواهر ونقاط VIP عملات افتراضية جوّا التطبيق بس. ما إلها قيمة مالية، وما بتتحوّل لمصاري، وما بتنباع لبرا التطبيق.',
      'المشتريات نهائية، إلا إذا قوانين متجر Apple أو Google بتقول غير هيك.',
    ],
  },
  {
    title: 'الخدمة',
    body: ['منحاول التطبيق يضل شغّال دايماً، بس ممكن يوقف شوي أو نغيّر فيه ميزات. منقدر نعدّل هالشروط، والتاريخ فوق بيتحدّث.'],
  },
  { title: 'التواصل', body: withEmail([`لأي سؤال أو بلاغ: ${CONTACT_EMAIL}`]) },
];

const EN: LegalSection[] = [
  { title: 'Agreement', body: ['By using Haysa Play you agree to these terms and to the Privacy Policy.'] },
  { title: 'Age', body: ['You must be at least 13 years old.'] },
  {
    title: 'Respect',
    body: [
      'No insults, harassment, threats, racism, sexual or violent content, scams, spam or impersonation.',
      'No cheating in games or exploiting bugs.',
      'We may suspend or delete accounts that break these terms.',
    ],
  },
  {
    title: 'Coins, gems and gifts',
    body: [
      'Coins, gems and VIP points are virtual items for use in the app only. They have no cash value and cannot be exchanged for money or sold outside the app.',
      'Purchases are final, except where Apple or Google store rules say otherwise.',
    ],
  },
  { title: 'The service', body: ['We try to keep the app running, but it may be interrupted and features may change. We may update these terms; the date above will change.'] },
  { title: 'Contact', body: withEmail([`Questions or reports: ${CONTACT_EMAIL}`]) },
];

export default function Terms() {
  return (
    <LegalPage
      title="شروط الاستخدام"
      updated={LEGAL_UPDATED_AR}
      ar={AR}
      en={{ title: `Terms of Use (updated ${LEGAL_UPDATED_EN})`, sections: EN }}
    />
  );
}
