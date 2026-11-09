const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

// Extract normalizeArabic, BILINGUAL_THESAURUS, getSearchVariants, evaluateProductSearchScore
const normMatch = html.match(/function normalizeArabic[\s\S]*?function renderProducts/);
if (!normMatch) {
  console.error('Could not find search engine functions in index.html!');
  process.exit(1);
}

// Evaluate code in context
const code = normMatch[0].replace('function renderProducts', '');
const evalFn = new Function('allProducts', `${code}; return { normalizeArabic, BILINGUAL_THESAURUS, getSearchVariants, evaluateProductSearchScore };`);

const cat = JSON.parse(fs.readFileSync('catalog.json', 'utf8'));
const allProducts = cat.products;

const { evaluateProductSearchScore } = evalFn(allProducts);

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

console.log(`Testing ${testQueries.length} real queries on ${allProducts.length} products:\n`);

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
    console.log(`✅ [${q}] -> Found ${matches.length} matches! Top: "${matches[0].title.slice(0, 50)}..." @ ${matches[0].price} EGP (${matches[0].store})`);
  } else {
    console.log(`❌ [${q}] -> 0 matches!`);
  }
}

console.log(`\nResult: ${passCount}/${testQueries.length} passed.`);
if (passCount === testQueries.length) {
  console.log('🎉 PERFECT 100% SEARCH RECALL!');
}
