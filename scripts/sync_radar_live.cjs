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
  'ox_muscle': 'Ox Muscle',
  'galaxy_supps': 'Galaxy Supps',
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
  'أوكس مصل': 'Ox Muscle',
  'جالاكسي سابليمنتس': 'Galaxy Supps',
  'آي فيت مصر': 'iFIT Egypt',
  'فيت سبوت': 'Fit Spot',
  'زيرو فات': 'Zero Fat Supplements',
  'جو فيت مصر': 'GoFit Egypt'
};

function decodeHtmlEntities(str) {
  if (!str) return '';
  return String(str)
    .replace(/&#038;|&amp;/g, '&')
    .replace(/&#8211;|&#8212;/g, '–')
    .replace(/&#8217;|&#039;|&apos;/g, "'")
    .replace(/&#8220;|&#8221;|&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

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
    { name: 'MuscleTech', keys: ['muscletech', 'muscle tech', 'nitro-tech', 'nitrotech', 'cell-tech', 'hydroxycut'] },
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
    { name: 'NOW Foods', keys: ['now foods', 'now supplements', 'ناو فودز', 'ناو سبلمنتس', 'by now'] },
    { name: "Puritan's Pride", keys: ["puritan's pride", 'puritan’s pride', 'puritans pride', 'بيورتنز برايد', 'بيوريتنز'] },
    { name: 'Solgar', keys: ['solgar', 'سولجار'] },
    { name: 'Nutricost', keys: ['nutricost'] },
    { name: "Doctor's Best", keys: ["doctor's best", 'doctors best'] },
    { name: 'California Gold Nutrition', keys: ['california gold'] },
    { name: 'Big Ramy Labs', keys: ['big ramy', 'red rex'] },
    { name: 'Body Builder', keys: ['body builder', 'bodybuilder'] },
    { name: 'Nutriversum', keys: ['nutriversum'] },
    { name: 'Fitness Bull', keys: ['fitness bull'] },
    { name: 'Laperva', keys: ['laperva', 'لابيرفا'] },
    { name: 'Muscle Rulz', keys: ['muscle rulz'] },
    { name: 'Marvelous Nutrition', keys: ['marvelous'] },
    { name: 'DY Nutrition', keys: ['dy nutrition', 'dorian yates'] },
    { name: 'ALLMAX', keys: ['allmax'] },
    { name: 'BSN', keys: ['bsn', 'syntha-6', 'aminox'] },
    { name: 'Olimp Sport', keys: ['olimp'] },
    { name: 'Scitec Nutrition', keys: ['scitec'] },
    { name: 'Ronnie Coleman', keys: ['ronnie coleman', 'king whey', 'king mass'] },
    { name: 'Organic Nation', keys: ['organic nation', 'اورجانيك نيشن'] },
    { name: 'Muscle Add', keys: ['muscle add', 'ماسل اد'] },
    { name: 'Strong Muscles', keys: ['strong muscles'] },
    { name: 'Trego', keys: ['trego', 'trigo', 'تريجو'] },
    { name: 'Challenger Nutrition', keys: ['challenger nutrition', 'challenger'] },
    { name: 'Novogen Pharma', keys: ['novogen', 'novogen pharma', 'نوفوجين'] },
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
  if (t.includes('bcaa') || t.includes('amino') || t.includes('امينو') || t.includes('eaa') || t.includes('glutamine')) return 'Amino & BCAA';
  if (t.includes('fat burner') || t.includes('lipo') || t.includes('تخسيس') || t.includes('حارق')) return 'Fat Burners & حوارق';
  if (t.includes('bar') || t.includes('snack') || t.includes('بار') || t.includes('سناك') || t.includes('كوكيز')) return 'Protein Snacks & Bars';
  return 'مكملات غذائية متنوعة';
}

function generateArabicSearchTerms(title, brand, cat, extraTerms = '') {
  const terms = new Set();
  if (extraTerms) {
    extraTerms.split(/\s+/).filter(Boolean).forEach(x => terms.add(x));
  }
  const t = ((title || '') + ' ' + (brand || '') + ' ' + (cat || '') + ' ' + (extraTerms || '')).toLowerCase();

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
  if (t.includes('total war') || t.includes('توتال وور')) {
    ['توتال وور', 'توتال وار', 'توتل وور', 'ريدكون', 'ريدكون 1', 'redcon1'].forEach(x => terms.add(x));
  }
  if (t.includes('pre-workout') || t.includes('preworkout') || t.includes('pump') || t.includes('بري')) {
    ['بري وورك اوت', 'بري ورك اوت', 'طاقة', 'بمب', 'ضخ دم', 'عروق', 'تركيز'].forEach(x => terms.add(x));
  }
  if (t.includes('lipo') || t.includes('fat burner') || t.includes('حارق') || t.includes('تخسيس')) {
    ['حارق دهون', 'حوارق', 'تخسيس', 'تنحيف', 'سد شهية', 'كارنتين', 'ليبو 6'].forEach(x => terms.add(x));
  }
  if (t.includes('bcaa') || t.includes('amino') || t.includes('امينو') || t.includes('glutamine') || t.includes('جلوتامين')) {
    ['امينو', 'بي سي ايه', 'احماض امينية', 'استشفاء عضلي', 'ريكفري', 'جلوتامين'].forEach(x => terms.add(x));
  }
  if (t.includes('omega') || t.includes('fish oil') || t.includes('زيت سمك') || t.includes('اوميجا')) {
    ['اوميجا 3', 'اوميجا', 'زيت سمك', 'صحة القلب', 'مفاصل'].forEach(x => terms.add(x));
  }
  if (t.includes('vitamin') || t.includes('multivitamin') || t.includes('zinc') || t.includes('magnesium') || t.includes('collagen') || t.includes('فيتامين')) {
    ['فيتامين', 'فيتامينات', 'ملتي فيتامين', 'زنك', 'ماغنيسيوم', 'كولاجين', 'مناعة'].forEach(x => terms.add(x));
  }
  if (t.includes('bar') || t.includes('snack') || t.includes('trigo') || t.includes('تريجو')) {
    ['بروتين بار', 'سناك صحي', 'شوكولاته صحية', 'سناكس', 'تريجو بار'].forEach(x => terms.add(x));
  }

  // Brands
  if (t.includes('muscletech') || t.includes('muscle tech') || t.includes('ماسل تك')) ['ماسل تك', 'ماسيل تك', 'ماستك'].forEach(x => terms.add(x));
  if (t.includes('optimum') || t.includes('اوبتيموم') || t.includes('gold standard')) ['اوبتيموم', 'اوبتيمم', 'جولد ستاندرد', 'اون'].forEach(x => terms.add(x));
  if (t.includes('dymatize') || t.includes('ديماتايز')) ['ديماتايز', 'دايماتايز'].forEach(x => terms.add(x));
  if (t.includes('applied') || t.includes('ابلايد')) ['ابلايد نيوتريشن', 'ابلايد'].forEach(x => terms.add(x));
  if (t.includes('nutrex') || t.includes('نيوتركس')) ['نيوتركس', 'نوتركس', 'نيوتريكس'].forEach(x => terms.add(x));
  if (t.includes('levrone') || t.includes('ليفرون')) ['كيفين ليفرون', 'ليفرون'].forEach(x => terms.add(x));
  if (t.includes('now foods') || t.includes('ناو فودز')) ['ناو فودز', 'ناو'].forEach(x => terms.add(x));
  if (t.includes('big ramy') || t.includes('red rex')) ['بيج رامي', 'ريد ريكس'].forEach(x => terms.add(x));

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

function cleanGalaxyEnTitle(title) {
  let clean = decodeHtmlEntities(title || '');
  // TranslatePress literal auto-translation fixes
  clean = clean.replace(/\bBreak Workout\b/gi, 'Pre-Workout');
  clean = clean.replace(/\bBreak-Workout\b/gi, 'Pre-Workout');
  return clean.trim();
}

function getImageBasename(imgUrl) {
  if (!imgUrl) return '';
  return imgUrl.split('?')[0].split('/').pop().replace(/-\d+x\d+(?=\.[a-z0-9]+$)/i, '').toLowerCase();
}

function isBundleTitle(t) {
  return /\b(bundle|pack|combo|duo|stack|2x|3x)\b|باكدج|عرض مزدوج|توفير مزدوج/i.test(t || '');
}

const MATCH_STOP_WORDS = new Set([
  'in', 'for', 'with', 'and', 'the', 'of', 'by', 'from', 'egypt', 'power', 'fit',
  'supplements', 'supplement', 'store', 'sports', 'nutrition', 'original', 'new',
  'servings', 'serving', 'serv', 'serves', 'doses', 'dose', 'caps', 'capsules',
  'tablets', 'tabs', 'softgels', 'powder', 'liquid', 'gm', 'gram', 'grams', 'kg',
  'lb', 'lbs', 'ml', 'mg', 'mcg', 'premium', 'extreme', 'formula', 'booster',
  'muscle', 'growth', 'recovery', 'energy', 'focus', 'performance', 'flavor',
  'chocolate', 'vanilla', 'strawberry', 'watermelon', 'fruit', 'punch', 'mango',
  'unflavored', 'blue', 'raspberry', 'apple', 'orange', 'lemon', 'peach', 'berry'
]);

function extractMatchTokens(title) {
  const norm = normalizeTitle(title);
  return norm
    .split(' ')
    .filter(w => w.length >= 2 && !MATCH_STOP_WORDS.has(w) && !/^\d+$/.test(w));
}

function findSmartMatch(offer, products, productByNormTitle) {
  const normOffer = normalizeTitle(offer.title);
  if (!normOffer || normOffer.length < 3) return null;

  // 1. Direct normalized title match
  const exact = productByNormTitle.get(normOffer);
  if (exact && exact.length > 0) return exact[0];

  // 2. Smart token & size & bundle match
  const offerBundle = isBundleTitle(offer.title);
  const offerTokens = extractMatchTokens(offer.title);
  if (offerTokens.length < 2) return null;

  const offerSize = offer.size || '';
  const offerBrand = offer.brand || 'ماركة معتمدة';

  let bestCandidate = null;
  let bestScore = 0;

  for (const p of products) {
    if (isBundleTitle(p.title) !== offerBundle) continue;

    // Brand guardrail when both brands are known
    const pBrand = p.brand || 'ماركة معتمدة';
    if (offerBrand !== 'ماركة معتمدة' && pBrand !== 'ماركة معتمدة' && offerBrand !== pBrand) {
      // Allow Power Fit wrapper brands in legacy catalog
      if (!pBrand.includes('Power Fit')) continue;
    }

    // Size guardrail when both sizes exist
    const pSize = p.size || '';
    if (offerSize && pSize && offerSize !== pSize) {
      // Allow 60count vs 60serv equivalence, otherwise require match
      const oNum = offerSize.replace(/(count|serv)$/i, '');
      const pNum = pSize.replace(/(count|serv)$/i, '');
      const bothCountLike = /(count|serv)$/i.test(offerSize) && /(count|serv)$/i.test(pSize);
      if (!(bothCountLike && oNum === pNum)) continue;
    }

    const pTokens = extractMatchTokens(p.title);
    if (pTokens.length < 2) continue;

    const pTokenSet = new Set(pTokens);
    let overlap = 0;
    for (const tok of offerTokens) {
      if (pTokenSet.has(tok)) overlap++;
    }

    const unionSize = new Set([...offerTokens, ...pTokens]).size;
    const jaccard = unionSize > 0 ? (overlap / unionSize) : 0;
    const containment = Math.min(offerTokens.length, pTokens.length) > 0
      ? (overlap / Math.min(offerTokens.length, pTokens.length))
      : 0;

    if (overlap >= 3 && jaccard >= 0.55 && containment >= 0.75) {
      const score = jaccard + containment;
      if (score > bestScore) {
        bestScore = score;
        bestCandidate = p;
      }
    }
  }

  return bestCandidate;
}

// Crawl a WooCommerce store (with parallel page batches & EN/AR deduplication support)
async function crawlWooCommerce(store, defaultMaxPages = 6) {
  const maxPages = store.maxPages || defaultMaxPages;
  console.log(`[Crawl WC] ${store.name} (${store.apiUrl}, maxPages=${maxPages})...`);

  const rawProducts = [];
  const batchSize = 3;
  for (let start = 1; start <= maxPages; start += batchSize) {
    const pageNums = [];
    for (let i = 0; i < batchSize && (start + i) <= maxPages; i++) {
      pageNums.push(start + i);
    }
    const batchResults = await Promise.all(
      pageNums.map(p => safeFetch(`${store.apiUrl}?per_page=100&page=${p}`, 15000))
    );
    let reachedEnd = false;
    for (let i = 0; i < batchResults.length; i++) {
      const data = batchResults[i];
      if (!Array.isArray(data) || data.length === 0) {
        reachedEnd = true;
        continue;
      }
      rawProducts.push(...data);
      console.log(`  -> ${store.name} page ${pageNums[i]}: ${data.length} raw products`);
      if (data.length < 100) reachedEnd = true;
    }
    if (reachedEnd) break;
  }

  const parsePriceAndItem = (p, overrideTitle = null, extraArabicTerms = '') => {
    const cleanName = decodeHtmlEntities(overrideTitle || p.name);
    const rawPrice = p.prices?.price ? parseInt(p.prices.price, 10) : 0;
    const minorUnit = (p.prices?.currency_minor_unit !== undefined && p.prices?.currency_minor_unit !== null) ? Number(p.prices.currency_minor_unit) : 2;
    const divisor = Math.pow(10, minorUnit);
    let price = rawPrice / divisor;

    const lowerName = cleanName.toLowerCase();
    const isSnack = lowerName.includes('bar') || lowerName.includes('snack') || lowerName.includes('chips') || lowerName.includes('spread');
    if (price < 70 && rawPrice >= 500 && !isSnack) {
      price = rawPrice;
    }

    const rawReg = p.prices?.regular_price ? parseInt(p.prices.regular_price, 10) : 0;
    let originalPrice = rawReg > 0 ? rawReg / divisor : null;
    if (originalPrice && originalPrice < 70 && rawReg >= 500 && !isSnack) {
      originalPrice = rawReg;
    }

    if (price <= 0) return null;
    return {
      rawId: p.id,
      storeId: store.id,
      storeNameEn: STORE_NAME_EN[store.id] || store.name,
      platform: 'WooCommerce',
      title: cleanName,
      price,
      originalPrice: (originalPrice && originalPrice > price) ? originalPrice : null,
      inStock: p.is_in_stock !== false,
      url: p.permalink,
      image: p.images?.[0]?.src || '',
      brand: detectBrand(cleanName + ' ' + extraArabicTerms),
      size: canonicalizeSize(parseSize(cleanName)),
      extraArabicTerms
    };
  };

  if (store.deduplicateLang) {
    const paired = new Map();
    for (const p of rawProducts) {
      const minorUnit = (p.prices?.currency_minor_unit !== undefined && p.prices?.currency_minor_unit !== null) ? Number(p.prices.currency_minor_unit) : 2;
      const pr = p.prices?.price ? parseInt(p.prices.price, 10) / Math.pow(10, minorUnit) : 0;
      if (pr <= 0) continue;

      const imgFile = getImageBasename(p.images?.[0]?.src || '');
      const key = imgFile ? `${imgFile}__${pr}` : `id_${p.id}`;
      const isEn = (p.permalink || '').includes('/en/');

      if (!paired.has(key)) {
        paired.set(key, { en: isEn ? p : null, ar: !isEn ? p : null, fallback: p });
      } else {
        const entry = paired.get(key);
        if (isEn && !entry.en) entry.en = p;
        else if (!isEn && !entry.ar) entry.ar = p;
        else paired.set(`${key}__${p.id}`, { en: isEn ? p : null, ar: !isEn ? p : null, fallback: p });
      }
    }

    const dedupItems = [];
    for (const entry of paired.values()) {
      const primary = entry.en || entry.ar || entry.fallback;
      const enTitle = entry.en ? cleanGalaxyEnTitle(entry.en.name) : decodeHtmlEntities(primary.name);
      const arTitle = entry.ar ? decodeHtmlEntities(entry.ar.name) : '';
      const built = parsePriceAndItem(primary, enTitle, arTitle);
      if (built) dedupItems.push(built);
    }
    console.log(`  -> ${store.name} deduplicated EN/AR pairs: ${rawProducts.length} -> ${dedupItems.length} unique products`);
    return dedupItems;
  }

  const items = [];
  for (const p of rawProducts) {
    const built = parsePriceAndItem(p);
    if (built) items.push(built);
  }
  return items;
}

// Crawl a Shopify store (with optional flavor variant consolidation)
async function crawlShopify(store, defaultMaxPages = 6) {
  const maxPages = store.maxPages || defaultMaxPages;
  console.log(`[Crawl Shopify] ${store.name} (${store.apiUrl}, maxPages=${maxPages})...`);
  const items = [];
  for (let page = 1; page <= maxPages; page++) {
    const url = `${store.apiUrl}?limit=250&page=${page}`;
    const data = await safeFetch(url, 15000);
    if (!data || !Array.isArray(data.products) || data.products.length === 0) break;

    for (const p of data.products) {
      const cleanProdTitle = decodeHtmlEntities(p.title);
      if (store.consolidateFlavors) {
        // Group flavor-only variants by canonical size so same product doesn't duplicate across flavors
        const bySize = new Map();
        for (const v of (p.variants || [])) {
          const price = parseFloat(v.price) || 0;
          if (price <= 0) continue;
          const vSize = canonicalizeSize(parseSize(cleanProdTitle, v.title));
          const key = vSize || 'default';
          const avail = v.available !== false;
          const existing = bySize.get(key);
          if (!existing || (avail && !existing.inStock) || (avail === existing.inStock && price < existing.price)) {
            const comparePrice = parseFloat(v.compare_at_price) || 0;
            const hasDistinctVariantSize = parseSize('', v.title) !== '';
            const fullTitle = (cleanProdTitle + (hasDistinctVariantSize && v.title !== 'Default Title' ? ` - ${decodeHtmlEntities(v.title)}` : '')).trim();
            bySize.set(key, {
              rawId: `${p.id}_${v.id}`,
              storeId: store.id,
              storeNameEn: STORE_NAME_EN[store.id] || store.name,
              platform: 'Shopify',
              title: fullTitle,
              price,
              originalPrice: (comparePrice > price) ? comparePrice : null,
              inStock: avail,
              url: `https://${new URL(store.url).hostname}/products/${p.handle}`,
              image: p.images?.[0]?.src || '',
              brand: detectBrand(fullTitle + ' ' + (p.vendor || '')),
              size: key === 'default' ? '' : key
            });
          }
        }
        for (const item of bySize.values()) items.push(item);
      } else {
        for (const v of (p.variants || [])) {
          const price = parseFloat(v.price) || 0;
          const comparePrice = parseFloat(v.compare_at_price) || 0;
          const fullTitle = (cleanProdTitle + (v.title && v.title !== 'Default Title' ? ` - ${decodeHtmlEntities(v.title)}` : '')).trim();

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
              brand: detectBrand(fullTitle + ' ' + (p.vendor || '')),
              size: canonicalizeSize(parseSize(fullTitle, v.title))
            });
          }
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
    { id: 'super_supplement', name: 'Super Supplement', type: 'woocommerce', apiUrl: 'https://super-eg.com/wp-json/wc/store/v1/products', url: 'https://super-eg.com', maxPages: 6 },
    { id: 'mf_supplement', name: 'MF Supplement', type: 'woocommerce', apiUrl: 'https://mfsupps.com/wp-json/wc/store/v1/products', url: 'https://mfsupps.com', maxPages: 6 },
    { id: 'max_muscle', name: 'Max Muscle Elite', type: 'shopify', apiUrl: 'https://maxmuscleelite.com/products.json', url: 'https://maxmuscleelite.com', maxPages: 4 },
    { id: 'power_fit', name: 'Power Fit', type: 'shopify', apiUrl: 'https://powerfitsupplements.com/products.json', url: 'https://powerfitsupplements.com', maxPages: 4 },
    { id: 'the_coach', name: 'The Coach', type: 'shopify', apiUrl: 'https://www.thecoachsupp.com/products.json', url: 'https://www.thecoachsupp.com', maxPages: 4 },
    { id: 'power_store', name: 'Power Store', type: 'shopify', apiUrl: 'https://powerstore-eg.com/products.json', url: 'https://powerstore-eg.com', maxPages: 4 },
    { id: 'train_hard', name: 'Train Hard', type: 'woocommerce', apiUrl: 'https://trainhardeg.com/wp-json/wc/store/v1/products', url: 'https://trainhardeg.com', maxPages: 5 },
    { id: 'fitness_tech', name: 'Fitness Tech', type: 'woocommerce', apiUrl: 'https://fitnesstechsupplements.com/wp-json/wc/store/v1/products', url: 'https://fitnesstechsupplements.com', maxPages: 6 },
    { id: 'ox_muscle', name: 'Ox Muscle', type: 'shopify', apiUrl: 'https://oxmuscleeg.com/products.json', url: 'https://oxmuscleeg.com', maxPages: 6, consolidateFlavors: true },
    { id: 'galaxy_supps', name: 'Galaxy Supps', type: 'woocommerce', apiUrl: 'https://galaxysupps.com/wp-json/wc/store/v1/products', url: 'https://galaxysupps.com', maxPages: 16, deduplicateLang: true },
    { id: 'ifit_egypt', name: 'iFIT Egypt', type: 'woocommerce', apiUrl: 'https://ifit-eg.com/wp-json/wc/store/v1/products', url: 'https://ifit-eg.com', maxPages: 6 },
    { id: 'fit_spot', name: 'Fit Spot', type: 'shopify', apiUrl: 'https://fitspot-eg.com/products.json', url: 'https://fitspot-eg.com', maxPages: 4 },
    { id: 'zero_fat', name: 'Zero Fat Supplements', type: 'shopify', apiUrl: 'https://zerofatsupplements.com/products.json', url: 'https://zerofatsupplements.com', maxPages: 4 }
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
        offers = await crawlWooCommerce(store, 6);
      }

      if (offers && offers.length > 0) {
        storesSuccessful++;
        totalOffersCollected += offers.length;
        console.log(`✅ ${store.name}: ${offers.length} active offers gathered`);

        // Merge offers into catalog
        for (const offer of offers) {
          const targetProduct = findSmartMatch(offer, products, productByNormTitle);

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

            if (offer.extraArabicTerms) {
              const existingTerms = new Set((targetProduct.arabicSearchTerms || '').split(/\s+/).filter(Boolean));
              offer.extraArabicTerms.split(/\s+/).filter(Boolean).forEach(t => existingTerms.add(t));
              targetProduct.arabicSearchTerms = Array.from(existingTerms).join(' ');
            }

            if (priceChanged) {
              pricesUpdatedCount++;
              targetProduct.lastUpdated = new Date().toISOString();
            }
          } else {
            // It's a completely NEW product on the store! Add it to the radar!
            let baseId = `${offer.storeId}_${normalizeTitle(offer.title).replace(/\s+/g, '_').slice(0, 40)}`;
            let newId = baseId;
            let suffix = 2;
            while (productById.has(newId)) {
              newId = `${baseId}_${suffix++}`;
            }
            const brand = offer.brand || detectBrand(offer.title);
            const size = offer.size || canonicalizeSize(parseSize(offer.title));
            const category = detectCategory(offer.title);
            const arabicTerms = generateArabicSearchTerms(offer.title, brand, category, offer.extraArabicTerms || '');

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

  // Recalculate lowest price, cheapest store, exclusives, and clean names for ALL products
  const CORE_STORE_IDS = new Set([
    'super_supplement', 'mf_supplement', 'max_muscle', 'power_fit',
    'the_coach', 'power_store', 'train_hard', 'fitness_tech', 'protein_we_vitamin',
    'ox_muscle', 'galaxy_supps'
  ]);

  let externalDealsFound = 0;
  let exclusiveItemsCount = 0;

  for (const p of products) {
    const bd = p.storeBreakdown || {};
    let minInStockPrice = Infinity;
    let minInStockStore = null;
    let minAnyPrice = Infinity;
    let minAnyStore = null;
    let minCorePrice = Infinity;
    let minCoreStore = null;
    let maxPrice = 0;
    let listedStoresCount = 0;

    let minExternalPrice = Infinity;
    let bestExternalOffer = null;

    for (const [sId, offer] of Object.entries(bd)) {
      // Normalize store names to strictly English
      offer.storeName = normalizeStoreName(offer.storeName, sId);
      offer.storeNameEn = normalizeStoreName(offer.storeNameEn || offer.storeName, sId);

      if (offer.available && offer.price > 0) {
        listedStoresCount++;
        if (offer.price < minAnyPrice) {
          minAnyPrice = offer.price;
          minAnyStore = offer.storeNameEn;
        }
        if (offer.price > maxPrice) {
          maxPrice = offer.price;
        }

        if (offer.inStock !== false) {
          if (offer.price < minInStockPrice) {
            minInStockPrice = offer.price;
            minInStockStore = offer.storeNameEn;
          }

          if (CORE_STORE_IDS.has(sId)) {
            if (offer.price < minCorePrice) {
              minCorePrice = offer.price;
              minCoreStore = offer.storeNameEn;
            }
          } else {
            // Track external stores outside the 11
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
    }

    p.availableCount = listedStoresCount;
    p.isExclusive = (listedStoresCount === 1);
    if (p.isExclusive) exclusiveItemsCount++;

    const effectiveMinPrice = (minInStockPrice !== Infinity) ? minInStockPrice : minAnyPrice;
    const effectiveMinStore = (minInStockPrice !== Infinity) ? minInStockStore : minAnyStore;

    if (effectiveMinPrice !== Infinity) {
      p.lowestPrice = effectiveMinPrice;
      p.cheapestStore = effectiveMinStore;
      p.lowestCorePrice = (minCorePrice !== Infinity) ? minCorePrice : effectiveMinPrice;
      p.cheapestCoreStore = (minCoreStore !== null) ? minCoreStore : effectiveMinStore;
      p.highestPrice = maxPrice > effectiveMinPrice ? maxPrice : effectiveMinPrice;
      p.maxSavings = Math.max(0, p.highestPrice - p.lowestPrice);

      if (bestExternalOffer && effectiveMinPrice === minExternalPrice && (minCorePrice === Infinity || effectiveMinPrice < minCorePrice)) {
        bestExternalOffer.savingsVsCore = (minCorePrice !== Infinity) ? Math.max(0, minCorePrice - effectiveMinPrice) : 0;
        p.externalCheaper = bestExternalOffer;
        externalDealsFound++;
      } else {
        p.externalCheaper = false;
      }
    } else {
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
    totalComparedItems: products.length,
    externalDealsFound,
    exclusiveItemsCount,
    monitoredCoreStores: 11,
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
