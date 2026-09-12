(function(){
  "use strict";
  var A = window.AVISTORE;
  document.getElementById("year").textContent = new Date().getFullYear();
  A.initChrome();

  var grid = document.getElementById("searchGrid");
  var meta = document.getElementById("searchMeta");
  var sortBar = document.getElementById("sortBar");
  var sortSelect = document.getElementById("sortSelect");
  var pagination = document.getElementById("searchPagination");
  var pageSize = A.CONFIG.SEARCH_PAGE_SIZE;
  var currentPage = 1;
  var sortMode = "default";

  function sortList(list){
    var arr = list.slice();
    if(sortMode === "price_asc"){
      arr.sort(function(a,b){ return (Number(a.price)||0) - (Number(b.price)||0); });
    } else if(sortMode === "price_desc"){
      arr.sort(function(a,b){ return (Number(b.price)||0) - (Number(a.price)||0); });
    } else if(sortMode === "discount"){
      arr.sort(function(a,b){ return A.discountPercent(b) - A.discountPercent(a); });
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

  function renderSearch(){
    var q = searchTerm.trim().toLowerCase();
    var all = A.getAllProducts();

    if(!q){
      sortBar.hidden = true;
      pagination.innerHTML = "";
      var suggested = A.shuffledCopy(all).slice(0, A.CONFIG.HOME_RANDOM_COUNT);
      meta.textContent = suggested.length ? "پیشنهاد برای شما" : "";
      grid.innerHTML = suggested.map(A.listItemHtml).join("");
      A.wireRevealOnce(grid);
      return;
    }
    var list = all.filter(function(p){
      var hay = (p.name + " " + (p.description||"")).toLowerCase();
      return hay.indexOf(q) !== -1;
    });
    if(!list.length){
      sortBar.hidden = true;
      pagination.innerHTML = "";
      meta.textContent = "۰ نتیجه برای «" + searchTerm.trim() + "»";
      grid.innerHTML = '<div class="empty-state"><h3>محصولی پیدا نشد</h3><p>عبارت جستجو را تغییر بده یا دوباره تلاش کن.</p></div>';
      return;
    }

    sortBar.hidden = false;
    list = sortList(list);
    meta.textContent = list.length + " نتیجه برای «" + searchTerm.trim() + "»";

    var totalPages = Math.max(1, Math.ceil(list.length / pageSize));
    if(currentPage > totalPages) currentPage = totalPages;
    var start = (currentPage - 1) * pageSize;
    var pageItems = list.slice(start, start + pageSize);

    grid.innerHTML = pageItems.map(A.listItemHtml).join("");
    A.wireRevealOnce(grid);
    pagination.innerHTML = A.paginationHtml(currentPage, totalPages);
  }
  A.wirePagination(pagination, function(n){
    currentPage = n;
    renderSearch();
    grid.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  sortSelect.addEventListener("change", function(){
    sortMode = sortSelect.value;
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
    grid.innerHTML = '<div class="error-state"><h3>مشکلی در بارگذاری محصولات پیش آمد</h3><p>' + A.escapeHtml(err.message) + '</p></div>';
  });

  setTimeout(function(){ document.getElementById("searchInputPage").focus(); }, 50);
})();
