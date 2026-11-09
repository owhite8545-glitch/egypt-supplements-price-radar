import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rawStoresConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'stores.json'), 'utf8'));
const CORE_STORES = rawStoresConfig.coreStores || rawStoresConfig;
const EXTERNAL_STORES = rawStoresConfig.externalStores || [];

// Comprehensive Egyptian Supplement Brands
const KNOWN_BRANDS = [
  'Optimum Nutrition', 'MuscleTech', 'Dymatize', 'BioTechUSA', 'BiotechUSA',
  'Kevin Levrone', 'Applied Nutrition', 'Rule 1', 'FA Engineered', 'Cellucor',
  'BSN', 'Dorian Yates', 'DY Nutrition', 'Yava Labs', 'Nutrex', 'Animal',
  'Universal Nutrition', 'Ronnie Coleman', 'Ultimate Nutrition', 'MusclePharm',
  'Redcon1', 'Scitec Nutrition', 'Olimp', 'MyProtein', 'Mutant', 'Tractor',
  'Novogen Pharma', 'Challenger', 'Labrada', 'JNX Sports', 'PVL', 'Ghost',
  'Grenade', 'EHP Labs', 'BPI Sports', 'Evogen', 'Organic Nation', 'Strong Muscles',
  'Muscle Add', 'William Bonac', 'Wellness Nutrition', 'Skeleton Nutrition',
  'Victor Martinez', 'Now Foods', 'Now', 'Horbaach', 'Carlyle', 'Keep Going',
  'Pureganic', 'Jamieson', 'Keenceutical', 'Alfa Vitamins', 'Solaray', 'Neocell',
  'Marvelous', 'Building Blox', 'Pure Health'
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
  'total war': 'Redcon1',
  'novogen': 'Novogen Pharma',
  'yava': 'Yava Labs',
  'organic nation': 'Organic Nation',
  'muscle add': 'Muscle Add',
  'strong muscles': 'Strong Muscles',
  'puritan': "Puritan's Pride"
};

export function detectBrand(title, vendor) {
  if (vendor && vendor !== 'Unknown' && vendor !== 'Default' && vendor.length > 2) {
    const vTrim = vendor.trim();
    if (!['General', 'Other', 'Default Title'].includes(vTrim)) return vTrim;
  }
  const lower = (title || '').toLowerCase();
  for (const [alias, canonical] of Object.entries(BRAND_ALIASES)) {
    if (lower.includes(alias)) return canonical;
  }
  for (const b of KNOWN_BRANDS) {
    if (lower.includes(b.toLowerCase())) return b;
  }
  return 'ماركة معتمدة';
}

export function parseSize(title, variantTitle = '') {
  const combined = (title + ' ' + variantTitle).toLowerCase();
  
  // 1. Weight in kg
  const kgMatch = combined.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilo)/i);
  if (kgMatch) return kgMatch[1] + 'kg';
  
  // 2. Weight in lbs
  const lbsMatch = combined.match(/(\d+(?:\.\d+)?)\s*(?:lbs|lb|pound)/i);
  if (lbsMatch) return lbsMatch[1] + 'lb';

  // 3. Weight in g / gm (avoid matching nutritional mg/mcg)
  const gMatch = combined.match(/(\d+(?:\.\d+)?)\s*(?:g|gm|gram|grams)\b(?!\s*(?:protein|sugar|fat|bcaa|glutamine|creatine))/i);
  if (gMatch && !combined.includes(gMatch[1] + 'mg') && !combined.includes(gMatch[1] + 'mcg')) {
    return parseInt(gMatch[1], 10) + 'g';
  }

  // 4. Volume in ml / l
  const mlMatch = combined.match(/(\d+(?:\.\d+)?)\s*(?:ml|liter|litre)/i);
  if (mlMatch) return mlMatch[1] + 'ml';

  // 5. Servings
  const servMatch = combined.match(/(\d+)\s*(?:servings|serves|serv|ser)\b/i);
  if (servMatch) return servMatch[1] + 'serv';

  // 6. Count
  const countMatch = combined.match(/(\d+)\s*(?:capsules|caps|tablets|tabs|softgels|gummies|pieces|sachets)\b/i);
  if (countMatch) return countMatch[1] + 'count';

  return '';
}

export function canonicalizeSize(raw) {
  if (!raw) return '';
  raw = raw.toLowerCase().trim();
  if (['5lb', '5lbs', '2.27kg', '2.2kg', '2.3kg'].includes(raw)) return '2.27kg';
  if (['2lb', '2lbs', '908g', '907g', '0.9kg'].includes(raw)) return '908g';
  if (['10lb', '10lbs', '4.54kg', '4.5kg'].includes(raw)) return '4.54kg';
  if (['12lb', '12lbs', '5.44kg'].includes(raw)) return '5.44kg';
  if (['6lb', '6lbs', '2.72kg'].includes(raw)) return '2.72kg';
  if (['1000g', '1kg'].includes(raw)) return '1kg';
  if (['2000g', '2kg'].includes(raw)) return '2kg';
  if (['3000g', '3kg'].includes(raw)) return '3kg';
  if (['4000g', '4kg'].includes(raw)) return '4kg';
  if (['500g', '0.5kg'].includes(raw)) return '500g';
  if (['300g'].includes(raw)) return '300g';
  if (['250g'].includes(raw)) return '250g';
  if (['200g', '200gm'].includes(raw)) return '200g';
  if (['370g', '370gm'].includes(raw)) return '370g';
  if (['33g', '33gm'].includes(raw)) return '33g';
  return raw;
}

export function detectForm(title) {
  const t = (title || '').toLowerCase();
  if (t.includes('drink') || t.includes('can ') || t.includes('beverage') || t.includes('ready-to-drink') || t.includes('ready to drink') || t.includes('rtd')) return 'drink';
  if (t.includes('spread') || t.includes('butter') || t.includes('jam') || t.includes('sauce')) return 'spread';
  if (t.includes('bar') || t.includes('cookie') || t.includes('cake') || t.includes('snack')) return 'snack';
  if (t.includes('capsule') || t.includes('caps') || t.includes('tablet') || t.includes('tabs') || t.includes('softgel') || t.includes('gummies')) return 'capsule';
  return 'powder';
}

export function detectCategory(title) {
  const t = (title || '').toLowerCase();
  if (t.includes('spread') || t.includes('butter') || t.includes('jam') || t.includes('sauce') || t.includes('cake') || t.includes('cookie') || t.includes('sweetener')) return 'Groceries';
  if (t.includes('drink') || t.includes('can ') || t.includes('beverage') || t.includes('ready-to-drink') || t.includes('rtd')) return 'Energy Drinks';
  if (t.includes('creatine') || t.includes('crea ') || t.includes('creapure')) return 'Creatine';
  if (t.includes('pre-workout') || t.includes('pre workout') || t.includes('preworkout') || t.includes('the curse') || t.includes('total war') || t.includes('supernova')) return 'Pre-Workout';
  if (t.includes('whey') || t.includes('isolate') || t.includes('casein') || t.includes('gainer') || t.includes('mass') || t.includes('protein')) return 'Protein';
  if (t.includes('bcaa') || t.includes('eaa') || t.includes('glutamine') || t.includes('citrulline') || t.includes('amino') || t.includes('beta-alanine') || t.includes('beta alanine')) return 'Amino Acids';
  if (t.includes('lipo') || t.includes('carnitine') || t.includes('cla') || t.includes('burner') || t.includes('hydroxycut')) return 'Fat Burners';
  if (t.includes('vitamin') || t.includes('multivitamin') || t.includes('zinc') || t.includes('omega') || t.includes('magnesium') || t.includes('d3') || t.includes('collagen') || t.includes('melatonin') || t.includes('biotin')) return 'Vitamins';
  return 'General';
}

export function generateMatchKey(title, brand, size = '', form = '') {
  let clean = (title || '').toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ');

  // Strip generic marketing words
  for (const drop of ['100%', 'powder', 'supplement', 'supplements', 'flavour', 'flavor', 'egypt', 'zero', 'sugar', 'original', 'premium', 'high']) {
    clean = clean.replace(new RegExp(`\\b${drop}\\b`, 'g'), '');
  }
  clean = clean.replace(/\s+/g, ' ').trim();

  const brandWords = (brand || '').toLowerCase().split(/\s+/);
  const words = clean.split(' ').filter(w => w.length >= 2 && !brandWords.includes(w));
  const bKey = (brand || 'brand').toLowerCase().replace(/[^a-z0-9]/g, '_');
  const wKey = words.slice(0, 4).join('_').replace(/[^a-z0-9_]/g, '_');
  const szKey = (size || '').replace(/[^a-z0-9]/g, '');
  const fKey = (form || '').replace(/[^a-z0-9]/g, '');

  return `${bKey}_${wKey}${szKey ? '_' + szKey : ''}${fKey ? '_' + fKey : ''}`.replace(/_+/g, '_').replace(/^_|_$/g, '');
}

function groupVariantsBySize(p) {
  const variants = p.variants || [];
  if (variants.length <= 1) {
    const v = variants[0];
    const price = v ? parseFloat(v.price) || 0 : 0;
    const compareAt = v?.compare_at_price ? parseFloat(v.compare_at_price) : null;
    const inStock = v ? (v.available === true) : true;
    const sz = canonicalizeSize(parseSize(p.title, v?.title || ''));
    return [{
      size: sz,
      variantTitle: v?.title || '',
      price,
      originalPrice: compareAt && compareAt > price ? compareAt : null,
      inStock,
      variantId: v?.id
    }];
  }

  // Multi-variant product: group variants by distinct size
  const groups = new Map();
  for (const v of variants) {
    const rawSz = parseSize(p.title, v.title || '');
    const sz = canonicalizeSize(rawSz) || 'default';
    if (!groups.has(sz)) groups.set(sz, []);
    groups.get(sz).push(v);
  }

  const result = [];
  for (const [sz, vList] of groups.entries()) {
    const inStock = vList.some(v => v.available === true);
    const availableVars = vList.filter(v => v.available === true && parseFloat(v.price) > 0);
    const chosenVars = availableVars.length > 0 ? availableVars : vList.filter(v => parseFloat(v.price) > 0);
    if (chosenVars.length === 0) continue;

    // Pick best price among this specific size
    chosenVars.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
    const bestVar = chosenVars[0];
    const price = parseFloat(bestVar.price) || 0;
    const compareAt = bestVar.compare_at_price ? parseFloat(bestVar.compare_at_price) : null;

    result.push({
      size: sz === 'default' ? '' : sz,
      variantTitle: bestVar.title,
      price,
      originalPrice: compareAt && compareAt > price ? compareAt : null,
      inStock,
      variantId: bestVar.id
    });
  }

  return result;
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
        const sizeGroups = groupVariantsBySize(p);

        for (const sg of sizeGroups) {
          if (!sg.price || sg.price <= 0) continue;

          const brand = detectBrand(p.title, p.vendor);
          const size = sg.size;
          const form = detectForm(p.title + ' ' + sg.variantTitle);
          const category = detectCategory(p.title);
          const matchKey = generateMatchKey(p.title, brand, size, form);

          let displayTitle = p.title;
          if (size && !p.title.toLowerCase().includes(size.toLowerCase())) {
            displayTitle = `${p.title} (${size.toUpperCase()})`;
          }

          products.push({
            id: `${store.id}_${p.id}_${size || 'def'}`.replace(/[^a-zA-Z0-9_-]/g, '_'),
            rawId: p.id,
            variantId: sg.variantId,
            storeId: store.id,
            storeName: store.nameAr,
            storeNameEn: store.name,
            platform: store.platform,
            isExternal: !!store.isExternalRadar,
            title: displayTitle,
            brand,
            weight: size ? size.toUpperCase() : '',
            size,
            form,
            price: sg.price,
            maxVariantPrice: sg.price,
            originalPrice: sg.originalPrice,
            inStock: sg.inStock,
            url: `${store.url}/products/${p.handle}${sg.variantId ? '?variant=' + sg.variantId : ''}`,
            image: p.images?.[0]?.src || '',
            category: p.product_type || category,
            tags: p.tags || [],
            matchKey,
            updatedAt: p.updated_at || new Date().toISOString()
          });
        }
      }

      console.log(`  -> صفحة ${page}: تم سحب ${list.length} منتج أصلي`);
      page++;
    } catch (err) {
      console.error(`  خطأ في ${store.name}: ${err.message}`);
      break;
    }
  }

  console.log(`  اكتمل ${store.nameAr}: الإجمالي ${products.length} صنف/حجم.`);
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
        const rawPrice = p.prices?.price ? parseInt(p.prices.price, 10) : 0;
        const divisor = Math.pow(10, p.prices?.currency_minor_unit || 2);
        const price = rawPrice / divisor;
        if (!price || price <= 0) continue;

        const rawReg = p.prices?.regular_price ? parseInt(p.prices.regular_price, 10) : 0;
        const regPrice = rawReg / divisor;
        const brandAttr = p.attributes?.find(a => a.name?.toLowerCase().includes('brand'))?.terms?.[0]?.name;
        const brand = detectBrand(p.name, brandAttr);
        const size = canonicalizeSize(parseSize(p.name));
        const form = detectForm(p.name);
        const category = detectCategory(p.name);
        const matchKey = generateMatchKey(p.name, brand, size, form);

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
          weight: size ? size.toUpperCase() : '',
          size,
          form,
          price,
          maxVariantPrice: price,
          originalPrice: regPrice > price ? regPrice : null,
          inStock: p.is_in_stock ?? true,
          url: p.permalink,
          image: p.images?.[0]?.src || '',
          category: p.categories?.[0]?.name || category,
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
  console.log(`🚀 بدء فحص وتتبع أسعار مكملات مصر بدقة 100% متطابقة للأحجام`);
  console.log(`الوقت: ${new Date().toLocaleString('ar-EG')}`);
  console.log(`=========================================\n`);

  const allCoreProducts = [];
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

  console.log(`\nتم سحب ${allCoreProducts.length} صنف/حجم من المتاجر الـ 6 الأساسية.`);

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
        size: item.size,
        form: item.form,
        category: item.category,
        image: item.image,
        coreVariants: []
      });
    }

    const group = groupedMap.get(key);
    if (!group.image && item.image) group.image = item.image;
    group.coreVariants.push(item);
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
          available: false
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

    const isExclusive = (availableCoreStores.length === 1);
    const maxSavings = (highestCorePrice && lowestCorePrice) ? (highestCorePrice - lowestCorePrice) : 0;

    catalog.push({
      id: key.replace(/[^a-zA-Z0-9_-]/g, '_'),
      title: group.title,
      brand: group.brand,
      weight: group.weight,
      size: group.size,
      form: group.form,
      category: group.category,
      image: group.image,
      lowestPrice: lowestCorePrice,
      cheapestStore: cheapestCoreStore,
      lowestCorePrice,
      cheapestCoreStore,
      highestPrice: highestCorePrice,
      maxSavings,
      isExclusive,
      availableCount: availableCoreStores.length,
      storeBreakdown,
      externalCheaper: null,
      lastUpdated: new Date().toISOString()
    });
  }

  catalog.sort((a, b) => b.availableCount - a.availableCount);

  const outputData = {
    metadata: {
      generatedAt: new Date().toISOString(),
      durationSeconds: Math.round((Date.now() - startTime) / 1000),
      totalRawProducts: allCoreProducts.length,
      coreProductsCount: allCoreProducts.length,
      totalComparedItems: catalog.length,
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
  console.log(`- إجمالي الأصناف/المجموعات المقارنة بدقة: ${catalog.length}`);
  console.log(`- استغرق الفحص: ${outputData.metadata.durationSeconds} ثانية`);
  console.log(`=========================================\n`);

  return outputData;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const isFull = process.argv.includes('--all') || process.argv.includes('--full');
  runScraper({ full: isFull });
}
