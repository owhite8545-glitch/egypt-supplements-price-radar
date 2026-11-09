const fs = require('fs');
const https = require('https');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }, timeout: 25000 }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchJson(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch(e) {
          reject(new Error(`Failed parsing JSON from ${url}: ${e.message}`));
        }
      });
    }).on('error', reject);
  });
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

function detectBrand(title) {
  const t = title.toLowerCase();
  const brands = [
    { name: 'Optimum Nutrition', keys: ['optimum nutrition', 'gold standard', 'optimum'] },
    { name: 'MuscleTech', keys: ['muscletech', 'nitro-tech', 'nitrotech', 'cell-tech', 'hydroxycut'] },
    { name: 'Dymatize', keys: ['dymatize', 'iso 100', 'iso-100', 'super mass'] },
    { name: 'Applied Nutrition', keys: ['applied nutrition', 'abe', 'all black everything', 'critical whey'] },
    { name: 'Kevin Levrone', keys: ['kevin levrone', 'levrone', 'anabolic mass'] },
    { name: 'Nutrex Research', keys: ['nutrex', 'anabol', 'lipo-6', 'lipo 6'] },
    { name: 'Rule 1', keys: ['rule 1', 'rule one', 'r1 protein'] },
    { name: 'Cellucor', keys: ['cellucor', 'c4'] },
    { name: 'Universal Nutrition', keys: ['universal nutrition', 'animal pak', 'animal cuts', 'animal flex'] },
    { name: 'BPI Sports', keys: ['bpi sports', 'best bcaa'] },
    { name: 'Redcon1', keys: ['redcon1', 'total war', 'big noise'] },
    { name: 'BioTechUSA', keys: ['biotechusa', 'biotech usa', 'biotech'] },
    { name: 'Organic Nation', keys: ['organic nation'] },
    { name: 'Trego', keys: ['trego', 'trigo'] },
    { name: 'Red Rex', keys: ['red rex', 'big ramy'] },
    { name: 'Challenger Nutrition', keys: ['challenger nutrition', 'challenger'] },
    { name: 'Keep Going', keys: ['keep going', 'kgoing'] }
  ];
  for (const b of brands) {
    if (b.keys.some(k => t.includes(k))) return b.name;
  }
  return 'ماركة معتمدة';
}

function detectCategory(title) {
  const t = title.toLowerCase();
  if (t.includes('c4') || t.includes('energy drink')) return 'مشروعات طاقة & C4 ⚡';
  if (t.includes('isolate') || t.includes('iso 100') || t.includes('iso-100') || t.includes('ايزوليت')) return 'Isolate (معزول)';
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
  const t = (title + ' ' + brand + ' ' + cat).toLowerCase();

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

async function main() {
  console.log('Loading catalog.json...');
  const cat = JSON.parse(fs.readFileSync('catalog.json', 'utf8'));
  const products = cat.products;
  console.log(`Initial catalog products: ${products.length}`);

  // Fetch SuppSpot (Shopify)
  console.log('Fetching SuppSpot (Add to Spot)...');
  let suppSpotItems = [];
  try {
    const res = await fetchJson('https://suppspot.com/products.json?limit=250');
    suppSpotItems = res.products || [];
    console.log(`Fetched ${suppSpotItems.length} products from SuppSpot.`);
  } catch(e) {
    console.warn('SuppSpot fetch error:', e.message);
  }

  // Fetch FitSpot (Shopify)
  console.log('Fetching FitSpot Egypt...');
  let fitSpotItems = [];
  try {
    const res = await fetchJson('https://fitspot-eg.com/products.json?limit=250');
    fitSpotItems = res.products || [];
    console.log(`Fetched ${fitSpotItems.length} products from FitSpot.`);
  } catch(e) {
    console.warn('FitSpot fetch error:', e.message);
  }

  // Fetch iFIT Egypt (WooCommerce)
  console.log('Fetching iFIT Egypt...');
  let ifitItems = [];
  try {
    const res = await fetchJson('https://ifit-eg.com/wp-json/wc/store/v1/products?per_page=100');
    ifitItems = Array.isArray(res) ? res : [];
    console.log(`Fetched ${ifitItems.length} products from iFIT Egypt.`);
  } catch(e) {
    console.warn('iFIT fetch error:', e.message);
  }

  // Fetch ZeroFat Egypt (Shopify)
  console.log('Fetching ZeroFat Egypt...');
  let zeroFatItems = [];
  try {
    const res = await fetchJson('https://zerofatsupplements.com/products.json?limit=250');
    zeroFatItems = res.products || [];
    console.log(`Fetched ${zeroFatItems.length} products from ZeroFat Egypt.`);
  } catch(e) {
    console.warn('ZeroFat fetch error:', e.message);
  }

  // Normalize product lists
  const externalList = [];

  // SuppSpot
  for (const p of suppSpotItems) {
    const variant = p.variants?.[0];
    const price = variant ? parseFloat(variant.price) : 0;
    if (price > 0) {
      externalList.push({
        sourceStoreId: 'add_to_spot',
        sourceStoreNameEn: 'Add to Spot',
        title: p.title,
        price,
        inStock: variant.available !== false,
        url: `https://suppspot.com/products/${p.handle}`,
        imageUrl: p.images?.[0]?.src || null,
        vendor: p.vendor || null
      });
    }
  }

  // FitSpot
  for (const p of fitSpotItems) {
    const variant = p.variants?.[0];
    const price = variant ? parseFloat(variant.price) : 0;
    if (price > 0) {
      externalList.push({
        sourceStoreId: 'fit_spot',
        sourceStoreNameEn: 'Fit Spot',
        title: p.title,
        price,
        inStock: variant.available !== false,
        url: `https://fitspot-eg.com/products/${p.handle}`,
        imageUrl: p.images?.[0]?.src || null,
        vendor: p.vendor || null
      });
    }
  }

  // iFIT
  for (const p of ifitItems) {
    const price = p.prices ? parseFloat(p.prices.price) / 100 : 0;
    if (price > 0) {
      externalList.push({
        sourceStoreId: 'ifit_egypt',
        sourceStoreNameEn: 'iFIT Egypt',
        title: p.name,
        price,
        inStock: p.is_in_stock !== false,
        url: p.permalink,
        imageUrl: p.images?.[0]?.src || null,
        vendor: null
      });
    }
  }

  // ZeroFat
  for (const p of zeroFatItems) {
    const variant = p.variants?.[0];
    const price = variant ? parseFloat(variant.price) : 0;
    if (price > 0) {
      externalList.push({
        sourceStoreId: 'zero_fat',
        sourceStoreNameEn: 'Zero Fat Supplements',
        title: p.title,
        price,
        inStock: variant.available !== false,
        url: `https://zerofatsupplements.com/products/${p.handle}`,
        imageUrl: p.images?.[0]?.src || null,
        vendor: p.vendor || null
      });
    }
  }

  console.log(`Total new incoming store offers to process: ${externalList.length}`);

  let matchedCount = 0;
  let newAddedCount = 0;

  for (const offer of externalList) {
    const normOfferTitle = normalizeTitle(offer.title);
    if (!normOfferTitle || normOfferTitle.length < 3) continue;

    // Check if matches existing product
    const match = products.find(prod => {
      const normProdTitle = normalizeTitle(prod.title);
      if (normProdTitle === normOfferTitle) return true;
      // If title includes significant matching tokens
      const offerTokens = normOfferTitle.split(' ').filter(t => t.length > 2);
      if (offerTokens.length >= 3) {
        const matchesAll = offerTokens.every(tok => normProdTitle.includes(tok));
        if (matchesAll) return true;
      }
      return false;
    });

    if (match) {
      matchedCount++;
      if (!match.storeBreakdown) match.storeBreakdown = {};
      match.storeBreakdown[offer.sourceStoreId] = {
        storeName: offer.sourceStoreNameEn,
        storeNameEn: offer.sourceStoreNameEn,
        price: offer.price,
        available: true,
        inStock: offer.inStock,
        url: offer.url,
        isCheapest: false
      };

      // Recalculate lowestPrice and cheapestStore
      let minP = 999999;
      let minStore = match.cheapestStore;
      for (const [sKey, st] of Object.entries(match.storeBreakdown)) {
        if (st.available && st.price > 0 && st.price < minP) {
          minP = st.price;
          minStore = st.storeNameEn || st.storeName || sKey;
        }
      }
      if (minP < 999999) {
        match.lowestPrice = minP;
        match.cheapestStore = minStore;
      }
      // Re-mark isCheapest flag
      for (const st of Object.values(match.storeBreakdown)) {
        st.isCheapest = (st.price === match.lowestPrice);
      }
    } else {
      // Add as new catalog item!
      newAddedCount++;
      const id = `${offer.sourceStoreId}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const brand = offer.vendor || detectBrand(offer.title);
      const category = detectCategory(offer.title);
      const arabicTerms = generateArabicSearchTerms(offer.title, brand, category);

      const newProd = {
        id,
        title: offer.title,
        brand,
        category,
        lowestPrice: offer.price,
        cheapestStore: offer.sourceStoreNameEn,
        availableCount: 1,
        maxSavings: 0,
        imageUrl: offer.imageUrl,
        arabicSearchTerms: arabicTerms,
        arabicTitle: '',
        storeBreakdown: {
          [offer.sourceStoreId]: {
            storeName: offer.sourceStoreNameEn,
            storeNameEn: offer.sourceStoreNameEn,
            price: offer.price,
            available: true,
            inStock: offer.inStock,
            url: offer.url,
            isCheapest: true
          }
        },
        lastUpdated: new Date().toISOString()
      };
      products.push(newProd);
    }
  }

  // Also, let's ensure EVERY product in products has rich arabicSearchTerms
  console.log('Enriching all products with rich Arabic & English search tokens...');
  for (const prod of products) {
    const existingTerms = prod.arabicSearchTerms || '';
    const generated = generateArabicSearchTerms(prod.title, prod.brand, prod.category);
    const combined = Array.from(new Set(`${existingTerms} ${generated}`.split(/\s+/).filter(Boolean))).join(' ');
    prod.arabicSearchTerms = combined;
  }

  console.log(`Matched with existing products: ${matchedCount}`);
  console.log(`Added brand new unique products: ${newAddedCount}`);
  console.log(`Total final catalog products: ${products.length}`);

  cat.metadata.totalProducts = products.length;
  cat.metadata.lastCatalogSync = new Date().toISOString();

  fs.writeFileSync('catalog.json', JSON.stringify(cat, null, 2), 'utf8');
  console.log('Successfully wrote updated catalog.json!');
}

main().catch(console.error);
