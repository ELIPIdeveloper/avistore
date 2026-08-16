(function(){
  "use strict";
  var A = window.AVISTORE;
  document.getElementById("year").textContent = new Date().getFullYear();
  A.initChrome();

  var wrap = document.getElementById("cartItemsWrap");
  var foot = document.getElementById("cartFoot");

  function renderCart(){
    var entries = A.cartEntries();

    if(!entries.length){
      wrap.innerHTML =
        '<div class="cart-empty">' +
        '<svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 3h2l2.4 12.4a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.6L22 8H6"/></svg>' +
        '<p>سبد خرید شما خالی است</p>' +
        '<a href="/index.html">مشاهده محصولات</a>' +
        '</div>';
      foot.hidden = true;
      updateCheckoutTotal();
      return;
    }

    foot.hidden = false;
    wrap.innerHTML = entries.map(function(e){
      var thumb = A.escapeHtml(e.product.thumb || e.product.image || "");
      var variantBits = [];
      if(e.variant.color) variantBits.push("رنگ: " + e.variant.color);
      if(e.variant.size) variantBits.push("سایز: " + e.variant.size);
      var variantLine = variantBits.length ? '<div class="line-variant">' + A.escapeHtml(variantBits.join(" · ")) + '</div>' : "";
      return (
        '<div class="cart-item" data-key="' + A.escapeHtml(e.key) + '">' +
          '<a href="' + A.productUrl(e.code) + '"><img src="' + thumb + '" alt=""></a>' +
          '<div class="cart-item-info">' +
            '<h4><a href="' + A.productUrl(e.code) + '">' + A.escapeHtml(e.product.name) + '</a></h4>' +
            variantLine +
            '<div class="line-price num">' + A.fmtPrice(e.price) + ' × ' + e.qty + '</div>' +
            '<div class="stepper" style="margin-top:6px;">' +
              '<button type="button" data-dec="' + A.escapeHtml(e.key) + '">−</button>' +
              '<span class="num">' + e.qty + '</span>' +
              '<button type="button" data-inc="' + A.escapeHtml(e.key) + '" ' + (e.qty>=A.CONFIG.MAX_QTY_PER_PRODUCT?"disabled":"") + '>+</button>' +
            '</div>' +
          '</div>' +
          '<div class="cart-item-actions">' +
            '<span class="num" style="font-weight:700;font-size:13px;">' + A.fmtPrice(e.price * e.qty) + '</span>' +
            '<button class="remove-link" data-remove="' + A.escapeHtml(e.key) + '">حذف</button>' +
          '</div>' +
        '</div>'
      );
    }).join("");

    document.getElementById("cartItemCount").textContent = entries.reduce(function(s,e){ return s + e.qty; }, 0);
    document.getElementById("cartSubtotal").textContent = A.fmtPrice(A.cartTotal());
    updateCheckoutTotal();
  }

  function updateCheckoutTotal(){
    var el = document.getElementById("checkoutTotal");
    if(el) el.textContent = A.fmtPrice(A.cartTotal());
  }

  wrap.addEventListener("click", function(e){
    var inc = e.target.closest("[data-inc]");
    var dec = e.target.closest("[data-dec]");
    var rem = e.target.closest("[data-remove]");
    if(inc) A.setQty(inc.getAttribute("data-inc"), (A.qtyOf(inc.getAttribute("data-inc"))||0) + 1);
    if(dec) A.setQty(dec.getAttribute("data-dec"), (A.qtyOf(dec.getAttribute("data-dec"))||0) - 1);
    if(rem) A.setQty(rem.getAttribute("data-remove"), 0);
  });
  A.onChange(renderCart);

  /* ---------- سفارش‌های قبلی (تاریخچهٔ محلی این دستگاه) ---------- */
  var ordersSection = document.getElementById("ordersSection");
  var ordersList = document.getElementById("ordersList");

  function formatOrderDate(iso){
    if(!iso) return "";
    try { return new Date(iso).toLocaleDateString("fa-IR", { year: "numeric", month: "2-digit", day: "2-digit" }); }
    catch(e){ return ""; }
  }

  function renderOrders(){
    var list = A.getOrders();
    if(!list.length){ ordersSection.style.display = "none"; ordersList.innerHTML = ""; return; }
    ordersSection.style.display = "block";
    ordersList.innerHTML = list.map(function(o){
      var statusClass = o.status === "paid" ? "ok" : (o.status === "failed" ? "bad" : "pending");
      var itemCount = (o.items || []).reduce(function(s, it){ return s + (it.qty || 0); }, 0);
      return (
        '<div class="order-card">' +
          '<div class="order-card-top">' +
            '<span class="order-id num">' + A.escapeHtml(o.purchase_id) + '</span>' +
            '<span class="order-status ' + statusClass + '">' + A.orderStatusLabel(o.status) + '</span>' +
          '</div>' +
          '<div class="order-card-mid">' +
            '<span>' + itemCount + ' قلم</span>' +
            '<span class="num">' + A.fmtPrice(o.amount) + '</span>' +
            '<span>' + formatOrderDate(o.paid_at || o.created_at) + '</span>' +
          '</div>' +
          '<button type="button" class="order-print-btn" data-print="' + A.escapeHtml(o.purchase_id) + '">چاپ فاکتور</button>' +
        '</div>'
      );
    }).join("");
  }

  ordersList.addEventListener("click", function(e){
    var btn = e.target.closest("[data-print]");
    if(!btn) return;
    A.printInvoice(A.getOrder(btn.getAttribute("data-print")));
  });

  renderOrders();

  /* cart / checkout view switch */
  var cartView = document.getElementById("cartView");
  var checkoutView = document.getElementById("checkoutView");
  function showCartView(){ cartView.style.display = "block"; checkoutView.style.display = "none"; }
  function showCheckoutView(){
    if(!A.cartEntries().length){ A.toast("سبد خرید خالی است.", true); return; }
    cartView.style.display = "none"; checkoutView.style.display = "block";
    prefillCustomer();
  }
  document.getElementById("goCheckoutBtn").addEventListener("click", showCheckoutView);
  document.getElementById("backToCartBtn").addEventListener("click", showCartView);

  /* checkout form */
  var form = document.getElementById("checkoutForm");
  var payBtn = document.getElementById("payBtn");
  var formError = document.getElementById("formError");

  function prefillCustomer(){
    var saved = A.loadCustomer();
    Object.keys(saved).forEach(function(key){
      var input = form.querySelector('[name="' + key + '"]');
      if(input) input.value = saved[key];
    });
  }
  function showFormError(msg){ formError.textContent = msg; formError.classList.add("show"); }
  function hideFormError(){ formError.classList.remove("show"); }

  form.addEventListener("submit", function(e){
    e.preventDefault();
    hideFormError();

    var entries = A.cartEntries();
    if(!entries.length){ showFormError("سبد خرید خالی است."); return; }

    var fd = new FormData(form);
    var customer = {
      full_name: (fd.get("full_name")||"").toString().trim(),
      phone: (fd.get("phone")||"").toString().trim(),
      province: (fd.get("province")||"").toString().trim(),
      city: (fd.get("city")||"").toString().trim(),
      address: (fd.get("address")||"").toString().trim(),
      postal_code: (fd.get("postal_code")||"").toString().trim(),
      notes: (fd.get("notes")||"").toString().trim()
    };

    if(!customer.full_name){ showFormError("نام و نام خانوادگی را وارد کنید."); return; }
    if(!/^09\d{9}$/.test(customer.phone)){ showFormError("شماره موبایل معتبر نیست (مثال: 09123456789)."); return; }
    if(!customer.province || !customer.city || !customer.address || !customer.postal_code){
      showFormError("اطلاعات آدرس را کامل وارد کنید."); return;
    }

    A.saveCustomer(customer);

    // فقط کد، تعداد و رنگ/سایز انتخابی به سرور ارسال می‌شود؛ قیمت و جمع کل توسط سرور و بر اساس دیتابیس محاسبه می‌گردد.
    var products_payload = entries.map(function(e){
      return { code: e.code, quantity: e.qty, color: e.variant.color || null, size: e.variant.size || null };
    });

    payBtn.disabled = true;
    payBtn.textContent = "در حال اتصال به درگاه…";

    fetch(A.CONFIG.API_BASE + "/api/create-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ products: products_payload, customer: customer })
    })
      .then(function(r){ return r.json().then(function(data){ return { ok: r.ok, data: data }; }); })
      .then(function(res){
        if(res.ok && res.data && res.data.ok && res.data.url){
          var orderItems = entries.map(function(e){
            return {
              code: e.code, name: e.product.name,
              color: e.variant.color || null, size: e.variant.size || null,
              qty: e.qty, price: e.price, line_total: e.price * e.qty
            };
          });
          A.addOrder({
            purchase_id: res.data.purchase_id,
            amount: res.data.amount,
            status: "pending",
            ref_id: null,
            customer: customer,
            items: orderItems,
            created_at: new Date().toISOString(),
            paid_at: null
          });
          renderOrders();
          window.location.href = res.data.url;
        } else {
          var msg = (res.data && res.data.error) ? res.data.error : "ثبت سفارش با خطا مواجه شد.";
          showFormError(msg);
          payBtn.disabled = false;
          payBtn.textContent = "پرداخت و ثبت سفارش";
        }
      })
      .catch(function(){
        showFormError("ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید.");
        payBtn.disabled = false;
        payBtn.textContent = "پرداخت و ثبت سفارش";
      });
  });

  A.fetchProducts().then(renderCart).catch(function(){ renderCart(); });
})();
