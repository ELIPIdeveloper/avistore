const state = { products: [], cart: JSON.parse(localStorage.getItem("cart") || "{}") };

const fa = n => new Intl.NumberFormat("fa-IR").format(n);
const toman = n => `${fa(n)} تومان`;

async function loadProducts() {
  const r = await fetch("/api/products");
  if (!r.ok) throw new Error("خطا در دریافت محصولات");
  state.products = await r.json();
  renderProducts();
  renderCart();
}

function renderProducts() {
  const el = document.querySelector("#products");
  el.innerHTML = state.products.map(p => `
    <article class="card">
      <div class="product-img">${p.icon || "🛍️"}</div>
      <h3>${escapeHtml(p.name)}</h3>
      <p class="price">${toman(p.price)}</p>
      <button class="add" data-id="${p.id}">افزودن به سبد</button>
    </article>`).join("");
  el.querySelectorAll(".add").forEach(b => b.onclick = () => add(b.dataset.id));
}

function add(id) {
  state.cart[id] = (state.cart[id] || 0) + 1;
  save(); renderCart(); showToast("به سبد خرید اضافه شد");
}
function change(id, delta) {
  state.cart[id] = (state.cart[id] || 0) + delta;
  if (state.cart[id] <= 0) delete state.cart[id];
  save(); renderCart();
}
function save(){localStorage.setItem("cart", JSON.stringify(state.cart))}
function items() {
  return Object.entries(state.cart).map(([id, qty]) => {
    const p = state.products.find(x => x.id === id);
    return p ? { ...p, qty } : null;
  }).filter(Boolean);
}
function renderCart() {
  const list = items();
  document.querySelector("#cartCount").textContent = fa(list.reduce((s,x)=>s+x.qty,0));
  document.querySelector("#cartItems").innerHTML = list.length ? list.map(x => `
    <div class="cart-item">
      <div><strong>${escapeHtml(x.name)}</strong><div>${toman(x.price*x.qty)}</div></div>
      <div class="qty"><button onclick="change('${x.id}',-1)">−</button><span>${fa(x.qty)}</span><button onclick="change('${x.id}',1)">+</button></div>
    </div>`).join("") : `<div style="padding:30px;text-align:center;color:#98a2b3">سبد خرید خالی است.</div>`;
  document.querySelector("#cartTotal").textContent = toman(list.reduce((s,x)=>s+x.price*x.qty,0));
}
function openCart(){document.querySelector("#cartPanel").classList.add("open");document.querySelector("#overlay").classList.add("show")}
function closeCart(){document.querySelector("#cartPanel").classList.remove("open");document.querySelector("#overlay").classList.remove("show")}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function showToast(t){const e=document.querySelector("#toast");e.textContent=t;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),1800)}

document.querySelector("#cartBtn").onclick=openCart;
document.querySelector("#closeCart").onclick=closeCart;
document.querySelector("#overlay").onclick=closeCart;
document.querySelector("#checkoutBtn").onclick=()=>{
  if(!items().length) return showToast("سبد خرید خالی است");
  document.querySelector("#checkoutModal").classList.remove("hidden");
};
document.querySelector("#closeModal").onclick=()=>document.querySelector("#checkoutModal").classList.add("hidden");

document.querySelector("#checkoutForm").onsubmit=async e=>{
  e.preventDefault();
  const err=document.querySelector("#checkoutError"); err.textContent="";
  const data=Object.fromEntries(new FormData(e.target));
  const products=items().map(x=>({id:x.id,qty:x.qty}));
  try{
    const r=await fetch("/api/payment/request",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({products,...data})});
    const j=await r.json();
    if(!r.ok) throw new Error(j.error || "خطا در ساخت پرداخت");
    window.location.href=j.paymentUrl;
  }catch(x){err.textContent=x.message}
};

loadProducts().catch(e=>showToast(e.message));

window.change=change;
