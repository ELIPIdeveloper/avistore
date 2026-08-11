const API = window.AVI_CONFIG.API_BASE;

function toman(n) {
  return new Intl.NumberFormat("fa-IR").format(Number(n)) + " تومان";
}

function getCart() {
  try { return JSON.parse(localStorage.getItem("avi_cart") || "[]"); }
  catch { return []; }
}

function saveCart(cart) {
  localStorage.setItem("avi_cart", JSON.stringify(cart));
  updateCartCount();
}

function updateCartCount() {
  const n = getCart().reduce((s,x)=>s+Number(x.quantity||0),0);
  document.querySelectorAll("[data-cart-count]").forEach(e=>e.textContent=n);
}

function addToCart(id, quantity=1) {
  const cart=getCart();
  const item=cart.find(x=>Number(x.id)===Number(id));
  if(item) item.quantity += quantity;
  else cart.push({id:Number(id),quantity});
  saveCart(cart);
  alert("محصول به سبد خرید اضافه شد.");
}

async function loadProducts() {
  const grid=document.querySelector("#products");
  if(!grid) return;
  grid.innerHTML="<p>در حال دریافت محصولات...</p>";
  const r=await fetch(`${API}/api/products`);
  const data=await r.json();
  if(!data.ok) throw new Error("خطا");
  grid.innerHTML=data.products.map(p=>`
    <article class="product">
      <img src="${escapeHtml(p.image || 'https://placehold.co/600x700?text=AViStore')}" alt="${escapeHtml(p.name)}">
      <div class="product-body">
        <span class="tag">${escapeHtml(p.category)}</span>
        <h3>${escapeHtml(p.name)}</h3>
        <p>${escapeHtml(p.description||"")}</p>
        <strong>${toman(p.price)}</strong>
        ${p.old_price ? `<del>${toman(p.old_price)}</del>` : ""}
        <button onclick="addToCart(${p.id})">افزودن به سبد</button>
      </div>
    </article>
  `).join("");
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}

document.addEventListener("DOMContentLoaded",()=>{
  updateCartCount();
  loadProducts().catch(e=>{
    const el=document.querySelector("#products");
    if(el) el.innerHTML="<p>دریافت محصولات با خطا مواجه شد.</p>";
  });
});
