const $=s=>document.querySelector(s);
let products=[],categories=[],store={},cart=JSON.parse(localStorage.getItem("tw_cart")||"[]");

const money=(n)=>`${store.currency||"৳"}${Number(n).toLocaleString("en-BD",{maximumFractionDigits:2})}`;
const saveCart=()=>{localStorage.setItem("tw_cart",JSON.stringify(cart));updateCartCount()};
const updateCartCount=()=>$("#cartCount").textContent=cart.reduce((a,x)=>a+x.quantity,0);

async function api(url,opts={}){const r=await fetch(url,{headers:{"Content-Type":"application/json",...(opts.headers||{})},...opts});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Request failed");return d}

function section(key){return window.sections?.find(s=>s.section_key===key)}
function renderSections(){
 const h=section("hero"); if(h){$("#hero").className="hero"+(h.image_url?" has-image":"");if(h.image_url)$("#hero").style.backgroundImage=`url("${h.image_url}")`;$("#hero").innerHTML=`<div class="hero-content"><p class="eyebrow">Trend Wear</p><h1>${esc(h.title)}</h1><p>${esc(h.body||h.subtitle)}</p>${h.button_text?`<a class="primary" href="${esc(h.button_url||"#products")}">${esc(h.button_text)}</a>`:""}</div>`}
 const a=section("about");if(a)$("#about").innerHTML=`<div><p class="eyebrow">${esc(a.title)}</p><h2>${esc(a.subtitle)}</h2></div><div><p>${esc(a.body)}</p></div>`;
 for(const k of ["why","cta"]){const s=section(k),el=$("#"+k);if(!s||!el)return;el.innerHTML=`<p class="eyebrow">${esc(s.title)}</p><h2>${esc(s.subtitle)}</h2><p>${esc(s.body)}</p>${s.button_text?`<a class="${k==="why"?"secondary-btn":"primary"}" href="${esc(s.button_url||"#products")}">${esc(s.button_text)}</a>`:""}`}
 $("#contactLinks").innerHTML=[["Phone",store.contact_phone,store.contact_phone?`tel:${store.contact_phone}`:""],["WhatsApp",store.contact_whatsapp,store.contact_whatsapp?`https://wa.me/${String(store.contact_whatsapp).replace(/\D/g,"")}`:""],["Email",store.contact_email,store.contact_email?`mailto:${store.contact_email}`:""],["Address",store.address,""]].filter(x=>x[1]).map(x=>x[2]?`<a href="${esc(x[2])}" target="_blank" rel="noopener">${esc(x[0])} · ${esc(x[1])}</a>`:`<div>${esc(x[0])} · ${esc(x[1])}</div>`).join("");
}
function renderProducts(){
 const cat=$("#categoryFilter").value, sort=$("#sortFilter").value;let list=[...products].filter(p=>!cat||p.category_slug===cat);
 if(sort==="price-low")list.sort((a,b)=>a.price-b.price);if(sort==="price-high")list.sort((a,b)=>b.price-a.price);
 $("#productGrid").innerHTML=list.length?list.map(p=>card(p)).join(""):`<div><p>No products found.</p></div>`;
}
function card(p){return `<article class="product-card"><div class="product-image">${p.image_url?`<img loading="lazy" src="${esc(p.image_url)}" alt="${esc(p.name)}">`:`<div></div>`}</div><div class="product-info"><p class="product-name">${esc(p.name)}</p><div class="product-price">${money(p.price)}${p.compare_price?`<span class="old">${money(p.compare_price)}</span>`:""}</div><div class="product-actions"><button class="primary" data-add="${p.id}" ${p.stock<1?"disabled":""}>${p.stock<1?"Out of stock":"Add to bag"}</button></div></div></article>`}
function renderCart(){
 const box=$("#cartItems");if(!cart.length){box.innerHTML="<p>Your bag is empty.</p>";$("#cartTotal").textContent=money(0);$("#checkoutBtn").disabled=true;return}
 let total=0;box.innerHTML=cart.map((x,i)=>{total+=x.price*x.quantity;return `<div class="cart-row"><img src="${esc(x.image_url||"")}" alt=""><div><strong>${esc(x.name)}</strong><div>${money(x.price)}</div><div class="qty"><button data-minus="${i}">−</button><span>${x.quantity}</span><button data-plus="${i}">+</button></div></div><button class="secondary-btn" data-remove="${i}">Remove</button></div>`}).join("");$("#cartTotal").textContent=money(total);$("#checkoutBtn").disabled=false}
function add(id){const p=products.find(x=>x.id===id);if(!p)return;const found=cart.find(x=>x.product_id===id);if(found){if(found.quantity<p.stock)found.quantity++}else cart.push({product_id:p.id,name:p.name,price:p.price,image_url:p.image_url,quantity:1});saveCart();renderCart()}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

document.addEventListener("click",e=>{
 const addId=e.target.closest("[data-add]")?.dataset.add;if(addId){add(Number(addId));return}
 if(e.target.closest("#cartBtn")){$("#cartOverlay").hidden=false;renderCart()}
 if(e.target.closest("#searchBtn")){$("#searchOverlay").hidden=false;$("#searchInput").focus()}
 if(e.target.matches("[data-close]"))e.target.closest(".overlay").hidden=true;
 const plus=e.target.closest("[data-plus]")?.dataset.plus;if(plus!=null){cart[plus].quantity++;saveCart();renderCart()}
 const minus=e.target.closest("[data-minus]")?.dataset.minus;if(minus!=null){cart[minus].quantity--;if(cart[minus].quantity<1)cart.splice(minus,1);saveCart();renderCart()}
 const rem=e.target.closest("[data-remove]")?.dataset.remove;if(rem!=null){cart.splice(rem,1);saveCart();renderCart()}
 if(e.target.closest("#checkoutBtn")){$("#cartOverlay").hidden=true;$("#checkoutOverlay").hidden=false}
});
$("#categoryFilter").addEventListener("change",renderProducts);$("#sortFilter").addEventListener("change",renderProducts);
$("#searchInput").addEventListener("input",e=>{const q=e.target.value.toLowerCase();$("#searchResults").innerHTML=products.filter(p=>p.name.toLowerCase().includes(q)).slice(0,8).map(p=>`<div class="search-result" data-search-id="${p.id}"><strong>${esc(p.name)}</strong><div>${money(p.price)}</div></div>`).join("")});
$("#checkoutForm").addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.target);try{const r=await api("/api/orders",{method:"POST",body:JSON.stringify({customer:{name:f.get("name"),phone:f.get("phone"),email:f.get("email"),address:f.get("address")},items:cart,payment_method:f.get("payment_method"),notes:f.get("notes")})});cart=[];saveCart();$("#checkoutMsg").innerHTML=`<p><strong>Order placed.</strong> Your order number is ${esc(r.order_code)}. Total: ${money(r.total)}. Payment remains pending until verified.</p>`;e.target.reset()}catch(err){$("#checkoutMsg").textContent=err.message}});
(async()=>{try{const s=await api("/api/store");store=s.settings;window.sections=s.sections;categories=await api("/api/categories");products=await api("/api/products");$("#categoryFilter").insertAdjacentHTML("beforeend",categories.map(c=>`<option value="${esc(c.slug)}">${esc(c.name)}</option>`).join(""));renderSections();renderProducts();updateCartCount();$("#year").textContent=new Date().getFullYear()}catch(e){document.body.insertAdjacentHTML("afterbegin",`<div style="padding:15px;background:#111;color:#fff;text-align:center">Store temporarily unavailable. Please try again.</div>`)}})();
