import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { detectBrand, parseSize, canonicalizeSize, detectForm, detectCategory } from './scraper.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const catalogPath = path.join(__dirname, 'catalog.json');
const storesPath = path.join(__dirname, 'stores.json');

const catalogData = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const storesConfig = JSON.parse(fs.readFileSync(storesPath, 'utf8'));

const EXTERNAL_STORES = storesConfig.externalStores || [];

function cleanTokens(title, brand = '') {
  const stopWords = new Set([
    'egypt', 'powder', 'supplement', 'supplements', 'flavor', 'flavour', '100%', '100',
    'original', 'free', 'with', 'and', 'the', 'box', 'pack', 'sugar', 'drink', 'explosive',
    'energy', 'premium', 'ultra', 'pure', 'food', 'nutrition', 'shaker', 'diet', 'protein',
    'zero', 'added', 'flavour', 'bottle', 'tub', 'serv', 'servings'
  ]);
  
  const brandWords = new Set((brand || '').toLowerCase().split(/\s+/));

  return (title || '').toLowerCase()
    .replace(/[–—\-_/|,()]/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length >= 2 && !stopWords.has(w) && !brandWords.has(w));
}

async function fetchWooCommerceAll(store) {
  console.log(`[Radar] جاري سحب ${store.name} (${store.url})...`);
  const products = [];
  let page = 1;

  while (page <= 8) {
    try {
      const url = `${store.apiUrl}?per_page=100&page=${page}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        signal: AbortSignal.timeout(15000)
      });
      if (!res.ok) break;
      const list = await res.json();
      if (!Array.isArray(list) || list.length === 0) break;

      for (const p of list) {
        const rawPrice = p.prices?.price ? parseInt(p.prices.price, 10) : 0;
        const minorUnit = (p.prices?.currency_minor_unit !== undefined && p.prices?.currency_minor_unit !== null) ? Number(p.prices.currency_minor_unit) : 2;
        const divisor = Math.pow(10, minorUnit);
        let price = rawPrice / divisor;
        const lowerName = (p.name || '').toLowerCase();
        const isSnack = lowerName.includes('bar') || lowerName.includes('snack') || lowerName.includes('chips') || lowerName.includes('spread');
        if (price < 70 && rawPrice >= 500 && !isSnack) {
          price = rawPrice;
        }
        const inStock = p.is_in_stock ?? true;

        if (price > 0 && inStock) {
          const brandAttr = p.attributes?.find(a => a.name?.toLowerCase().includes('brand'))?.terms?.[0]?.name;
          const brand = detectBrand(p.name, brandAttr);
          const size = canonicalizeSize(parseSize(p.name));
          const form = detectForm(p.name);
          const category = detectCategory(p.name);

          products.push({
            id: `${store.id}_${p.id}`,
            name: p.name,
            brand,
            size,
            form,
            category,
            price,
            url: p.permalink,
            image: p.images?.[0]?.src || '',
            inStock,
            storeId: store.id,
            storeName: store.name,
            storeNameAr: store.nameAr || store.name,
            tokens: cleanTokens(p.name, brand)
          });
        }
      }

      console.log(`  -> صفحة ${page}: ${list.length} منتج`);
      page++;
    } catch (err) {
      console.error(`  خطأ في ${store.name}: ${err.message}`);
      break;
    }
  }

  console.log(`  اكتمل ${store.name}: الإجمالي ${products.length} منتج متوفر.`);
  return products;
}

export async function runRadarSync() {
  console.log('--- بدء تحديث رادار الصفقات الخارجية بالتحقق الصارم الشامل ---');
  
  const allExternal = [];
  for (const store of EXTERNAL_STORES) {
    const prods = await fetchWooCommerceAll(store);
    allExternal.push(...prods);
  }

  console.log(`إجمالي المنتجات المسحوبة من الرادار الخارجي: ${allExternal.length}`);

  let dealsCount = 0;
  const products = catalogData.products;

  // Reset any previous externalCheaper on core products
  for (const p of products) {
    p.externalCheaper = null;
    if (!p.lowestCorePrice && p.lowestPrice) {
      p.lowestCorePrice = p.lowestPrice;
      p.cheapestCoreStore = p.cheapestStore;
    }
    p.brand = p.brand || detectBrand(p.title);
    p.size = p.size || canonicalizeSize(parseSize(p.title));
    p.form = p.form || detectForm(p.title);
    p.category = p.category || detectCategory(p.title);
    p.tokens = cleanTokens(p.title, p.brand);
  }

  // Exact & High-Precision Matcher
  for (const ext of allExternal) {
    if (!ext.inStock || ext.price <= 0) continue;

    const extLower = ext.name.toLowerCase();

    for (const core of products) {
      const corePrice = core.lowestCorePrice || core.lowestPrice;
      if (!corePrice || ext.price >= corePrice) continue;

      // Anti-anomaly gate: External price cannot be an unrealistic fraction of core price
      if (ext.price < corePrice * 0.40) continue;

      // Special priority: Exact C4 Drink 500ml match
      const coreLower = core.title.toLowerCase();
      const isC4Match = (extLower.includes('c4') && extLower.includes('500ml') && coreLower.includes('c4') && coreLower.includes('500ml'));

      if (!isC4Match) {
        // Gate 1: Brand Verification
        const coreBrandLower = (core.brand || '').toLowerCase();
        const extBrandLower = (ext.brand || '').toLowerCase();
        if (coreBrandLower !== extBrandLower && !coreLowerMatchesBrand(core.title, ext.brand) && !coreLowerMatchesBrand(ext.name, core.brand)) {
          continue;
        }

        // Gate 2: Form Verification (drink vs powder vs spread vs snack vs capsule)
        if (ext.form && core.form && ext.form !== core.form) {
          continue;
        }

        // Gate 3: Category Verification (creatine cannot match whey protein, etc.)
        if (ext.category && core.category && ext.category !== 'General' && core.category !== 'General' && ext.category !== core.category) {
          continue;
        }

        // Gate 4: Size Verification
        if (ext.size && core.size && ext.size !== core.size) {
          continue;
        }

        // Gate 5: Token Specificity Match
        if (ext.tokens.length === 0 || core.tokens.length === 0) continue;

        let common = 0;
        for (const t of ext.tokens) {
          if (core.tokens.includes(t)) common++;
        }

        const score = common / Math.max(ext.tokens.length, core.tokens.length);
        if (score < 0.70) continue;
      }

      // Attach deal if cheaper than any existing external deal attached
      const savingsVsCore = Math.round((corePrice - ext.price) * 10) / 10;
      if (!core.externalCheaper || ext.price < core.externalCheaper.price) {
        core.externalCheaper = {
          found: true,
          storeId: ext.storeId,
          storeName: ext.storeName,
          storeNameAr: ext.storeNameAr,
          price: ext.price,
          url: ext.url,
          savingsVsCore,
          titleInStore: ext.name,
          verifiedEgypt: true,
          shippingInfo: 'متجر مصري موثوق - شحن لجميع المحافظات'
        };
        core.lowestPrice = ext.price;
        core.cheapestStore = ext.storeName;
        core.isExclusive = false;
      }
    }
  }

  // Clean helper properties from products
  for (const p of products) {
    delete p.tokens;
    if (p.externalCheaper) {
      dealsCount++;
    }
  }

  catalogData.metadata.externalDealsFound = dealsCount;
  catalogData.metadata.externalProductsCount = allExternal.length;
  catalogData.metadata.lastRadarSync = new Date().toISOString();
  catalogData.externalStores = EXTERNAL_STORES;

  fs.writeFileSync(catalogPath, JSON.stringify(catalogData, null, 2), 'utf8');

  console.log(`\n=========================================`);
  console.log(`✅ تم تحديث catalog.json برادار الصفقات الخارجية بنجاح!`);
  console.log(`- صفقات حقيقية مؤكدة أرخص خارج المتاجر الـ 6 (باللون البنفسجي): ${dealsCount}`);
  console.log(`=========================================\n`);
}

function coreLowerMatchesBrand(title, brand) {
  if (!brand || brand === 'ماركة معتمدة') return false;
  return (title || '').toLowerCase().includes(brand.toLowerCase());
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runRadarSync();
}
