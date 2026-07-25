const $ = (sel) => document.querySelector(sel);

function money(n){ return `£${Number(n).toFixed(0)}`; }

/* cart storage */
function getCart(){
  try { return JSON.parse(localStorage.getItem("bb_cart") || "[]"); }
  catch { return []; }
}
function setCart(cart){
  localStorage.setItem("bb_cart", JSON.stringify(cart));
  updateCartCount();
}
function updateCartCount(){
  const cart = getCart();
  const count = cart.reduce((sum, item) => sum + (item.qty || 1), 0);
  const el = $("#cartCount");
  if (el) el.textContent = String(count);
}

/* load packs/creators */
async function loadData(){
  const base = new URL(".", window.location.href);
  const packsURL = new URL("../json/packs.json", base);
  const creatorsURL = new URL("../json/creators.json", base);

  const [packsRes, creatorsRes] = await Promise.all([fetch(packsURL), fetch(creatorsURL)]);
  if (!packsRes.ok) throw new Error(`packs.json failed: ${packsRes.status}`);
  if (!creatorsRes.ok) throw new Error(`creators.json failed: ${creatorsRes.status}`);

  return {
    packs: await packsRes.json(),
    creators: await creatorsRes.json()
  };
}

function packById(packs, id){
  return packs.find(p => p.id === id);
}

function creatorById(creators, id){
  return creators.find(c => c.id === id);
}

function linePrice(pack, licenceName){
  const info = pack?.licenses?.[licenceName];
  if (!info) return { price: 0, creatorSplit: 0.85 };
  return { price: Number(info.price || 0), creatorSplit: Number(info.creatorSplit || 0) };
}

function renderCart({ packs, creators }){
  const wrap = $("#cartItems");
  if (!wrap) return;

  const cart = getCart();

  if (!cart.length){
    wrap.innerHTML = `
      <p class="muted">Your cart is empty.</p>
      <a class="btn" href="marketplacedemo.html">Browse marketplace</a>
    `;
    $("#subTotal").textContent = money(0);
    $("#platformFee").textContent = money(0);
    $("#creatorTotal").textContent = money(0);
    $("#grandTotal").textContent = money(0);
    return;
  }

  let subTotal = 0;
  let creatorTotal = 0;

  const html = cart.map((item) => {
    const pack = packById(packs, item.packId);
    if (!pack){
      return `
        <div class="cart-item">
          <div class="cart-left">
            <p class="cart-title"><strong>Missing pack</strong></p>
            <p class="muted small">ID: ${item.packId}</p>
          </div>
          <button class="btn secondary danger" data-remove="${item.packId}__${item.licence}">Remove</button>
        </div>
      `;
    }

    const c = creatorById(creators, pack.creatorId);
    const licName = item.licence;
    const qty = Math.max(1, Number(item.qty || 1));

    const { price, creatorSplit } = linePrice(pack, licName);
    const line = price * qty;

    subTotal += line;
    creatorTotal += Math.round(line * creatorSplit);

    return `
      <div class="cart-item" data-key="${pack.id}__${licName}">
        <div class="cart-left">
          <p class="cart-title"><strong>${pack.title}</strong></p>
          <p class="muted small">${pack.category} • ${pack.mood} • Licence: <strong>${licName}</strong></p>
          <p class="muted small">By ${c?.name || "Unknown"}</p>

          <div class="qty" style="margin-top:8px;">
            <button class="btn secondary" type="button" data-dec="${pack.id}__${licName}">−</button>
            <span><strong>${qty}</strong></span>
            <button class="btn secondary" type="button" data-inc="${pack.id}__${licName}">+</button>
            <span class="muted small" style="margin-left:8px;">${money(price)} each</span>
          </div>
        </div>

        <div style="text-align:right;">
          <div><strong>${money(line)}</strong></div>
          <a class="linkbtn" href="product.html?id=${encodeURIComponent(pack.id)}" style="margin-top:8px; display:inline-block;">View</a>
          <div style="margin-top:8px;">
            <button class="btn secondary danger" type="button" data-remove="${pack.id}__${licName}">Remove</button>
          </div>
        </div>
      </div>
    `;
  }).join("");

  wrap.innerHTML = html;

  const platformFee = Math.max(0, subTotal - creatorTotal);

  $("#subTotal").textContent = money(subTotal);
  $("#platformFee").textContent = money(platformFee);
  $("#creatorTotal").textContent = money(creatorTotal);
  $("#grandTotal").textContent = money(subTotal);

  // handlers
  wrap.addEventListener("click", (e) => {
    const inc = e.target.closest("[data-inc]");
    const dec = e.target.closest("[data-dec]");
    const rem = e.target.closest("[data-remove]");

    if (!inc && !dec && !rem) return;

    let cart = getCart();

    const key =
      (inc && inc.dataset.inc) ||
      (dec && dec.dataset.dec) ||
      (rem && rem.dataset.remove);

    const [packId, licence] = key.split("__");

    const idx = cart.findIndex(i => i.packId === packId && i.licence === licence);
    if (idx === -1) return;

    if (inc){
      cart[idx].qty = (cart[idx].qty || 1) + 1;
    } else if (dec){
      cart[idx].qty = Math.max(1, (cart[idx].qty || 1) - 1);
    } else if (rem){
      cart.splice(idx, 1);
    }

    setCart(cart);
    renderCart({ packs, creators });
  });
}

(async function init(){
  updateCartCount();

  try{
    const data = await loadData();
    renderCart(data);

    const clearBtn = $("#clearCart");
    if (clearBtn){
      clearBtn.addEventListener("click", () => {
        setCart([]);
        renderCart(data);
      });
    }

    const checkoutBtn = $("#checkout");
    if (checkoutBtn){
      checkoutBtn.addEventListener("click", () => {
        const cart = getCart();
        if (!cart.length) return alert("Your cart is empty.");
        alert("Demo checkout complete ✅\n(No payment processed — this is a prototype.)");
      });
    }
  } catch(err){
    console.error(err);
    const wrap = $("#cartItems");
    if (wrap){
      wrap.innerHTML = `
        <div class="box">
          <h2>Cart error</h2>
          <p class="muted">Couldn’t load packs/creators JSON.</p>
          <p class="muted small">${String(err.message || err)}</p>
        </div>
      `;
    }
  }
})();
