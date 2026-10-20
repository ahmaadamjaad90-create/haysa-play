// إيميل التواصل اللي بيطلع بصفحات الخصوصية والشروط (فاضي لحد ما صاحب التطبيق يختار واحد)
export const CONTACT_EMAIL = '';

// الأسطر اللي فيها الإيميل بتختفي إذا ما في إيميل
export const withEmail = (lines: string[]) => (CONTACT_EMAIL ? lines : []);
export const LEGAL_UPDATED_AR = '20 أكتوبر 2026';
export const LEGAL_UPDATED_EN = 'October 20, 2026';
