const API_CHECKOUT = window.AVI_CONFIG.API_BASE;

function cartData() {
  try{return JSON.parse(localStorage.getItem("avi_cart")||"[]")}catch{return[]}
}

document.addEventListener("DOMContentLoaded",()=>{
  const form=document.querySelector("#checkout-form");
  const summary=document.querySelector("#checkout-summary");
  const cart=cartData();

  if(!cart.length){
    summary.innerHTML="<p>سبد خرید خالی است.</p>";
    form?.remove();
    return;
  }

  summary.innerHTML=cart.map(x=>`<div>محصول #${x.id} × ${x.quantity}</div>`).join("");

  form.addEventListener("submit",async e=>{
    e.preventDefault();
    const btn=form.querySelector("button[type=submit]");
    btn.disabled=true;
    btn.textContent="در حال اتصال به درگاه...";

    const customer={
      name:form.name.value.trim(),
      phone:form.phone.value.trim(),
      postal_code:form.postal_code.value.trim(),
      address:form.address.value.trim()
    };

    try{
      const r=await fetch(`${API_CHECKOUT}/api/payment/create`,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({customer,items:cart})
      });
      const data=await r.json();
      if(!data.ok) throw new Error(data.error||"خطا");
      localStorage.removeItem("avi_cart");
      location.href=data.payment_url;
    }catch(err){
      alert(err.message);
      btn.disabled=false;
      btn.textContent="پرداخت";
    }
  });
});
