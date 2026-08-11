const API_BASE = "https://api.avistore.ir";

async function loadProducts() {
  const container = document.getElementById("products");

  if (!container) return;

  container.innerHTML = "<p>در حال دریافت محصولات...</p>";

  try {
    const response = await fetch(${API_BASE}/products);

    if (!response.ok) {
      throw new Error("خطا در دریافت محصولات");
    }

    const data = await response.json();

    const products = data.products || [];

    if (products.length === 0) {
      container.innerHTML = "<p>محصولی موجود نیست.</p>";
      return;
    }

    container.innerHTML = products.map(product => 
      <div class="product-card">

        <img
          src="${product.image}"
          alt="${product.name}"
          loading="lazy"
        >

        <h3>${product.name}</h3>

        <p>${product.description || ""}</p>

        <div class="price">
          ${Number(product.price).toLocaleString("fa-IR")} تومان
        </div>

        ${
          product.old_price
            ? <div class="old-price">
                ${Number(product.old_price).toLocaleString("fa-IR")} تومان
              </div>
            : ""
        }

        <p class="stock">
          موجودی: ${product.stock}
        </p>

        <button onclick="viewProduct(${product.id})">
          مشاهده محصول
        </button>

      </div>
    ).join("");

  } catch (error) {
    console.error(error);

    container.innerHTML =
      "<p>خطا در اتصال به سرور. دوباره تلاش کنید.</p>";
  }
}

function viewProduct(id) {
  window.location.href = product.html?id=${id};
}

document.addEventListener("DOMContentLoaded", loadProducts);
