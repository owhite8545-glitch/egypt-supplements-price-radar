import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rawStoresConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'stores.json'), 'utf8'));
const CORE_STORES = rawStoresConfig.coreStores || rawStoresConfig;
const EXTERNAL_STORES = rawStoresConfig.externalStores || [];

// Common supplement brands in Egypt
const KNOWN_BRANDS = [
  'Optimum Nutrition', 'MuscleTech', 'Dymatize', 'BioTechUSA', 'BiotechUSA',
  'Kevin Levrone', 'Applied Nutrition', 'Rule 1', 'FA Engineered', 'Cellucor',
  'BSN', 'Dorian Yates', 'DY Nutrition', 'Yava Labs', 'Nutrex', 'Animal',
  'Universal Nutrition', 'Ronnie Coleman', 'Ultimate Nutrition', 'MusclePharm',
  'Redcon1', 'Scitec Nutrition', 'Olimp', 'MyProtein', 'Mutant', 'Tractor',
  'Novogen Pharma', 'Challenger', 'Labrada', 'JNX Sports', 'PVL', 'Ghost',
  'Grenade', 'EHP Labs', 'BPI Sports', 'Evogen'
];

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

function detectBrand(title, vendor) {
  if (vendor && vendor !== 'Unknown' && vendor !== 'Default' && vendor.length > 2) {
    return vendor.trim();
  }
  const lower = title.toLowerCase();
  for (const [alias, canonical] of Object.entries(BRAND_ALIASES)) {
    if (lower.includes(alias)) return canonical;
  }
  for (const b of KNOWN_BRANDS) {
    if (lower.includes(b.toLowerCase())) return b;
  }
  return 'ماركة معتمدة';
}

function extractWeightOrServings(title) {
  const match = title.match(/(\d+(?:\.\d+)?\s*(?:kg|g|gm|lbs|lb|servings|serv|capsules|caps|tablets|tabs|ml))/i);
  return match ? match[0].toUpperCase() : '';
}

function generateMatchKey(title, brand) {
  let clean = title.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ');

  // Normalize common terms
  for (const drop of ['100%', 'powder', 'supplement', 'flavour', 'flavor', 'egypt', 'drink', 'explosive', 'zero', 'sugar', 'energy']) {
    clean = clean.replace(new RegExp(`\\b${drop}\\b`, 'g'), '');
  }
  clean = clean.replace(/\s+/g, ' ').trim();

  const brandWords = (brand || '').toLowerCase().split(/\s+/);
  const words = clean.split(' ').filter(w => w.length >= 2 && !brandWords.includes(w));
  const bKey = (brand || 'brand').toLowerCase().replace(/[^a-z0-9]/g, '_');
  const wKey = words.slice(0, 4).join('_').replace(/[^a-z0-9_]/g, '_');
  return `${bKey}_${wKey}`.replace(/_+/g, '_').replace(/^_|_$/g, '');
}

async function fetchShopifyStore(store, maxPages = 2) {
  console.log(`[Shopify] جاري سحب ${store.nameAr} (${store.name})...`);
  const products = [];
  let page = 1;

  while (page <= maxPages) {
    try {
      const url = `${store.apiUrl}?limit=250&page=${page}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        signal: AbortSignal.timeout(15000)
      });
      if (!res.ok) break;
      const data = await res.json();
      const list = data.products || [];
      if (list.length === 0) break;

      for (const p of list) {
        const variants = p.variants || [];
        const validPrices = variants.map(v => parseFloat(v.price) || 0).filter(pr => pr > 0);
        const minPrice = validPrices.length ? Math.min(...validPrices) : 0;
        const maxPrice = validPrices.length ? Math.max(...validPrices) : minPrice;
        const inStock = variants.some(v => v.available === true);
        const brand = detectBrand(p.title, p.vendor);
        const weight = extractWeightOrServings(p.title);
        const matchKey = generateMatchKey(p.title, brand);

        products.push({
          id: `${store.id}_${p.id}`.replace(/[^a-zA-Z0-9_-]/g, '_'),
          rawId: p.id,
          storeId: store.id,
          storeName: store.nameAr,
          storeNameEn: store.name,
          platform: store.platform,
          isExternal: !!store.isExternalRadar,
          title: p.title,
          brand,
          weight,
          price: minPrice,
          maxVariantPrice: maxPrice,
          originalPrice: variants[0]?.compare_at_price ? parseFloat(variants[0].compare_at_price) : null,
          inStock,
          url: `${store.url}/products/${p.handle}`,
          image: p.images?.[0]?.src || '',
          category: p.product_type || 'مكملات غذائية',
          tags: p.tags || [],
          matchKey,
          updatedAt: p.updated_at || new Date().toISOString()
        });
      }

      console.log(`  -> صفحة ${page}: تم سحب ${list.length} منتج`);
      page++;
    } catch (err) {
      console.error(`  خطأ في ${store.name}: ${err.message}`);
      break;
    }
  }

  console.log(`  اكتمل ${store.nameAr}: الإجمالي ${products.length} منتج.`);
  return products;
}

async function fetchWooCommerceStore(store, maxPages = 4) {
  console.log(`[WooCommerce] جاري سحب ${store.nameAr} (${store.name})...`);
  const products = [];
  let page = 1;

  while (page <= maxPages) {
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
        const rawReg = p.prices?.regular_price ? parseInt(p.prices.regular_price) : 0;
        const regPrice = rawReg / divisor;
        const brandAttr = p.attributes?.find(a => a.name?.toLowerCase().includes('brand'))?.terms?.[0]?.name;
        const brand = detectBrand(p.name, brandAttr);
        const weight = extractWeightOrServings(p.name);
        const matchKey = generateMatchKey(p.name, brand);

        products.push({
          id: `${store.id}_${p.id}`.replace(/[^a-zA-Z0-9_-]/g, '_'),
          rawId: p.id,
          storeId: store.id,
          storeName: store.nameAr,
          storeNameEn: store.name,
          platform: store.platform,
          isExternal: !!store.isExternalRadar,
          title: p.name,
          brand,
          weight,
          price,
          maxVariantPrice: price,
          originalPrice: regPrice > price ? regPrice : null,
          inStock: p.is_in_stock ?? true,
          url: p.permalink,
          image: p.images?.[0]?.src || '',
          category: p.categories?.[0]?.name || 'مكملات غذائية',
          tags: [],
          matchKey,
          updatedAt: new Date().toISOString()
        });
      }

      console.log(`  -> صفحة ${page}: تم سحب ${list.length} منتج`);
      page++;
    } catch (err) {
      console.error(`  خطأ في ${store.name}: ${err.message}`);
      break;
    }
  }

  console.log(`  اكتمل ${store.nameAr}: الإجمالي ${products.length} منتج.`);
  return products;
}

export async function runScraper(options = { full: false }) {
  const startTime = Date.now();
  console.log(`=========================================`);
  console.log(`🚀 بدء فحص وتتبع أسعار مكملات مصر (6 متاجر أساسية + رادار السوق الخارجي)`);
  console.log(`الوقت: ${new Date().toLocaleString('ar-EG')}`);
  console.log(`=========================================\n`);

  const allCoreProducts = [];
  const allExternalProducts = [];

  const maxShopifyPages = options.full ? 10 : 2;
  const maxWcPages = options.full ? 15 : 3;

  // 1. Scrape 6 Core Stores
  for (const store of CORE_STORES) {
    store.isExternalRadar = false;
    let prods = [];
    if (store.type === 'shopify') {
      prods = await fetchShopifyStore(store, maxShopifyPages);
    } else {
      prods = await fetchWooCommerceStore(store, maxWcPages);
    }
    allCoreProducts.push(...prods);
  }

  // 2. Scrape External Stores
  for (const store of EXTERNAL_STORES) {
    store.isExternalRadar = true;
    let prods = [];
    if (store.type === 'shopify') {
      prods = await fetchShopifyStore(store, 2);
    } else {
      prods = await fetchWooCommerceStore(store, 2);
    }
    allExternalProducts.push(...prods);
  }

  console.log(`\nتم سحب ${allCoreProducts.length} منتج من المتاجر الـ 6، و ${allExternalProducts.length} منتج من رادار السوق الخارجي.`);

  const groupedMap = new Map();

  for (const item of allCoreProducts) {
    if (!item.price || item.price <= 0) continue;
    let key = item.matchKey;
    if (!key || key.length < 3) key = item.title.toLowerCase().replace(/[^a-z0-9]/g, '_');
    key = key.replace(/[^a-zA-Z0-9_-]/g, '_');

    if (!groupedMap.has(key)) {
      groupedMap.set(key, {
        matchKey: key,
        title: item.title,
        brand: item.brand,
        weight: item.weight,
        category: item.category,
        image: item.image,
        coreVariants: [],
        externalVariants: []
      });
    }

    const group = groupedMap.get(key);
    if (!group.image && item.image) group.image = item.image;
    group.coreVariants.push(item);
  }

  for (const extItem of allExternalProducts) {
    if (!extItem.price || extItem.price <= 0) continue;
    let key = extItem.matchKey;
    if (!key || key.length < 3) key = extItem.title.toLowerCase().replace(/[^a-z0-9]/g, '_');
    key = key.replace(/[^a-zA-Z0-9_-]/g, '_');

    if (groupedMap.has(key)) {
      groupedMap.get(key).externalVariants.push(extItem);
    } else {
      groupedMap.set(key, {
        matchKey: key,
        title: extItem.title,
        brand: extItem.brand,
        weight: extItem.weight,
        category: extItem.category,
        image: extItem.image,
        coreVariants: [],
        externalVariants: [extItem]
      });
    }
  }

  const catalog = [];

  for (const [key, group] of groupedMap.entries()) {
    const storeBreakdown = {};
    const availableCoreStores = [];

    for (const store of CORE_STORES) {
      const match = group.coreVariants.find(v => v.storeId === store.id);
      if (match) {
        storeBreakdown[store.id] = {
          storeId: store.id,
          storeName: store.nameAr,
          storeNameEn: store.name,
          platform: store.platform,
          available: true,
          inStock: match.inStock,
          price: match.price,
          originalPrice: match.originalPrice,
          url: match.url,
          image: match.image,
          titleInStore: match.title
        };
        if (match.inStock && match.price > 0) {
          availableCoreStores.push({
            storeId: store.id,
            storeName: store.nameAr,
            price: match.price,
            url: match.url
          });
        }
      } else {
        storeBreakdown[store.id] = {
          storeId: store.id,
          storeName: store.nameAr,
          storeNameEn: store.name,
          platform: store.platform,
          available: false,
          inStock: false,
          price: null,
          reason: 'غير متوفر في هذا المتجر'
        };
      }
    }

    let lowestCorePrice = null;
    let cheapestCoreStore = null;
    let highestCorePrice = null;

    if (availableCoreStores.length > 0) {
      availableCoreStores.sort((a, b) => a.price - b.price);
      lowestCorePrice = availableCoreStores[0].price;
      cheapestCoreStore = availableCoreStores[0].storeName;
      highestCorePrice = availableCoreStores[availableCoreStores.length - 1].price;
    } else if (group.coreVariants.length > 0) {
      const priced = group.coreVariants.filter(v => v.price > 0);
      if (priced.length) {
        priced.sort((a, b) => a.price - b.price);
        lowestCorePrice = priced[0].price;
        cheapestCoreStore = priced[0].storeName;
        highestCorePrice = priced[priced.length - 1].price;
      }
    }

    let externalCheaper = null;
    const pricedExternal = group.externalVariants.filter(v => v.price > 0 && v.inStock);

    if (pricedExternal.length > 0) {
      pricedExternal.sort((a, b) => a.price - b.price);
      const bestExt = pricedExternal[0];

      if (!lowestCorePrice || bestExt.price < lowestCorePrice) {
        const savingsVsCore = lowestCorePrice ? (lowestCorePrice - bestExt.price) : 0;
        externalCheaper = {
          found: true,
          storeId: bestExt.storeId,
          storeName: bestExt.storeName,
          storeNameEn: bestExt.storeNameEn,
          price: bestExt.price,
          url: bestExt.url,
          savingsVsCore: Math.round(savingsVsCore * 10) / 10,
          titleInStore: bestExt.title,
          verifiedEgypt: true,
          shippingInfo: 'متجر مصري موثوق - شحن لجميع المحافظات'
        };
      }
    }

    const absoluteLowestPrice = externalCheaper ? externalCheaper.price : lowestCorePrice;
    const absoluteCheapestStore = externalCheaper ? externalCheaper.storeName : cheapestCoreStore;
    const isExclusive = (availableCoreStores.length === 1 && !externalCheaper);
    const maxSavings = (highestCorePrice && absoluteLowestPrice) ? (highestCorePrice - absoluteLowestPrice) : 0;

    catalog.push({
      id: key.replace(/[^a-zA-Z0-9_-]/g, '_'),
      title: group.title,
      brand: group.brand,
      weight: group.weight,
      category: group.category,
      image: group.image,
      lowestPrice: absoluteLowestPrice,
      cheapestStore: absoluteCheapestStore,
      lowestCorePrice,
      cheapestCoreStore,
      highestPrice: highestCorePrice,
      maxSavings,
      isExclusive,
      availableCount: availableCoreStores.length,
      storeBreakdown,
      externalCheaper,
      lastUpdated: new Date().toISOString()
    });
  }

  catalog.sort((a, b) => b.availableCount - a.availableCount);

  const outputData = {
    metadata: {
      generatedAt: new Date().toISOString(),
      durationSeconds: Math.round((Date.now() - startTime) / 1000),
      totalRawProducts: allCoreProducts.length + allExternalProducts.length,
      coreProductsCount: allCoreProducts.length,
      externalProductsCount: allExternalProducts.length,
      totalComparedItems: catalog.length,
      externalDealsFound: catalog.filter(c => c.externalCheaper).length,
      storesCount: CORE_STORES.length
    },
    coreStores: CORE_STORES,
    externalStores: EXTERNAL_STORES,
    products: catalog
  };

  const catalogPath = path.join(__dirname, 'catalog.json');
  fs.writeFileSync(catalogPath, JSON.stringify(outputData, null, 2), 'utf8');

  console.log(`\n=========================================`);
  console.log(`✅ تم حفظ الكتالوج المحدّث بنجاح في catalog.json`);
  console.log(`- إجمالي المجموعات المقارنة: ${catalog.length}`);
  console.log(`- صفقات تم رصدها أرخص خارج المتاجر الـ 6 (باللون البنفسجي): ${outputData.metadata.externalDealsFound}`);
  console.log(`- استغرق الفحص: ${outputData.metadata.durationSeconds} ثانية`);
  console.log(`=========================================\n`);

  return outputData;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const isFull = process.argv.includes('--all') || process.argv.includes('--full');
  runScraper({ full: isFull });
}
