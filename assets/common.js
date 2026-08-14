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

  function initChrome(){
    renderBadges();
    // در صورتی که صفحه از حافظهٔ back-forward مرورگر (bfcache) بازیابی شود،
    // اسکریپت دوباره اجرا نمی‌شود، پس باید عدد سبد را دستی تازه کنیم.
    window.addEventListener("pageshow", function(e){
      cart = loadCart();
      renderBadges();
    });
  }

  /* ---------- cart logic ---------- */
  function cartCount(){
    var c = 0;
    Object.keys(cart).forEach(function(code){ c += cart[code] || 0; });
    return c;
  }
  function qtyOf(code){ return cart[code] || 0; }
  function addToCart(code, qty){
    var product = getProductByCode(code);
    if(!product) return;
    var current = cart[code] || 0;
    var next = Math.min(current + qty, CONFIG.MAX_QTY_PER_PRODUCT);
    if(next === current){
      toast("حداکثر " + CONFIG.MAX_QTY_PER_PRODUCT + " عدد از این محصول قابل افزودن است.", true);
      return;
    }
    cart[code] = next;
    saveCart();
    notify();
    toast(product.name + " به سبد اضافه شد.");
  }
  function setQty(code, qty){
    if(qty <= 0){ delete cart[code]; }
    else { cart[code] = Math.min(qty, CONFIG.MAX_QTY_PER_PRODUCT); }
    saveCart();
    notify();
  }
  function cartEntries(){
    return Object.keys(cart)
      .filter(function(code){ return productsByCode[code] && cart[code] > 0; })
      .map(function(code){ return { code: code, qty: cart[code], product: productsByCode[code] }; });
  }
  function cartTotal(){
    return cartEntries().reduce(function(sum, e){ return sum + (Number(e.product.price)||0) * e.qty; }, 0);
  }

  /* ---------- shared product-card renderer (home / search / related) ---------- */
  function cardHtml(p){
    var thumb = escapeHtml(p.thumb || p.image || "");
    var qtyInCart = qtyOf(p.code);
    var atMax = qtyInCart >= CONFIG.MAX_QTY_PER_PRODUCT;
    var category = (p.category || "").trim();
    return (
      '<a class="card" href="' + productUrl(p.code) + '" data-code="' + escapeHtml(p.code) + '">' +
        '<span class="card-media">' +
          '<img src="' + thumb + '" alt="' + escapeHtml(p.name) + '" loading="lazy">' +
        '</span>' +
        '<span class="card-body">' +
          (category ? '<span class="card-cat">' + escapeHtml(category) + '</span>' : "") +
          '<h3 class="card-title">' + escapeHtml(p.name) + '</h3>' +
          '<p class="card-desc">' + escapeHtml(p.description || "") + '</p>' +
          '<span class="card-foot">' +
            '<span class="price-tag num">' + fmtPrice(p.price) + '</span>' +
            '<button type="button" class="add-btn" data-add="' + escapeHtml(p.code) + '" ' + (atMax ? "disabled" : "") + '>' +
              (atMax ? "حداکثر" : "افزودن") +
            '</button>' +
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
    onChange: onChange,
    initChrome: initChrome,
    renderBadges: renderBadges,
    cartCount: cartCount,
    qtyOf: qtyOf,
    addToCart: addToCart,
    setQty: setQty,
    cartEntries: cartEntries,
    cartTotal: cartTotal,
    cardHtml: cardHtml,
    wireGridAddButtons: wireGridAddButtons,
    loadCustomer: loadCustomer,
    saveCustomer: saveCustomer
  };
})();
