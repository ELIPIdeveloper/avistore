const ZARINPAL_REQUEST = "https://payment.zarinpal.com/pg/v4/payment/request.json";
const ZARINPAL_VERIFY = "https://payment.zarinpal.com/pg/v4/payment/verify.json";
const ZARINPAL_START = "https://www.zarinpal.com/pg/StartPay/";

function corsHeaders(env) {
  // نکته امنیتی: قبلاً وقتی SITE_URL تنظیم نشده بود، به‌صورت پیش‌فرض از
  // "*" (اجازه به هر دامنه‌ای) استفاده می‌شد. این یعنی روت‌های حساس مثل
  // /api/orders هم به‌طور پیش‌فرض برای هر سایتی در دسترس بودن. حالا اگر
  // SITE_URL تنظیم نشده باشد، اصلاً هدر Access-Control-Allow-Origin
  // ست نمی‌شود (یعنی درخواست‌های cross-origin از مرورگر رد می‌شوند) —
  // این پیش‌فرض امن‌تری است. برای اینکه سایت اصلی بتواند به Worker
  // متصل شود، حتماً SITE_URL را در تنظیمات Worker ست کنید.
  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Key",
    "Content-Type": "application/json; charset=UTF-8",
    "Cache-Control": "no-store"
  };
  if (env.SITE_URL) {
    headers["Access-Control-Allow-Origin"] = env.SITE_URL;
  }
  return headers;
}

// مقایسه‌ی زمان‌ثابت (constant-time) برای کلید ادمین، تا از حملات
// timing (که با اندازه‌گیری تفاوت زمان پاسخ می‌توان کلید را حدس زد)
// جلوگیری شود. مقایسهٔ معمولی با !== به محض برخورد به اولین کاراکتر
// متفاوت متوقف می‌شود که همین باعث نشتی زمانی می‌شود.
function timingSafeEqual(a, b) {
  const enc = new TextEncoder();
  const aBytes = enc.encode(String(a ?? ""));
  const bBytes = enc.encode(String(b ?? ""));
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= aBytes[i] ^ bBytes[i];
  }
  return diff === 0;
}

function json(data, status, env) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: corsHeaders(env)
  });
}

function redirectResult(env, data) {
  const site = env.SITE_URL || "https://avistore.ir";
  const u = new URL("/result.html", site);
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null) {
      u.searchParams.set(key, String(value));
    }
  }
  return Response.redirect(u.toString(), 302);
}

function zarinpalError(data) {
  if (data?.errors?.message) return String(data.errors.message);
  if (Array.isArray(data?.errors)) {
    return data.errors.map(x => x?.message || JSON.stringify(x)).join(" | ");
  }
  if (data?.data?.message) return String(data.data.message);
  return "زرین‌پال درخواست را قبول نکرد.";
}

function clean(v, max = 500) {
  return String(v ?? "").trim().slice(0, max);
}

function normalizePhone(v) {
  return String(v ?? "").replace(/[\s-]/g, "");
}

function getClientIp(request) {
  return request.headers.get("CF-Connecting-IP") || "unknown";
}

/* ---------- گزارش سفارش‌ها (پنل ادمین) ----------
   این بخش برای پاسخ به این نیاز اضافه شده: «چه کسی چه چیزی با چه آدرس و
   شماره‌ای خریده». دسترسی با یک کلید مخفی (ADMIN_KEY) محافظت می‌شود که
   باید در تنظیمات Worker (wrangler secret) ست شود؛ بدون آن این اندپوینت
   کاملاً غیرفعال می‌ماند. کلید فقط از هدر X-Admin-Key خوانده می‌شود
   (صفحهٔ admin.html همین کار را می‌کند) — نه از query string. */
function requireAdmin(request, env) {
  if (!env.ADMIN_KEY) {
    return { ok: false, status: 500, error: "ADMIN_KEY تنظیم نشده است." };
  }
  // نکتهٔ امنیتی: کلید ادمین دیگر از query string (?key=...) خوانده
  // نمی‌شود، چون در URL قرار گرفتن یعنی در تاریخچهٔ مرورگر، لاگ‌های
  // سرور/CDN و هر جای دیگری که URL ذخیره می‌شود هم باقی می‌ماند.
  // فقط از هدر X-Admin-Key خوانده می‌شود (admin.html هم به همین شکل
  // به‌روزرسانی شده است).
  const provided = request.headers.get("X-Admin-Key") || "";
  if (!timingSafeEqual(provided, env.ADMIN_KEY)) {
    return { ok: false, status: 401, error: "دسترسی غیرمجاز." };
  }
  return { ok: true };
}

function csvEscape(v) {
  let s = String(v ?? "");
  // محافظت در برابر CSV/Formula Injection: اگر مقدار با کاراکترهایی که
  // اکسل/گوگل‌شیت آن‌ها را نشانهٔ شروع فرمول می‌داند (= + - @) یا با
  // تب/کریج‌ریترن شروع شود، برنامه‌های صفحه‌گسترده ممکن است آن را به‌جای
  // متن ساده، به‌عنوان فرمول اجرا کنند (مثلاً یک لینک مخرب یا فراخوانی
  // دستور). با افزودن یک آپاستروف در ابتدا، این مقدار همیشه به‌صورت متن
  // ساده نمایش داده می‌شود، نه فرمول.
  if (/^[=+\-@\t\r]/.test(s)) {
    s = "'" + s;
  }
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function ordersCsvResponse(orders, env) {
  const header = [
    "کد سفارش", "تاریخ ثبت", "تاریخ پرداخت", "وضعیت", "کد رهگیری زرین‌پال",
    "نام و نام خانوادگی", "موبایل", "استان", "شهر", "آدرس", "کد پستی", "توضیحات",
    "کد محصول", "نام محصول", "رنگ", "سایز", "تعداد", "قیمت واحد", "جمع ردیف", "مبلغ کل سفارش"
  ];
  const rows = [header];

  for (const o of orders) {
    const items = o.items.length ? o.items : [{}];
    for (const it of items) {
      rows.push([
        o.purchase_id, o.created_at, o.paid_at || "", o.status, o.ref_id || "",
        o.customer.full_name, o.customer.phone, o.customer.province, o.customer.city,
        o.customer.address, o.customer.postal_code, o.customer.notes,
        it.code || "", it.name || "", it.color || "", it.size || "",
        it.quantity ?? "", it.unit_price ?? "", it.line_total ?? "", o.amount
      ]);
    }
  }

  // BOM ابتدای فایل برای اینکه اکسل متن فارسی UTF-8 را درست نمایش دهد.
  const csv = "\uFEFF" + rows.map(r => r.map(csvEscape).join(",")).join("\r\n");

  return new Response(csv, {
    status: 200,
    headers: Object.assign(
      {
        "Content-Type": "text/csv; charset=UTF-8",
        "Content-Disposition": 'attachment; filename="avistore-orders.csv"',
        "Cache-Control": "no-store"
      },
      env.SITE_URL ? { "Access-Control-Allow-Origin": env.SITE_URL } : {}
    )
  });
}

async function ordersReport(request, env) {
  const auth = requireAdmin(request, env);
  if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status, env);

  if (!env.DB) {
    return json({ ok: false, error: "Binding دیتابیس DB تنظیم نشده است." }, 500, env);
  }

  const url = new URL(request.url);
  const statusParam = clean(url.searchParams.get("status") || "paid", 20);
  const status = ["paid", "pending", "all"].includes(statusParam) ? statusParam : "paid";
  const format = clean(url.searchParams.get("format") || "json", 10);

  let limit = Number(url.searchParams.get("limit"));
  let offset = Number(url.searchParams.get("offset"));
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) limit = 200;
  if (!Number.isSafeInteger(offset) || offset < 0) offset = 0;

  const baseSelect = `
    SELECT purchase_id, amount, status, ref_id, full_name, phone, province,
           city, address, postal_code, notes, created_at, paid_at
    FROM purchases
  `;

  const purchasesResult = status === "all"
    ? await env.DB.prepare(baseSelect + " ORDER BY created_at DESC LIMIT ? OFFSET ?")
        .bind(limit, offset).all()
    : await env.DB.prepare(baseSelect + " WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?")
        .bind(status, limit, offset).all();

  const purchases = purchasesResult.results || [];
  const itemsByPurchase = {};

  if (purchases.length) {
    const ids = purchases.map(p => p.purchase_id);
    const placeholders = ids.map(() => "?").join(",");
    const itemsResult = await env.DB.prepare(`
      SELECT purchase_id, product_code, product_name, color, size, quantity, unit_price, line_total
      FROM purchase_items
      WHERE purchase_id IN (${placeholders})
      ORDER BY rowid ASC
    `).bind(...ids).all();

    for (const row of (itemsResult.results || [])) {
      if (!itemsByPurchase[row.purchase_id]) itemsByPurchase[row.purchase_id] = [];
      itemsByPurchase[row.purchase_id].push({
        code: row.product_code,
        name: row.product_name,
        color: row.color || null,
        size: row.size || null,
        quantity: row.quantity,
        unit_price: row.unit_price,
        line_total: row.line_total
      });
    }
  }

  const orders = purchases.map(p => ({
    purchase_id: p.purchase_id,
    status: p.status,
    amount: p.amount,
    ref_id: p.ref_id || null,
    customer: {
      full_name: p.full_name,
      phone: p.phone,
      province: p.province,
      city: p.city,
      address: p.address,
      postal_code: p.postal_code,
      notes: p.notes || ""
    },
    created_at: p.created_at,
    paid_at: p.paid_at || null,
    items: itemsByPurchase[p.purchase_id] || []
  }));

  if (format === "csv") {
    return ordersCsvResponse(orders, env);
  }

  return json({ ok: true, status, count: orders.length, limit, offset, orders }, 200, env);
}

async function isRateLimited(request, env) {
  // این تابع برای مسیر عمومی /api/create-payment استفاده می‌شود. اگر
  // RATE_LIMITER تنظیم نشده باشد fail-open است (درخواست را مسدود
  // نمی‌کند)، چون این مسیر باید همیشه برای مشتری‌ها در دسترس بماند.
  // با این حال قویاً توصیه می‌شود RATE_LIMITER را تنظیم کنید تا در برابر
  // سوءاستفاده/اسپم سفارش هم محافظت داشته باشید.
  if (!env.RATE_LIMITER) return false;
  const ip = getClientIp(request);
  const { success } = await env.RATE_LIMITER.limit({ key: ip });
  return !success;
}

// نکتهٔ امنیتی: مسیرهای ادمین (/api/orders و /api/test-config) به کلید
// ادمین دسترسی دارند، پس اگر بدون rate limit بمانند قابل brute-force
// کردن‌اند. برخلاف isRateLimited عمومی، این نسخه fail-closed است: اگر
// binding به نام RATE_LIMITER در wrangler.toml تنظیم نشده باشد، به‌جای
// غیرفعال‌شدن بی‌صدای محدودیت، کل مسیر با خطای صریح مسدود می‌شود تا
// وضعیت پیکربندی ناقص هیچ‌وقت نامحسوس نماند.
async function requireAdminRateLimit(request, env) {
  if (!env.RATE_LIMITER) {
    return {
      ok: false,
      status: 503,
      error: "RATE_LIMITER تنظیم نشده است؛ به دلایل امنیتی این مسیر بدون آن غیرفعال است."
    };
  }
  const ip = getClientIp(request);
  const { success } = await env.RATE_LIMITER.limit({ key: ip });
  if (!success) {
    return { ok: false, status: 429, error: "تعداد درخواست‌ها بیش از حد مجاز است. لطفاً چند دقیقه دیگر تلاش کنید." };
  }
  return { ok: true };
}

async function createPayment(request, env) {
  if (!env.MERCHANT_ID) {
    return json({ ok: false, error: "MERCHANT_ID تنظیم نشده است." }, 500, env);
  }

  if (!env.DB) {
    return json({ ok: false, error: "Binding دیتابیس DB تنظیم نشده است." }, 500, env);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "JSON نامعتبر است." }, 400, env);
  }

  const products = Array.isArray(body?.products) ? body.products : [];
  const customer = body?.customer || {};

  if (products.length < 1 || products.length > 50) {
    return json({ ok: false, error: "تعداد محصولات نامعتبر است." }, 400, env);
  }

  const fullName = clean(customer.full_name, 100);
  const phone = normalizePhone(customer.phone);
  const province = clean(customer.province, 50);
  const city = clean(customer.city, 80);
  const address = clean(customer.address, 500);
  const postalCode = clean(customer.postal_code, 20);
  const notes = clean(customer.notes, 500);

  if (!fullName) return json({ ok: false, error: "نام وارد نشده است." }, 400, env);

  if (!/^09\d{9}$/.test(phone)) {
    return json({ ok: false, error: "شماره موبایل معتبر نیست." }, 400, env);
  }

  if (!province || !city || !address || !postalCode) {
    return json({ ok: false, error: "اطلاعات آدرس کامل نیست." }, 400, env);
  }

  const merged = new Map(); // key -> { code, color, size, quantity }

  for (const item of products) {
    const code = clean(item?.code, 100);
    const color = item?.color != null ? clean(item.color, 60) : "";
    const size = item?.size != null ? clean(item.size, 60) : "";
    const quantity = Number(item?.quantity);

    if (
      !code ||
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      quantity > 10
    ) {
      return json({ ok: false, error: "حداکثر تعداد مجاز برای هر محصول ۱۰ عدد است." }, 400, env);
    }

    // ترکیب کد + رنگ + سایز، چون هر ترکیب متفاوت قیمت جدا و ردیف جدا در فاکتور دارد.
    const key = code + "\u0001" + color + "\u0001" + size;
    const existing = merged.get(key);
    if (existing) {
      existing.quantity += quantity;
    } else {
      merged.set(key, { code, color, size, quantity });
    }
  }

  for (const entry of merged.values()) {
    if (entry.quantity > 10) {
      return json({ ok: false, error: "حداکثر تعداد مجاز برای هر محصول ۱۰ عدد است." }, 400, env);
    }
  }

  let total = 0;
  const itemRows = [];

  for (const entry of merged.values()) {
    const { code, color, size, quantity } = entry;

    const product = await env.DB.prepare(`
      SELECT code, name, price, active
      FROM products
      WHERE code = ?
      LIMIT 1
    `).bind(code).first();

    if (!product || Number(product.active) !== 1) {
      return json({
        ok: false,
        error: `محصول ${code} پیدا نشد یا غیرفعال است.`
      }, 404, env);
    }

    let priceDiff = 0;

    // رنگ و سایز اختیاری هستند؛ اگر ارسال شده باشند باید دقیقاً با یکی از
    // گزینه‌های تعریف‌شدهٔ همان محصول در دیتابیس مطابقت داشته باشند تا
    // اختلاف قیمت (price_diff) واقعی و قابل اعتماد از سرور خوانده شود.
    if (color) {
      const colorRow = await env.DB.prepare(`
        SELECT price_diff FROM product_colors WHERE code = ? AND name = ? LIMIT 1
      `).bind(code, color).first();
      if (!colorRow) {
        return json({ ok: false, error: `رنگ «${color}» برای محصول ${code} معتبر نیست.` }, 400, env);
      }
      priceDiff += Number(colorRow.price_diff) || 0;
    }

    if (size) {
      const sizeRow = await env.DB.prepare(`
        SELECT price_diff FROM product_sizes WHERE code = ? AND name = ? LIMIT 1
      `).bind(code, size).first();
      if (!sizeRow) {
        return json({ ok: false, error: `سایز «${size}» برای محصول ${code} معتبر نیست.` }, 400, env);
      }
      priceDiff += Number(sizeRow.price_diff) || 0;
    }

    const price = Number(product.price) + priceDiff;

    if (!Number.isSafeInteger(price) || price <= 0) {
      return json({
        ok: false,
        error: `قیمت محصول ${code} نامعتبر است.`
      }, 500, env);
    }

    const lineTotal = price * quantity;

    if (!Number.isSafeInteger(lineTotal)) {
      return json({ ok: false, error: "مبلغ سفارش بیش از حد مجاز است." }, 400, env);
    }

    total += lineTotal;

    itemRows.push({
      code,
      name: product.name,
      color: color || null,
      size: size || null,
      quantity,
      unit_price: price,
      line_total: lineTotal
    });
  }

  if (!Number.isSafeInteger(total) || total <= 0) {
    return json({ ok: false, error: "مبلغ سفارش نامعتبر است." }, 400, env);
  }

  const MIN_AMOUNT = Number(env.MIN_AMOUNT) > 0 ? Number(env.MIN_AMOUNT) : 10000; // حداقل مبلغ قابل قبول زرین‌پال (ریال)
  const MAX_AMOUNT = Number(env.MAX_AMOUNT) > 0 ? Number(env.MAX_AMOUNT) : 500000000; // سقف مبلغ سفارش (ریال)

  if (total < MIN_AMOUNT) {
    return json({
      ok: false,
      error: `حداقل مبلغ قابل پرداخت ${MIN_AMOUNT.toLocaleString("fa-IR")} ریال است.`
    }, 400, env);
  }

  if (total > MAX_AMOUNT) {
    return json({
      ok: false,
      error: `مبلغ سفارش بیش از حد مجاز است (حداکثر ${MAX_AMOUNT.toLocaleString("fa-IR")} ریال).`
    }, 400, env);
  }

  const purchaseId =
    "AV-" +
    crypto.randomUUID().replaceAll("-", "").slice(0, 20).toUpperCase();

  const siteUrl = env.SITE_URL || "https://avistore.ir";
  const callbackUrl = new URL("/api/callback", siteUrl);
  callbackUrl.searchParams.set("purchase_id", purchaseId);

  let response;
  let data;

  try {
    response = await fetch(ZARINPAL_REQUEST, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        merchant_id: env.MERCHANT_ID,
        amount: total,
        description: `AviStore - ${purchaseId}`,
        callback_url: callbackUrl.toString()
      })
    });

    data = await response.json();
  } catch (error) {
    // نکتهٔ امنیتی: جزئیات خطای داخلی (error.message) دیگر در پاسخ به
    // کاربر برگردانده نمی‌شود، چون می‌تواند اطلاعات داخلی سیستم/سرویس‌های
    // بیرونی را افشا کند. فقط در لاگ سرور (که کاربر به آن دسترسی ندارد)
    // ثبت می‌شود.
    console.error("zarinpal_request_error", error?.message || String(error));
    return json({
      ok: false,
      error: "ارتباط با زرین‌پال برقرار نشد."
    }, 502, env);
  }

  const authority = data?.data?.authority;

  if (!response.ok || !authority) {
    return json({
      ok: false,
      stage: "zarinpal_request",
      error: zarinpalError(data),
      http_status: response.status,
      zarinpal_code:
        data?.errors?.code ||
        data?.data?.code ||
        null
    }, 502, env);
  }

  try {
    await env.DB.prepare(`
      INSERT INTO purchases (
        purchase_id,
        amount,
        status,
        authority,
        full_name,
        phone,
        province,
        city,
        address,
        postal_code,
        notes,
        created_at,
        updated_at
      )
      VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(
      purchaseId,
      total,
      authority,
      fullName,
      phone,
      province,
      city,
      address,
      postalCode,
      notes
    ).run();

    for (const item of itemRows) {
      await env.DB.prepare(`
        INSERT INTO purchase_items (
          purchase_id,
          product_code,
          product_name,
          color,
          size,
          quantity,
          unit_price,
          line_total
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        purchaseId,
        item.code,
        item.name,
        item.color,
        item.size,
        item.quantity,
        item.unit_price,
        item.line_total
      ).run();
    }
  } catch (error) {
    console.error("db_insert_purchase_error", error?.message || String(error));
    return json({
      ok: false,
      error: "ثبت سفارش در D1 انجام نشد."
    }, 500, env);
  }

  return json({
    ok: true,
    purchase_id: purchaseId,
    amount: total,
    authority,
    url: ZARINPAL_START + authority
  }, 200, env);
}

async function verifyPayment(request, env) {
  if (!env.MERCHANT_ID || !env.DB) {
    return redirectResult(env, {
      status: "failed",
      message: "تنظیمات سرور کامل نیست."
    });
  }

  const url = new URL(request.url);

  const purchaseId = url.searchParams.get("purchase_id");
  const authority = url.searchParams.get("Authority");
  const status = url.searchParams.get("Status");

  if (!purchaseId || !authority) {
    return redirectResult(env, {
      status: "failed",
      message: "اطلاعات بازگشت زرین‌پال ناقص است."
    });
  }

  const order = await env.DB.prepare(`
    SELECT
      purchase_id,
      amount,
      status,
      authority,
      ref_id
    FROM purchases
    WHERE purchase_id = ?
    LIMIT 1
  `).bind(purchaseId).first();

  if (!order) {
    return redirectResult(env, {
      status: "failed",
      purchase_id: purchaseId,
      message: "سفارش پیدا نشد."
    });
  }

  // جلوگیری از پردازش دوباره Callback
  if (order.status === "paid") {
    return redirectResult(env, {
      status: "success",
      purchase_id: purchaseId,
      ref_id: order.ref_id || "",
      message: "این سفارش قبلاً پرداخت شده است."
    });
  }

  // Authority باید متعلق به همین سفارش باشد.
  if (!order.authority || order.authority !== authority) {
    return redirectResult(env, {
      status: "failed",
      purchase_id: purchaseId,
      message: "Authority با سفارش مطابقت ندارد."
    });
  }

  if (String(status || "").toUpperCase() !== "OK") {
    return redirectResult(env, {
      status: "failed",
      purchase_id: purchaseId,
      message: "پرداخت لغو شد یا موفق نبود."
    });
  }

  let response;
  let data;

  try {
    response = await fetch(ZARINPAL_VERIFY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        merchant_id: env.MERCHANT_ID,
        amount: Number(order.amount),
        authority
      })
    });

    data = await response.json();
  } catch {
    return redirectResult(env, {
      status: "failed",
      purchase_id: purchaseId,
      message: "ارتباط با زرین‌پال برای Verify ناموفق بود."
    });
  }

  const code = Number(data?.data?.code);
  const refId = data?.data?.ref_id;

  if (code === 100 || code === 101) {
    const update = await env.DB.prepare(`
      UPDATE purchases
      SET
        status = 'paid',
        ref_id = ?,
        paid_at = datetime('now'),
        updated_at = datetime('now')
      WHERE purchase_id = ?
        AND status = 'pending'
        AND authority = ?
    `).bind(
      refId ? String(refId) : null,
      purchaseId,
      authority
    ).run();

    if (update.meta.changes === 0) {
      const current = await env.DB.prepare(`
        SELECT status, ref_id
        FROM purchases
        WHERE purchase_id = ?
        LIMIT 1
      `).bind(purchaseId).first();

      if (current?.status === "paid") {
        return redirectResult(env, {
          status: "success",
          purchase_id: purchaseId,
          ref_id: current.ref_id || refId || ""
        });
      }

      return redirectResult(env, {
        status: "failed",
        purchase_id: purchaseId,
        message: "سفارش قبلاً تغییر وضعیت داده است."
      });
    }

    return redirectResult(env, {
      status: "success",
      purchase_id: purchaseId,
      ref_id: refId || ""
    });
  }

  return redirectResult(env, {
    status: "failed",
    purchase_id: purchaseId,
    message: zarinpalError(data),
    zarinpal_code: code || ""
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(env)
      });
    }

    // تست تنظیمات
    // نکتهٔ امنیتی: قبلاً این اندپوینت بدون هیچ احراز هویتی برای همه در
    // دسترس بود و اطلاعات پیکربندی سرور (وجود MERCHANT_ID/DB، آدرس‌های
    // سایت/ورکر) را افشا می‌کرد. حالا مثل /api/orders به کلید ادمین و
    // محدودیت نرخ درخواست (fail-closed از طریق requireAdminRateLimit)
    // نیاز دارد.
    if (
      request.method === "GET" &&
      url.pathname === "/api/test-config"
    ) {
      const limit = await requireAdminRateLimit(request, env);
      if (!limit.ok) return json({ ok: false, error: limit.error }, limit.status, env);
      const auth = requireAdmin(request, env);
      if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status, env);
      return json({
        ok: true,
        worker: "avistore-api",
        merchant_id_exists: Boolean(env.MERCHANT_ID),
        db_exists: Boolean(env.DB),
        site_url: env.SITE_URL || null,
        worker_url: env.WORKER_URL || null
      }, 200, env);
    }

    // ایجاد پرداخت
    if (
      request.method === "POST" &&
      url.pathname === "/api/create-payment"
    ) {
      if (await isRateLimited(request, env)) {
        return json({
          ok: false,
          error: "تعداد درخواست‌های شما بیش از حد مجاز است. لطفاً چند دقیقه دیگر تلاش کنید."
        }, 429, env);
      }
      try {
        return await createPayment(request, env);
      } catch (error) {
        console.error("create_payment_error", error?.message || String(error));
        return json({
          ok: false,
          error: "خطای داخلی ایجاد پرداخت"
        }, 500, env);
      }
    }

    // Callback زرین‌پال
    if (
      request.method === "GET" &&
      url.pathname === "/api/callback"
    ) {
      try {
        return await verifyPayment(request, env);
      } catch (error) {
        console.error("verify_payment_error", error?.message || String(error));
        return redirectResult(env, {
          status: "failed",
          message: "خطای داخلی Callback"
        });
      }
    }

    // گزارش سفارش‌ها برای پنل ادمین (نیازمند ADMIN_KEY)
    // نکتهٔ امنیتی: این روت قبلاً هیچ محدودیت نرخ درخواستی نداشت، یعنی
    // کلید ادمین را می‌شد بدون هیچ مانعی حدس زد (brute-force). حالا از
    // requireAdminRateLimit استفاده می‌کند که fail-closed است: اگر
    // RATE_LIMITER تنظیم نشده باشد، مسیر مسدود می‌شود، نه اینکه بی‌صدا
    // بدون محدودیت باقی بماند.
    if (
      request.method === "GET" &&
      url.pathname === "/api/orders"
    ) {
      const limit = await requireAdminRateLimit(request, env);
      if (!limit.ok) return json({ ok: false, error: limit.error }, limit.status, env);
      try {
        return await ordersReport(request, env);
      } catch (error) {
        console.error("orders_report_error", error?.message || String(error));
        return json({
          ok: false,
          error: "خطای داخلی گزارش سفارش‌ها"
        }, 500, env);
      }
    }

    return json({
      ok: false,
      error: "Not Found",
      path: url.pathname,
      message: "AviStore Worker is running, but this API route does not exist."
    }, 404, env);
  }
};

/* =====================================================================
   راهنمای راه‌اندازی / migration پایگاه‌داده (D1)
   =====================================================================

   ۱) جدول‌های موجود (products, purchases, purchase_items) باید از قبل
      ساخته شده باشند. اگر purchase_items شما ستون‌های color و size را
      ندارد، این دو خط را یک‌بار روی D1 اجرا کنید:

        ALTER TABLE purchase_items ADD COLUMN color TEXT;
        ALTER TABLE purchase_items ADD COLUMN size TEXT;

   ۲) دو جدول جدید برای نگه‌داری اختلاف قیمت رنگ/سایز هر محصول (باید با
      همان مقادیر colors/sizes که در assets/products.json سایت است هم‌خوان
      باشند، چون قیمت نهایی همیشه از همین‌جا خوانده می‌شود، نه از فایل
      جلوی سایت):

        CREATE TABLE IF NOT EXISTS product_colors (
          code       TEXT NOT NULL,
          name       TEXT NOT NULL,
          price_diff INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (code, name)
        );

        CREATE TABLE IF NOT EXISTS product_sizes (
          code       TEXT NOT NULL,
          name       TEXT NOT NULL,
          price_diff INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (code, name)
        );

      نمونه دیتای اولیه (مطابق محصولات فعلی سایت):

        INSERT INTO product_colors (code, name, price_diff) VALUES
          ('1', 'مشکی', 0), ('1', 'سفید', 0), ('1', 'آبی', 80000),
          ('2', 'مشکی', 0), ('2', 'نقره‌ای', 0),
          ('3', 'قهوه‌ای', 0), ('3', 'مشکی', 0),
          ('5', 'مشکی', 0), ('5', 'طوسی', 0);

        INSERT INTO product_sizes (code, name, price_diff) VALUES
          ('2', 'کوچک', 0), ('2', 'بزرگ', 350000),
          ('5', '۲۰ لیتر', 0), ('5', '۳۰ لیتر', 120000);

      اگر محصولی رنگ/سایز ندارد نیازی به ردیف در این جداول نیست؛ اگر
      کاربر برای آن محصول رنگ/سایز نفرستد، سرور هم بررسی نمی‌کند.

   ۳) کلید ادمین برای اندپوینت گزارش سفارش‌ها (/api/orders) و
      /api/test-config را با wrangler ست کنید (این مقدار را مخفی نگه
      دارید و طولانی/تصادفی انتخاب کنید، فقط برای شما و admin.html
      استفاده می‌شود):

        wrangler secret put ADMIN_KEY

      نکتهٔ امنیتی: binding به نام RATE_LIMITER را هم حتماً در
      wrangler.toml تنظیم کنید. برای مسیرهای ادمین (/api/orders و
      /api/test-config) این محدودیت fail-closed است — یعنی اگر
      RATE_LIMITER تنظیم نشده باشد، خود این مسیرها با خطای صریح ۵۰۳
      مسدود می‌شوند تا کلید ادمین هیچ‌وقت بدون محافظت در برابر
      brute-force در دسترس نباشد.

   ۴) استفاده از /api/orders:

      نکتهٔ امنیتی: کلید ادمین دیگر از query string (?key=...) پذیرفته
      نمی‌شود، چون در URL قرار گرفتن یعنی در تاریخچهٔ مرورگر و لاگ‌های
      سرور هم باقی می‌ماند. کلید را همیشه در هدر X-Admin-Key بفرستید:

        curl -H "X-Admin-Key: YOUR_ADMIN_KEY" \
          "https://YOUR_WORKER/api/orders?status=paid&format=json"

        curl -H "X-Admin-Key: YOUR_ADMIN_KEY" \
          "https://YOUR_WORKER/api/orders?status=all&format=csv" -o orders.csv

      status: paid (پیش‌فرض) | pending | all
      format: json (پیش‌فرض) | csv
      admin.html هم به همین روش (هدر) به‌روزرسانی شده است.

   ۵) SITE_URL را حتماً ست کنید (wrangler secret put SITE_URL یا در
      wrangler.toml به‌صورت vars). اگر ست نشود، به‌جای اجازه دادن به همه
      دامنه‌ها (رفتار قبلی و ناامن)، هدر CORS اصلاً ست نمی‌شود و
      درخواست‌های مرورگری از دامنهٔ سایت هم رد خواهند شد.

      خروجی JSON شامل لیست سفارش‌ها با اطلاعات کامل مشتری (نام، موبایل،
      استان، شهر، آدرس، کدپستی، توضیحات) و لیست اقلام هر سفارش (کد و نام
      محصول، رنگ، سایز، تعداد، قیمت واحد و جمع ردیف) است — همان چیزی که
      صفحهٔ admin.html به‌صورت جدول نمایش می‌دهد.
   ===================================================================== */
