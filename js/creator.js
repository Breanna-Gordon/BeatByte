const $ = (sel) => document.querySelector(sel);

function money(n){ return `£${Number(n).toFixed(0)}`; }

function getCart(){
  try { return JSON.parse(localStorage.getItem("bb_cart") || "[]"); }
  catch { return []; }
}
function updateCartCount(){
  const cart = getCart();
  const count = cart.reduce((sum, item) => sum + (item.qty || 1), 0);
  const el = $("#cartCount");
  if (el) el.textContent = String(count);
}

function getCreatorId(){
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

async function loadData(){
  const base = new URL(".", window.location.href);
  const creatorsURL = new URL("../json/creators.json", base);
  const packsURL = new URL("../json/packs.json", base);

  const [cRes, pRes] = await Promise.all([fetch(creatorsURL), fetch(packsURL)]);
  if (!cRes.ok) throw new Error(`creators.json failed: ${cRes.status}`);
  if (!pRes.ok) throw new Error(`packs.json failed: ${pRes.status}`);

  return { creators: await cRes.json(), packs: await pRes.json() };
}

function cheapestLicence(p){
  const entries = Object.entries(p.licenses || {});
  entries.sort((a,b) => (a[1]?.price ?? 9999) - (b[1]?.price ?? 9999));
  const [name, info] = entries[0] || ["N/A", {price:9999, creatorSplit:0.5}];
  return { name, ...(info||{}) };
}

function renderCreator(creator){
  $("#creatorName").textContent = creator?.name || "Creator";
  $("#creatorMeta").textContent = `${creator?.location || ""}${creator?.verified ? " • Verified " : ""}`;

  $("#creatorCard").innerHTML = `
    <div class="box">
      <h2 style="margin-top:0;">About</h2>
      <p>${creator?.bio || "No bio yet."}</p>

      <div class="muted small" style="display:flex;gap:10px;flex-wrap:wrap;">
        <span><strong>Joined:</strong> ${creator?.joinedAt || "—"}</span>
        <span>•</span>
        <span><strong>Specialties:</strong> ${(creator?.specialties || []).join(", ") || "—"}</span>
      </div>
    </div>
  `;
}

function renderPacks(packs){
  const grid = $("#grid");
  const countEl = $("#resultsCount");
  if (!grid) return;

  countEl.textContent = String(packs.length);

  const html = packs.map(p => {
    const chosen = cheapestLicence(p);
    const price = Number(chosen.price || 0);
    const bpm = p.bpm ? `<span>•</span><span>${p.bpm} BPM</span>` : "";
    const key = p.key ? `<span>•</span><span>${p.key}</span>` : "";
    const extra = (p.category === "Adaptive Music" && p.adaptive)
      ? `<div class="muted small" style="margin-top:6px;">Adaptive: ${p.adaptive.stems} stems • ${p.adaptive.intensityLevels} intensity • ${p.adaptive.transitionType} transitions</div>`
      : "";

    return `
      <article class="card" role="listitem" data-id="${p.id}" tabindex="0">
        <div class="top">
          <div>
            <h3 class="h2">${p.title}</h3>
            <div class="meta">
              <span>${p.category}</span>
              <span>•</span>
              <span>${p.mood}</span>
              <span>•</span>
              <span>${Number(p.rating||0).toFixed(1)}★</span>
              ${bpm}
              ${key}
            </div>
          </div>
          ${p.featured ? `<span class="badge good">Featured</span>` : `<span class="badge">Pack</span>`}
        </div>

        <div class="tags">
          ${(p.tags||[]).slice(0,4).map(t => `<span class="tag">${t}</span>`).join("")}
        </div>

        <p class="muted small">${p.description || ""}</p>
        ${extra}

        <div class="actions">
          <div>
            <div class="price">${money(price)} <span class="muted small">(${chosen.name})</span></div>
            <div class="muted small">${p.trackCount} tracks • ${p.duration?.format === "min" ? (p.duration.totalMinutes + " min") : (p.duration.totalSeconds + " s")}</div>
          </div>
          <a class="linkbtn" href="product.html?id=${encodeURIComponent(p.id)}">View</a>
        </div>
      </article>
    `;
  }).join("");

  grid.innerHTML = html || `<p class="muted">No packs found.</p>`;

  // whole-card click
  grid.addEventListener("click", (e) => {
    if (e.target.closest("a,button,input,select,textarea,label")) return;
    const card = e.target.closest(".card[data-id]");
    if (!card) return;
    window.location.href = `product.html?id=${encodeURIComponent(card.dataset.id)}`;
  });
  grid.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const card = e.target.closest(".card[data-id]");
    if (!card) return;
    window.location.href = `product.html?id=${encodeURIComponent(card.dataset.id)}`;
  });
}

(async function init(){
  updateCartCount();
  try{
    const id = getCreatorId();
    const { creators, packs } = await loadData();

    const creator = creators.find(c => c.id === id) || creators[0];
    renderCreator(creator);

    const onlyMusic = $("#onlyMusic");
    const filterAndRender = () => {
      let list = packs.filter(p => p.creatorId === creator.id);
      if (onlyMusic?.checked){
        list = list.filter(p => ["Music","Theme","EP","Soundtrack","Adaptive Music"].includes(p.category));
      }
      // sort: featured, then rating
      list.sort((a,b) => (b.featured?1:0)-(a.featured?1:0) || (Number(b.rating||0)-Number(a.rating||0)));
      renderPacks(list);
    };

    if (onlyMusic) onlyMusic.addEventListener("change", filterAndRender);
    filterAndRender();
  } catch(err){
    console.error(err);
    $("#creatorCard").innerHTML = `
      <div class="box">
        <h2>Couldn’t load creator</h2>
        <p class="muted">${String(err.message || err)}</p>
      </div>
    `;
  }
})();
