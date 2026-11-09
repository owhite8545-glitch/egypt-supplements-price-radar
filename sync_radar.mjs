import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const catalogPath = path.join(__dirname, 'catalog.json');
const storesPath = path.join(__dirname, 'stores.json');

const catalogData = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const storesConfig = JSON.parse(fs.readFileSync(storesPath, 'utf8'));

const CORE_STORES = storesConfig.coreStores || [];
const EXTERNAL_STORES = storesConfig.externalStores || [];

const BRAND_ALIASES = {
  'c4': 'Cellucor',
  'gold standard': 'Optimum Nutrition',
  'nitrotech': 'MuscleTech',
  'nitro tech': 'MuscleTech',
  'hydroxycut': 'MuscleTech',
  'iso100': 'Dymatize',
  'iso 100': 'Dymatize',
  'the curse': 'JNX Sports',
  'animal pak': 'Animal',
  'animal cuts': 'Animal',
  'animal whey': 'Animal',
  'anabolic iso': 'Kevin Levrone',
  'total war': 'Redcon1'
};

function extractSize(title) {
  const match = title.match(/(\d+(?:\.\d+)?\s*(?:kg|g|gm|lbs|lb|servings|serv|capsules|caps|tablets|tabs|ml|pack|can))/i);
  if (!match) return '';
  return match[0].toLowerCase().replace(/\s+/g, '');
}

function cleanTokens(title) {
  const stopWords = new Set([
    'egypt', 'powder', 'supplement', 'supplements', 'flavor', 'flavour', '100%', '100',
    'original', 'free', 'with', 'and', 'the', 'box', 'pack', 'sugar', 'drink', 'explosive',
    'energy', 'premium', 'ultra', 'pure', 'food', 'nutrition', 'shaker', 'diet', 'protein'
  ]);
  
  return title.toLowerCase()
    .replace(/[–—\-_/|,()]/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length >= 2 && !stopWords.has(w));
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
        const rawPrice = p.prices?.price ? parseInt(p.prices.price) : 0;
        const divisor = Math.pow(10, p.prices?.currency_minor_unit || 2);
        const price = rawPrice / divisor;
        const inStock = p.is_in_stock ?? true;

        if (price > 0) {
          products.push({
            id: `${store.id}_${p.id}`,
            name: p.name,
            price,
            url: p.permalink,
            image: p.images?.[0]?.src || '',
            inStock,
            storeId: store.id,
            storeName: store.name,
            storeNameAr: store.nameAr || store.name,
            size: extractSize(p.name),
            tokens: cleanTokens(p.name)
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

  console.log(`  اكتمل ${store.name}: الإجمالي ${products.length} منتج`);
  return products;
}

export async function runRadarSync() {
  console.log('--- بدء تحديث رادار الصفقات الخارجية ---');
  
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
    p.size = extractSize(p.title);
    p.tokens = cleanTokens(p.title);
  }

  // Exact & Fuzzy Matcher
  for (const ext of allExternal) {
    if (!ext.inStock) continue;

    // Check specific known deals first (like C4 Drink 500ml)
    const extLower = ext.name.toLowerCase();
    
    let matchedProduct = null;
    let bestScore = 0;

    for (const core of products) {
      const coreLower = core.title.toLowerCase();

      // Check special high priority exact matches:
      if (extLower.includes('c4') && extLower.includes('500ml') && coreLower.includes('c4') && coreLower.includes('500ml')) {
        matchedProduct = core;
        break;
      }

      // Check size compatibility if both specify size
      if (ext.size && core.size && ext.size !== core.size) {
        continue;
      }

      // Token overlap
      let common = 0;
      for (const t of ext.tokens) {
        if (core.tokens.includes(t)) common++;
      }

      const score = common / Math.max(ext.tokens.length, core.tokens.length, 1);
      if (score >= 0.48 && score > bestScore) {
        bestScore = score;
        matchedProduct = core;
      }
    }

    if (matchedProduct) {
      const corePrice = matchedProduct.lowestCorePrice || matchedProduct.lowestPrice;
      if (corePrice && ext.price < corePrice) {
        const savingsVsCore = Math.round((corePrice - ext.price) * 10) / 10;
        
        // If this external deal is cheaper than any previously attached external deal
        if (!matchedProduct.externalCheaper || ext.price < matchedProduct.externalCheaper.price) {
          matchedProduct.externalCheaper = {
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
          matchedProduct.lowestPrice = ext.price;
          matchedProduct.cheapestStore = ext.storeName;
        }
      }
    }
  }

  // Clean helper properties from products
  for (const p of products) {
    delete p.size;
    delete p.tokens;
    if (p.externalCheaper) dealsCount++;
  }

  catalogData.metadata.externalDealsFound = dealsCount;
  catalogData.metadata.externalProductsCount = allExternal.length;
  catalogData.metadata.lastRadarSync = new Date().toISOString();
  catalogData.externalStores = EXTERNAL_STORES;

  fs.writeFileSync(catalogPath, JSON.stringify(catalogData, null, 2), 'utf8');

  console.log(`\n=========================================`);
  console.log(`✅ تم تحديث catalog.json بنجاح!`);
  console.log(`- صفقات تم رصدها أرخص خارج المتاجر الـ 6 (باللون البنفسجي): ${dealsCount}`);
  console.log(`=========================================\n`);
}

runRadarSync();
