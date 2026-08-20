(function(){
  "use strict";
  var A = window.AVISTORE;
  document.getElementById("year").textContent = new Date().getFullYear();
  A.initChrome();

  var catGrid = document.getElementById("catGrid");
  var catsTitle = document.getElementById("catsTitle");
  var catsCount = document.getElementById("catsCount");
  var breadcrumb = document.getElementById("catBreadcrumb");
  var bcCatName = document.getElementById("bcCatName");
  var switchRow = document.getElementById("catSwitchRow");
  var productsGrid = document.getElementById("catProductsGrid");

  function getCategoryFromUrl(){
    var params = new URLSearchParams(window.location.search);
    return params.get("cat") || "";
  }

  function countInCategory(all, cat){
    return all.filter(function(p){ return (p.category || "") === cat; }).length;
  }

  /* ---------- حالت لیست دسته‌بندی‌ها ---------- */
  function renderCategoryList(){
    var all = A.getAllProducts();
    var cats = A.getCategories();

    breadcrumb.style.display = "none";
    catsTitle.querySelector("h2").textContent = "دسته‌بندی‌ها";
    catsCount.textContent = cats.length ? cats.length + " دسته" : "";
    switchRow.style.display = "none";
    productsGrid.style.display = "none";
    catGrid.style.display = "grid";

    if(!cats.length){
      catGrid.innerHTML = '<div class="empty-state"><h3>دسته‌بندی‌ای موجود نیست</h3><p>بعداً دوباره سر بزن.</p></div>';
      return;
    }
    catGrid.innerHTML = cats.map(function(c){
      var sample = all.filter(function(p){ return p.category === c; })[0];
      var img = sample ? A.escapeHtml(sample.thumb || sample.image || "") : "";
      var count = countInCategory(all, c);
      return (
        '<a class="cat-card reveal-once" href="' + A.categoryUrl(c) + '">' +
          (img ? '<span class="cat-card-media"><img src="' + img + '" alt="' + A.escapeHtml(c) + '" loading="lazy"></span>' : '') +
          '<span class="cat-card-body">' +
            '<h3>' + A.escapeHtml(c) + '</h3>' +
            '<span>' + count + ' محصول</span>' +
          '</span>' +
        '</a>'
      );
    }).join("");
    A.wireRevealOnce(catGrid);
  }

  /* ---------- حالت محصولات یک دسته ---------- */
  function renderCategoryProducts(cat){
    var all = A.getAllProducts();
    var cats = A.getCategories();

    catGrid.style.display = "none";
    catsTitle.querySelector("h2").textContent = cat;
    breadcrumb.style.display = "flex";
    bcCatName.textContent = cat;

    var list = all.filter(function(p){ return (p.category || "") === cat; });
    catsCount.textContent = list.length + " محصول";

    switchRow.style.display = cats.length > 1 ? "flex" : "none";
    switchRow.innerHTML = cats.map(function(c){
      return '<a class="cat-chip' + (c === cat ? " active" : "") + '" href="' + A.categoryUrl(c) + '">' + A.escapeHtml(c) + '</a>';
    }).join("");

    productsGrid.style.display = "grid";
    if(!list.length){
      productsGrid.innerHTML = '<div class="empty-state"><h3>محصولی در این دسته نیست</h3><p>دسته دیگری را امتحان کن.</p></div>';
      return;
    }
    productsGrid.innerHTML = list.map(function(p){
      return A.cardHtml(p, { showDesc: false, showAdd: false });
    }).join("");
    A.wireRevealOnce(productsGrid);
  }

  function render(){
    var cat = getCategoryFromUrl();
    if(cat) renderCategoryProducts(cat);
    else renderCategoryList();
  }

  A.onChange(render);

  A.fetchProducts().then(render).catch(function(err){
    catGrid.innerHTML = '<div class="error-state"><h3>مشکلی در بارگذاری دسته‌بندی‌ها پیش آمد</h3><p>' + A.escapeHtml(err.message) + '</p></div>';
  });
})();
