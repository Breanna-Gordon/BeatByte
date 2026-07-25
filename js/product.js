// js/product.js
const $ = (sel) => document.querySelector(sel);

/* -------------------------
   Helpers
-------------------------- */
function money(n) {
  return `£${Number(n).toFixed(0)}`;
}

function getCart() {
  try {
    return JSON.parse(localStorage.getItem("bb_cart") || "[]");
  } catch {
    return [];
  }
}

function setCart(cart) {
  localStorage.setItem("bb_cart", JSON.stringify(cart));
  updateCartCount();
}

function updateCartCount() {
  const cart = getCart();
  const count = cart.reduce((sum, item) => sum + (item.qty || 1), 0);
  const el = $("#cartCount");
  if (el) el.textContent = String(count);
}

function getId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

/* -------------------------
   Cart
-------------------------- */
function addToCart(pack, licenceName) {
  const cart = getCart();
  const existing = cart.find(
    (i) => i.packId === pack.id && i.licence === licenceName
  );

  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      packId: pack.id,
      licence: licenceName,
      qty: 1,
    });
  }

  setCart(cart);
  alert(`Added to cart: ${pack.title} (${licenceName})`);
}

/* -------------------------
   Data loading
-------------------------- */
async function loadData() {
  const base = new URL(".", window.location.href);

  const packsURL = new URL("../json/packs.json", base);
  const creatorsURL = new URL("../json/creators.json", base);

  const [packsRes, creatorsRes] = await Promise.all([
    fetch(packsURL),
    fetch(creatorsURL),
  ]);

  if (!packsRes.ok) throw new Error(`packs.json failed`);
  if (!creatorsRes.ok) throw new Error(`creators.json failed`);

  return {
    packs: await packsRes.json(),
    creators: await creatorsRes.json(),
  };
}

/* -------------------------
   Render
-------------------------- */
function render(pack, creator) {
  const licenceRows = Object.entries(pack.licenses)
    .map(([name, info]) => {
      const creatorCut = Math.round(info.price * info.creatorSplit);
      const platformCut = info.price - creatorCut;

      return `
        <div class="lic">
          <div>
            <strong>${name}</strong>
            <div class="muted small">
              Total ${money(info.price)} • 
              Creator ${money(creatorCut)} • 
              Platform ${money(platformCut)}
            </div>
          </div>
          <button class="btn" data-lic="${name}">Add</button>
        </div>
      `;
    })
    .join("");

  const sampleList = (pack.samples || [])
    .map((s) => `<li><span class="muted">${s}</span></li>`)
    .join("");

  $("#product").innerHTML = `
    <div class="box">
      <h1>${pack.title}</h1>
      <p class="muted">
        ${pack.category} • ${pack.mood} • ${pack.rating.toFixed(1)}★
      </p>

      <div class="tags">
        ${(pack.tags || [])
          .map((t) => `<span class="tag">${t}</span>`)
          .join("")}
      </div>

      <p>${pack.description}</p>

      <h2>Included samples (demo)</h2>
      <ul>${sampleList}</ul>

      <p class="muted small">
        In a full build, this would include audio previews.
      </p>
    </div>

    <aside class="box">
      <h2>Buy licence</h2>
      <div class="licences">${licenceRows}</div>

      <hr />

      <h2>Creator</h2>
      <p>
        <a class="creator-link" href="creator.html?id=${encodeURIComponent(pack.creatorId)}">
          <strong>${creator?.name || "Unknown"}</strong>
        </a>
      </p>
      <p class="muted small">${creator?.location || ""}</p>
      <p class="muted">${creator?.bio || ""}</p>

      <a class="linkbtn" href="marketplacedemo.html">Browse more</a>
      <a class="linkbtn" href="cart.html">Go to cart</a>
    </aside>
  `;

  $("#product").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-lic]");
    if (!btn) return;
    addToCart(pack, btn.dataset.lic);
  });
}

/* -------------------------
   Init
-------------------------- */
(async function init() {
  updateCartCount();

  try {
    const id = getId();
    const { packs, creators } = await loadData();

    const pack = packs.find((p) => p.id === id) || packs[0];
    const creator = creators.find((c) => c.id === pack.creatorId);

    render(pack, creator);
  } catch (err) {
    console.error(err);
    $("#product").innerHTML = `
      <div class="box">
        <h2>Couldn’t load product</h2>
        <p class="muted">Make sure you're running via Live Server.</p>
      </div>
    `;
  }
})();
