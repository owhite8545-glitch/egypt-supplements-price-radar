const fs = require('fs');
const cat = JSON.parse(fs.readFileSync('catalog.json', 'utf8'));
const allProducts = cat.products;

const html = fs.readFileSync('index.html', 'utf8');
const normMatch = html.match(/function normalizeArabic[\s\S]*?function renderProducts/);
const code = normMatch[0].replace('function renderProducts', '');
const evalFn = new Function('allProducts', `${code}; return { normalizeArabic, BILINGUAL_THESAURUS, getSearchVariants };`);
const { normalizeArabic, BILINGUAL_THESAURUS, getSearchVariants } = evalFn(allProducts);

function matchVariantInText(text, variant) {
  if (!text || !variant) return false;
  if (variant.length <= 2) {
    const words = text.split(/\s+/);
    return words.includes(variant);
  }
  return text.includes(variant);
}

function evaluateProductSearchScore(product, query) {
  const normQuery = normalizeArabic(query);
  if (!normQuery) return 1;

  const rawTokens = normQuery.split(' ').filter(t => t.length > 0);
  if (rawTokens.length === 0) return 1;

  const titleNorm = normalizeArabic(product.title);
  const brandNorm = normalizeArabic(product.brand);
  const catNorm = normalizeArabic(product.category);
  const arabicTermsNorm = normalizeArabic(product.arabicSearchTerms);
  const arabicTitleNorm = normalizeArabic(product.arabicTitle);
  const fullHaystack = `${titleNorm} ${brandNorm} ${catNorm} ${arabicTermsNorm} ${arabicTitleNorm}`;

  const tokenVariants = rawTokens.map(t => getSearchVariants(t));
  let matchedTokensCount = 0;
  let score = 0;

  for (const variants of tokenVariants) {
    let bestTokenScore = 0;
    for (const v of variants) {
      let s = 0;
      if (matchVariantInText(titleNorm, v)) {
        s = 40;
      } else if (matchVariantInText(brandNorm, v)) {
        s = 35;
      } else if (matchVariantInText(arabicTermsNorm, v) || matchVariantInText(arabicTitleNorm, v)) {
        s = 30;
      } else if (matchVariantInText(fullHaystack, v)) {
        s = 15;
      }
      if (s > bestTokenScore) bestTokenScore = s;
    }
    if (bestTokenScore > 0) {
      matchedTokensCount++;
      score += bestTokenScore;
    }
  }

  const isFullMatch = (matchedTokensCount === rawTokens.length);
  const isStrongPartial = (rawTokens.length >= 3 && matchedTokensCount >= rawTokens.length - 1);

  if (!isFullMatch && !isStrongPartial) {
    return 0;
  }

  if (isFullMatch) {
    score += 150;
  }

  if (titleNorm.includes(normQuery) || arabicTermsNorm.includes(normQuery)) {
    score += 100;
  }

  const hasInStock = Object.values(product.storeBreakdown || {}).some(st => st.available && st.inStock !== false) || !!product.externalCheaper;
  if (hasInStock) score += 10;

  return score;
}

const testQueries = [
  'انابول',
  'أنابول',
  'انابول هاردكور',
  'anabol',
  'كرياتين',
  'الكرياتين',
  'كرياتين ماسل تك',
  'ماسل تك كرياتين',
  'creatine',
  'واي',
  'الواي',
  'واي بروتين',
  'واي اوبتيموم',
  'جولد ستاندرد',
  'whey',
  'ايزو',
  'ديماتايز ايزو',
  'iso 100',
  'سي فور',
  'سيفور',
  'c4',
  'تريجو',
  'شوكولاته سبريد',
  'اورجانيك نيشن',
  'بروتين بار'
];

let passCount = 0;
for (const q of testQueries) {
  const matches = [];
  for (const p of allProducts) {
    const score = evaluateProductSearchScore(p, q);
    if (score > 0) matches.push({ title: p.title, score, price: p.lowestPrice, store: p.cheapestStore });
  }
  matches.sort((a, b) => b.score - a.score || (a.price || 999999) - (b.price || 999999));
  if (matches.length > 0) {
    passCount++;
    console.log(`✅ [${q.padEnd(16)}] -> Top match: "${matches[0].title.slice(0, 48)}" | ${matches[0].price} EGP (${matches[0].store}) | score: ${matches[0].score}`);
  } else {
    console.log(`❌ [${q}] -> 0 matches!`);
  }
}

console.log(`\nFinal Test: ${passCount}/${testQueries.length} Passed!`);
