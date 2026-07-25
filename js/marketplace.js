// js/marketplace.js
const $ = (sel) => document.querySelector(sel);

const state = {
  packs: [],
  creators: [],
  q: "",
  category: "all",
  mood: "all",
  license: "all",

  // IMPORTANT: blank input = Infinity (no limit)
  maxPrice: Infinity,

  sort: "featured",
  onlyAffordable: false,

  // pagination
  page: 1,
  pageSize: 9,
};

function money(n) {
  return `£${Number(n).toFixed(0)}`;
}

/* -------------------------
   Cart helpers
-------------------------- */
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

/* -------------------------
   Data helpers
-------------------------- */
function creatorById(id) {
  return state.creators.find((c) => c.id === id);
}

function cheapestLicence(p) {
  const licObj = p?.licenses || {};
  const entries = Object.entries(licObj);

  if (!entries.length) return { name: "N/A", price: 9999, creatorSplit: 0.5 };

  entries.sort((a, b) => (a[1]?.price ?? 9999) - (b[1]?.price ?? 9999));
  const [name, info] = entries[0];
  return { name, ...(info || {}) };
}

// “General” = Indie licence price <= 15
function isGeneral(p) {
  const indie = p?.licenses?.Indie?.price ?? Infinity;
  return indie <= 15;
}

/* -------------------------
   Chips
-------------------------- */
function buildChip(label) {
  return `<span class="chip">${label}</span>`;
}

function updateChips() {
  const wrap = $("#activeChips");
  if (!wrap) return;

  const chips = [];
  if (state.q.trim()) chips.push(buildChip(`Search: "${state.q.trim()}"`));
  if (state.category !== "all") chips.push(buildChip(`Category: ${state.category}`));
  if (state.mood !== "all") chips.push(buildChip(`Mood: ${state.mood}`));
  if (state.license !== "all") chips.push(buildChip(`Licence: ${state.license}`));
  if (Number.isFinite(state.maxPrice)) chips.push(buildChip(`≤ ${money(state.maxPrice)}`));
  if (state.onlyAffordable) chips.push(buildChip("General"));

  wrap.innerHTML = chips.join("");
}

/* -------------------------
   Sorting / filtering
-------------------------- */
function scoreFeatured(p) {
  const t = new Date(p.createdAt).getTime() || 0;
  return (p.featured ? 1000 : 0) + (Number(p.rating || 0) * 10) + (t / 1e11);
}

function applyFilters() {
  let items = [...state.packs];

  const q = state.q.trim().toLowerCase();
  if (q) {
    items = items.filter((p) => {
      const cName = creatorById(p.creatorId)?.name?.toLowerCase() || "";
      return (
        (p.title || "").toLowerCase().includes(q) ||
        (p.description || "").toLowerCase().includes(q) ||
        (p.tags || []).join(" ").toLowerCase().includes(q) ||
        cName.includes(q)
      );
    });
  }

  if (state.category !== "all") items = items.filter((p) => p.category === state.category);
  if (state.mood !== "all") items = items.filter((p) => p.mood === state.mood);

  if (state.license !== "all") {
    items = items.filter((p) => p.licenses && p.licenses[state.license]);
  }

  // price filter:
  // - if licence selected, filter by that licence price
  // - else filter by cheapest licence price
  items = items.filter((p) => {
    const lic =
      state.license !== "all" && p.licenses?.[state.license]
        ? { name: state.license, ...p.licenses[state.license] }
        : cheapestLicence(p);

    const price = lic.price ?? 9999;
    return price <= state.maxPrice;
  });

  if (state.onlyAffordable) {
    items = items.filter(isGeneral);
  }

  // sort
  if (state.sort === "priceAsc") {
    items.sort((a, b) => (cheapestLicence(a).price ?? 9999) - (cheapestLicence(b).price ?? 9999));
  } else if (state.sort === "priceDesc") {
    items.sort((a, b) => (cheapestLicence(b).price ?? 9999) - (cheapestLicence(a).price ?? 9999));
  } else if (state.sort === "ratingDesc") {
    items.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
  } else if (state.sort === "newest") {
    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } else {
    items.sort((a, b) => scoreFeatured(b) - scoreFeatured(a));
  }

  return items;
}

/* -------------------------
   Pagination
-------------------------- */
function clampPage(totalPages) {
  if (totalPages < 1) totalPages = 1;
  if (state.page > totalPages) state.page = totalPages;
  if (state.page < 1) state.page = 1;
  return totalPages;
}

/* -------------------------
   Render
-------------------------- */
function render() {
  updateChips();

  const items = applyFilters();

  const countEl = $("#resultsCount");
  if (countEl) countEl.textContent = String(items.length);

  const totalPages = clampPage(Math.ceil(items.length / state.pageSize));
  const start = (state.page - 1) * state.pageSize;
  const pageItems = items.slice(start, start + state.pageSize);

  // pager UI
  const pageNow = $("#pageNow");
  const pageTotal = $("#pageTotal");
  const pageInfo = $("#pageInfo");
  const prevBtn = $("#prevPage");
  const nextBtn = $("#nextPage");
  const pager = $("#pager");

  if (pageNow) pageNow.textContent = String(state.page);
  if (pageTotal) pageTotal.textContent = String(totalPages);
  if (pageInfo) pageInfo.textContent = `Page ${state.page} of ${totalPages}`;

  if (prevBtn) prevBtn.disabled = state.page <= 1;
  if (nextBtn) nextBtn.disabled = state.page >= totalPages;

  if (pager) pager.style.display = totalPages <= 1 ? "none" : "flex";

  const grid = $("#grid");
  if (!grid) return;

  const html = pageItems
    .map((p) => {
      const c = creatorById(p.creatorId);

      const chosen =
        state.license !== "all" && p.licenses?.[state.license]
          ? { name: state.license, ...p.licenses[state.license] }
          : cheapestLicence(p);

      const price = Number(chosen.price || 0);
      const split = Number(chosen.creatorSplit || 0);

      const creatorCut = Math.round(price * split);
      const platformCut = price - creatorCut;

      const badge = isGeneral(p)
        ? `<span class="badge good">General</span>`
        : `<span class="badge warn">Premium</span>`;

      // extra music info (bpm/key/trackCount/duration) if present
      const bpm = p.bpm ? `<span>•</span><span>${p.bpm} BPM</span>` : "";
      const key = p.key ? `<span>•</span><span>${p.key}</span>` : "";
      const tracks = p.trackCount ? `<div class="muted small">${p.trackCount} tracks</div>` : "";
      const duration =
        p.duration?.format === "min"
          ? `<div class="muted small">${p.duration.totalMinutes} min total</div>`
          : p.duration?.format === "s"
          ? `<div class="muted small">${p.duration.totalSeconds} s total</div>`
          : "";

      // Adaptive metadata snippet
      const adaptive =
        p.category === "Adaptive Music" && p.adaptive
          ? `<div class="muted small" style="margin-top:6px;">
               Adaptive: ${p.adaptive.stems} stems • ${p.adaptive.intensityLevels} intensity • ${p.adaptive.transitionType} transitions
             </div>`
          : "";

      return `
        <article class="card" role="listitem" data-id="${p.id}" tabindex="0" aria-label="Open ${p.title}">
          <div class="top">
            <div>
              <h3 class="h2">${p.title}</h3>
              <div class="meta">
                <span>${p.category}</span>
                <span>•</span>
                <span>${p.mood}</span>
                <span>•</span>
                <span>${Number(p.rating || 0).toFixed(1)}★</span>
                ${bpm}
                ${key}
              </div>
            </div>
            ${badge}
          </div>

          <div class="tags" aria-label="Tags">
            ${(p.tags || [])
              .slice(0, 4)
              .map((t) => `<span class="tag">${t}</span>`)
              .join("")}
          </div>

          <p class="muted small">${p.description || ""}</p>
          ${tracks}
          ${duration}
          ${adaptive}

          <div class="actions">
            <div>
              <div class="price">${money(price)} <span class="muted small">(${chosen.name})</span></div>
              <div class="split">Creator ${money(creatorCut)} • Platform ${money(platformCut)}</div>
              <div class="muted small">
                By <a href="creator.html?id=${encodeURIComponent(p.creatorId)}">${c?.name || "Unknown"}</a>
              </div>
            </div>

            
          </div>
        </article>
      `;
    })
    .join("");

  grid.innerHTML = html || `<p class="muted">No packs match your filters.</p>`;
}

/* -------------------------
   Bind UI
-------------------------- */
function resetToFirstPage() {
  state.page = 1;
}

function bind() {
  const q = $("#q");
  const category = $("#category");
  const mood = $("#mood");
  const license = $("#license");
  const price = $("#price");
  const sort = $("#sort");
  const onlyAffordable = $("#onlyAffordable");
  const clear = $("#clearFilters");
  const prev = $("#prevPage");
  const next = $("#nextPage");
  const grid = $("#grid");

  if (q)
    q.addEventListener("input", (e) => {
      state.q = e.target.value;
      resetToFirstPage();
      render();
    });

  if (category)
    category.addEventListener("change", (e) => {
      state.category = e.target.value;
      resetToFirstPage();
      render();
    });

  if (mood)
    mood.addEventListener("change", (e) => {
      state.mood = e.target.value;
      resetToFirstPage();
      render();
    });

  if (license)
    license.addEventListener("change", (e) => {
      state.license = e.target.value;
      resetToFirstPage();
      render();
    });

  // max price: blank = no limit
  if (price)
    price.addEventListener("input", (e) => {
      const raw = e.target.value.trim();
      state.maxPrice = raw === "" ? Infinity : Math.max(0, Number(raw || 0));
      resetToFirstPage();
      render();
    });

  if (sort)
    sort.addEventListener("change", (e) => {
      state.sort = e.target.value;
      resetToFirstPage();
      render();
    });

  if (onlyAffordable)
    onlyAffordable.addEventListener("change", (e) => {
      state.onlyAffordable = e.target.checked;
      resetToFirstPage();
      render();
    });

  if (clear)
    clear.addEventListener("click", () => {
      state.q = "";
      state.category = "all";
      state.mood = "all";
      state.license = "all";
      state.maxPrice = Infinity;
      state.sort = "featured";
      state.onlyAffordable = false;
      state.page = 1;

      if (q) q.value = "";
      if (category) category.value = "all";
      if (mood) mood.value = "all";
      if (license) license.value = "all";
      if (price) price.value = "";
      if (sort) sort.value = "featured";
      if (onlyAffordable) onlyAffordable.checked = false;

      render();
    });

  // pagination
  if (prev)
    prev.addEventListener("click", () => {
      state.page -= 1;
      render();
    });

  if (next)
    next.addEventListener("click", () => {
      state.page += 1;
      render();
    });

  // Whole card clickable (mouse + keyboard Enter)
  if (grid) {
    grid.addEventListener("click", (e) => {
      // Don’t hijack clicks on interactive elements
      if (e.target.closest("a, button, input, select, textarea, label")) return;

      const card = e.target.closest(".card[data-id]");
      if (!card) return;

      const id = card.dataset.id;
      window.location.href = `product.html?id=${encodeURIComponent(id)}`;
    });

    grid.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;

      const card = e.target.closest(".card[data-id]");
      if (!card) return;

      const id = card.dataset.id;
      window.location.href = `product.html?id=${encodeURIComponent(id)}`;
    });
  }

  // keyboard hint (Enter from search jumps to first "View" link)
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && document.activeElement === q) {
      const first = document.querySelector(".card a.linkbtn");
      if (first) first.focus();
    }
  });
}

/* -------------------------
   Load JSON (Live Server / local server)
-------------------------- */
async function loadData() {
  const base = new URL(".", window.location.href);

  // marketplacedemo.html is in /pages/, json is in /json/
  const packsURL = new URL("../json/packs.json", base);
  const creatorsURL = new URL("../json/creators.json", base);

  const [packsRes, creatorsRes] = await Promise.all([fetch(packsURL), fetch(creatorsURL)]);

  if (!packsRes.ok) throw new Error(`packs.json failed: ${packsRes.status}`);
  if (!creatorsRes.ok) throw new Error(`creators.json failed: ${creatorsRes.status}`);

  state.packs = await packsRes.json();
  state.creators = await creatorsRes.json();
}

/* -------------------------
   Init
-------------------------- */
(async function init() {
  updateCartCount();

  try {
    await loadData();
    bind();
    render();
  } catch (err) {
    console.error(err);
    const grid = $("#grid");
    if (grid) {
      grid.innerHTML = `
        <div class="box">
          <h2>Data load error</h2>
          <p class="muted">
            If you opened the HTML by double-clicking, <strong>fetch()</strong> may be blocked.<br>
            Run with <strong>VS Code Live Server</strong> (recommended).
          </p>
          <p class="muted small">${String(err.message || err)}</p>
        </div>
      `;
    }
  }
})();
