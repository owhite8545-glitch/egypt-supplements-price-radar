# -*- coding: utf-8 -*-
"""
Egypt Supplements Price Radar & Scraper (6 Core Stores + External Egyptian Market Radar)
"""

import sys
import json
import time
import re
import urllib.request
from datetime import datetime

KNOWN_BRANDS = [
    'Optimum Nutrition', 'MuscleTech', 'Dymatize', 'BioTechUSA', 'BiotechUSA',
    'Kevin Levrone', 'Applied Nutrition', 'Rule 1', 'FA Engineered', 'Cellucor',
    'BSN', 'Dorian Yates', 'DY Nutrition', 'Yava Labs', 'Nutrex', 'Animal',
    'Universal Nutrition', 'Ronnie Coleman', 'Ultimate Nutrition', 'MusclePharm',
    'Redcon1', 'Scitec Nutrition', 'Olimp', 'MyProtein', 'Mutant', 'Tractor',
    'Novogen Pharma', 'Challenger', 'Labrada', 'JNX Sports', 'PVL', 'Ghost',
    'Grenade', 'EHP Labs', 'BPI Sports', 'Evogen'
]

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}

def detect_brand(title, vendor=None):
    if vendor and vendor not in ['Unknown', 'Default', ''] and len(vendor) > 2:
        return vendor.strip()
    t_lower = title.lower()
    for b in KNOWN_BRANDS:
        if b.lower() in t_lower:
            return b
    return "ماركة معتمدة"

def extract_weight(title):
    m = re.search(r'(\d+(?:\.\d+)?\s*(?:kg|g|gm|lbs|lb|servings|serv|capsules|caps|tablets|tabs|ml))', title, re.IGNORECASE)
    return m.group(1).upper() if m else ''

def generate_match_key(title, brand):
    clean = re.sub(r'[^a-zA-Z0-9\s]', ' ', title).lower()
    for drop in ['100%', 'powder', 'supplement', 'flavour', 'flavor', 'egypt', 'drink', 'explosive', 'zero', 'sugar', 'energy']:
        clean = re.sub(r'\b' + drop + r'\b', '', clean)
    clean = re.sub(r'\s+', ' ', clean).strip()
    brand_words = (brand or '').lower().split()
    words = [w for w in clean.split() if len(w) >= 2 and w not in brand_words]
    b_key = (brand or 'brand').lower().replace(' ', '_')
    sub = '_'.join(words[:4])
    return f"{b_key}_{sub}"

def fetch_json(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode('utf-8'))

def fetch_shopify(store, max_pages=2):
    print(f"[Shopify] جاري سحب {store['nameAr']} ({store['name']})...")
    products = []
    for page in range(1, max_pages + 1):
        try:
            url = f"{store['apiUrl']}?limit=250&page={page}"
            data = fetch_json(url)
            items = data.get('products', [])
            if not items:
                break
            for p in items:
                variants = p.get('variants', [])
                prices = [float(v.get('price', 0)) for v in variants if float(v.get('price', 0)) > 0]
                min_p = min(prices) if prices else 0
                max_p = max(prices) if prices else min_p
                in_stock = any(v.get('available') is True for v in variants)
                brand = detect_brand(p.get('title', ''), p.get('vendor'))
                weight = extract_weight(p.get('title', ''))
                key = generate_match_key(p.get('title', ''), brand)
                orig_p = float(variants[0].get('compare_at_price')) if variants and variants[0].get('compare_at_price') else None

                products.append({
                    'id': f"{store['id']}_{p.get('id')}",
                    'storeId': store['id'],
                    'storeName': store['nameAr'],
                    'storeNameEn': store['name'],
                    'platform': store['platform'],
                    'isExternal': bool(store.get('isExternalRadar')),
                    'title': p.get('title', ''),
                    'brand': brand,
                    'weight': weight,
                    'price': min_p,
                    'originalPrice': orig_p,
                    'inStock': in_stock,
                    'url': f"{store['url']}/products/{p.get('handle', '')}",
                    'image': p.get('images', [{}])[0].get('src', '') if p.get('images') else '',
                    'category': p.get('product_type') or 'مكملات غذائية',
                    'matchKey': key
                })
            print(f"  -> صفحة {page}: تم سحب {len(items)} منتج")
        except Exception as e:
            print(f"  خطأ في {store['name']}: {e}")
            break
    print(f"  اكتمل {store['nameAr']}: الإجمالي {len(products)} منتج.")
    return products

def fetch_woocommerce(store, max_pages=3):
    print(f"[WooCommerce] جاري سحب {store['nameAr']} ({store['name']})...")
    products = []
    for page in range(1, max_pages + 1):
        try:
            url = f"{store['apiUrl']}?per_page=100&page={page}"
            items = fetch_json(url)
            if not isinstance(items, list) or not items:
                break
            for p in items:
                prices_obj = p.get('prices', {})
                raw_price = int(prices_obj.get('price') or 0)
                minor = int(prices_obj.get('currency_minor_unit') or 2)
                price = raw_price / (10 ** minor)
                raw_reg = int(prices_obj.get('regular_price') or 0)
                reg_price = raw_reg / (10 ** minor)
                brand_attr = next((a for a in p.get('attributes', []) if 'brand' in a.get('name', '').lower()), None)
                brand_val = brand_attr.get('terms', [{}])[0].get('name') if brand_attr and brand_attr.get('terms') else None
                brand = detect_brand(p.get('name', ''), brand_val)
                weight = extract_weight(p.get('name', ''))
                key = generate_match_key(p.get('name', ''), brand)

                products.append({
                    'id': f"{store['id']}_{p.get('id')}",
                    'storeId': store['id'],
                    'storeName': store['nameAr'],
                    'storeNameEn': store['name'],
                    'platform': store['platform'],
                    'isExternal': bool(store.get('isExternalRadar')),
                    'title': p.get('name', ''),
                    'brand': brand,
                    'weight': weight,
                    'price': price,
                    'originalPrice': reg_price if reg_price > price else None,
                    'inStock': p.get('is_in_stock', True),
                    'url': p.get('permalink', ''),
                    'image': p.get('images', [{}])[0].get('src', '') if p.get('images') else '',
                    'category': p.get('categories', [{}])[0].get('name', 'مكملات غذائية') if p.get('categories') else 'مكملات غذائية',
                    'matchKey': key
                })
            print(f"  -> صفحة {page}: تم سحب {len(items)} منتج")
        except Exception as e:
            print(f"  خطأ في {store['name']}: {e}")
            break
    print(f"  اكتمل {store['nameAr']}: الإجمالي {len(products)} منتج.")
    return products

def main():
    is_full = '--all' in sys.argv or '--full' in sys.argv
    start_time = time.time()
    print("=========================================")
    print("🚀 بدء فحص وتتبع أسعار مكملات مصر (6 متاجر + رادار السوق الخارجي)")
    print(f"الوقت: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=========================================\n")

    with open('stores.json', 'r', encoding='utf-8') as f:
        cfg = json.load(f)

    core_stores = cfg.get('coreStores', cfg)
    ext_stores = cfg.get('externalStores', [])

    all_core = []
    all_ext = []

    for st in core_stores:
        st['isExternalRadar'] = False
        if st.get('type') == 'shopify':
            all_core.extend(fetch_shopify(st, max_pages=10 if is_full else 2))
        else:
            all_core.extend(fetch_woocommerce(st, max_pages=15 if is_full else 3))

    for st in ext_stores:
        st['isExternalRadar'] = True
        if st.get('type') == 'shopify':
            all_ext.extend(fetch_shopify(st, max_pages=2))
        else:
            all_ext.extend(fetch_woocommerce(st, max_pages=2))

    print(f"\nتم سحب {len(all_core)} من المتاجر الـ 6، و {len(all_ext)} من رادار السوق.")

    groups = {}
    for item in all_core:
        if not item.get('price') or item['price'] <= 0:
            continue
        k = item.get('matchKey') or re.sub(r'[^a-zA-Z0-9]', '_', item['title'].lower())
        if k not in groups:
            groups[k] = {
                'matchKey': k,
                'title': item['title'],
                'brand': item['brand'],
                'weight': item['weight'],
                'category': item['category'],
                'image': item['image'],
                'core': [],
                'ext': []
            }
        g = groups[k]
        if not g['image'] and item['image']:
            g['image'] = item['image']
        g['core'].append(item)

    for item in all_ext:
        if not item.get('price') or item['price'] <= 0:
            continue
        k = item.get('matchKey') or re.sub(r'[^a-zA-Z0-9]', '_', item['title'].lower())
        if k in groups:
            groups[k]['ext'].append(item)
        else:
            groups[k] = {
                'matchKey': k,
                'title': item['title'],
                'brand': item['brand'],
                'weight': item['weight'],
                'category': item['category'],
                'image': item['image'],
                'core': [],
                'ext': [item]
            }

    catalog = []
    for k, g in groups.items():
        breakdown = {}
        avail_core = []
        for st in core_stores:
            match = next((v for v in g['core'] if v['storeId'] == st['id']), None)
            if match:
                breakdown[st['id']] = {
                    'storeId': st['id'],
                    'storeName': st['nameAr'],
                    'available': True,
                    'inStock': match['inStock'],
                    'price': match['price'],
                    'originalPrice': match['originalPrice'],
                    'url': match['url']
                }
                if match['inStock'] and match['price'] > 0:
                    avail_core.append(match)
            else:
                breakdown[st['id']] = {
                    'storeId': st['id'],
                    'storeName': st['nameAr'],
                    'available': False,
                    'inStock': False,
                    'price': None,
                    'reason': 'غير متوفر في هذا المتجر'
                }

        lowest_core = None
        cheapest_core = None
        highest_core = None

        if avail_core:
            avail_core.sort(key=lambda x: x['price'])
            lowest_core = avail_core[0]['price']
            cheapest_core = avail_core[0]['storeName']
            highest_core = avail_core[-1]['price']

        # External cheaper check
        ext_cheaper = None
        priced_ext = [e for e in g['ext'] if e['price'] > 0 and e.get('inStock', True)]
        if priced_ext:
            priced_ext.sort(key=lambda x: x['price'])
            best_ext = priced_ext[0]
            if not lowest_core or best_ext['price'] < lowest_core:
                savings = (lowest_core - best_ext['price']) if lowest_core else 0
                ext_cheaper = {
                    'found': True,
                    'storeId': best_ext['storeId'],
                    'storeName': best_ext['storeName'],
                    'price': best_ext['price'],
                    'url': best_ext['url'],
                    'savingsVsCore': round(savings, 1),
                    'verifiedEgypt': True,
                    'shippingInfo': 'متجر مصري موثوق - شحن لجميع المحافظات'
                }

        abs_lowest = ext_cheaper['price'] if ext_cheaper else lowest_core
        abs_store = ext_cheaper['storeName'] if ext_cheaper else cheapest_core

        catalog.append({
            'id': k,
            'title': g['title'],
            'brand': g['brand'],
            'weight': g['weight'],
            'category': g['category'],
            'image': g['image'],
            'lowestPrice': abs_lowest,
            'cheapestStore': abs_store,
            'lowestCorePrice': lowest_core,
            'cheapestCoreStore': cheapest_core,
            'highestPrice': highest_core,
            'maxSavings': (highest_core - abs_lowest) if (highest_core and abs_lowest) else 0,
            'isExclusive': (len(avail_core) == 1 and not ext_cheaper),
            'availableCount': len(avail_core),
            'storeBreakdown': breakdown,
            'externalCheaper': ext_cheaper,
            'lastUpdated': datetime.utcnow().isoformat()
        })

    catalog.sort(key=lambda x: x['availableCount'], reverse=True)

    output = {
        'metadata': {
            'generatedAt': datetime.utcnow().isoformat(),
            'durationSeconds': round(time.time() - start_time, 2),
            'totalRawProducts': len(all_core) + len(all_ext),
            'totalComparedItems': len(catalog),
            'externalDealsFound': sum(1 for c in catalog if c['externalCheaper']),
            'storesCount': len(core_stores)
        },
        'coreStores': core_stores,
        'externalStores': ext_stores,
        'products': catalog
    }

    with open('catalog.json', 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print("\n=========================================")
    print("✅ تم حفظ الكتالوج بنجاح في ملف catalog.json")
    print(f"- إجمالي المجموعات المقارنة: {len(catalog)}")
    print(f"- صفقات رادار السوق البنفسجية خارج الـ 6: {output['metadata']['externalDealsFound']}")
    print("=========================================\n")

if __name__ == '__main__':
    main()
