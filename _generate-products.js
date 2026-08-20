#!/usr/bin/env node
/**
 * generate-products.js
 * ---------------------------------------------------------------
 * هر بار که products.json را تغییر دادید (محصول اضافه/حذف کردید)،
 * این اسکریپت را اجرا کنید تا صفحه اختصاصی هر محصول ساخته شود:
 *
 *     node generate-products.js
 *
 * خروجی هر محصول با کد N در مسیر زیر ساخته می‌شود:
 *     /products/N/index.html
 *
 * محتوای این صفحات برای سئو (title/description/og:image) از روی
 * products.json ساخته می‌شود، ولی قیمت و موجودی واقعی همیشه به‌صورت
 * زنده از products.json توسط common.js خوانده می‌شود.
 * ---------------------------------------------------------------
 */
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PRODUCTS_JSON = path.join(ROOT, "assets", "products.json");
const TEMPLATE_PATH = path.join(ROOT, "products", "_template.html");
const PRODUCTS_DIR = path.join(ROOT, "products");
const FAVICON_PATH = path.join(ROOT, "favicon.ico");
const ICON_SVG_PATH = path.join(ROOT, "icon.svg");

// دامنهٔ واقعی سایت — برای ساخت لینک کامل هر محصول در JSON-LD (schema.org)
// لازم است. اگر دامنه‌تان چیز دیگری است، همین یک خط را عوض کنید.
const SITE_URL = "https://avistore.ir";

function escapeHtml(s){
  return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){
    return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c];
  });
}

// نکته: عمداً aggregateRating در این JSON-LD قرار داده نشده، چون هیچ
// امتیاز/نظر واقعی‌ای در products.json ثبت نشده و ساختن یک عدد ساختگی
// (مثلاً «۴.۵ از ۲۴ نظر» برای همهٔ محصولات) طبق راهنمای داده‌های ساخت‌یافتهٔ
// گوگل «محتوای ساختگی» محسوب می‌شود و می‌تواند باعث اعمال جریمهٔ دستی روی
// کل سایت شود. اگر بعداً نظرات واقعی کاربران را ذخیره کردید، یک فیلد مثل
// p.rating = { value: 4.5, count: 24 } به هر محصول در products.json اضافه
// کنید؛ این اسکریپت خودش aggregateRating را فقط برای همان محصولات اضافه
// می‌کند.
function buildProductJsonLd(p, url){
  var images = (Array.isArray(p.images) && p.images.length) ? p.images.filter(Boolean) : [p.image || p.thumb].filter(Boolean);
  var data = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": p.name || "",
    "image": images,
    "description": p.description || "",
    "sku": String(p.code),
    "brand": { "@type": "Brand", "name": "آوی استور" },
    "offers": {
      "@type": "Offer",
      "url": url,
      "priceCurrency": "IRR",
      "price": String(Number(p.price) || 0),
      "availability": (p.active === false) ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
      "itemCondition": "https://schema.org/NewCondition"
    }
  };
  if(p.rating && Number(p.rating.value) && Number(p.rating.count)){
    data.aggregateRating = {
      "@type": "AggregateRating",
      "ratingValue": String(p.rating.value),
      "reviewCount": String(p.rating.count)
    };
  }
  // "</" داخل JSON می‌تواند تگ اسکریپت را زودتر از موعد ببندد؛ برای امنیت جایگزین می‌شود.
  var json = JSON.stringify(data, null, 2).replace(/<\//g, "<\\/");
  return '<script type="application/ld+json">\n' + json + '\n</script>';
}

function main(){
  const products = JSON.parse(fs.readFileSync(PRODUCTS_JSON, "utf8"));
  const template = fs.readFileSync(TEMPLATE_PATH, "utf8");

  if(!Array.isArray(products)){
    console.error("products.json باید یک آرایه باشد.");
    process.exit(1);
  }

  let count = 0;
  products.forEach(function(p){
    if(!p || !p.code) return;
    const dir = path.join(PRODUCTS_DIR, String(p.code));
    fs.mkdirSync(dir, { recursive: true });

    const categoryUrl = "/categories.html?cat=" + encodeURIComponent(p.category || "");
    const productUrl = SITE_URL + "/products/" + encodeURIComponent(p.code) + "/";
    const jsonLd = buildProductJsonLd(p, productUrl);

    const html = template
      .split("{{TITLE}}").join(escapeHtml(p.name || ""))
      .split("{{DESC}}").join(escapeHtml(p.description || ""))
      .split("{{IMAGE}}").join(escapeHtml(p.image || p.thumb || ""))
      .split("{{CODE}}").join(escapeHtml(p.code))
      .split("{{CATEGORY_URL}}").join(escapeHtml(categoryUrl))
      .split("{{CATEGORY}}").join(escapeHtml(p.category || ""))
      .split("{{JSONLD}}").join(jsonLd);

    fs.writeFileSync(path.join(dir, "index.html"), html, "utf8");

    // آیکون‌ها (favicon.ico و icon.svg) کنار index.html هر محصول کپی می‌شوند
    // تا آدرس‌دهی نسبی/برخی هاست‌ها که فایل‌های ریشه را برای هر مسیر سرو
    // نمی‌کنند هم آیکون درست را نمایش دهند.
    if(fs.existsSync(FAVICON_PATH)){
      fs.copyFileSync(FAVICON_PATH, path.join(dir, "favicon.ico"));
    }
    if(fs.existsSync(ICON_SVG_PATH)){
      fs.copyFileSync(ICON_SVG_PATH, path.join(dir, "icon.svg"));
    }

    count++;
  });

  console.log("✔ " + count + " صفحه محصول ساخته شد در پوشه‌های /products/<code>/ (به همراه favicon.ico و icon.svg)");
}

main();
