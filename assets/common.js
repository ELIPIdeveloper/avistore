/* =====================================================================
   common.js — منطق مشترک بین همه صفحات (خانه، جستجو، سبد خرید، صفحه محصول)
   سبد خرید در localStorage نگه‌داری می‌شود، پس بین همه صفحات مشترک است.
   ===================================================================== */
window.AVISTORE = (function(){
  "use strict";

  var CONFIG = {
    API_BASE: "",                 // خالی = همان دامنه. در غیر این‌صورت مثلا "https://your-worker.workers.dev"
    PRODUCTS_URL: "/assets/products.json",
    MAX_QTY_PER_PRODUCT: 10,
    CURRENCY_LABEL: "ریال",
    HOME_RANDOM_COUNT: 8
  };

  var STORAGE = {
    CART: "avistore_cart",
    CUSTOMER: "avistore_customer"
  };

  var products = [];
  var productsByCode = {};
  var cart = loadCart();
  var listeners = [];

  /* ---------- storage ---------- */
  function loadCart(){
    try {
      var raw = localStorage.getItem(STORAGE.CART);
      var parsed = raw ? JSON.parse(raw) : {};
      return (parsed && typeof parsed === "object") ? parsed : {};
    } catch(e){ return {}; }
  }
  function saveCart(){
    try { localStorage.setItem(STORAGE.CART, JSON.stringify(cart)); } catch(e){}
  }
  function loadCustomer(){
    try {
      var raw = localStorage.getItem(STORAGE.CUSTOMER);
      return raw ? JSON.parse(raw) : {};
    } catch(e){ return {}; }
  }
  function saveCustomer(data){
    try { localStorage.setItem(STORAGE.CUSTOMER, JSON.stringify(data)); } catch(e){}
  }

  /* ---------- utils ---------- */
  function fmtPrice(n){
    n = Number(n) || 0;
    return n.toLocaleString("fa-IR") + " " + CONFIG.CURRENCY_LABEL;
  }
  function escapeHtml(s){
    return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c];
    });
  }
  function shuffledCopy(arr){
    var a = arr.slice();
    for(var i = a.length - 1; i > 0; i--){
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }
  function toast(msg, isErr){
    var stack = document.getElementById("toastStack");
    if(!stack) return;
    var el = document.createElement("div");
    el.className = "toast" + (isErr ? " err" : "");
    el.textContent = msg;
    stack.appendChild(el);
    setTimeout(function(){
      el.style.transition = "opacity .3s"; el.style.opacity = "0";
      setTimeout(function(){ el.remove(); }, 300);
    }, 2200);
  }
  function productUrl(code){ return "/products/" + encodeURIComponent(code) + "/"; }

  /* ---------- product image gallery ----------
     اگر محصول آرایهٔ images داشته باشد همان استفاده می‌شود (چند عکس)،
     در غیر این‌صورت فقط همان یک عکس/thumb قبلی به‌عنوان تک‌آیتم برگردانده می‌شود. */
  function productImages(p){
    if(!p) return [];
    if(Array.isArray(p.images) && p.images.length){
      return p.images.filter(Boolean);
    }
    var single = p.image || p.thumb;
    return single ? [single] : [];
  }

  /* ---------- variant (رنگ/سایز/وزن) key helpers ----------
     کلید سبد خرید معمولاً همان کد محصول است؛ اگر رنگ/سایز/وزن انتخاب شده
     باشد به کلید اضافه می‌شود تا هر ترکیب به‌صورت مستقل در سبد شمرده شود.
     یک محصول می‌تواند هیچ‌کدام، یکی، دوتا یا هر سه‌ی این گزینه‌ها را
     داشته باشد (colors / sizes / weights در products.json اختیاری‌اند).
     این کلید‌ها با استخراج کد از ابتدای رشته (تا اولین "|") با نسخهٔ قبلی
     (که فقط کد بود) کاملاً سازگار می‌مانند. */
  function variantKey(code, variant){
    var parts = [code];
    if(variant && variant.color) parts.push("c:" + variant.color);
    if(variant && variant.size) parts.push("s:" + variant.size);
    if(variant && variant.weight) parts.push("w:" + variant.weight);
    return parts.join("|");
  }
  function keyToCode(key){ return String(key).split("|")[0]; }
  function keyToVariant(key){
    var parts = String(key).split("|").slice(1);
    var v = {};
    parts.forEach(function(part){
      if(part.indexOf("c:") === 0) v.color = part.slice(2);
      else if(part.indexOf("s:") === 0) v.size = part.slice(2);
      else if(part.indexOf("w:") === 0) v.weight = part.slice(2);
    });
    return v;
  }

  /* ---------- قیمت بر اساس رنگ/سایز/وزن ----------
     هر گزینهٔ رنگ/سایز/وزن می‌تواند فیلد اختیاری priceDiff داشته باشد
     (مبلغی که به قیمت پایه اضافه/کم می‌شود). اگر priceDiff نداشته باشد
     یعنی همان قیمت پایه محصول، بدون تغییر. sizes/weights هم می‌توانند
     رشتهٔ ساده باشند (بدون اختلاف قیمت) و هم آبجکت {name, priceDiff}
     برای سازگاری با محصولات قدیمی. */
  function sizeName(s){ return (s && typeof s === "object") ? s.name : s; }
  function variantPriceDiff(p, variant){
    var diff = 0;
    if(variant && variant.color && Array.isArray(p.colors)){
      var c = p.colors.filter(function(x){ return x.name === variant.color; })[0];
      if(c && c.priceDiff) diff += Number(c.priceDiff) || 0;
    }
    if(variant && variant.size && Array.isArray(p.sizes)){
      var s = p.sizes.filter(function(x){ return sizeName(x) === variant.size; })[0];
      if(s && typeof s === "object" && s.priceDiff) diff += Number(s.priceDiff) || 0;
    }
    if(variant && variant.weight && Array.isArray(p.weights)){
      var w = p.weights.filter(function(x){ return sizeName(x) === variant.weight; })[0];
      if(w && typeof w === "object" && w.priceDiff) diff += Number(w.priceDiff) || 0;
    }
    return diff;
  }
  function effectivePrice(p, variant){
    var diff = variantPriceDiff(p, variant);
    var out = { price: (Number(p.price) || 0) + diff };
    if(p.oldPrice) out.oldPrice = (Number(p.oldPrice) || 0) + diff;
    return out;
  }

  /* ---------- product data ---------- */
  function fetchProducts(){
    if(products.length) return Promise.resolve(products);
    return fetch(CONFIG.PRODUCTS_URL, { cache: "no-store" })
      .then(function(r){
        if(!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function(list){
        if(!Array.isArray(list)) throw new Error("فرمت products.json نامعتبر است.");
        products = list.filter(function(p){ return p && p.code && p.active !== false; });
        productsByCode = {};
        products.forEach(function(p){ productsByCode[p.code] = p; });
        return products;
      });
  }
  function getProductByCode(code){ return productsByCode[code]; }
  function getCategories(){
    var seen = {};
    var list = [];
    products.forEach(function(p){
      var c = (p.category || "").trim();
      if(!c || seen[c]) return;
      seen[c] = true;
      list.push(c);
    });
    return list.sort(function(a, b){ return a.localeCompare(b, "fa"); });
  }
  function categoryUrl(cat){ return "/categories.html?cat=" + encodeURIComponent(cat); }

  /* ---------- change notifications (badge/cart re-render across a page) ---------- */
  function onChange(fn){ listeners.push(fn); }
  function notify(){ listeners.forEach(function(fn){ fn(); }); renderBadges(); }

  /* ---------- header / badges / nav (present on every page) ----------
     نکته دربارهٔ باگ «صفر ماندن عدد سبد خرید»: قبلاً برای مخفی/نمایش
     کردن مقدار روی attribute بولی «hidden» تکیه می‌کردیم. در برخی
     مرورگرها/دستگاه‌ها (به‌خصوص وقتی چند استایل‌شیت با هم رقابت
     می‌کنند) قانون [hidden]{display:none} می‌تواند حتی وقتی خودمان
     hidden=false می‌گذاریم برنده شود، پس بج همیشه پنهان می‌ماند و
     در نتیجه شمارهٔ صحیح هیچ‌وقت دیده نمی‌شود. راه‌حل: به‌جای
     attribute، مستقیماً style.display را کنترل می‌کنیم که همیشه
     بالاترین اولویت را دارد و دیگر به رقابت CSS وابسته نیست. */
  function renderBadges(){
    var count = cartCount();
    document.querySelectorAll(".cart-badge").forEach(function(b){
      b.textContent = count;
      b.style.display = count > 0 ? "flex" : "none";
      b.removeAttribute("hidden");
    });
    document.querySelectorAll(".nav-badge").forEach(function(b){
      b.textContent = count;
      b.style.display = count > 0 ? "flex" : "none";
      b.removeAttribute("hidden");
    });
  }

  /* ---------- reveal-once (بلور→واضح + حرکت، هنگام اسکرول وارد دید صفحه یا بلافاصله بعد از رندر نتایج سرچ) ----------
     هدر (نوار بالا) و نوار پایین عمداً از این سیستم بیرون نگه داشته می‌شوند و کلاس reveal-once نمی‌گیرند. */
  var revealObserver = null;
  function getRevealObserver(){
    if(revealObserver) return revealObserver;
    if(typeof IntersectionObserver === "undefined") return null;
    revealObserver = new IntersectionObserver(function(entries, obs){
      entries.forEach(function(entry){
        if(entry.isIntersecting){
          entry.target.classList.add("revealed");
          obs.unobserve(entry.target);
        }
      });
    }, { root: null, rootMargin: "0px 0px -10% 0px", threshold: 0.12 });
    return revealObserver;
  }
  function wireRevealOnce(scope){
    var root = scope || document;
    var els = root.querySelectorAll(".reveal-once:not([data-reveal-wired])");
    var obs = getRevealObserver();
    els.forEach(function(el){
      el.setAttribute("data-reveal-wired", "1");
      if(obs) obs.observe(el);
      else el.classList.add("revealed"); // مرورگر بدون پشتیبانی از IntersectionObserver
    });
  }

  function initChrome(){
    renderBadges();
    wireRevealOnce();
    // در صورتی که صفحه از حافظهٔ back-forward مرورگر (bfcache) بازیابی شود،
    // اسکریپت دوباره اجرا نمی‌شود، پس باید عدد سبد را دستی تازه کنیم.
    window.addEventListener("pageshow", function(e){
      cart = loadCart();
      renderBadges();
    });
  }

  /* ---------- cart logic ----------
     کلید‌های cart می‌توانند فقط کد محصول باشند (بدون تنوع) یا
     "کد|c:رنگ|s:سایز" باشند (وقتی کاربر رنگ/سایز را از صفحهٔ محصول انتخاب می‌کند). */
  function cartCount(){
    var c = 0;
    Object.keys(cart).forEach(function(key){ c += cart[key] || 0; });
    return c;
  }
  function qtyOf(key){ return cart[key] || 0; }
  function addToCart(key, qty){
    var product = getProductByCode(keyToCode(key));
    if(!product) return;
    if(!isInStock(product)){
      toast("این محصول در حال حاضر ناموجود است.", true);
      return;
    }
    var current = cart[key] || 0;
    var next = Math.min(current + qty, CONFIG.MAX_QTY_PER_PRODUCT);
    if(next === current){
      toast("حداکثر " + CONFIG.MAX_QTY_PER_PRODUCT + " عدد از این محصول قابل افزودن است.", true);
      return;
    }
    cart[key] = next;
    saveCart();
    notify();
    toast(product.name + " به سبد اضافه شد.");
  }
  function setQty(key, qty){
    if(qty <= 0){ delete cart[key]; }
    else { cart[key] = Math.min(qty, CONFIG.MAX_QTY_PER_PRODUCT); }
    saveCart();
    notify();
  }
  function cartEntries(){
    return Object.keys(cart)
      .filter(function(key){ return productsByCode[keyToCode(key)] && cart[key] > 0; })
      .map(function(key){
        var code = keyToCode(key);
        var variant = keyToVariant(key);
        var product = productsByCode[code];
        var eff = effectivePrice(product, variant);
        return {
          key: key,
          code: code,
          variant: variant,
          qty: cart[key],
          product: product,
          price: eff.price,
          oldPrice: eff.oldPrice
        };
      });
  }
  function cartTotal(){
    return cartEntries().reduce(function(sum, e){ return sum + (Number(e.price)||0) * e.qty; }, 0);
  }

  function discountPercent(p){
    var old = Number(p.oldPrice) || 0;
    var price = Number(p.price) || 0;
    if(!old || old <= price) return 0;
    return Math.round(((old - price) / old) * 100);
  }

  /* محصول همچنان نمایش داده می‌شود (بر خلاف active:false که کلاً از لیست‌ها
     حذفش می‌کند)، فقط دکمهٔ افزودن غیرفعال و برچسب «ناموجود» نشان داده می‌شود.
     برای ناموجود کردن یک محصول: در products.json فیلد "inStock": false اضافه کنید. */
  function isInStock(p){
    return p && p.inStock !== false;
  }

  /* ---------- shared product-card renderer (home / search / related) ----------
     opts.showDesc و opts.showAdd پیش‌فرض true هستند (رفتار قبلی حفظ می‌شود).
     صفحهٔ اصلی این دو را false می‌فرستد تا نه توضیحات نشان داده شود و نه
     دکمهٔ «افزودن» — با کلیک روی کارت مستقیماً به صفحهٔ محصول می‌رود و
     افزودن به سبد فقط از همان‌جا انجام می‌شود. */
  function cardHtml(p, opts){
    opts = opts || {};
    var showDesc = opts.showDesc !== false;
    var showAdd = opts.showAdd !== false;
    var thumb = escapeHtml(p.thumb || p.image || "");
    var qtyInCart = qtyOf(p.code);
    var atMax = qtyInCart >= CONFIG.MAX_QTY_PER_PRODUCT;
    var category = (p.category || "").trim();
    var off = discountPercent(p);
    var inStock = isInStock(p);
    return (
      '<a class="card reveal-once' + (inStock ? "" : " is-oos") + '" href="' + productUrl(p.code) + '" data-code="' + escapeHtml(p.code) + '">' +
        '<span class="card-media">' +
          '<img src="' + thumb + '" alt="' + escapeHtml(p.name) + '" loading="lazy">' +
          (!inStock ? '<span class="oos-badge">ناموجود</span>' : (off ? '<span class="discount-badge">' + off + '٪ تخفیف</span>' : "")) +
        '</span>' +
        '<span class="card-body">' +
          (category ? '<span class="card-cat">' + escapeHtml(category) + '</span>' : "") +
          '<h3 class="card-title">' + escapeHtml(p.name) + '</h3>' +
          (showDesc ? '<p class="card-desc">' + escapeHtml(p.description || "") + '</p>' : "") +
          '<span class="card-foot">' +
            '<span class="price-wrap">' +
              (off ? '<span class="price-old num">' + fmtPrice(p.oldPrice) + '</span>' : "") +
              '<span class="price-tag num">' + fmtPrice(p.price) + '</span>' +
            '</span>' +
            (showAdd ?
              (!inStock ?
                '<button type="button" class="add-btn" disabled>ناموجود</button>'
              :
                '<button type="button" class="add-btn" data-add="' + escapeHtml(p.code) + '" ' + (atMax ? "disabled" : "") + '>' +
                  (atMax ? "حداکثر" : "افزودن") +
                '</button>'
              )
            : "") +
          '</span>' +
        '</span>' +
      '</a>'
    );
  }
  function wireGridAddButtons(gridEl){
    gridEl.addEventListener("click", function(e){
      var addBtn = e.target.closest("[data-add]");
      if(!addBtn) return;
      e.preventDefault();
      e.stopPropagation();
      addToCart(addBtn.getAttribute("data-add"), 1);
    });
  }

  /* ---------- ردیفی/خطی (list) renderer — برای صفحهٔ جستجو ----------
     بدون توضیحات و بدون دکمهٔ افزودن؛ کل ردیف یک لینک است و با کلیک
     مستقیم به صفحهٔ محصول (/products/کد/) می‌رود. عکس کوچک سمت راست،
     بعد از آن عنوان محصول و یک متن کوچک از دسته‌بندی. */
  function listItemHtml(p){
    var thumb = escapeHtml(p.thumb || p.image || "");
    var category = (p.category || "").trim();
    var off = discountPercent(p);
    var inStock = isInStock(p);
    return (
      '<a class="list-item reveal-once' + (inStock ? "" : " is-oos") + '" href="' + productUrl(p.code) + '" data-code="' + escapeHtml(p.code) + '">' +
        '<span class="list-item-media">' +
          '<img src="' + thumb + '" alt="' + escapeHtml(p.name) + '" loading="lazy">' +
          (!inStock ? '<span class="oos-badge sm">ناموجود</span>' : (off ? '<span class="discount-badge sm">' + off + '٪</span>' : "")) +
        '</span>' +
        '<span class="list-item-body">' +
          '<span class="list-item-title">' + escapeHtml(p.name) + '</span>' +
          (category ? '<span class="list-item-cat">' + escapeHtml(category) + '</span>' : "") +
          '<span class="list-item-foot">' +
            (off ? '<span class="price-old num">' + fmtPrice(p.oldPrice) + '</span>' : "") +
            '<span class="price-tag num">' + fmtPrice(p.price) + '</span>' +
          '</span>' +
        '</span>' +
      '</a>'
    );
  }

  /* ---------- تاریخچهٔ سفارش‌ها (محلی/localStorage) ----------
     چون سایت کاربرِ لاگین‌شده ندارد، خلاصهٔ سفارش‌هایی که از همین مرورگر
     ثبت شده‌اند برای نمایش در سبد خرید و چاپ فاکتور، در localStorage
     نگه‌داری می‌شود. منبع اصلی و رسمی سفارش‌ها همیشه دیتابیس سرور
     (D1 در ورکر) است؛ این فقط یک رونوشت راحت برای همین دستگاه است. */
  var ORDERS_KEY = "avistore_orders";
  var MAX_STORED_ORDERS = 30;

  function loadOrders(){
    try {
      var raw = localStorage.getItem(ORDERS_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch(e){ return []; }
  }
  function saveOrders(list){
    try { localStorage.setItem(ORDERS_KEY, JSON.stringify(list.slice(0, MAX_STORED_ORDERS))); } catch(e){}
  }
  function addOrder(order){
    if(!order || !order.purchase_id) return;
    var list = loadOrders().filter(function(o){ return o.purchase_id !== order.purchase_id; });
    list.unshift(order);
    saveOrders(list);
  }
  function updateOrder(purchaseId, patch){
    var list = loadOrders();
    var idx = -1;
    for(var i = 0; i < list.length; i++){ if(list[i].purchase_id === purchaseId){ idx = i; break; } }
    if(idx === -1) return null;
    list[idx] = Object.assign({}, list[idx], patch);
    saveOrders(list);
    return list[idx];
  }
  function getOrders(){ return loadOrders(); }
  function getOrder(purchaseId){
    var list = loadOrders();
    for(var i = 0; i < list.length; i++){ if(list[i].purchase_id === purchaseId) return list[i]; }
    return null;
  }
  function clearCart(){
    cart = {};
    saveCart();
    notify();
  }

  /* ---------- ساخت و چاپ فاکتور ---------- */
  function fmtOrderDate(iso){
    if(!iso) return "";
    try {
      return new Date(iso).toLocaleDateString("fa-IR", { year: "numeric", month: "2-digit", day: "2-digit" }) +
        " ساعت " + new Date(iso).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
    } catch(e){ return ""; }
  }
  function orderStatusLabel(status){
    if(status === "paid") return "پرداخت‌شده";
    if(status === "failed") return "ناموفق";
    return "در انتظار پرداخت";
  }
  function buildInvoiceHtml(order){
    order = order || {};
    var items = Array.isArray(order.items) ? order.items : [];
    var customer = order.customer || {};
    var rows = items.map(function(it, i){
      var variantBits = [];
      if(it.color) variantBits.push("رنگ: " + it.color);
      if(it.size) variantBits.push("سایز: " + it.size);
      if(it.weight) variantBits.push("وزن: " + it.weight);
      return (
        '<tr>' +
          '<td>' + (i + 1) + '</td>' +
          '<td>' + escapeHtml(it.name || it.code || "") + (variantBits.length ? '<div class="v">' + escapeHtml(variantBits.join(" · ")) + '</div>' : "") + '</td>' +
          '<td class="num">' + (it.qty || 0) + '</td>' +
          '<td class="num">' + fmtPrice(it.price) + '</td>' +
          '<td class="num">' + fmtPrice(it.line_total != null ? it.line_total : (it.price || 0) * (it.qty || 0)) + '</td>' +
        '</tr>'
      );
    }).join("");
    var addressLine = [customer.province, customer.city, customer.address].filter(Boolean).join("، ");
    return (
      '<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8">' +
      '<title>فاکتور ' + escapeHtml(order.purchase_id || "") + '</title>' +
      '<link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;700;800;900&display=swap" rel="stylesheet">' +
      '<style>' +
        '*{box-sizing:border-box;}' +
        'body{font-family:"Vazirmatn",sans-serif;margin:0;padding:28px;color:#131C2B;background:#fff;}' +
        '.head{display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #1F4E86;padding-bottom:14px;margin-bottom:18px;}' +
        '.brand{font-weight:900;font-size:20px;color:#1F4E86;}' +
        '.head h1{font-size:15px;margin:0;font-weight:800;}' +
        '.meta{display:flex;flex-wrap:wrap;gap:8px 26px;font-size:12.5px;color:#55636F;margin-bottom:16px;}' +
        '.meta b{color:#131C2B;}' +
        '.status{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11.5px;font-weight:700;}' +
        '.status.paid{background:#E4F3E8;color:#1F7A3D;}' +
        '.status.pending{background:#FFF3D9;color:#93650A;}' +
        '.status.failed{background:#FBE7E2;color:#C2452F;}' +
        '.box{border:1px solid #E1E6ED;border-radius:14px;padding:14px 16px;margin-bottom:18px;font-size:12.5px;line-height:2;}' +
        '.box h3{margin:0 0 6px;font-size:13px;}' +
        'table{width:100%;border-collapse:collapse;font-size:12.5px;margin-bottom:18px;}' +
        'th,td{border:1px solid #E1E6ED;padding:8px 10px;text-align:right;}' +
        'th{background:#F5F7FA;font-weight:700;}' +
        '.v{color:#8994A1;font-size:11px;margin-top:2px;}' +
        '.total-row{display:flex;justify-content:space-between;font-size:15px;font-weight:800;padding:10px 4px;border-top:2px dashed #E1E6ED;}' +
        '.no-print{margin-top:22px;text-align:center;}' +
        '.no-print button{background:#1F4E86;color:#fff;border:none;border-radius:12px;padding:11px 24px;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer;}' +
        '.foot{margin-top:26px;text-align:center;color:#8994A1;font-size:11px;}' +
        '@media print{ .no-print{display:none;} body{padding:0;} }' +
      '</style></head><body>' +
        '<div class="head"><span class="brand">آوی استور</span><h1>فاکتور خرید</h1></div>' +
        '<div class="meta">' +
          '<span>شماره سفارش: <b class="num">' + escapeHtml(order.purchase_id || "-") + '</b></span>' +
          (order.ref_id ? '<span>کد رهگیری: <b class="num">' + escapeHtml(order.ref_id) + '</b></span>' : "") +
          '<span>تاریخ: <b>' + fmtOrderDate(order.paid_at || order.created_at) + '</b></span>' +
          '<span>وضعیت: <span class="status ' + escapeHtml(order.status || "pending") + '">' + orderStatusLabel(order.status) + '</span></span>' +
        '</div>' +
        (customer.full_name ? (
          '<div class="box"><h3>اطلاعات گیرنده</h3>' +
            '<div>نام: ' + escapeHtml(customer.full_name) + '</div>' +
            (customer.phone ? '<div>موبایل: <span class="num">' + escapeHtml(customer.phone) + '</span></div>' : "") +
            (addressLine ? '<div>آدرس: ' + escapeHtml(addressLine) + '</div>' : "") +
            (customer.postal_code ? '<div>کد پستی: <span class="num">' + escapeHtml(customer.postal_code) + '</span></div>' : "") +
          '</div>'
        ) : "") +
        (items.length ?
          '<table><thead><tr><th>#</th><th>محصول</th><th>تعداد</th><th>قیمت واحد</th><th>جمع</th></tr></thead><tbody>' + rows + '</tbody></table>'
          : '<p style="color:#8994A1;font-size:12.5px;">جزئیات اقلام این سفارش روی این دستگاه ذخیره نشده است.</p>'
        ) +
        '<div class="total-row"><span>جمع کل قابل پرداخت</span><span class="num">' + fmtPrice(order.amount) + '</span></div>' +
        '<div class="no-print"><button onclick="window.print()">چاپ فاکتور</button></div>' +
        '<div class="foot">آوی استور — این برگه به‌صورت خودکار تولید شده است.</div>' +
      '</body></html>'
    );
  }
  function printInvoice(order){
    if(!order){
      toast("سفارشی برای چاپ پیدا نشد.", true);
      return;
    }
    var html = buildInvoiceHtml(order);
    var w = window.open("", "_blank");
    if(!w){
      toast("مرورگر اجازهٔ باز شدن پنجرهٔ چاپ را نداد. لطفاً pop-up را برای این سایت فعال کنید.", true);
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(function(){ try { w.print(); } catch(e){} }, 350);
  }

  return {
    CONFIG: CONFIG,
    fmtPrice: fmtPrice,
    escapeHtml: escapeHtml,
    shuffledCopy: shuffledCopy,
    toast: toast,
    productUrl: productUrl,
    fetchProducts: fetchProducts,
    getProductByCode: getProductByCode,
    getAllProducts: function(){ return products; },
    getCategories: getCategories,
    categoryUrl: categoryUrl,
    productImages: productImages,
    variantKey: variantKey,
    effectivePrice: effectivePrice,
    onChange: onChange,
    initChrome: initChrome,
    wireRevealOnce: wireRevealOnce,
    renderBadges: renderBadges,
    cartCount: cartCount,
    qtyOf: qtyOf,
    addToCart: addToCart,
    setQty: setQty,
    cartEntries: cartEntries,
    cartTotal: cartTotal,
    cardHtml: cardHtml,
    listItemHtml: listItemHtml,
    discountPercent: discountPercent,
    isInStock: isInStock,
    wireGridAddButtons: wireGridAddButtons,
    loadCustomer: loadCustomer,
    saveCustomer: saveCustomer,
    clearCart: clearCart,
    addOrder: addOrder,
    updateOrder: updateOrder,
    getOrders: getOrders,
    getOrder: getOrder,
    fmtOrderDate: fmtOrderDate,
    orderStatusLabel: orderStatusLabel,
    buildInvoiceHtml: buildInvoiceHtml,
    printInvoice: printInvoice
  };
})();
