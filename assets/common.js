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

  /* ---------- variant (رنگ/سایز) key helpers ----------
     کلید سبد خرید معمولاً همان کد محصول است؛ اگر رنگ/سایز انتخاب شده باشد
     به کلید اضافه می‌شود تا هر ترکیب رنگ/سایز به‌صورت مستقل در سبد شمرده شود.
     این کلید‌ها با استخراج کد از ابتدای رشته (تا اولین "|") با نسخهٔ قبلی
     (که فقط کد بود) کاملاً سازگار می‌مانند. */
  function variantKey(code, variant){
    var parts = [code];
    if(variant && variant.color) parts.push("c:" + variant.color);
    if(variant && variant.size) parts.push("s:" + variant.size);
    return parts.join("|");
  }
  function keyToCode(key){ return String(key).split("|")[0]; }
  function keyToVariant(key){
    var parts = String(key).split("|").slice(1);
    var v = {};
    parts.forEach(function(part){
      if(part.indexOf("c:") === 0) v.color = part.slice(2);
      else if(part.indexOf("s:") === 0) v.size = part.slice(2);
    });
    return v;
  }

  /* ---------- قیمت بر اساس رنگ/سایز ----------
     هر گزینهٔ رنگ/سایز می‌تواند فیلد اختیاری priceDiff داشته باشد (مبلغی که
     به قیمت پایه اضافه/کم می‌شود). اگر priceDiff نداشته باشد یعنی همان قیمت
     پایه محصول، بدون تغییر. sizes هم می‌تواند رشتهٔ ساده باشد (بدون اختلاف
     قیمت) و هم آبجکت {name, priceDiff} برای سازگاری با محصولات قدیمی. */
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
    return (
      '<a class="card reveal-once" href="' + productUrl(p.code) + '" data-code="' + escapeHtml(p.code) + '">' +
        '<span class="card-media">' +
          '<img src="' + thumb + '" alt="' + escapeHtml(p.name) + '" loading="lazy">' +
          (off ? '<span class="discount-badge">' + off + '٪ تخفیف</span>' : "") +
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
              '<button type="button" class="add-btn" data-add="' + escapeHtml(p.code) + '" ' + (atMax ? "disabled" : "") + '>' +
                (atMax ? "حداکثر" : "افزودن") +
              '</button>'
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
    discountPercent: discountPercent,
    wireGridAddButtons: wireGridAddButtons,
    loadCustomer: loadCustomer,
    saveCustomer: saveCustomer
  };
})();
