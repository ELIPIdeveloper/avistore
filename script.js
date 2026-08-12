const WORKER_URL = "https://avistore-api.mohammadaminmoradi1133.workers.dev";

const itemsEl = document.getElementById("items");
const addItemBtn = document.getElementById("addItem");
const payButton = document.getElementById("payButton");
const message = document.getElementById("message");
const summary = document.getElementById("summary");

function addItem(code = "", qty = 1) {
  const row = document.createElement("div");
  row.className = "item-row";
  row.innerHTML = `
    <input class="product-code" maxlength="100" placeholder="کد محصول" value="${escapeAttr(code)}">
    <input class="product-qty" type="number" min="1" max="99" value="${qty}">
    <button type="button" class="remove">حذف</button>
  `;
  row.querySelector(".remove").onclick = () => {
    row.remove();
    if (!itemsEl.children.length) addItem();
  };
  itemsEl.appendChild(row);
}

function escapeAttr(s) {
  return String(s).replaceAll("&","&amp;").replaceAll('"',"&quot;").replaceAll("<","&lt;");
}

addItem();
addItemBtn.onclick = () => addItem();

payButton.onclick = async () => {
  const rows = [...document.querySelectorAll(".item-row")];

  const products = rows.map(row => ({
    code: row.querySelector(".product-code").value.trim(),
    quantity: Number(row.querySelector(".product-qty").value)
  })).filter(x => x.code);

  const customer = {
    full_name: document.getElementById("fullName").value.trim(),
    phone: document.getElementById("phone").value.trim(),
    province: document.getElementById("province").value.trim(),
    city: document.getElementById("city").value.trim(),
    address: document.getElementById("address").value.trim(),
    postal_code: document.getElementById("postalCode").value.trim(),
    notes: document.getElementById("notes").value.trim()
  };

  if (!products.length) return showError("حداقل یک کد محصول وارد کنید.");
  if (!customer.full_name) return showError("نام و نام خانوادگی را وارد کنید.");
  if (!/^09\d{9}$/.test(customer.phone.replace(/\s|-/g, ""))) {
    return showError("شماره موبایل معتبر وارد کنید.");
  }
  if (!customer.province || !customer.city || !customer.address || !customer.postal_code) {
    return showError("استان، شهر، آدرس و کد پستی را کامل کنید.");
  }

  payButton.disabled = true;
  message.className = "";
  message.textContent = "در حال بررسی محصولات و ایجاد سفارش...";

  try {
    const res = await fetch(WORKER_URL + "/api/create-payment", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({products, customer})
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
      throw new Error(data.error || "ایجاد سفارش ناموفق بود.");
    }

    message.textContent = "در حال انتقال به زرین‌پال...";
    location.href = data.url;
  } catch (e) {
    showError(e.message || "خطایی رخ داد.");
    payButton.disabled = false;
  }
};

function showError(text) {
  message.className = "error";
  message.textContent = text;
}
