/*
  cart-store.js
  ---------------------------------------------------------------
  محل واحد و مشترک برای ذخیره و خواندن «سبد خرید» و «مشخصات مشتری».
  همه‌ی صفحات (index, category, search, cart) همین یک فایل را
  لود می‌کنند تا هیچ‌وقت داده‌ها با هم فرق نکنند.

  نکته‌ی خیلی مهم درباره‌ی علت خالی شدن سبد:
  اگر فایل‌های html را با دابل‌کلیک باز می‌کنید (آدرس با file:// شروع
  می‌شود)، بعضی از مرورگرها (خصوصا Chrome/Edge) به هر فایل یک
  "origin" جدا می‌دهند و localStorage بین فایل‌ها به اشتراک گذاشته
  نمی‌شود. برای اینکه سبد بین همه‌ی صفحات درست کار کند، باید سایت را
  از طریق یک سرور محلی باز کنید (مثلا http://localhost:8000) نه با
  دابل‌کلیک روی فایل. فایل start-server.bat / start-server.sh هم به
  همین دلیل اضافه شده.
  ---------------------------------------------------------------
*/
(function (global) {
  "use strict";

  var STORAGE = { CART: "avistore_cart", CUSTOMER: "avistore_customer" };
  var CHANGE_EVENT = "avistore:cartchange";

  function safeParse(raw) {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      console.warn("[cart-store] داده خراب در localStorage:", e);
      return null;
    }
  }

  function loadCart() {
    var parsed = safeParse(localStorage.getItem(STORAGE.CART));
    return parsed && typeof parsed === "object" ? parsed : {};
  }

  function saveCart(cart) {
    try {
      localStorage.setItem(STORAGE.CART, JSON.stringify(cart || {}));
    } catch (e) {
      console.error("[cart-store] ذخیره سبد خرید ناموفق بود:", e);
      return false;
    }
    // به بقیه‌ی کد همین تب هم اطلاع بده (رویداد storage فقط بین تب‌های
    // دیگر شلیک می‌شود، نه در همان تبی که تغییر داده).
    try {
      global.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: cart }));
    } catch (e) {}
    return true;
  }

  function loadCustomer() {
    var parsed = safeParse(localStorage.getItem(STORAGE.CUSTOMER));
    return parsed && typeof parsed === "object" ? parsed : {};
  }

  function saveCustomer(data) {
    try {
      localStorage.setItem(STORAGE.CUSTOMER, JSON.stringify(data || {}));
      return true;
    } catch (e) {
      console.error("[cart-store] ذخیره مشخصات مشتری ناموفق بود:", e);
      return false;
    }
  }

  // وقتی سبد در یک تب دیگر (یا همین تب) عوض می‌شود، صفحه‌های دیگر
  // می‌توانند با این تابع، برای بروزرسانی خودکار (بج تعداد، لیست
  // سبد و ...) عضو شوند.
  function onChange(handler) {
    if (typeof handler !== "function") return function () {};
    function fromOtherTab(e) {
      if (e.key === STORAGE.CART) handler(loadCart());
    }
    function fromSameTab(e) {
      handler(e.detail || loadCart());
    }
    global.addEventListener("storage", fromOtherTab);
    global.addEventListener(CHANGE_EVENT, fromSameTab);
    return function unsubscribe() {
      global.removeEventListener("storage", fromOtherTab);
      global.removeEventListener(CHANGE_EVENT, fromSameTab);
    };
  }

  function isFileProtocol() {
    return global.location && global.location.protocol === "file:";
  }

  global.AviCart = {
    STORAGE: STORAGE,
    loadCart: loadCart,
    saveCart: saveCart,
    loadCustomer: loadCustomer,
    saveCustomer: saveCustomer,
    onChange: onChange,
    isFileProtocol: isFileProtocol
  };

  // هشدار محسوس در کنسول اگر با file:// باز شده باشد، همان جایی که
  // باگ «سبد صفر می‌شود» از آن‌جا می‌آید.
  if (isFileProtocol()) {
    console.warn(
      "[cart-store] این صفحه با file:// باز شده. برای اینکه سبد خرید " +
      "بین همه صفحات درست کار کند، سایت را با یک سرور محلی باز کنید " +
      "(فایل start-server.bat یا start-server.sh را اجرا کنید)."
    );
  }
})(window);
