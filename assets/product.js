(function(){
  "use strict";
  var A = window.AVISTORE;
  document.getElementById("year").textContent = new Date().getFullYear();
  A.initChrome();

  // کد محصول این صفحه از مسیر پوشه استخراج می‌شود؛ یعنی /products/{{CODE}}/
  var CODE = (function(){
    var m = window.location.pathname.match(/\/products\/([^\/]+)\/?/);
    return m ? decodeURIComponent(m[1]) : "";
  })();

  // رنگ/سایز/وزن انتخاب‌شدهٔ فعلی (اگر محصول این گزینه‌ها را داشته باشد؛
  // هر محصول می‌تواند هیچ‌کدام، یکی، دوتا یا هر سه‌ی این‌ها را داشته باشد)
  var selected = { color: null, size: null, weight: null };

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
    renderCategoryBreadcrumb(p);
    document.getElementById("pdDesc").textContent = p.description || "";
    document.getElementById("pdMetaRow").innerHTML = A.trustBadgesHtml(p);
    renderSpecs(p);
    renderPrice(p);
    renderGallery(p);
    renderVariants(p);
    updateAddButtonState();
    renderRelated(p);
  }

  /* ---------- breadcrumb دسته‌بندی چندسطحی (محصولات چرمی / مردانه / نام محصول) ---------- */
  function renderCategoryBreadcrumb(p){
    var bcCatWrap = document.getElementById("bcCatWrap");
    var bcCatSep = document.getElementById("bcCatSep");
    var parts = A.splitCategory(p.category);
    if(!parts.length){
      bcCatWrap.style.display = "none";
      bcCatSep.style.display = "none";
      return;
    }
    var acc = [];
    bcCatWrap.innerHTML = parts.map(function(seg){
      acc.push(seg);
      return '<a href="' + A.categoryUrl(acc.join("/")) + '">' + A.escapeHtml(seg) + '</a>';
    }).join('<span>/</span>');
    bcCatWrap.style.display = "";
    bcCatSep.style.display = "";
  }

  /* ---------- مشخصات محصول (ابعاد/نوع/اصالت/مشخصه‌های دستی) ---------- */
  function renderSpecs(p){
    var wrap = document.getElementById("pdSpecs");
    var html = A.specsHtml(p);
    if(!html){ wrap.hidden = true; wrap.innerHTML = ""; return; }
    wrap.hidden = false;
    wrap.innerHTML = html;
  }

  /* ---------- قیمت (بر اساس رنگ/سایز انتخاب‌شده) ---------- */
  function renderPrice(p){
    var eff = A.effectivePrice(p, selected);
    document.getElementById("pdPrice").textContent = A.fmtPrice(eff.price);
    var off = A.discountPercent(eff);
    var pdBadge = document.getElementById("pdDiscountBadge");
    var pdOld = document.getElementById("pdPriceOld");
    if(!A.isInStock(p)){
      pdBadge.textContent = "ناموجود";
      pdBadge.hidden = false;
      pdBadge.classList.add("oos-badge");
      pdBadge.classList.remove("discount-badge");
    } else {
      pdBadge.classList.add("discount-badge");
      pdBadge.classList.remove("oos-badge");
      if(off){
        pdBadge.textContent = off + "٪ تخفیف";
        pdBadge.hidden = false;
      } else {
        pdBadge.hidden = true;
      }
    }
    if(off && A.isInStock(p)){
      pdOld.textContent = A.fmtPrice(eff.oldPrice);
      pdOld.hidden = false;
    } else {
      pdOld.hidden = true;
    }
  }

  /* ---------- گالری چند عکسی (+ جابجایی با سوایپ لمسی مثل گالری) ---------- */
  // جلوه محو-تیزِ نرم (کراس‌فید واقعی) هنگام تعویض تصویر اصلی: به‌جای پرش ناگهانی،
  // یک «شبح» از عکس قبلی زیر عکس جدید قرار می‌گیرد و هر دو هم‌زمان و به‌آرامی محو/نمایان می‌شوند.
  function setMainImage(src){
    if(!src || imgEl.getAttribute("src") === src){ if(src) imgEl.src = src; return; }
    var mediaBox = imgEl.parentNode;
    if(mediaBox){
      var ghost = document.createElement("img");
      ghost.src = imgEl.currentSrc || imgEl.src;
      ghost.alt = "";
      ghost.className = "pd-img-ghost";
      mediaBox.insertBefore(ghost, imgEl);
      imgEl.classList.add("img-switching");
      imgEl.src = src;
      requestAnimationFrame(function(){
        requestAnimationFrame(function(){
          imgEl.classList.remove("img-switching");
          ghost.style.opacity = "0";
        });
      });
      window.setTimeout(function(){
        if(ghost.parentNode) ghost.parentNode.removeChild(ghost);
      }, 650);
    } else {
      imgEl.src = src;
    }
  }

  function renderGallery(p){
    var images = A.productImages(p);
    var mediaEl = imgEl.closest(".pd-main-img");
    var activeIdx = 0;
    imgEl.alt = p.name;
    imgEl.src = images[0] || "";

    function showImage(idx){
      if(!images.length) return;
      // چرخشی: از آخرین به اولین و برعکس هم برود، حس گالری واقعی‌تر می‌شود
      idx = (idx + images.length) % images.length;
      if(idx === activeIdx) return;
      activeIdx = idx;
      setMainImage(images[activeIdx]);
      if(thumbsEl){
        thumbsEl.querySelectorAll(".pd-thumb").forEach(function(b, i){
          b.classList.toggle("active", i === activeIdx);
        });
      }
    }

    if(images.length <= 1){
      thumbsEl.hidden = true;
      thumbsEl.innerHTML = "";
    } else {
      thumbsEl.hidden = false;
      thumbsEl.innerHTML = images.map(function(src, i){
        return '<button type="button" class="pd-thumb' + (i === 0 ? " active" : "") + '" data-idx="' + i + '">' +
          '<img src="' + A.escapeHtml(src) + '" alt="' + A.escapeHtml(p.name) + ' - تصویر ' + (i + 1) + '">' +
        '</button>';
      }).join("");
      thumbsEl.querySelectorAll(".pd-thumb").forEach(function(btn){
        btn.addEventListener("click", function(){
          showImage(Number(btn.getAttribute("data-idx")));
        });
      });
    }

    // سوایپ لمسی روی تصویر اصلی؛ چون renderGallery ممکن است چندبار صدا
    // زده شود، از خصوصیت‌های on... استفاده می‌کنیم تا هندلر قبلی به‌جای
    // «اضافه شدن» جایگزین شود و رویدادها تکراری نشوند.
    if(mediaEl){
      var startX = 0, startY = 0, dragging = false, isHorizontal = false;
      var SWIPE_THRESHOLD = 40;
      mediaEl.ontouchstart = function(e){
        if(images.length <= 1) return;
        var t = e.touches[0];
        startX = t.clientX; startY = t.clientY;
        dragging = true; isHorizontal = false;
      };
      mediaEl.ontouchmove = function(e){
        if(!dragging) return;
        var t = e.touches[0];
        var dx = t.clientX - startX, dy = t.clientY - startY;
        if(!isHorizontal && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 6){
          isHorizontal = true;
        }
        if(isHorizontal && e.cancelable) e.preventDefault();
      };
      mediaEl.ontouchend = function(e){
        if(!dragging) return;
        dragging = false;
        if(!isHorizontal) return;
        var t = e.changedTouches[0];
        var dx = t.clientX - startX;
        if(Math.abs(dx) < SWIPE_THRESHOLD) return;
        // کشیدن انگشت به چپ → تصویر بعدی، به راست → تصویر قبلی
        showImage(activeIdx + (dx < 0 ? 1 : -1));
      };
      mediaEl.ontouchcancel = function(){ dragging = false; };
    }
  }

  /* ---------- رنگ و سایز ---------- */
  function renderVariants(p){
    var hasColors = Array.isArray(p.colors) && p.colors.length;
    var hasSizes = Array.isArray(p.sizes) && p.sizes.length;
    var hasWeights = Array.isArray(p.weights) && p.weights.length;

    if(!hasColors && !hasSizes && !hasWeights){
      variantsEl.hidden = true;
      variantsEl.innerHTML = "";
      selected.color = null;
      selected.size = null;
      selected.weight = null;
      return;
    }

    if(hasColors && (!selected.color || !p.colors.some(function(c){ return c.name === selected.color; }))){
      selected.color = p.colors[0].name;
    }
    if(!hasColors) selected.color = null;
    if(hasSizes && (!selected.size || !p.sizes.some(function(s){ return sizeName(s) === selected.size; }))){
      selected.size = sizeName(p.sizes[0]);
    }
    if(!hasSizes) selected.size = null;
    if(hasWeights && (!selected.weight || !p.weights.some(function(w){ return sizeName(w) === selected.weight; }))){
      selected.weight = sizeName(p.weights[0]);
    }
    if(!hasWeights) selected.weight = null;

    function sizeName(s){ return (s && typeof s === "object") ? s.name : s; }
    function diffLabel(diff){
      if(!diff) return "";
      var sign = diff > 0 ? "+" : "−";
      return ' <span class="variant-diff">(' + sign + A.fmtPrice(Math.abs(diff)) + ')</span>';
    }
    // یک گروه گزینهٔ متنی ساده (برای سایز و وزن؛ رنگ جدا و به‌صورت
    // سواچ رنگی رندر می‌شود) — تا افزودن هر نوع تنوع جدید (وزن، حجم و...)
    // فقط با تکرار همین الگو ممکن باشد.
    function textGroupHtml(label, options, selectedValue, attr){
      return '<div class="variant-group">' +
        '<div class="variant-group-label">' + label + ': <b>' + A.escapeHtml(selectedValue) + '</b></div>' +
        '<div class="variant-options">' +
        options.map(function(o){
          var name = sizeName(o);
          var diff = (o && typeof o === "object") ? Number(o.priceDiff) || 0 : 0;
          var active = name === selectedValue;
          return '<button type="button" class="size-option' + (active ? " active" : "") + '" data-' + attr + '="' + A.escapeHtml(name) + '">' +
            A.escapeHtml(name) + diffLabel(diff) +
          '</button>';
        }).join("") +
        '</div></div>';
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
    if(hasSizes) html += textGroupHtml("سایز", p.sizes, selected.size, "size");
    if(hasWeights) html += textGroupHtml("وزن", p.weights, selected.weight, "weight");
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
    variantsEl.querySelectorAll("[data-weight]").forEach(function(btn){
      btn.addEventListener("click", function(){
        selected.weight = btn.getAttribute("data-weight");
        renderVariants(p);
        renderPrice(p);
        updateAddButtonState();
      });
    });
  }

  function updateAddButtonState(){
    var p = A.getProductByCode(CODE);
    var already = A.qtyOf(currentKey());
    var addBtn = document.getElementById("pdAdd");
    if(p && !A.isInStock(p)){
      addBtn.disabled = true; addBtn.textContent = "ناموجود";
      stepperEl.querySelectorAll("button").forEach(function(b){ b.disabled = true; });
    } else if(already >= A.CONFIG.MAX_QTY_PER_PRODUCT){
      addBtn.disabled = true; addBtn.textContent = "حداکثر تعداد در سبد";
      stepperEl.querySelectorAll("button").forEach(function(b){ b.disabled = false; });
    } else {
      addBtn.disabled = false; addBtn.textContent = "افزودن به سبد";
      stepperEl.querySelectorAll("button").forEach(function(b){ b.disabled = false; });
    }
    qty = 1;
    qtyEl.textContent = qty;
  }

  // نکته دربارهٔ باگ «افزودن محصول اشتباه/اضافه به سبد»: قبلاً هر بار که
  // سبد خرید تغییر می‌کرد (حتی همان لحظه که کاربر روی دکمهٔ «افزودن» یکی
  // از محصولات مشابه کلیک می‌کرد)، renderRelated دوباره صدا زده می‌شد و
  // لیست محصولات مشابه را از نو و به‌صورت تصادفی می‌چید. یعنی درست در
  // لحظه‌ای که کاربر انگشتش را برمی‌داشت یا دوباره کلیک می‌کرد، زیر دستش
  // یک محصول کاملاً متفاوت جای محصول قبلی می‌نشست و کلیک دوم به‌جای آن
  // محصول، محصول دیگری را به سبد اضافه می‌کرد. راه‌حل: لیست محصولات
  // مشابه فقط یک‌بار (اولین باری که صفحه رندر می‌شود) انتخاب و کش می‌شود؛
  // تغییرات بعدی سبد فقط همان لیست ثابت را دوباره رسم می‌کنند، نه یک
  // چینش تصادفی جدید.
  var relatedList = null;
  function renderRelated(current){
    if(!relatedList){
      var all = A.getAllProducts().filter(function(p){ return p.code !== current.code; });
      relatedList = A.shuffledCopy(all).slice(0, 4);
    }
    var grid = document.getElementById("relatedGrid");
    grid.innerHTML = relatedList.length ? relatedList.map(A.cardHtml).join("") : "";
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
