(function(){
  "use strict";
  var A = window.AVISTORE;
  document.getElementById("year").textContent = new Date().getFullYear();
  A.initChrome();

  var catGrid = document.getElementById("catGrid");
  var catsTitle = document.getElementById("catsTitle");
  var catsCount = document.getElementById("catsCount");
  var breadcrumb = document.getElementById("catBreadcrumb");
  var switchRow = document.getElementById("catSwitchRow");
  var productsGrid = document.getElementById("catProductsGrid");

  function getCategoryFromUrl(){
    var params = new URLSearchParams(window.location.search);
    return params.get("cat") || "";
  }

  /* ---------- کارت‌های زیردسته (چه در ریشه چه داخل یک دسته) ---------- */
  function renderChildCards(children){
    catGrid.style.display = "grid";
    if(!children.length){
      catGrid.innerHTML = "";
      return;
    }
    catGrid.innerHTML = children.map(function(c){
      var list = A.productsInCategory(c.path);
      var sample = list[0];
      var img = sample ? A.escapeHtml(sample.thumb || sample.image || "") : "";
      return (
        '<a class="cat-card reveal-once" href="' + A.categoryUrl(c.path) + '">' +
          (img ? '<span class="cat-card-media"><img src="' + img + '" alt="' + A.escapeHtml(c.name) + '" loading="lazy"></span>' : '') +
          '<span class="cat-card-body">' +
            '<h3>' + A.escapeHtml(c.name) + '</h3>' +
            '<span>' + list.length + ' محصول</span>' +
          '</span>' +
        '</a>'
      );
    }).join("");
    A.wireRevealOnce(catGrid);
  }

  /* ---------- حالت لیست دسته‌بندی‌های سطح اول (بدون cat در URL) ---------- */
  function renderCategoryList(){
    var top = A.getCategoryChildren("");

    breadcrumb.style.display = "none";
    breadcrumb.innerHTML = "";
    catsTitle.querySelector("h2").textContent = "دسته‌بندی‌ها";
    catsCount.textContent = top.length ? top.length + " دسته" : "";
    switchRow.style.display = "none";
    switchRow.innerHTML = "";
    productsGrid.style.display = "none";
    productsGrid.innerHTML = "";

    if(!top.length){
      catGrid.style.display = "grid";
      catGrid.innerHTML = '<div class="empty-state"><h3>دسته‌بندی‌ای موجود نیست</h3><p>بعداً دوباره سر بزن.</p></div>';
      return;
    }
    renderChildCards(top);
  }

  /* ---------- حالت یک دسته‌بندی مشخص (با ?cat=) — ممکن است خودش زیردسته هم داشته باشد ---------- */
  function renderCategoryProducts(catPath){
    var parts = A.splitCategory(catPath);
    if(!parts.length){ renderCategoryList(); return; }

    var children = A.getCategoryChildren(catPath);
    var list = A.productsInCategory(catPath); // شامل زیردسته‌ها هم می‌شود

    // breadcrumb: خانه / دسته‌بندی‌ها / سطح۱ / سطح۲ / ...
    var acc = [];
    var crumbs = '<a href="/index.html">خانه</a><span>/</span><a href="/categories.html">دسته‌بندی‌ها</a>';
    parts.forEach(function(seg, i){
      acc.push(seg);
      var isLast = i === parts.length - 1;
      crumbs += '<span>/</span>' + (isLast
        ? '<span>' + A.escapeHtml(seg) + '</span>'
        : '<a href="' + A.categoryUrl(acc.join("/")) + '">' + A.escapeHtml(seg) + '</a>');
    });
    breadcrumb.style.display = "flex";
    breadcrumb.innerHTML = crumbs;

    catsTitle.querySelector("h2").textContent = parts[parts.length - 1];
    catsCount.textContent = list.length + " محصول";

    // زیردسته‌های همین مسیر (اگر باشند) به‌صورت کارت نشان داده می‌شوند
    if(children.length){
      renderChildCards(children);
    } else {
      catGrid.style.display = "none";
      catGrid.innerHTML = "";
    }

    // چیپ‌های دسته‌های هم‌سطح (خواهر/برادر) برای جابه‌جایی سریع
    var parentPath = parts.slice(0, -1).join("/");
    var siblings = A.getCategoryChildren(parentPath);
    switchRow.style.display = siblings.length > 1 ? "flex" : "none";
    switchRow.innerHTML = siblings.map(function(s){
      return '<a class="cat-chip' + (s.path === catPath ? " active" : "") + '" href="' + A.categoryUrl(s.path) + '">' + A.escapeHtml(s.name) + '</a>';
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
