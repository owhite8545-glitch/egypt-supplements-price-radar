# 🏋️‍♂️ رادار أسعار المكملات في مصر | Egypt Supplements Price Radar

> أذكى وأدق محرك لمقارنة أسعار المكملات الغذائية في مصر لحظة بلحظة بين أشهر المتاجر المعتمدة مع رادار خارجي لأقوى الصفقات الحصرية.

---

## 🌟 المميزات الرئيسية

1. **مقارنة حية لـ 6 متاجر رئيسية في مصر**:
   - Super Supplement
   - MF Supplement
   - Max Muscle
   - Power Fit Supplement
   - The Coach
   - Power Store

2. **رادار الأسعار الخارجية (External Market Deals)**:
   - نظام رادار يرصد العروض الأرخص خارج المتاجر الـ 6 (مثل GoFit Egypt و iFIT Egypt).
   - تمييز أرخص سعر بين الـ 6 باللون الأخضر، وإبراز الصفقات الخارجية الأرخص ببطاقة مخصصة باللون البنفسجي ورابط شراء مباشر في مصر.

3. **حاسبة ومحسّن السلة الذكية (Smart Cart Optimizer)**:
   - تجميع المنتجات واقتراح الشراء المجمع أو تفريق الطلب للحصول على أقصى توفير ممكن مع حساب كوبونات الخصم والشحن.

4. **تصميم احترافي فائق التميز (Premium Espresso Dark Mode)**:
   - واجهة عصرية باللون البني البريميوم والذهبي الفاخر مع دعم كامل للغة العربية (RTL).
   - تجربة استخدام سريعة ومتوافقة 100% مع الهواتف والحواسب.

5. **أدوات مشاركة سريعة**:
   - مشاركة الصفقات عبر WhatsApp بنقرة واحدة.
   - فلترة ذكية حسب التصنيف، السعر، والمتجر.

---

## 🛠️ البنية التقنية

- **الواجهة:** HTML5, Modern CSS (Espresso Bronze Design System), Tailwind CSS, Vanilla JS.
- **محرك السحب (Scraper):**
  - متوفر بنسختين: Node.js (`scraper.mjs`) و Python (`scraper.py`).
  - دعم Pagination كامل لمتاجر Shopify و WooCommerce.
- **خادم التطوير:** Node.js HTTP Server (`server.mjs`).
- **السحابة والنشر:** مهيأ بالكامل للنشر الفوري على **Vercel** عبر `vercel.json` مع خوادم Serverless بدون خادم.

---

## 🚀 التشغيل السريع

### المتطلبات
- Node.js (v18+) أو Python 3.9+

### تشغيل خادم التطوير المحلي
```bash
npm start
# يفتح الخادم المحلي على http://localhost:3000
```

### تحديث أسعار المنتجات (Scraping)
```bash
# باستخدام Node.js
npm run scrape:full

# أو باستخدام Python
npm run py:scrape
```

---

## 📦 النشر على Vercel
المشروع جاهز ومجهز بملف `vercel.json` لإنشاء الـ Endpoints الثابتة ودوال الـ Serverless.

```bash
vercel deploy
```
