(function(){
  "use strict";
  var A = window.AVISTORE;
  document.getElementById("year").textContent = new Date().getFullYear();
  A.initChrome();

  var wrap = document.getElementById("resultWrap");

  function getParams(){
    var p = new URLSearchParams(window.location.search);
    return {
      status: p.get("status") || "",
      purchase_id: p.get("purchase_id") || "",
      ref_id: p.get("ref_id") || "",
      message: p.get("message") || "",
      zarinpal_code: p.get("zarinpal_code") || ""
    };
  }

  var q = getParams();
  var isSuccess = q.status === "success";

  var order = q.purchase_id ? A.getOrder(q.purchase_id) : null;

  if(isSuccess){
    // سفارش محلی را «پرداخت‌شده» علامت می‌زنیم و سبد خرید را خالی می‌کنیم.
    if(order){
      order = A.updateOrder(q.purchase_id, {
        status: "paid",
        ref_id: q.ref_id || order.ref_id || null,
        paid_at: new Date().toISOString()
      });
    } else if(q.purchase_id){
      order = {
        purchase_id: q.purchase_id,
        amount: null,
        status: "paid",
        ref_id: q.ref_id || null,
        customer: {},
        items: [],
        created_at: new Date().toISOString(),
        paid_at: new Date().toISOString()
      };
    }
    A.clearCart();
  } else {
    if(order){
      order = A.updateOrder(q.purchase_id, { status: "failed" });
    }
  }

  function render(){
    if(isSuccess){
      wrap.innerHTML =
        '<div class="result-icon ok">' +
          '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6L9 17l-5-5"/></svg>' +
        '</div>' +
        '<h2>پرداخت با موفقیت انجام شد</h2>' +
        '<p>سفارش شما ثبت شد و به‌زودی برای ارسال آماده می‌شود.</p>' +
        '<div class="result-meta">' +
          '<div><span>شماره سفارش</span><b class="num">' + A.escapeHtml(q.purchase_id || "-") + '</b></div>' +
          (q.ref_id ? '<div><span>کد رهگیری</span><b class="num">' + A.escapeHtml(q.ref_id) + '</b></div>' : "") +
          (order && order.amount != null ? '<div><span>مبلغ پرداخت‌شده</span><b class="num">' + A.fmtPrice(order.amount) + '</b></div>' : "") +
        '</div>' +
        '<div class="result-actions">' +
          '<button type="button" class="checkout-btn" id="printBtn">چاپ فاکتور</button>' +
          '<a href="/index.html" class="back-link" style="justify-content:center;">بازگشت به فروشگاه</a>' +
        '</div>';
    } else {
      wrap.innerHTML =
        '<div class="result-icon bad">' +
          '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M18 6L6 18M6 6l12 12"/></svg>' +
        '</div>' +
        '<h2>پرداخت ناموفق بود</h2>' +
        '<p>' + A.escapeHtml(q.message || "پرداخت انجام نشد یا لغو شد. می‌توانید دوباره تلاش کنید.") + '</p>' +
        (q.purchase_id ? (
          '<div class="result-meta"><div><span>شماره سفارش</span><b class="num">' + A.escapeHtml(q.purchase_id) + '</b></div></div>'
        ) : "") +
        '<div class="result-actions">' +
          '<a href="/cart.html" class="checkout-btn" style="display:block;text-align:center;text-decoration:none;">بازگشت به سبد خرید</a>' +
        '</div>';
    }

    var printBtn = document.getElementById("printBtn");
    if(printBtn){
      printBtn.addEventListener("click", function(){ A.printInvoice(order); });
    }
  }

  render();
})();
