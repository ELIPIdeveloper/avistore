(function(){
  "use strict";
  var A = window.AVISTORE;
  document.getElementById("year").textContent = new Date().getFullYear();
  A.initChrome();

  // کد محصول این صفحه از مسیر پوشه استخراج می‌شود؛ یعنی /products/{{CODE}}/
  var CODE = "{{CODE}}";

  // رنگ/سایز انتخاب‌شدهٔ فعلی (اگر محصول این گزینه‌ها را داشته باشد)
  var selected = { color: null, size: null };

  var qty = 1;
  var stepperEl = document.getElementById("pdStepper");
  var qtyEl = document.getElementById("pdQty");
  var thumbsEl = document.getElementById("pdThumbs");
  var variantsEl = document.getElementById("pdVariants");
  var imgEl = document.getElementById("pdImg");

  function currentKey(){ return A.variantKey(CODE, selected); }

  function renderProduct(){
    var p = A.getProductByCode(CODE);
    if(!p){
      document.querySelector(".pd-wrap").innerHTML = '<div class="error-state"><h3>محصول پیدا نشد</h3><p>این محصول ممکن است حذف شده یا موجود نباشد.</p></div>';
      return;
    }
    document.title = p.name + " | آوی استور";
    document.getElementById("pdName").textContent = p.name;
    document.getElementById("bcName").textContent = p.name;
    var bcCat = document.getElementById("bcCat");
    var bcCatSep = document.getElementById("bcCatSep");
    if(p.category){
      bcCat.textContent = p.category;
      bcCat.href = A.categoryUrl(p.category);
      bcCat.style.display = "";
      bcCatSep.style.display = "";
    } else {
      bcCat.style.display = "none";
      bcCatSep.style.display = "none";
    }
    document.getElementById("pdDesc").textContent = p.description || "";
    renderPrice(p);
    renderGallery(p);
    renderVariants(p);
    updateAddButtonState();
    renderRelated(p);
  }

  /* ---------- قیمت (بر اساس رنگ/سایز انتخاب‌شده) ---------- */
  function renderPrice(p){
    var eff = A.effectivePrice(p, selected);
    document.getElementById("pdPrice").textContent = A.fmtPrice(eff.price);
    var off = A.discountPercent(eff);
    var pdBadge = document.getElementById("pdDiscountBadge");
    var pdOld = document.getElementById("pdPriceOld");
    if(off){
      pdBadge.textContent = off + "٪ تخفیف";
      pdBadge.hidden = false;
      pdOld.textContent = A.fmtPrice(eff.oldPrice);
      pdOld.hidden = false;
    } else {
      pdBadge.hidden = true;
      pdOld.hidden = true;
    }
  }

  /* ---------- گالری چند عکسی ---------- */
  function renderGallery(p){
    var images = A.productImages(p);
    imgEl.alt = p.name;
    imgEl.src = images[0] || "";

    if(images.length <= 1){
      thumbsEl.hidden = true;
      thumbsEl.innerHTML = "";
      return;
    }
    thumbsEl.hidden = false;
    thumbsEl.innerHTML = images.map(function(src, i){
      return '<button type="button" class="pd-thumb' + (i === 0 ? " active" : "") + '" data-idx="' + i + '">' +
        '<img src="' + A.escapeHtml(src) + '" alt="' + A.escapeHtml(p.name) + ' - تصویر ' + (i + 1) + '">' +
      '</button>';
    }).join("");
    thumbsEl.querySelectorAll(".pd-thumb").forEach(function(btn){
      btn.addEventListener("click", function(){
        imgEl.src = images[Number(btn.getAttribute("data-idx"))];
        thumbsEl.querySelectorAll(".pd-thumb").forEach(function(b){ b.classList.remove("active"); });
        btn.classList.add("active");
      });
    });
  }

  /* ---------- رنگ و سایز ---------- */
  function renderVariants(p){
    var hasColors = Array.isArray(p.colors) && p.colors.length;
    var hasSizes = Array.isArray(p.sizes) && p.sizes.length;

    if(!hasColors && !hasSizes){
      variantsEl.hidden = true;
      variantsEl.innerHTML = "";
      selected.color = null;
      selected.size = null;
      return;
    }

    if(hasColors && (!selected.color || !p.colors.some(function(c){ return c.name === selected.color; }))){
      selected.color = p.colors[0].name;
    }
    if(hasSizes && (!selected.size || !p.sizes.some(function(s){ return sizeName(s) === selected.size; }))){
      selected.size = sizeName(p.sizes[0]);
    }

    function sizeName(s){ return (s && typeof s === "object") ? s.name : s; }
    function diffLabel(diff){
      if(!diff) return "";
      var sign = diff > 0 ? "+" : "−";
      return ' <span class="variant-diff">(' + sign + A.fmtPrice(Math.abs(diff)) + ')</span>';
    }

    var html = "";
    if(hasColors){
      html += '<div class="variant-group">' +
        '<div class="variant-group-label">رنگ: <b>' + A.escapeHtml(selected.color) + '</b></div>' +
        '<div class="variant-options">' +
        p.colors.map(function(c){
          var active = c.name === selected.color;
          return '<button type="button" class="color-swatch' + (active ? " active" : "") + '" ' +
            'style="background:' + A.escapeHtml(c.hex || "#ccc") + ';" ' +
            'data-color="' + A.escapeHtml(c.name) + '" title="' + A.escapeHtml(c.name) + '" aria-label="' + A.escapeHtml(c.name) + '"></button>';
        }).join("") +
        '</div></div>';
    }
    if(hasSizes){
      html += '<div class="variant-group">' +
        '<div class="variant-group-label">سایز: <b>' + A.escapeHtml(selected.size) + '</b></div>' +
        '<div class="variant-options">' +
        p.sizes.map(function(s){
          var name = sizeName(s);
          var diff = (s && typeof s === "object") ? Number(s.priceDiff) || 0 : 0;
          var active = name === selected.size;
          return '<button type="button" class="size-option' + (active ? " active" : "") + '" data-size="' + A.escapeHtml(name) + '">' +
            A.escapeHtml(name) + diffLabel(diff) +
          '</button>';
        }).join("") +
        '</div></div>';
    }
    variantsEl.hidden = false;
    variantsEl.innerHTML = html;

    variantsEl.querySelectorAll("[data-color]").forEach(function(btn){
      btn.addEventListener("click", function(){
        selected.color = btn.getAttribute("data-color");
        renderVariants(p);
        renderPrice(p);
        updateAddButtonState();
      });
    });
    variantsEl.querySelectorAll("[data-size]").forEach(function(btn){
      btn.addEventListener("click", function(){
        selected.size = btn.getAttribute("data-size");
        renderVariants(p);
        renderPrice(p);
        updateAddButtonState();
      });
    });
  }

  function updateAddButtonState(){
    var already = A.qtyOf(currentKey());
    var addBtn = document.getElementById("pdAdd");
    if(already >= A.CONFIG.MAX_QTY_PER_PRODUCT){
      addBtn.disabled = true; addBtn.textContent = "حداکثر تعداد در سبد";
    } else {
      addBtn.disabled = false; addBtn.textContent = "افزودن به سبد";
    }
    qty = 1;
    qtyEl.textContent = qty;
  }

  function renderRelated(current){
    var all = A.getAllProducts().filter(function(p){ return p.code !== current.code; });
    var list = A.shuffledCopy(all).slice(0, 4);
    var grid = document.getElementById("relatedGrid");
    grid.innerHTML = list.length ? list.map(A.cardHtml).join("") : "";
    A.wireRevealOnce(grid);
  }
  A.wireGridAddButtons(document.getElementById("relatedGrid"));

  stepperEl.addEventListener("click", function(e){
    var btn = e.target.closest("button"); if(!btn) return;
    var act = btn.getAttribute("data-act");
    var already = A.qtyOf(currentKey());
    if(act === "inc" && qty + already < A.CONFIG.MAX_QTY_PER_PRODUCT) qty++;
    if(act === "dec" && qty > 1) qty--;
    qtyEl.textContent = qty;
  });
  document.getElementById("pdAdd").addEventListener("click", function(){
    A.addToCart(currentKey(), qty);
    updateAddButtonState();
  });

  A.onChange(renderProduct);

  A.fetchProducts().then(renderProduct).catch(function(err){
    document.querySelector(".pd-wrap").innerHTML = '<div class="error-state"><h3>مشکلی در بارگذاری محصول پیش آمد</h3><p>' + A.escapeHtml(err.message) + '</p></div>';
  });
})();
