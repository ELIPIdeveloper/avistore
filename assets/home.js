(function(){
  "use strict";
  var A = window.AVISTORE;
  document.getElementById("year").textContent = new Date().getFullYear();
  A.initChrome();

  var homeRandomList = [];
  var grid = document.getElementById("homeGrid");
  // در صفحهٔ اصلی توضیحات و دکمهٔ «افزودن» نمایش داده نمی‌شود؛
  // کلیک روی کارت مستقیماً به صفحهٔ محصول می‌رود و افزودن به سبد فقط از آنجا ممکن است.

  function renderHomeCategories(){
    var cats = A.getCategories();
    var catRow = document.getElementById("homeCatRow");
    if(!cats.length){ catRow.innerHTML = ""; return; }
    catRow.innerHTML = cats.map(function(c){
      return '<a class="cat-chip" href="' + A.categoryUrl(c) + '">' + A.escapeHtml(c) + '</a>';
    }).join("");
  }

  function rollHomeRandom(){
    var all = A.getAllProducts();
    var n = Math.min(A.CONFIG.HOME_RANDOM_COUNT, all.length);
    homeRandomList = A.shuffledCopy(all).slice(0, n);
  }
  function renderHome(){
    if(!homeRandomList.length){
      grid.innerHTML = '<div class="empty-state"><h3>محصولی موجود نیست</h3><p>بعداً دوباره سر بزن.</p></div>';
      return;
    }
    grid.innerHTML = homeRandomList.map(function(p){
      return A.cardHtml(p, { showDesc: false, showAdd: false });
    }).join("");
    A.wireRevealOnce(grid);
  }
  document.getElementById("shuffleHomeBtn").addEventListener("click", function(){
    rollHomeRandom();
    renderHome();
  });
  A.onChange(renderHome);

  A.fetchProducts().then(function(){
    rollHomeRandom();
    renderHome();
    renderHomeCategories();
  }).catch(function(err){
    grid.innerHTML = '<div class="error-state"><h3>مشکلی در بارگذاری محصولات پیش آمد</h3><p>فایل products.json پیدا نشد یا فرمت آن نادرست است. (' + A.escapeHtml(err.message) + ')</p></div>';
    document.getElementById("homeCatRow").innerHTML = "";
  });

  /* banner slider */
  (function initBanners(){
    var track = document.getElementById("bannerTrack");
    var slides = track.querySelectorAll(".banner-slide");
    var dotsWrap = document.getElementById("bannerDots");
    slides.forEach(function(slide, i){
      slide.setAttribute("data-idx", i);
      var d = document.createElement("button");
      d.type = "button";
      d.setAttribute("aria-label", "اسلاید " + (i + 1));
      if(i === 0) d.classList.add("on");
      dotsWrap.appendChild(d);
    });
    var dots = dotsWrap.querySelectorAll("span, button");
    var activeIdx = 0;
    function setActive(i){
      activeIdx = i;
      dots.forEach(function(d, idx){ d.classList.toggle("on", idx === i); });
      slides.forEach(function(s, idx){ s.classList.toggle("active", idx === i); });
    }
    setActive(0);

    // به‌جای محاسبهٔ دستی scrollLeft (که در چیدمان RTL بین مرورگرها ناسازگار است)
    // از IntersectionObserver داخل خودِ track استفاده می‌کنیم تا اسلاید فعال را
    // با اطمینان تشخیص بدهیم؛ همین observer دات‌ها را هم به‌روزرسانی می‌کند.
    if(typeof IntersectionObserver !== "undefined"){
      var io = new IntersectionObserver(function(entries){
        entries.forEach(function(entry){
          if(entry.isIntersecting && entry.intersectionRatio >= 0.6){
            setActive(Number(entry.target.getAttribute("data-idx")));
          }
        });
      }, { root: track, threshold: [0.6] });
      slides.forEach(function(s){ io.observe(s); });
    }

    function goTo(i){
      var idx = Math.max(0, Math.min(slides.length - 1, i));
      slides[idx].scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
      setActive(idx);
    }

    dots.forEach(function(d, i){
      d.addEventListener("click", function(){
        goTo(i);
      });
    });
  })();
})();
