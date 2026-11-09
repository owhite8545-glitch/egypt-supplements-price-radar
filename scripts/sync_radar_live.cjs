/**
 * 24/7 Automated Periodic Radar Synchronization Engine
 * Crawls Egyptian supplement stores, updates live prices, discovers new products,
 * normalizes store names strictly to English, and updates catalog.json.
 */

const fs = require('fs');
const path = require('path');

const CATALOG_PATH = path.join(__dirname, '..', 'catalog.json');
const STORES_PATH = path.join(__dirname, '..', 'stores.json');

// Core English Store Names Mapping
const STORE_NAME_EN = {
  'super_supplement': 'Super Supplement',
  'mf_supplement': 'MF Supplement',
  'max_muscle': 'Max Muscle Elite',
  'power_fit': 'Power Fit',
  'the_coach': 'The Coach',
  'power_store': 'Power Store',
  'train_hard': 'Train Hard',
  'fitness_tech': 'Fitness Tech',
  'protein_we_vitamin': 'Protein & Vitamin',
  'ifit_egypt': 'iFIT Egypt',
  'fit_spot': 'Fit Spot',
  'zero_fat': 'Zero Fat Supplements',
  'gofit_egypt': 'GoFit Egypt',
  'social_media': 'Social Media & Pages',
  'olx_egypt': 'OLX Egypt & Open Market'
};

const ARABIC_TO_EN_STORE = {
  'إم إف سبلمنت': 'MF Supplement',
  'سوبر سبلمنت': 'Super Supplement',
  'ماكس مسل إيليت': 'Max Muscle Elite',
  'باور فيت سبلمنت': 'Power Fit',
  'باور ستور': 'Power Store',
  'ذا كوتش': 'The Coach',
  'ترين هارد': 'Train Hard',
  'فتنس تك سبلمنت': 'Fitness Tech',
  'بروتين وي فيتامين': 'Protein & Vitamin',
  'آي فيت مصر': 'iFIT Egypt',
  'فيت سبوت': 'Fit Spot',
  'زيرو فات': 'Zero Fat Supplements',
  'جو فيت مصر': 'GoFit Egypt'
};

function normalizeStoreName(name, storeId) {
  if (STORE_NAME_EN[storeId]) return STORE_NAME_EN[storeId];
  if (ARABIC_TO_EN_STORE[name]) return ARABIC_TO_EN_STORE[name];
  return name || 'Verified Store';
}

function normalizeTitle(t) {
  if (!t) return '';
  return t
    .toLowerCase()
    .replace(/&#\d+;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[^\w\s\u0600-\u06FF]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseSize(title, variantTitle = '') {
  const combined = (title + ' ' + variantTitle).toLowerCase();
  const kgMatch = combined.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilo)/i);
  if (kgMatch) return kgMatch[1] + 'kg';
  const lbsMatch = combined.match(/(\d+(?:\.\d+)?)\s*(?:lbs|lb|pound)/i);
  if (lbsMatch) return lbsMatch[1] + 'lb';
  const gMatch = combined.match(/(\d+(?:\.\d+)?)\s*(?:g|gm|gram|grams)\b(?!\s*(?:protein|sugar|fat|bcaa|glutamine|creatine))/i);
  if (gMatch && !combined.includes(gMatch[1] + 'mg') && !combined.includes(gMatch[1] + 'mcg')) {
    return parseInt(gMatch[1], 10) + 'g';
  }
  const servMatch = combined.match(/(\d+)\s*(?:servings|serves|serv|ser)\b/i);
  if (servMatch) return servMatch[1] + 'serv';
  const countMatch = combined.match(/(\d+)\s*(?:capsules|caps|tablets|tabs|softgels|gummies|pieces|sachets)\b/i);
  if (countMatch) return countMatch[1] + 'count';
  return '';
}

function canonicalizeSize(raw) {
  if (!raw) return '';
  raw = raw.toLowerCase().trim();
  if (['5lb', '5lbs', '2.27kg', '2.2kg', '2.3kg'].includes(raw)) return '2.27kg';
  if (['2lb', '2lbs', '908g', '907g', '0.9kg'].includes(raw)) return '908g';
  if (['10lb', '10lbs', '4.54kg', '4.5kg'].includes(raw)) return '4.54kg';
  if (['300g', '300gm'].includes(raw)) return '300g';
  if (['250g', '250gm'].includes(raw)) return '250g';
  if (['500g', '500gm'].includes(raw)) return '500g';
  return raw;
}

function detectBrand(title) {
  const t = (title || '').toLowerCase();
  const brands = [
    { name: 'Optimum Nutrition', keys: ['optimum nutrition', 'gold standard', 'optimum'] },
    { name: 'MuscleTech', keys: ['muscletech', 'nitro-tech', 'nitrotech', 'cell-tech', 'hydroxycut'] },
    { name: 'Dymatize', keys: ['dymatize', 'iso 100', 'iso-100', 'super mass'] },
    { name: 'Applied Nutrition', keys: ['applied nutrition', 'abe', 'critical whey'] },
    { name: 'Kevin Levrone', keys: ['kevin levrone', 'levrone', 'anabolic mass'] },
    { name: 'Nutrex Research', keys: ['nutrex', 'anabol', 'lipo-6', 'lipo 6'] },
    { name: 'Rule 1', keys: ['rule 1', 'rule one', 'r1 protein'] },
    { name: 'Cellucor', keys: ['cellucor', 'c4'] },
    { name: 'Universal Nutrition', keys: ['universal nutrition', 'animal pak', 'animal cuts', 'animal flex'] },
    { name: 'BPI Sports', keys: ['bpi sports', 'best bcaa'] },
    { name: 'Redcon1', keys: ['redcon1', 'total war', 'big noise'] },
    { name: 'BioTechUSA', keys: ['biotechusa', 'biotech usa', 'biotech'] },
    { name: 'Organic Nation', keys: ['organic nation'] },
    { name: 'Muscle Add', keys: ['muscle add'] },
    { name: 'Strong Muscles', keys: ['strong muscles'] },
    { name: 'Trego', keys: ['trego', 'trigo'] },
    { name: 'Challenger Nutrition', keys: ['challenger nutrition', 'challenger'] },
    { name: 'Novogen Pharma', keys: ['novogen', 'novogen pharma'] },
    { name: 'Yava Labs', keys: ['yava labs', 'yava'] },
    { name: 'Keep Going', keys: ['keep going', 'kgoing'] }
  ];
  for (const b of brands) {
    if (b.keys.some(k => t.includes(k))) return b.name;
  }
  return 'ماركة معتمدة';
}

function detectCategory(title) {
  const t = (title || '').toLowerCase();
  if (t.includes('c4') || t.includes('energy drink')) return 'مشروعات طاقة & C4 ⚡';
  if (t.includes('isolate') || t.includes('iso 100') || t.includes('ايزوليت')) return 'Isolate (معزول)';
  if (t.includes('whey') || t.includes('protein') || t.includes('بروتين') || t.includes('واي')) return 'Whey Protein';
  if (t.includes('creatine') || t.includes('كرياتين') || t.includes('كراتين')) return 'Creatine (كرياتين)';
  if (t.includes('mass') || t.includes('gainer') || t.includes('تضخيم') || t.includes('جينر')) return 'Mass Gainer';
  if (t.includes('pre-workout') || t.includes('pre workout') || t.includes('pump') || t.includes('طاقة')) return 'Pre-Workout';
  if (t.includes('bcaa') || t.includes('amino') || t.includes('امينو') || t.includes('eaa')) return 'Amino & BCAA';
  if (t.includes('fat burner') || t.includes('lipo') || t.includes('تخسيس') || t.includes('حارق')) return 'Fat Burners & حوارق';
  if (t.includes('bar') || t.includes('snack') || t.includes('بار') || t.includes('سناك') || t.includes('كوكيز')) return 'Protein Snacks & Bars';
  return 'مكملات غذائية متنوعة';
}

function generateArabicSearchTerms(title, brand, cat) {
  const terms = new Set();
  const t = ((title || '') + ' ' + (brand || '') + ' ' + (cat || '')).toLowerCase();

  if (t.includes('anabol') || t.includes('انابول')) {
    ['انابول', 'انابوليك', 'بناء عضلات', 'محفز بنائي', 'هاردكور', 'نيوتركس', 'nutrex'].forEach(x => terms.add(x));
  }
  if (t.includes('creatine') || t.includes('كرياتين')) {
    ['كرياتين', 'كراتين', 'كريتين', 'مونو', 'مونوهايدريت', 'مونوهيدرات', 'ضخامة', 'قوة عضلية'].forEach(x => terms.add(x));
  }
  if (t.includes('whey') || t.includes('واي')) {
    ['واي', 'واي بروتين', 'بروتين مصل اللبن', 'بودر', 'عضلات صافية', 'وي بروتين'].forEach(x => terms.add(x));
  }
  if (t.includes('isolate') || t.includes('ايزو')) {
    ['ايزو', 'ايزوليت', 'أيزو', 'معزول', 'سريع الامتصاص', 'صفر سكر', 'صفر فات'].forEach(x => terms.add(x));
  }
  if (t.includes('mass') || t.includes('gainer') || t.includes('جينر')) {
    ['ماس', 'ماس جينر', 'جينر', 'تضخيم', 'زيادة وزن', 'كالوري عالي', 'ضخامة'].forEach(x => terms.add(x));
  }
  if (t.includes('c4') || t.includes('cellucor') || t.includes('energy')) {
    ['سي فور', 'سيفور', 'طاقة', 'مشروب طاقة', 'بمب', 'باور', 'قبل التمرين'].forEach(x => terms.add(x));
  }
  if (t.includes('pre-workout') || t.includes('pump') || t.includes('بري')) {
    ['بري وورك اوت', 'بري ورك اوت', 'طاقة', 'بمب', 'ضخ دم', 'عروق', 'تركيز'].forEach(x => terms.add(x));
  }
  if (t.includes('lipo') || t.includes('fat burner') || t.includes('حارق') || t.includes('تخسيس')) {
    ['حارق دهون', 'حوارق', 'تخسيس', 'تنحيف', 'سد شهية', 'كارنتين', 'ليبو 6'].forEach(x => terms.add(x));
  }
  if (t.includes('bcaa') || t.includes('amino') || t.includes('امينو')) {
    ['امينو', 'بي سي ايه', 'احماض امينية', 'استشفاء عضلي', 'ريكفري'].forEach(x => terms.add(x));
  }
  if (t.includes('omega') || t.includes('fish oil') || t.includes('زيت سمك')) {
    ['اوميجا 3', 'اوميجا', 'زيت سمك', 'صحة القلب', 'مفاصل'].forEach(x => terms.add(x));
  }
  if (t.includes('bar') || t.includes('snack') || t.includes('trigo') || t.includes('تريجو')) {
    ['بروتين بار', 'سناك صحي', 'شوكولاته صحية', 'سناكس', 'تريجو بار'].forEach(x => terms.add(x));
  }

  // Brands
  if (t.includes('muscletech') || t.includes('ماسل تك')) ['ماسل تك', 'ماسيل تك', 'ماستك'].forEach(x => terms.add(x));
  if (t.includes('optimum') || t.includes('اوبتيموم') || t.includes('gold standard')) ['اوبتيموم', 'اوبتيمم', 'جولد ستاندرد', 'اون'].forEach(x => terms.add(x));
  if (t.includes('dymatize') || t.includes('ديماتايز')) ['ديماتايز', 'دايماتايز'].forEach(x => terms.add(x));
  if (t.includes('applied') || t.includes('ابلايد')) ['ابلايد نيوتريشن', 'ابلايد'].forEach(x => terms.add(x));
  if (t.includes('nutrex') || t.includes('نيوتركس')) ['نيوتركس', 'نوتركس', 'نيوتريكس'].forEach(x => terms.add(x));
  if (t.includes('levrone') || t.includes('ليفرون')) ['كيفين ليفرون', 'ليفرون'].forEach(x => terms.add(x));

  return Array.from(terms).join(' ');
}

// Fetch helper with timeout and User-Agent
async function safeFetch(url, timeoutMs = 12000) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

// Crawl a WooCommerce store (e.g. Super Supplement, MF Supps, Train Hard, Fitness Tech, iFIT, GoFit)
async function crawlWooCommerce(store, maxPages = 4) {
  console.log(`[Crawl WC] ${store.name} (${store.apiUrl})...`);
  const items = [];
  for (let page = 1; page <= maxPages; page++) {
    const url = `${store.apiUrl}?per_page=100&page=${page}`;
    const data = await safeFetch(url);
    if (!Array.isArray(data) || data.length === 0) break;

    for (const p of data) {
      const rawPrice = p.prices?.price ? parseInt(p.prices.price, 10) : 0;
      const minorUnit = (p.prices?.currency_minor_unit !== undefined && p.prices?.currency_minor_unit !== null) ? Number(p.prices.currency_minor_unit) : 2;
      const divisor = Math.pow(10, minorUnit);
      let price = rawPrice / divisor;

      // Extra accuracy safeguard: If price is artificially low (< 70 EGP) while rawPrice is >= 500 EGP (except real small snacks/bars)
      const lowerName = (p.name || '').toLowerCase();
      const isSnack = lowerName.includes('bar') || lowerName.includes('snack') || lowerName.includes('chips') || lowerName.includes('spread');
      if (price < 70 && rawPrice >= 500 && !isSnack) {
        price = rawPrice;
      }

      const rawReg = p.prices?.regular_price ? parseInt(p.prices.regular_price, 10) : 0;
      let originalPrice = rawReg > 0 ? rawReg / divisor : null;
      if (originalPrice && originalPrice < 70 && rawReg >= 500 && !isSnack) {
        originalPrice = rawReg;
      }

      if (price > 0) {
        items.push({
          rawId: p.id,
          storeId: store.id,
          storeNameEn: STORE_NAME_EN[store.id] || store.name,
          platform: 'WooCommerce',
          title: p.name,
          price,
          originalPrice: (originalPrice && originalPrice > price) ? originalPrice : null,
          inStock: p.is_in_stock !== false,
          url: p.permalink,
          image: p.images?.[0]?.src || '',
          brand: detectBrand(p.name),
          size: canonicalizeSize(parseSize(p.name))
        });
      }
    }
    console.log(`  -> ${store.name} page ${page}: ${data.length} raw products`);
    if (data.length < 100) break; // Last page
  }
  return items;
}

// Crawl a Shopify store (e.g. Max Muscle Elite, Power Fit, The Coach, Power Store, Fit Spot, Zero Fat)
async function crawlShopify(store, maxPages = 4) {
  console.log(`[Crawl Shopify] ${store.name} (${store.apiUrl})...`);
  const items = [];
  for (let page = 1; page <= maxPages; page++) {
    const url = `${store.apiUrl}?limit=250&page=${page}`;
    const data = await safeFetch(url);
    if (!data || !Array.isArray(data.products) || data.products.length === 0) break;

    for (const p of data.products) {
      for (const v of (p.variants || [])) {
        const price = parseFloat(v.price) || 0;
        const comparePrice = parseFloat(v.compare_at_price) || 0;
        const fullTitle = (p.title + (v.title && v.title !== 'Default Title' ? ` - ${v.title}` : '')).trim();

        if (price > 0) {
          items.push({
            rawId: `${p.id}_${v.id}`,
            storeId: store.id,
            storeNameEn: STORE_NAME_EN[store.id] || store.name,
            platform: 'Shopify',
            title: fullTitle,
            price,
            originalPrice: (comparePrice > price) ? comparePrice : null,
            inStock: v.available !== false,
            url: `https://${new URL(store.url).hostname}/products/${p.handle}`,
            image: p.images?.[0]?.src || '',
            brand: detectBrand(fullTitle),
            size: canonicalizeSize(parseSize(fullTitle, v.title))
          });
        }
      }
    }
    console.log(`  -> ${store.name} page ${page}: ${data.products.length} products`);
    if (data.products.length < 250) break; // Last page
  }
  return items;
}

async function runLiveSync() {
  const startTime = Date.now();
  console.log('=====================================================');
  console.log(`⚡ 24/7 Automated Radar Sync Engine Started`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('=====================================================');

  if (!fs.existsSync(CATALOG_PATH)) {
    throw new Error(`Catalog file not found at ${CATALOG_PATH}`);
  }

  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
  const products = catalog.products || [];
  console.log(`Existing catalog products: ${products.length}`);

  // Create fast lookup indices
  const productById = new Map();
  const productByNormTitle = new Map();

  for (const p of products) {
    productById.set(p.id, p);
    const norm = normalizeTitle(p.title);
    if (norm) {
      if (!productByNormTitle.has(norm)) productByNormTitle.set(norm, []);
      productByNormTitle.get(norm).push(p);
    }
  }

  // Active stores to crawl
  const activeStores = [
    { id: 'super_supplement', name: 'Super Supplement', type: 'woocommerce', apiUrl: 'https://super-eg.com/wp-json/wc/store/v1/products', url: 'https://super-eg.com' },
    { id: 'mf_supplement', name: 'MF Supplement', type: 'woocommerce', apiUrl: 'https://mfsupps.com/wp-json/wc/store/v1/products', url: 'https://mfsupps.com' },
    { id: 'max_muscle', name: 'Max Muscle Elite', type: 'shopify', apiUrl: 'https://maxmuscleelite.com/products.json', url: 'https://maxmuscleelite.com' },
    { id: 'power_fit', name: 'Power Fit', type: 'shopify', apiUrl: 'https://powerfitsupplements.com/products.json', url: 'https://powerfitsupplements.com' },
    { id: 'the_coach', name: 'The Coach', type: 'shopify', apiUrl: 'https://www.thecoachsupp.com/products.json', url: 'https://www.thecoachsupp.com' },
    { id: 'power_store', name: 'Power Store', type: 'shopify', apiUrl: 'https://powerstore-eg.com/products.json', url: 'https://powerstore-eg.com' },
    { id: 'train_hard', name: 'Train Hard', type: 'woocommerce', apiUrl: 'https://trainhardeg.com/wp-json/wc/store/v1/products', url: 'https://trainhardeg.com' },
    { id: 'fitness_tech', name: 'Fitness Tech', type: 'woocommerce', apiUrl: 'https://fitnesstechsupplements.com/wp-json/wc/store/v1/products', url: 'https://fitnesstechsupplements.com' },
    { id: 'ifit_egypt', name: 'iFIT Egypt', type: 'woocommerce', apiUrl: 'https://ifit-eg.com/wp-json/wc/store/v1/products', url: 'https://ifit-eg.com' },
    { id: 'fit_spot', name: 'Fit Spot', type: 'shopify', apiUrl: 'https://fitspot-eg.com/products.json', url: 'https://fitspot-eg.com' },
    { id: 'zero_fat', name: 'Zero Fat Supplements', type: 'shopify', apiUrl: 'https://zerofatsupplements.com/products.json', url: 'https://zerofatsupplements.com' }
  ];

  let totalOffersCollected = 0;
  let pricesUpdatedCount = 0;
  let newProductsAddedCount = 0;
  let storesSuccessful = 0;

  // Crawl all stores
  for (const store of activeStores) {
    try {
      let offers = [];
      if (store.type === 'shopify') {
        offers = await crawlShopify(store, 4);
      } else {
        offers = await crawlWooCommerce(store, 4);
      }

      if (offers && offers.length > 0) {
        storesSuccessful++;
        totalOffersCollected += offers.length;
        console.log(`✅ ${store.name}: ${offers.length} active offers gathered`);

        // Merge offers into catalog
        for (const offer of offers) {
          const normOffer = normalizeTitle(offer.title);
          let targetProduct = null;

          // 1. Direct normalized match
          const candidates = productByNormTitle.get(normOffer);
          if (candidates && candidates.length > 0) {
            targetProduct = candidates[0];
          }

          // 2. Fuzzy size and brand match if direct match not found
          if (!targetProduct && offer.size) {
            for (const p of products) {
              if (p.brand === offer.brand && p.size === offer.size) {
                const normP = normalizeTitle(p.title);
                if (normP.includes(normOffer.slice(0, 15)) || normOffer.includes(normP.slice(0, 15))) {
                  targetProduct = p;
                  break;
                }
              }
            }
          }

          if (targetProduct) {
            // Update existing product's storeBreakdown
            if (!targetProduct.storeBreakdown) targetProduct.storeBreakdown = {};
            const prev = targetProduct.storeBreakdown[offer.storeId];
            const priceChanged = !prev || prev.price !== offer.price || prev.inStock !== offer.inStock;

            targetProduct.storeBreakdown[offer.storeId] = {
              storeId: offer.storeId,
              storeName: offer.storeNameEn,
              storeNameEn: offer.storeNameEn,
              platform: offer.platform,
              available: true,
              inStock: offer.inStock,
              price: offer.price,
              originalPrice: offer.originalPrice,
              url: offer.url,
              image: offer.image || targetProduct.image,
              titleInStore: offer.title
            };

            if (priceChanged) {
              pricesUpdatedCount++;
              targetProduct.lastUpdated = new Date().toISOString();
            }
          } else {
            // It's a completely NEW product on the store! Add it to the radar!
            const newId = `${offer.storeId}_${normalizeTitle(offer.title).replace(/\s+/g, '_').slice(0, 40)}`;
            const brand = offer.brand || detectBrand(offer.title);
            const size = offer.size || canonicalizeSize(parseSize(offer.title));
            const category = detectCategory(offer.title);
            const arabicTerms = generateArabicSearchTerms(offer.title, brand, category);

            const newProduct = {
              id: newId,
              title: offer.title,
              brand,
              weight: size ? size.toUpperCase() : '',
              size,
              form: offer.title.toLowerCase().includes('caps') ? 'capsules' : 'powder',
              category,
              image: offer.image,
              lowestPrice: offer.price,
              cheapestStore: offer.storeNameEn,
              lowestCorePrice: offer.price,
              cheapestCoreStore: offer.storeNameEn,
              highestPrice: offer.price,
              maxSavings: 0,
              isExclusive: true,
              availableCount: 1,
              storeBreakdown: {
                [offer.storeId]: {
                  storeId: offer.storeId,
                  storeName: offer.storeNameEn,
                  storeNameEn: offer.storeNameEn,
                  platform: offer.platform,
                  available: true,
                  inStock: offer.inStock,
                  price: offer.price,
                  originalPrice: offer.originalPrice,
                  url: offer.url,
                  image: offer.image,
                  titleInStore: offer.title
                }
              },
              lastUpdated: new Date().toISOString(),
              arabicSearchTerms: arabicTerms
            };

            products.push(newProduct);
            productById.set(newId, newProduct);
            const normNew = normalizeTitle(offer.title);
            if (!productByNormTitle.has(normNew)) productByNormTitle.set(normNew, []);
            productByNormTitle.get(normNew).push(newProduct);
            newProductsAddedCount++;
          }
        }
      }
    } catch (storeErr) {
      console.warn(`⚠️ Error crawling ${store.name}: ${storeErr.message}`);
    }
  }

  // Recalculate lowest price, cheapest store, and clean names for ALL products
  const CORE_STORE_IDS = new Set([
    'super_supplement', 'mf_supplement', 'max_muscle', 'power_fit',
    'the_coach', 'power_store', 'train_hard', 'fitness_tech', 'protein_we_vitamin'
  ]);

  for (const p of products) {
    const bd = p.storeBreakdown || {};
    let minPrice = Infinity;
    let minStore = null;
    let minCorePrice = Infinity;
    let minCoreStore = null;
    let maxPrice = 0;
    let availableCount = 0;

    let minExternalPrice = Infinity;
    let bestExternalOffer = null;

    for (const [sId, offer] of Object.entries(bd)) {
      // Normalize store names to strictly English
      offer.storeName = normalizeStoreName(offer.storeName, sId);
      offer.storeNameEn = normalizeStoreName(offer.storeNameEn || offer.storeName, sId);

      if (offer.available && offer.inStock && offer.price > 0) {
        availableCount++;
        if (offer.price < minPrice) {
          minPrice = offer.price;
          minStore = offer.storeNameEn;
        }
        if (offer.price > maxPrice) {
          maxPrice = offer.price;
        }

        if (CORE_STORE_IDS.has(sId)) {
          if (offer.price < minCorePrice) {
            minCorePrice = offer.price;
            minCoreStore = offer.storeNameEn;
          }
        } else {
          // Track external stores outside the 9
          if (offer.price < minExternalPrice) {
            minExternalPrice = offer.price;
            bestExternalOffer = {
              storeId: sId,
              storeName: offer.storeNameEn || offer.storeName,
              storeNameEn: offer.storeNameEn || offer.storeName,
              price: offer.price,
              originalPrice: offer.originalPrice || null,
              url: offer.url || '#',
              image: offer.image || p.image || ''
            };
          }
        }
      }
    }

    if (minPrice !== Infinity) {
      p.lowestPrice = minPrice;
      p.cheapestStore = minStore;
      p.lowestCorePrice = (minCorePrice !== Infinity) ? minCorePrice : minPrice;
      p.cheapestCoreStore = (minCoreStore !== null) ? minCoreStore : minStore;
      p.highestPrice = maxPrice > minPrice ? maxPrice : minPrice;
      p.maxSavings = Math.max(0, p.highestPrice - p.lowestPrice);
      p.availableCount = availableCount;

      if (bestExternalOffer && minPrice === minExternalPrice && (minCorePrice === Infinity || minPrice < minCorePrice)) {
        bestExternalOffer.savingsVsCore = (minCorePrice !== Infinity) ? Math.max(0, minCorePrice - minPrice) : 0;
        p.externalCheaper = bestExternalOffer;
      } else {
        p.externalCheaper = false;
      }
    } else {
      // Clean up if currently out of stock everywhere
      p.cheapestStore = normalizeStoreName(p.cheapestStore, '');
      p.cheapestCoreStore = normalizeStoreName(p.cheapestCoreStore, '');
      p.externalCheaper = false;
    }
  }

  // Update Metadata
  const nowIso = new Date().toISOString();
  catalog.metadata = {
    ...(catalog.metadata || {}),
    lastCatalogSync: nowIso,
    lastUpdated: nowIso,
    totalProducts: products.length,
    syncEngineStatus: '24/7 Live Active',
    stats: {
      storesChecked: activeStores.length,
      storesSuccessful,
      totalOffersCollected,
      pricesUpdatedCount,
      newProductsAddedCount,
      durationSeconds: Math.round((Date.now() - startTime) / 1000)
    }
  };

  catalog.products = products;

  // Save to disk
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2), 'utf8');

  console.log('=====================================================');
  console.log(`🎉 Sync Completed Successfully!`);
  console.log(`- Stores successfully crawled: ${storesSuccessful}/${activeStores.length}`);
  console.log(`- Total live offers parsed: ${totalOffersCollected}`);
  console.log(`- Prices updated/verified: ${pricesUpdatedCount}`);
  console.log(`- New products added: ${newProductsAddedCount}`);
  console.log(`- Total catalog products now: ${products.length}`);
  console.log(`- Duration: ${Math.round((Date.now() - startTime) / 1000)}s`);
  console.log('=====================================================');

  return catalog.metadata.stats;
}

if (require.main === module) {
  runLiveSync().catch(err => {
    console.error('Fatal sync failure:', err);
    process.exit(1);
  });
}

module.exports = { runLiveSync };
