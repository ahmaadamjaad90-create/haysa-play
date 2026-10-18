# هيصة بلاي (Haysa Play)

تطبيق غرف صوتية وألعاب جماعية للخليج. عربي، من اليمين لليسار.

- **التقنية:** React Native + Expo (TypeScript)، Expo Router
- **نسخة الويب للتجربة:** https://ahmaadamjaad90-create.github.io/haysa-play/
  (بتنبني تلقائياً مع كل push على `main` من `.github/workflows/web.yml`)

## الموجود هلأ

- الثيم (الألوان والخطوط Lalezar و Tajawal) والاتجاه RTL
- الدخول: Apple و Google و Facebook (تجريبي)، ورقم الجوال مع كود التحقق (تجريبي)
- إعداد الحساب: شخصية أو صورة، الاسم، ورقم ID ثابت
- الرئيسية: شريط الهدايا المتحرك، ألعاب النسخة الأولى، غرف حية (بيانات تجريبية)
- الشريط السفلي: الرئيسية · الغرف · VIP · الأصدقاء · حسابي

## الملفات

```
src/app/            الشاشات (كل ملف = شاشة)
src/app/(tabs)/     شاشات الشريط السفلي
src/components/     القطع المشتركة (الدلّة، الأيقونات، الأزرار)
src/lib/session.tsx الحساب (مؤقتاً على الجهاز، لحد ما نربط Supabase)
src/theme.ts        الألوان والخطوط
```

## أوامر

```bash
npm ci
npx expo start            # تشغيل
npx expo export -p web    # بناء نسخة الويب بمجلد dist
npx tsc --noEmit && npx expo lint
```
