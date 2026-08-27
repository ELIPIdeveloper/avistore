(function(){
  "use strict";
  var A = window.AVISTORE;
  document.getElementById("year").textContent = new Date().getFullYear();
  A.initChrome();

  var grid = document.getElementById("searchGrid");
  var meta = document.getElementById("searchMeta");

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
    meta.textContent = list.length + " نتیجه برای «" + searchTerm.trim() + "»";
    if(!list.length){
      grid.innerHTML = '<div class="empty-state"><h3>محصولی پیدا نشد</h3><p>عبارت جستجو را تغییر بده یا دوباره تلاش کن.</p></div>';
      return;
    }
    grid.innerHTML = list.map(A.listItemHtml).join("");
    A.wireRevealOnce(grid);
  }
  A.onChange(renderSearch);

  document.getElementById("searchInputPage").addEventListener("input", function(e){
    searchTerm = e.target.value;
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
