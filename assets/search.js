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
    var q = searchTerm.trim().toLowerCase();
    var all = A.getAllProducts();

    var base;
    if(!q){
      base = all;
    } else {
      base = all.filter(function(p){
        var hay = (p.name + " " + (p.description || "")).toLowerCase();
        return hay.indexOf(q) !== -1;
      });
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
