(function(){
  "use strict";
  var A = window.AVISTORE;
  document.getElementById("year").textContent = new Date().getFullYear();
  A.initChrome();

  var grid = document.getElementById("searchGrid");
  var sortSelect = document.getElementById("sortSelect");
  var pagination = document.getElementById("searchPagination");
  var pageSize = A.CONFIG.SEARCH_PAGE_SIZE;
  var currentPage = 1;

  /* ---------- امتیازدهی شباهت متن جستجو ----------
     هدف: مواردی که واقعاً «شناسایی» شدند (تطابق دقیق/شامل عبارت در اسم یا
     دسته) همیشه بالای نتایج بیایند، و بقیهٔ محصولات هم به‌جای حذف کامل،
     بر اساس میزان شباهتشان به عبارت جستجو (کلمه‌به‌کلمه + فاصلهٔ ویرایشی
     برای تحمل اشتباه تایپی) مرتب شوند، نه به ترتیب دلخواه/فایل. */

  function normalizeText(s){
    return String(s || "").toLowerCase().replace(/[\u200c\s]+/g, " ").trim();
  }

  // فاصلهٔ ویرایشی (Levenshtein) بین دو رشتهٔ کوتاه؛ برای تشخیص شباهت با
  // وجود اشتباه تایپی کوچک (مثلاً یک حرف اضافه/کم/جابه‌جا)
  function levenshtein(a, b){
    var m = a.length, n = b.length;
    if(!m) return n;
    if(!n) return m;
    var prev = [];
    for(var j = 0; j <= n; j++) prev[j] = j;
    for(var i = 1; i <= m; i++){
      var cur = [i];
      for(var j2 = 1; j2 <= n; j2++){
        var cost = a.charAt(i - 1) === b.charAt(j2 - 1) ? 0 : 1;
        cur[j2] = Math.min(prev[j2] + 1, cur[j2 - 1] + 1, prev[j2 - 1] + cost);
      }
      prev = cur;
    }
    return prev[n];
  }

  // شباهت بین یک کلمهٔ جستجو و یک کلمه از متن محصول؛ عددی بین ۰ تا ۱
  function wordSimilarity(qw, tw){
    if(!qw || !tw) return 0;
    if(qw === tw) return 1;
    if(tw.indexOf(qw) !== -1 || qw.indexOf(tw) !== -1){
      return 0.72 + 0.25 * (Math.min(qw.length, tw.length) / Math.max(qw.length, tw.length));
    }
    var dist = levenshtein(qw, tw);
    var ratio = 1 - dist / Math.max(qw.length, tw.length);
    return ratio > 0.55 ? ratio * 0.6 : 0; // فقط شباهت‌های معنادار حساب شوند
  }

  // امتیاز شباهت یک متن کامل (اسم/دسته/توضیحات) به کل عبارت جستجو
  function textScore(query, qWords, text){
    text = normalizeText(text);
    if(!text) return 0;
    if(text === query) return 1;
    if(text.indexOf(query) === 0) return 0.94; // شروع می‌شود با عبارت جستجو
    if(text.indexOf(query) !== -1) return 0.82; // شامل کل عبارت جستجو است -> «شناسایی‌شده»
    var tWords = text.split(" ").filter(Boolean);
    if(!tWords.length) return 0;
    var sum = 0;
    qWords.forEach(function(qw){
      var best = 0;
      tWords.forEach(function(tw){
        var s = wordSimilarity(qw, tw);
        if(s > best) best = s;
      });
      sum += best;
    });
    return Math.min(0.78, sum / qWords.length); // سقف پایین‌تر از سطح «شناسایی‌شده»
  }

  var MATCH_THRESHOLD = 0.8;  // این سطح به بالا = «شناسایی شد» (اسم/دسته واقعاً شامل عبارت است)
  var MIN_THRESHOLD = 0.16;   // زیر این سطح = آن‌قدر بی‌ربط که اصلاً نشان داده نشود

  function scoreProduct(p, query, qWords){
    var nameScore = textScore(query, qWords, p.name);
    var catScore = textScore(query, qWords, p.category);
    var descScore = textScore(query, qWords, p.description);
    // «شناسایی‌شده» فقط وقتی صادق است که اسم یا دسته واقعاً شامل/هم‌راستای
    // عبارت جستجو باشد؛ نه صرفاً چون جمع امتیازها بالا رفته
    var matched = nameScore >= MATCH_THRESHOLD || catScore >= MATCH_THRESHOLD;
    var score = Math.max(nameScore, catScore * 0.7, descScore * 0.5);
    if(nameScore > 0 && catScore > 0) score += 0.03;
    if(nameScore > 0 && descScore > 0) score += 0.02;
    return { score: Math.min(1, score), matched: matched };
  }

  // ترتیب پیش‌فرض نتایج جستجو: اول محصولات «شناسایی‌شده»، بعد بقیه به
  // ترتیب نزولیِ میزان شباهت
  function relevanceCompare(a, b){
    if(a._searchMatched !== b._searchMatched) return a._searchMatched ? -1 : 1;
    return (b._searchScore || 0) - (a._searchScore || 0);
  }

  /* ---------- مرتب‌سازی ----------
     همیشه از یک آرایهٔ تازه (slice) مرتب می‌شود تا آرایهٔ اصلی محصولات
     دست‌نخورده بماند؛ مقدار sortSelect.value مستقیماً همین‌جا خوانده
     می‌شود (بدون متغیر واسطهٔ جدا) تا هیچ‌وقت بین UI و منطق ناهم‌خوان نشود. */
  function sortList(list){
    var mode = sortSelect.value;
    var arr = list.slice();
    if(mode === "price_asc"){
      arr.sort(function(a, b){ return (Number(a.price) || 0) - (Number(b.price) || 0); });
    } else if(mode === "price_desc"){
      arr.sort(function(a, b){ return (Number(b.price) || 0) - (Number(a.price) || 0); });
    } else if(mode === "discount"){
      arr.sort(function(a, b){ return A.discountPercent(b) - A.discountPercent(a); });
    } else if(searchTerm.trim()){
      arr.sort(relevanceCompare);
    }
    return arr;
  }

  function getQueryFromUrl(){
    var params = new URLSearchParams(window.location.search);
    return params.get("q") || "";
  }

  var searchTerm = getQueryFromUrl();
  document.getElementById("searchInputPage").value = searchTerm;

  /* قفل کردن نوار جستجو زیر هدر، طوری که هنگام اسکرول ثابت بماند */
  function pinSearchHead(){
    var header = document.querySelector("header.site-head");
    var head = document.getElementById("searchPageHead");
    if(header && head) head.style.top = header.offsetHeight + "px";
  }
  pinSearchHead();
  window.addEventListener("resize", pinSearchHead);

  function renderPage(list){
    var totalPages = Math.max(1, Math.ceil(list.length / pageSize));
    if(currentPage > totalPages) currentPage = totalPages;
    if(currentPage < 1) currentPage = 1;
    var start = (currentPage - 1) * pageSize;
    var pageItems = list.slice(start, start + pageSize);

    grid.innerHTML = pageItems.map(A.listItemHtml).join("");
    A.wireRevealOnce(grid);
    pagination.innerHTML = A.paginationHtml(currentPage, totalPages);
  }

  function renderSearch(){
    var q = normalizeText(searchTerm);
    var all = A.getAllProducts();

    var base;
    if(!q){
      base = all;
    } else {
      var qWords = q.split(" ").filter(Boolean);
      base = all
        .map(function(p){
          var r = scoreProduct(p, q, qWords);
          p._searchScore = r.score;
          p._searchMatched = r.matched;
          return p;
        })
        .filter(function(p){ return p._searchScore >= MIN_THRESHOLD; })
        // ابتدا محصولات «شناسایی‌شده» بالا می‌آیند، سپس بقیه به ترتیب شباهت
        .sort(relevanceCompare);
    }

    if(!base.length){
      pagination.innerHTML = "";
      grid.innerHTML = q
        ? '<div class="empty-state"><h3>محصولی پیدا نشد</h3><p>عبارت جستجو را تغییر بده یا دوباره تلاش کن.</p></div>'
        : '<div class="empty-state"><h3>محصولی موجود نیست</h3><p>بعداً دوباره سر بزن.</p></div>';
      return;
    }

    renderPage(sortList(base));
  }

  A.wirePagination(pagination, function(n){
    currentPage = n;
    renderSearch();
    grid.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  sortSelect.addEventListener("change", function(){
    currentPage = 1;
    renderSearch();
  });

  A.onChange(renderSearch);

  document.getElementById("searchInputPage").addEventListener("input", function(e){
    searchTerm = e.target.value;
    currentPage = 1;
    renderSearch();
    var url = new URL(window.location);
    url.searchParams.set("q", searchTerm);
    window.history.replaceState({}, "", url);
  });

  A.fetchProducts().then(renderSearch).catch(function(err){
    pagination.innerHTML = "";
    grid.innerHTML = '<div class="error-state"><h3>مشکلی در بارگذاری محصولات پیش آمد</h3><p>' + A.escapeHtml(err.message) + '</p></div>';
  });

  setTimeout(function(){ document.getElementById("searchInputPage").focus(); }, 50);
})();
