(function(){
  "use strict";

  // API_BASE را اگر Worker روی دامنهٔ دیگری اجرا می‌شود اینجا ست کنید،
  // مثلاً "https://your-worker.workers.dev". خالی یعنی همان دامنهٔ سایت.
  var API_BASE = "";

  var keyInput = document.getElementById("adminKey");
  var statusSelect = document.getElementById("statusSelect");
  var limitInput = document.getElementById("limitInput");
  var loadBtn = document.getElementById("loadBtn");
  var csvBtn = document.getElementById("csvBtn");
  var statusMsg = document.getElementById("statusMsg");
  var body = document.getElementById("ordersBody");
  var summaryRow = document.getElementById("summaryRow");
  var sumCount = document.getElementById("sumCount");
  var sumTotal = document.getElementById("sumTotal");

  // کلید فقط در sessionStorage نگه داشته می‌شود (پاک می‌شود با بستن تب).
  try {
    var saved = sessionStorage.getItem("avistore_admin_key");
    if(saved) keyInput.value = saved;
  } catch(e){}

  function fmtPrice(n){
    n = Number(n) || 0;
    return n.toLocaleString("fa-IR") + " ریال";
  }
  function escapeHtml(s){
    return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c];
    });
  }
  function statusBadge(status){
    if(status === "paid") return '<span class="badge paid">پرداخت‌شده</span>';
    if(status === "pending") return '<span class="badge pending">در انتظار</span>';
    return '<span class="badge other">' + escapeHtml(status) + '</span>';
  }

  function buildUrl(format){
    var status = statusSelect.value;
    var limit = Number(limitInput.value) || 200;
    var u = new URL(API_BASE + "/api/orders", window.location.origin);
    u.searchParams.set("status", status);
    u.searchParams.set("limit", limit);
    u.searchParams.set("format", format || "json");
    return u.toString();
  }

  function renderOrders(orders){
    if(!orders.length){
      body.innerHTML = '<tr class="empty-row"><td colspan="6">سفارشی با این فیلتر پیدا نشد.</td></tr>';
      summaryRow.hidden = true;
      return;
    }

    var total = 0;
    body.innerHTML = orders.map(function(o){
      total += Number(o.amount) || 0;
      var itemsHtml = o.items.map(function(it){
        var bits = [];
        if(it.color) bits.push("رنگ: " + it.color);
        if(it.size) bits.push("سایز: " + it.size);
        var variant = bits.length ? " (" + bits.join("، ") + ")" : "";
        return '<div class="item-line">' + escapeHtml(it.name || it.code) + variant + ' × ' + escapeHtml(it.quantity) + '</div>';
      }).join("");

      return (
        '<tr>' +
          '<td><div>' + escapeHtml(o.purchase_id) + '</div><code class="small">' + escapeHtml(o.created_at) + '</code></td>' +
          '<td><div class="cust-name">' + escapeHtml(o.customer.full_name) + '</div><div class="cust-phone">' + escapeHtml(o.customer.phone) + '</div></td>' +
          '<td class="addr-line">' + escapeHtml(o.customer.province) + '، ' + escapeHtml(o.customer.city) + '<br>' + escapeHtml(o.customer.address) + '<br>کدپستی: ' + escapeHtml(o.customer.postal_code) + '</td>' +
          '<td>' + itemsHtml + '</td>' +
          '<td class="amount-cell num">' + fmtPrice(o.amount) + '</td>' +
          '<td>' + statusBadge(o.status) + '</td>' +
        '</tr>'
      );
    }).join("");

    sumCount.textContent = orders.length.toLocaleString("fa-IR");
    sumTotal.textContent = fmtPrice(total);
    summaryRow.hidden = false;
  }

  function loadOrders(){
    var key = keyInput.value.trim();
    if(!key){
      statusMsg.textContent = "کلید ادمین را وارد کنید.";
      statusMsg.classList.add("err");
      return;
    }
    try { sessionStorage.setItem("avistore_admin_key", key); } catch(e){}

    statusMsg.textContent = "در حال بارگذاری…";
    statusMsg.classList.remove("err");
    loadBtn.disabled = true;

    // نکتهٔ امنیتی: کلید ادمین دیگر در URL/query نمی‌رود (که در تاریخچهٔ
    // مرورگر و لاگ‌های سرور می‌ماند)، بلکه فقط در هدر X-Admin-Key
    // فرستاده می‌شود.
    fetch(buildUrl("json"), { headers: { "X-Admin-Key": key } })
      .then(function(r){ return r.json().then(function(data){ return { ok: r.ok, data: data }; }); })
      .then(function(res){
        loadBtn.disabled = false;
        if(!res.ok || !res.data || !res.data.ok){
          var msg = (res.data && res.data.error) ? res.data.error : "بارگذاری سفارش‌ها با خطا مواجه شد.";
          statusMsg.textContent = msg;
          statusMsg.classList.add("err");
          body.innerHTML = '<tr class="empty-row"><td colspan="6">' + escapeHtml(msg) + '</td></tr>';
          summaryRow.hidden = true;
          return;
        }
        statusMsg.textContent = res.data.count + " سفارش پیدا شد.";
        renderOrders(res.data.orders || []);
      })
      .catch(function(){
        loadBtn.disabled = false;
        statusMsg.textContent = "ارتباط با سرور برقرار نشد.";
        statusMsg.classList.add("err");
      });
  }

  loadBtn.addEventListener("click", loadOrders);
  csvBtn.addEventListener("click", function(){
    var key = keyInput.value.trim();
    if(!key){
      statusMsg.textContent = "کلید ادمین را وارد کنید.";
      statusMsg.classList.add("err");
      return;
    }
    try { sessionStorage.setItem("avistore_admin_key", key); } catch(e){}

    statusMsg.textContent = "در حال آماده‌سازی فایل CSV…";
    statusMsg.classList.remove("err");
    csvBtn.disabled = true;

    // نکتهٔ امنیتی: قبلاً دانلود CSV با تغییر مستقیم آدرس صفحه انجام
    // می‌شد (window.location.href = ".../api/orders?...&key=...")، که
    // یعنی کلید ادمین وارد نوار آدرس و تاریخچهٔ مرورگر می‌شد. حالا با
    // fetch و هدر X-Admin-Key فایل را می‌گیریم و با Blob دانلودش
    // می‌کنیم، بدون اینکه کلید هیچ‌وقت در URL ظاهر شود.
    fetch(buildUrl("csv"), { headers: { "X-Admin-Key": key } })
      .then(function(r){
        if(!r.ok){
          return r.json().then(function(data){
            throw new Error((data && data.error) ? data.error : "دانلود CSV با خطا مواجه شد.");
          }).catch(function(err){
            throw (err instanceof Error) ? err : new Error("دانلود CSV با خطا مواجه شد.");
          });
        }
        return r.blob();
      })
      .then(function(blob){
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = "avistore-orders.csv";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
        statusMsg.textContent = "دانلود CSV انجام شد.";
      })
      .catch(function(err){
        statusMsg.textContent = err && err.message ? err.message : "دانلود CSV با خطا مواجه شد.";
        statusMsg.classList.add("err");
      })
      .finally(function(){
        csvBtn.disabled = false;
      });
  });
  keyInput.addEventListener("keydown", function(e){ if(e.key === "Enter") loadOrders(); });
})();
