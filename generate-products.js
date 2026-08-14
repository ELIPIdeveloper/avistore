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

function escapeHtml(s){
  return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){
    return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c];
  });
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

    const html = template
      .split("{{TITLE}}").join(escapeHtml(p.name || ""))
      .split("{{DESC}}").join(escapeHtml(p.description || ""))
      .split("{{IMAGE}}").join(escapeHtml(p.image || p.thumb || ""))
      .split("{{CODE}}").join(escapeHtml(p.code));

    fs.writeFileSync(path.join(dir, "index.html"), html, "utf8");
    count++;
  });

  console.log("✔ " + count + " صفحه محصول ساخته شد در پوشه‌های /products/<code>/");
}

main();
