/* =========================================================
   SUGAR CRUSH MILK TEA — Pre-Order System
   Backed by Supabase. Same `orders` table as the original
   system (no schema changes needed) — see notes in section 8.
========================================================= */

/* ---------------------------------------------------------
   0. SUPABASE SETUP
   Dashboard > Project Settings > API:
   - Project URL  -> looks like https://xxxxx.supabase.co
   - anon public key -> long string starting with "eyJ..."
--------------------------------------------------------- */
const SUPABASE_URL = "https://rlgvlbhikzlgsyhhcghw.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsZ3ZsYmhpa3psZ3N5aGhjZ2h3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5NzM3NzIsImV4cCI6MjEwNzU0OTc3Mn0._YjnWtcByF31UGFd5JFI8-Ew0V8KjCaFhwpnLeAts0k";

// A red notice at the top of the page (works even if styles.css is out of date)
function showBanner(msg) {
  const b = document.createElement("div");
  b.setAttribute("role", "alert");
  b.style.cssText = "position:sticky;top:0;z-index:999;background:#B01F78;color:#fff;font:700 13.5px/1.4 Nunito,sans-serif;padding:10px 16px;text-align:center";
  b.textContent = msg;
  document.body.prepend(b);
}

// If the Supabase library can't load (ad blocker, school/office filter, bad connection),
// keep the menu working and tell the customer, instead of the whole page going blank.
function offlineClient() {
  const err = { message: "Can't reach the ordering server. Check your internet connection or turn off your ad blocker, then refresh." };
  const fail = async () => ({ data: null, error: err });
  const chain = { select() { return chain; }, order() { return chain; }, update() { return chain; }, eq() { return chain; }, then: (res) => Promise.resolve({ data: null, error: err }).then(res) };
  const ch = { on() { return ch; }, subscribe() { return ch; } };
  return {
    rpc: fail, from: () => chain, channel: () => ch,
    auth: { signInWithPassword: fail, signOut: async () => ({ error: null }), getSession: async () => ({ data: { session: null } }), onAuthStateChange() {} },
  };
}

let supabaseClient;
try {
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (e) {
  console.error("Supabase failed to load:", e);
  supabaseClient = offlineClient();
  showBanner("⚠️ Can't reach the ordering server. You can browse the menu, but orders can't be placed. Check your connection or turn off your ad blocker, then refresh.");
}

/* ---------------------------------------------------------
   1. SHOP SETTINGS — EDIT HERE
--------------------------------------------------------- */
// Staff sign-in is password-only. The email below is the staff account you created in
// Supabase > Authentication > Users (it must also be listed in schema.sql's staff table).
const STAFF_EMAIL = "your-staff-email@example.com";   // <<< CHANGE THIS
// Small line shown under the staff password box. Don't put the real password here:
// everything in this file is public once it's on GitHub.
const STAFF_PASSWORD_HINT = "Ask the shop owner for the staff password.";

const MAX_QTY_PER_ITEM = 100;   // max cups per menu item, per order (all sizes/variants combined)

// Pickup time the customer can type in (24-hour "HH:MM")
const PICKUP_OPEN = "08:00";    // 8:00 AM
const PICKUP_CLOSE = "16:00";   // 4:00 PM

/* ---------------------------------------------------------
   2. EDIT YOUR MENU HERE  (prices from the shop's menu board)
--------------------------------------------------------- */

// Sweetness levels shown on the menu board
const SUGAR_LEVELS = [0, 25, 50, 75, 100];
const DEFAULT_SUGAR = 100;

// Add-ons. `only` limits an add-on to certain categories.
const ADDONS = [
  { id: "a1", name: "Tapioca Pearls",      price: 10 },
  { id: "a2", name: "Nata Jelly",          price: 10 },
  { id: "a3", name: "Extra Shot Espresso", price: 30, only: ["Coffee"] },
];

// Size / option helpers
const ML = (m, l) => [
  { key: "M", label: "Medium (16oz)", short: "M", price: m },
  { key: "L", label: "Large (22oz)",  short: "L", price: l },
];
const COFFEE = (p) => [
  { key: "ICED", label: "Iced (16oz)", short: "Iced", price: p },
  { key: "HOT",  label: "Hot (12oz)",  short: "Hot",  price: p },
];
const ONE_SIZE = (p, oz = "16oz") => [{ key: "STD", label: oz, short: oz, price: p }];

const CATEGORY_NOTES = {
  "Coffee": "Iced 16oz or Hot 12oz — same price",
  "Non Coffee": "16oz",
};

const MENU = [
  // ---- FRUITTI (M 16oz / L 22oz) ----
  { id: "f1", category: "Fruitti", name: "Lychee",      emoji: "🍒", desc: "Sweet, floral lychee fruit tea.",          options: ML(39, 49) },
  { id: "f2", category: "Fruitti", name: "Strawberry",  emoji: "🍓", desc: "Juicy strawberry fruit tea.",              options: ML(39, 49) },
  { id: "f3", category: "Fruitti", name: "Mango",       emoji: "🥭", desc: "Tropical ripe mango fruit tea.",           options: ML(39, 49) },
  { id: "f4", category: "Fruitti", name: "Melon",       emoji: "🍈", desc: "Cool, refreshing melon fruit tea.",        options: ML(39, 49) },
  { id: "f5", category: "Fruitti", name: "Blueberry",   emoji: "🫐", desc: "Fruity, tangy blueberry fruit tea.",       options: ML(39, 49) },
  { id: "f6", category: "Fruitti", name: "Green Apple", emoji: "🍏", desc: "Crisp and tangy green apple fruit tea.",   options: ML(39, 49) },

  // ---- MILK TEA (M 16oz / L 22oz) ----
  { id: "t1", category: "Milk Tea", name: "Wintermelon",       emoji: "🧋", desc: "Classic caramel-sweet wintermelon milk tea.", options: ML(49, 59) },
  { id: "t2", category: "Milk Tea", name: "Cookies & Cream",   emoji: "🍪", desc: "Creamy milk tea with cookie crumbs.",         options: ML(49, 59) },
  { id: "t3", category: "Milk Tea", name: "Okinawa",           emoji: "🧋", desc: "Rich brown-sugar Okinawa milk tea.",          options: ML(49, 59) },
  { id: "t4", category: "Milk Tea", name: "Salted Caramel",    emoji: "🍮", desc: "Sweet-salty caramel milk tea.",               options: ML(49, 59) },
  { id: "t5", category: "Milk Tea", name: "Taro",              emoji: "🍠", desc: "Smooth, nutty purple taro milk tea.",         options: ML(49, 59) },
  { id: "t6", category: "Milk Tea", name: "Belgian Chocolate", emoji: "🍫", desc: "Deep chocolatey milk tea.",                   options: ML(49, 59) },
  { id: "t7", category: "Milk Tea", name: "Matcha",            emoji: "🍵", desc: "Earthy Japanese-style matcha milk tea.",      options: ML(49, 59) },

  // ---- COFFEE (ESPRESSO) — Iced 16oz or Hot 12oz ----
  { id: "c1", category: "Coffee", name: "Americano",         emoji: "☕", desc: "Espresso with water. Bold and clean.",       options: COFFEE(79) },
  { id: "c2", category: "Coffee", name: "Cafe Latte",        emoji: "☕", desc: "Espresso with steamed milk.",                options: COFFEE(89) },
  { id: "c3", category: "Coffee", name: "Dalgona Espresso",  emoji: "☕", desc: "Whipped coffee cream over milk & espresso.", options: COFFEE(99) },
  { id: "c4", category: "Coffee", name: "Spanish Latte",     emoji: "☕", desc: "Sweetened condensed milk latte.",            options: COFFEE(99) },
  { id: "c5", category: "Coffee", name: "Vanilla Latte",     emoji: "☕", desc: "Smooth latte with vanilla syrup.",           options: COFFEE(99) },
  { id: "c6", category: "Coffee", name: "Mocha Latte",       emoji: "☕", desc: "Espresso, milk and chocolate.",              options: COFFEE(99) },
  { id: "c7", category: "Coffee", name: "White Mocha Latte", emoji: "☕", desc: "Espresso, milk and white chocolate.",        options: COFFEE(99) },
  { id: "c8", category: "Coffee", name: "Caramel Macchiato", emoji: "☕", desc: "Vanilla milk, espresso and caramel drizzle.",options: COFFEE(99) },

  // ---- FRESH LEMON (M 16oz / L 22oz) ----
  // ⚠ Classic Lemonade's price was smudged on the menu photo — 59 / 69 is a best guess. Please confirm.
  { id: "l1", category: "Fresh Lemon", name: "Classic Lemonade", emoji: "🍋", desc: "Freshly squeezed lemonade.",              options: ML(59, 69) },
  { id: "l2", category: "Fresh Lemon", name: "Lemon Yakult",     emoji: "🍋", desc: "Fresh lemon with creamy Yakult.",          options: ML(69, 79) },

  // ---- NON COFFEE (16oz) ----
  { id: "n1", category: "Non Coffee", name: "Strawberry Milk", emoji: "🍓", desc: "Strawberry puree with cold milk.",          options: ONE_SIZE(79) },
  { id: "n2", category: "Non Coffee", name: "Matchaberry",     emoji: "🍵", desc: "Matcha meets strawberry. Sweet & earthy.",  options: ONE_SIZE(79) },
  { id: "n3", category: "Non Coffee", name: "Milky Matcha",    emoji: "🍵", desc: "Creamy matcha latte.",                      options: ONE_SIZE(79) },

  // ---- FRAPPE (M 16oz / L 22oz) ----
  // ⚠ Only "Cookies & Cream" was visible on the photo (the board is cut off). Add other frappes here.
  { id: "p1", category: "Frappe", name: "Cookies & Cream", emoji: "🥤", desc: "Blended cookies & cream frappe.", options: ML(99, 119) },
];

/* ---------------------------------------------------------
   3. STATE
--------------------------------------------------------- */
const MY_ORDERS_KEY = "sugarcrush_my_orders";
function loadMyIds() {
  try {
    const v = JSON.parse(localStorage.getItem(MY_ORDERS_KEY) || "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(-50) : [];
  } catch (e) { return []; }
}
function saveMyIds() {
  try { localStorage.setItem(MY_ORDERS_KEY, JSON.stringify(state.myTicketIds.slice(-50))); } catch (e) { /* private mode: ignore */ }
}

const state = {
  cart: {},               // { lineKey: { itemId, optKey, sugar, addons:[ids], qty } }
  orders: [],             // orders currently loaded from Supabase
  myTicketIds: loadMyIds(), // order ids placed on this device, shown automatically in Orders
  nextTicketNumber: 1,    // shown on the hero banner; refreshed from the DB
  activeCategory: "All",
  adminAuthed: false,
  adminStatusFilter: "All",
  custom: null,           // drink currently being customized
};

const money = (n) => "₱" + Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatTicket = (n) => "SC-" + String(n).padStart(4, "0");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------------------------------------------------------
   4. ELEMENT REFS
--------------------------------------------------------- */
const missingEls = [];
const el = (id) => {
  const found = document.getElementById(id);
  if (found) return found;
  missingEls.push(id);
  return document.createElement("div"); // harmless stand-in so the rest of the page keeps working
};

const catbar = el("catbar");
const menuGrid = el("menuGrid");
const cartItemsEl = el("cartItems");
const cartEmptyEl = el("cartEmpty");
const cartTotalEl = el("cartTotal");
const cartCountEl = el("cartCount");
const checkoutBtn = el("checkoutBtn");

const views = { student: el("view-student"), tracker: el("view-tracker"), admin: el("view-admin") };
const navBtns = { student: el("navStudent"), tracker: el("navTracker"), admin: el("navAdmin") };

let toastTimer;
function toast(msg) {
  const t = el("toast");
  t.textContent = msg;
  t.classList.add("is-show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("is-show"), 2600);
}

/* ---------------------------------------------------------
   5. SUPABASE DATA LAYER
--------------------------------------------------------- */

// Convert a raw Supabase row into the shape the UI uses
function mapRow(row) {
  return {
    id: row.id,
    ticketNumber: row.ticket_number,
    ticket: formatTicket(row.ticket_number),
    studentName: row.student_name,       // customer name
    studentSection: row.student_section, // grade & section
    pickupTime: row.pickup_time,
    payment: row.payment_method,
    gcashRef: row.gcash_ref,
    paid: row.paid,
    items: row.items,
    total: Number(row.total),
    status: row.status,
    createdAt: row.created_at,
  };
}

// STAFF ONLY: load every order. The database only returns rows to a signed-in staff account.
async function fetchAllOrders() {
  const { data, error } = await supabaseClient
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Fetch orders failed:", error);
    return [];
  }
  return data.map(mapRow);
}

// Refresh the "next queue number" shown on the hero banner
async function refreshHeroTicket() {
  const { data, error } = await supabaseClient.rpc("next_ticket_number");
  const nextNum = !error && data ? Number(data) : 1;
  state.nextTicketNumber = nextNum;
  const ticketEl = el("heroTicketNum");
  if (ticketEl) ticketEl.textContent = formatTicket(nextNum);
}

// Place an order through the server function (it validates and recomputes the total).
// Returns the saved order (with its DB-assigned ticket number) or null on failure.
async function placeOrder(o) {
  const { data, error } = await supabaseClient.rpc("place_order", {
    p_name: o.name,
    p_section: o.section,
    p_pickup: o.pickup,
    p_payment: o.payment,
    p_gcash: o.gcash,
    p_items: o.items,
  });

  if (error) {
    console.error("Place order failed:", error);
    alert("❌ Order not saved.\n\nReason: " + error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  return row ? mapRow(row) : null;
}

// STAFF ONLY: change an order. RLS silently ignores updates from non-staff, so we check a row came back.
async function updateOrder(id, patch, what) {
  const { data, error } = await supabaseClient.from("orders").update(patch).eq("id", id).select("id");
  if (error || !data || data.length === 0) {
    console.error(`Update ${what} failed:`, error);
    alert(`❌ Could not update ${what}: ` + (error ? error.message : "not allowed. Please sign in again."));
    return false;
  }
  return true;
}
const updateOrderStatus = (id, status) => updateOrder(id, { status }, "status");
const updateOrderPaid = (id, paid) => updateOrder(id, { paid }, "payment");

// Customer: orders placed on this device
async function fetchMyOrders(ids) {
  const { data, error } = await supabaseClient.rpc("get_orders_by_ids", { p_ids: ids });
  if (error) { console.error("Fetch my orders failed:", error); return []; }
  return (data || []).map(mapRow);
}

// Customer: look up one order by ticket number AND the name used on it
async function findOrders(ticketText, name) {
  const digits = String(ticketText).replace(/[^0-9]/g, "");
  if (!digits || !name) return [];
  const { data, error } = await supabaseClient.rpc("find_order", { p_ticket: Number(digits), p_name: name });
  if (error) { console.error("Find order failed:", error); return []; }
  return (data || []).map(mapRow);
}

// Live updates for staff (the database only sends these to signed-in staff)
supabaseClient
  .channel("orders-changes")
  .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
    refreshHeroTicket();
    if (state.adminAuthed && !views.admin.hidden) renderAdmin();
  })
  .subscribe();

// Customers don't get live pushes, so quietly refresh every 15 seconds
setInterval(() => {
  if (document.hidden) return;
  if (!views.student.hidden) refreshHeroTicket();
  if (!views.tracker.hidden && !el("trackerTicketInput").value && !el("trackerNameInput").value) renderTracker(true);
}, 15000);

/* ---------------------------------------------------------
   6. VIEW SWITCHING
--------------------------------------------------------- */
function showView(name) {
  Object.keys(views).forEach((k) => {
    views[k].hidden = k !== name;
    navBtns[k].classList.toggle("is-active", k === name);
  });
  if (name === "tracker") renderTracker();
  if (name === "admin") renderAdmin();
}
navBtns.student.addEventListener("click", () => showView("student"));
navBtns.tracker.addEventListener("click", () => showView("tracker"));
navBtns.admin.addEventListener("click", () => showView("admin"));

/* ---------------------------------------------------------
   7. MENU RENDERING
--------------------------------------------------------- */
const findItem = (id) => MENU.find((m) => m.id === id);

function categories() {
  return ["All", ...new Set(MENU.map((m) => m.category))];
}

function renderCatbar() {
  catbar.innerHTML = "";
  categories().forEach((cat) => {
    const btn = document.createElement("button");
    btn.className = "catchip" + (cat === state.activeCategory ? " is-active" : "");
    btn.textContent = cat;
    btn.addEventListener("click", () => {
      state.activeCategory = cat;
      renderCatbar();
      renderMenu();
    });
    catbar.appendChild(btn);
  });
}

function renderMenu() {
  menuGrid.innerHTML = "";
  const grouped = {};
  MENU.filter((m) => state.activeCategory === "All" || m.category === state.activeCategory)
    .forEach((m) => {
      grouped[m.category] = grouped[m.category] || [];
      grouped[m.category].push(m);
    });

  Object.entries(grouped).forEach(([cat, items]) => {
    const heading = document.createElement("div");
    heading.className = "menuCategory";
    const note = CATEGORY_NOTES[cat] || (items[0].options.length > 1 ? "Medium 16oz · Large 22oz" : "");
    heading.innerHTML = `<h3>${esc(cat)}</h3>${note ? `<small>${esc(note)}</small>` : ""}`;
    menuGrid.appendChild(heading);
    items.forEach((item) => menuGrid.appendChild(buildDrinkCard(item)));
  });
}

function buildDrinkCard(item) {
  const inCart = itemQty(item.id);
  const full = inCart >= MAX_QTY_PER_ITEM;
  const card = document.createElement("article");
  card.className = "foodCard" + (inCart ? " is-inCart" : "");

  const prices = item.options.length > 1
    ? item.options.map((o) => `<span class="priceTag"><small>${esc(o.short)}</small>${money(o.price).replace(".00", "")}</span>`).join("")
    : `<span class="priceTag">${money(item.options[0].price).replace(".00", "")}</span>`;

  card.innerHTML = `
    ${inCart ? `<span class="inCartBadge">${inCart} in tray</span>` : ""}
    <div class="foodCard__top">
      <div class="foodCard__emoji">${item.emoji}</div>
      <div>
        <div class="foodCard__name">${esc(item.name)}</div>
        <div class="foodCard__desc">${esc(item.desc)}</div>
      </div>
    </div>
    <div class="foodCard__bottom">
      <div class="foodCard__prices">${prices}</div>
      <button class="addBtn" ${full ? "disabled" : ""}>${full ? "Max " + MAX_QTY_PER_ITEM : "Add +"}</button>
    </div>
  `;
  card.querySelector(".addBtn").addEventListener("click", () => openCustomize(item.id));
  return card;
}

/* ---------------------------------------------------------
   8. CART  (each unique drink + size + sweetness + add-ons is one line)
   Notes: the order is saved to the existing `orders` table. Each
   cart line is stored in `items` as { name, qty, price } where `name`
   carries the size / sweetness / add-ons, e.g.
   "Wintermelon (L, 50% sugar, +Tapioca Pearls)" and `price` is the
   per-cup price including add-ons.
--------------------------------------------------------- */
const lineKeyOf = (l) => [l.itemId, l.optKey, l.sugar, [...l.addons].sort().join("+")].join("|");

// Total cups of one menu item currently in the cart (all sizes / variants)
function itemQty(itemId) {
  return Object.values(state.cart).filter((l) => l.itemId === itemId).reduce((s, l) => s + l.qty, 0);
}

function addonsFor(item) {
  return ADDONS.filter((a) => !a.only || a.only.includes(item.category));
}

// Expand a stored cart line into everything the UI needs
function describeLine(key, l) {
  const item = findItem(l.itemId);
  const opt = item.options.find((o) => o.key === l.optKey);
  const addons = l.addons.map((id) => ADDONS.find((a) => a.id === id));
  const unit = opt.price + addons.reduce((s, a) => s + a.price, 0);

  const parts = [];
  if (item.options.length > 1) parts.push(opt.short);
  parts.push(l.sugar + "% sugar");
  addons.forEach((a) => parts.push("+" + a.name));

  return {
    key,
    itemId: l.itemId,
    qty: l.qty,
    emoji: item.emoji,
    baseName: item.name,
    optsText: parts.join(", "),
    name: `${item.name} (${parts.join(", ")})`,
    price: unit,
    lineTotal: unit * l.qty,
  };
}

function cartLines() {
  return Object.entries(state.cart).map(([key, l]) => describeLine(key, l));
}
function cartTotal() {
  return cartLines().reduce((sum, l) => sum + l.lineTotal, 0);
}

// Add cups to the cart; returns how many were actually added (respects the per-item limit)
function addToCart(line, qty) {
  const room = MAX_QTY_PER_ITEM - itemQty(line.itemId);
  const add = Math.min(qty, Math.max(0, room));
  if (add <= 0) {
    toast(`Limit reached — max ${MAX_QTY_PER_ITEM} per item per order.`);
    return 0;
  }
  const key = lineKeyOf(line);
  if (state.cart[key]) state.cart[key].qty += add;
  else state.cart[key] = { ...line, addons: [...line.addons], qty: add };
  if (add < qty) toast(`Only ${add} added — max ${MAX_QTY_PER_ITEM} per item per order.`);
  return add;
}

function setLineQty(key, wanted) {
  const l = state.cart[key];
  if (!l) return;
  const others = itemQty(l.itemId) - l.qty;
  const max = MAX_QTY_PER_ITEM - others;
  let next = Math.floor(Number(wanted));
  if (!Number.isFinite(next)) next = l.qty;
  if (next > max) { next = max; toast(`Limit reached — max ${MAX_QTY_PER_ITEM} per item per order.`); }
  if (next <= 0) delete state.cart[key];
  else l.qty = next;
  renderMenu();
  renderCart();
}

function renderCart() {
  const lines = cartLines();
  cartCountEl.textContent = lines.reduce((s, l) => s + l.qty, 0);

  cartItemsEl.innerHTML = "";
  cartEmptyEl.hidden = lines.length > 0;
  checkoutBtn.disabled = lines.length === 0;

  lines.forEach((l) => {
    const room = MAX_QTY_PER_ITEM - itemQty(l.itemId);
    const row = document.createElement("div");
    row.className = "cartItem";
    row.innerHTML = `
      <div class="cartItem__emoji">${l.emoji}</div>
      <div class="cartItem__info">
        <div class="cartItem__name">${esc(l.baseName)}</div>
        <div class="cartItem__opts">${esc(l.optsText)}</div>
        <div class="cartItem__price">${money(l.price)} ea · ${money(l.lineTotal)}</div>
      </div>
      <div class="cartItem__side">
        <div class="stepper">
          <button data-act="minus" aria-label="Less">−</button>
          <input type="number" inputmode="numeric" min="1" max="${MAX_QTY_PER_ITEM}" value="${l.qty}" aria-label="Quantity">
          <button data-act="plus" aria-label="More" ${room <= 0 ? "disabled" : ""}>+</button>
        </div>
        <button class="cartItem__remove">Remove</button>
      </div>
    `;
    row.querySelector('[data-act="minus"]').addEventListener("click", () => setLineQty(l.key, l.qty - 1));
    row.querySelector('[data-act="plus"]').addEventListener("click", () => setLineQty(l.key, l.qty + 1));
    row.querySelector("input").addEventListener("change", (e) => setLineQty(l.key, e.target.value));
    row.querySelector(".cartItem__remove").addEventListener("click", () => setLineQty(l.key, 0));
    cartItemsEl.appendChild(row);
  });

  cartTotalEl.textContent = money(cartTotal());
}

const overlay = el("overlay");
const cartDrawer = el("cartDrawer");
function openCart() { cartDrawer.classList.add("is-open"); overlay.classList.add("is-open"); }
function closeCart() { cartDrawer.classList.remove("is-open"); overlay.classList.remove("is-open"); }
el("cartFab").addEventListener("click", openCart);
el("closeCart").addEventListener("click", closeCart);
overlay.addEventListener("click", () => { closeCart(); closeAllModals(); });

/* ---------------------------------------------------------
   9. CUSTOMIZE-A-DRINK SHEET (size, sweetness, add-ons, quantity)
--------------------------------------------------------- */
const customOverlay = el("customOverlay");
const customBody = el("customBody");

function openCustomize(itemId) {
  const item = findItem(itemId);
  if (itemQty(itemId) >= MAX_QTY_PER_ITEM) {
    toast(`Limit reached — max ${MAX_QTY_PER_ITEM} per item per order.`);
    return;
  }
  state.custom = { itemId, optKey: item.options[0].key, sugar: DEFAULT_SUGAR, addons: [], qty: 1 };
  renderCustomize();
  customOverlay.classList.add("is-open");
}
function closeCustomize() { customOverlay.classList.remove("is-open"); state.custom = null; }
el("closeCustom").addEventListener("click", closeCustomize);

function customUnitPrice() {
  const c = state.custom, item = findItem(c.itemId);
  const base = item.options.find((o) => o.key === c.optKey).price;
  return base + c.addons.reduce((s, id) => s + ADDONS.find((a) => a.id === id).price, 0);
}
const customRoom = () => MAX_QTY_PER_ITEM - itemQty(state.custom.itemId);

function updateCustomTotals() {
  const c = state.custom;
  el("customTotal").textContent = money(customUnitPrice() * c.qty);
}

function renderCustomize() {
  const c = state.custom, item = findItem(c.itemId), room = customRoom();
  c.qty = Math.min(Math.max(1, c.qty), room);

  const sizeGroup = item.options.length > 1 ? `
    <div class="custom__group">
      <h4>Size</h4>
      <div class="chipRow">
        ${item.options.map((o) => `
          <button type="button" class="optChip ${o.key === c.optKey ? "is-on" : ""}" data-opt="${o.key}">
            ${esc(o.label)}<small>${money(o.price).replace(".00", "")}</small>
          </button>`).join("")}
      </div>
    </div>` : "";

  const addons = addonsFor(item);
  const addonGroup = addons.length ? `
    <div class="custom__group">
      <h4>Add-ons <small>optional</small></h4>
      <div class="chipRow">
        ${addons.map((a) => `
          <button type="button" class="optChip optChip--addon ${c.addons.includes(a.id) ? "is-on" : ""}" data-addon="${a.id}">
            ${esc(a.name)}<small>+${money(a.price).replace(".00", "")}</small>
          </button>`).join("")}
      </div>
    </div>` : "";

  customBody.innerHTML = `
    <div class="custom__top">
      <div class="foodCard__emoji">${item.emoji}</div>
      <div>
        <div class="custom__title">${esc(item.name)}</div>
        <div class="custom__desc">${esc(item.desc)}</div>
      </div>
    </div>
    ${sizeGroup}
    <div class="custom__group">
      <h4>Sweetness level</h4>
      <div class="chipRow">
        ${SUGAR_LEVELS.map((s) => `<button type="button" class="optChip optChip--sugar ${s === c.sugar ? "is-on" : ""}" data-sugar="${s}">${s}%</button>`).join("")}
      </div>
    </div>
    ${addonGroup}
    <div class="custom__group custom__qty">
      <div>
        <h4 style="margin:0">Quantity</h4>
        <div class="hint">${room < MAX_QTY_PER_ITEM ? `${room} more allowed` : `Max ${MAX_QTY_PER_ITEM}`} per item</div>
      </div>
      <div class="stepper">
        <button type="button" data-q="-1" aria-label="Less">−</button>
        <input type="number" id="customQty" inputmode="numeric" min="1" max="${room}" value="${c.qty}" aria-label="Quantity">
        <button type="button" data-q="1" aria-label="More">+</button>
      </div>
    </div>
    <button type="button" class="btn btn--primary btn--block" id="customAddBtn">
      Add to Order · <span id="customTotal">${money(customUnitPrice() * c.qty)}</span>
    </button>
  `;

  customBody.querySelectorAll("[data-opt]").forEach((b) => b.addEventListener("click", () => { c.optKey = b.dataset.opt; renderCustomize(); }));
  customBody.querySelectorAll("[data-sugar]").forEach((b) => b.addEventListener("click", () => { c.sugar = Number(b.dataset.sugar); renderCustomize(); }));
  customBody.querySelectorAll("[data-addon]").forEach((b) => b.addEventListener("click", () => {
    const id = b.dataset.addon;
    c.addons = c.addons.includes(id) ? c.addons.filter((x) => x !== id) : [...c.addons, id];
    renderCustomize();
  }));

  const qtyInput = el("customQty");
  const clampQty = (v) => {
    let n = Math.floor(Number(v));
    if (!Number.isFinite(n) || n < 1) n = 1;
    if (n > room) { n = room; toast(`Limit reached — max ${MAX_QTY_PER_ITEM} per item per order.`); }
    return n;
  };
  customBody.querySelectorAll("[data-q]").forEach((b) => b.addEventListener("click", () => {
    c.qty = clampQty(c.qty + Number(b.dataset.q));
    qtyInput.value = c.qty;
    updateCustomTotals();
  }));
  qtyInput.addEventListener("input", () => {
    const n = Math.floor(Number(qtyInput.value));
    if (Number.isFinite(n) && n >= 1) { c.qty = Math.min(n, room); updateCustomTotals(); }
  });
  qtyInput.addEventListener("change", () => { c.qty = clampQty(qtyInput.value); qtyInput.value = c.qty; updateCustomTotals(); });

  el("customAddBtn").addEventListener("click", () => {
    c.qty = clampQty(qtyInput.value);
    const added = addToCart({ itemId: c.itemId, optKey: c.optKey, sugar: c.sugar, addons: c.addons, qty: c.qty }, c.qty);
    if (!added) return;
    closeCustomize();
    renderMenu();
    renderCart();
    if (added === c.qty) toast(`${added} × ${item.name} added to your tray 🧋`);
  });
}

/* ---------------------------------------------------------
   10. CHECKOUT MODAL
--------------------------------------------------------- */
const checkoutOverlay = el("checkoutOverlay");
const checkoutForm = el("checkoutForm");
const gcashBox = el("gcashBox");

// "13:05" -> "1:05 PM"
function formatTime12(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function openCheckout() {
  if (cartLines().length === 0) return;
  closeCart();
  const pt = el("pickupTime");
  pt.min = PICKUP_OPEN;
  pt.max = PICKUP_CLOSE;
  document.querySelector(".field__hint").textContent = `Pickup hours: ${formatTime12(PICKUP_OPEN)} – ${formatTime12(PICKUP_CLOSE)}`;
  renderCheckoutSummary();
  checkoutOverlay.classList.add("is-open");
}
function closeCheckout() { checkoutOverlay.classList.remove("is-open"); }
checkoutBtn.addEventListener("click", openCheckout);
el("closeCheckout").addEventListener("click", closeCheckout);

// GCash number: digits only, max 11
el("gcashRef").addEventListener("input", (e) => {
  e.target.value = e.target.value.replace(/\D/g, "").slice(0, 11);
  e.target.style.borderColor = "";
});

document.querySelectorAll('input[name="payment"]').forEach((r) => {
  r.addEventListener("change", (e) => { gcashBox.hidden = e.target.value !== "gcash"; });
});

function renderCheckoutSummary() {
  const lines = cartLines();
  const rows = lines.map((l) => `<div class="row"><span>${esc(l.name)} × ${l.qty}</span><b>${money(l.lineTotal)}</b></div>`).join("");
  el("modalSummary").innerHTML = `${rows}<div class="totalRow"><span>Total</span><strong>${money(cartTotal())}</strong></div>`;
}

checkoutForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payment = document.querySelector('input[name="payment"]:checked').value;
  const gcashRef = el("gcashRef").value.trim();

  if (payment === "gcash" && !/^\d{11}$/.test(gcashRef)) {
    el("gcashRef").focus();
    el("gcashRef").style.borderColor = "var(--pink)";
    toast("GCash number must be exactly 11 digits.");
    return;
  }

  // Pickup time must be typed in and fall inside pickup hours
  const pickupRaw = el("pickupTime").value;
  if (!pickupRaw || pickupRaw < PICKUP_OPEN || pickupRaw > PICKUP_CLOSE) {
    el("pickupTime").focus();
    toast(`Pickup time must be between ${formatTime12(PICKUP_OPEN)} and ${formatTime12(PICKUP_CLOSE)}.`);
    return;
  }

  // Safety net: never let an item go past the per-order limit
  const overLimit = MENU.find((m) => itemQty(m.id) > MAX_QTY_PER_ITEM);
  if (overLimit) { toast(`${overLimit.name}: max ${MAX_QTY_PER_ITEM} per order.`); return; }

  const customerName = el("studentName").value.trim();
  const customerSection = el("studentSection").value.trim();
  const pickupTime = formatTime12(pickupRaw);
  const lines = cartLines();

  const orderArgs = {
    name: customerName,
    section: customerSection,
    pickup: pickupTime,
    payment,
    gcash: payment === "gcash" ? gcashRef : null,
    items: lines.map((l) => ({ name: l.name, qty: l.qty, price: l.price })),
  };

  const submitBtn = checkoutForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = "Placing order…";

  const savedOrder = await placeOrder(orderArgs);

  submitBtn.disabled = false;
  submitBtn.textContent = "Place Order";

  if (!savedOrder) return; // placeOrder already alerted the specific error

  state.myTicketIds.push(savedOrder.id);
  saveMyIds();
  state.cart = {};

  renderMenu();
  renderCart();
  await refreshHeroTicket();
  closeCheckout();
  checkoutForm.reset();
  el("gcashRef").style.borderColor = "";
  gcashBox.hidden = true;
  showConfirmation(savedOrder);
});

/* ---------------------------------------------------------
   11. CONFIRMATION TICKET
--------------------------------------------------------- */
const confirmOverlay = el("confirmOverlay");
function showConfirmation(order) {
  el("confirmNumber").textContent = order.ticket;
  const itemsList = order.items.map((i) => `${i.qty}× ${esc(i.name)}`).join("<br>");
  el("confirmDetails").innerHTML = `
    <div class="row"><span>Name</span><b>${esc(order.studentName)}</b></div>
    <div class="row"><span>Section</span><b>${esc(order.studentSection)}</b></div>
    <div class="row"><span>Pickup</span><b>${esc(order.pickupTime)}</b></div>
    <div class="row"><span>Items</span><b>${itemsList}</b></div>
    <div class="row"><span>Payment</span><b>${order.payment === "gcash" ? "GCash (pending verification)" : "Cash on pickup"}</b></div>
    <div class="row"><span>Total</span><b>${money(order.total)}</b></div>
  `;
  confirmOverlay.classList.add("is-open");
}
el("confirmDoneBtn").addEventListener("click", () => {
  confirmOverlay.classList.remove("is-open");
  showView("tracker");
});

function closeAllModals() {
  checkoutOverlay.classList.remove("is-open");
  confirmOverlay.classList.remove("is-open");
  closeCustomize();
}
[checkoutOverlay, confirmOverlay, customOverlay].forEach((ov) => {
  ov.addEventListener("click", (e) => { if (e.target === ov) closeAllModals(); });
});

/* ---------------------------------------------------------
   12. TRACKER VIEW (customer side)
--------------------------------------------------------- */
async function renderTracker(silent) {
  const list = el("trackerList");
  if (!silent) list.innerHTML = `<p class="trackerEmpty">Loading…</p>`;

  let mine = [];
  if (state.myTicketIds.length) mine = await fetchMyOrders(state.myTicketIds);

  list.innerHTML = "";
  if (mine.length === 0) {
    list.innerHTML = `<p class="trackerEmpty">No orders on this device yet. Place an order, or look one up above with its ticket number and name.</p>`;
    return;
  }
  mine.forEach((o) => list.appendChild(buildOrderCard(o, false)));
}

el("trackerSearchBtn").addEventListener("click", runTrackerSearch);
["trackerTicketInput", "trackerNameInput"].forEach((id) =>
  el(id).addEventListener("keydown", (e) => { if (e.key === "Enter") runTrackerSearch(); })
);

async function runTrackerSearch() {
  const ticket = el("trackerTicketInput").value.trim();
  const name = el("trackerNameInput").value.trim();
  const list = el("trackerList");
  if (!ticket && !name) { renderTracker(); return; }
  if (!ticket || !name) { toast("Enter both your ticket number and the name used on the order."); return; }

  list.innerHTML = `<p class="trackerEmpty">Searching…</p>`;
  const results = await findOrders(ticket, name);
  list.innerHTML = "";
  if (results.length === 0) {
    list.innerHTML = `<p class="trackerEmpty">No matching order found. Check the ticket number and the exact name you used.</p>`;
    return;
  }
  results.forEach((o) => list.appendChild(buildOrderCard(o, false)));
}

function statusBadgeClass(status) {
  return { Pending: "badge--pending", Preparing: "badge--preparing", Ready: "badge--ready", Completed: "badge--completed" }[status];
}

function buildOrderCard(o, isAdmin) {
  const card = document.createElement("div");
  card.className = "orderCard";
  const itemsText = o.items.map((i) => `${i.qty}× ${esc(i.name)}`).join("<br>");
  const payBadge = o.payment === "gcash"
    ? `<span class="badge ${o.paid ? "badge--paid" : "badge--unpaid"}">${o.paid ? "GCash Verified" : "GCash Ref " + esc(o.gcashRef)}</span>`
    : `<span class="badge badge--unpaid">Cash on Pickup</span>`;

  card.innerHTML = `
    <div class="orderCard__head">
      <div>
        <div class="orderCard__num">${o.ticket}</div>
        <div class="orderCard__meta">${esc(o.studentName)} · ${esc(o.studentSection)} · ${esc(o.pickupTime)}</div>
      </div>
      <span class="badge ${statusBadgeClass(o.status)}">${esc(o.status)}</span>
    </div>
    <div class="orderCard__items">${itemsText}</div>
    <div class="orderCard__foot">
      ${payBadge}
      <strong>${money(o.total)}</strong>
    </div>
  `;

  if (isAdmin) {
    const actions = document.createElement("div");
    actions.className = "adminOrder__actions";

    const flow = ["Pending", "Preparing", "Ready", "Completed"];
    const idx = flow.indexOf(o.status);

    if (idx < flow.length - 1) {
      const nextBtn = document.createElement("button");
      nextBtn.className = "smallBtn smallBtn--primary";
      nextBtn.textContent = "Mark as " + flow[idx + 1];
      nextBtn.addEventListener("click", async () => { await updateOrderStatus(o.id, flow[idx + 1]); renderAdmin(); });
      actions.appendChild(nextBtn);
    }
    if (idx > 0) {
      const backBtn = document.createElement("button");
      backBtn.className = "smallBtn smallBtn--revert";
      backBtn.textContent = "↩ Revert to " + flow[idx - 1];
      backBtn.addEventListener("click", async () => { await updateOrderStatus(o.id, flow[idx - 1]); renderAdmin(); });
      actions.appendChild(backBtn);
    }
    if (o.payment === "gcash" && !o.paid) {
      const payBtn = document.createElement("button");
      payBtn.className = "smallBtn";
      payBtn.textContent = "Confirm GCash Payment";
      payBtn.addEventListener("click", async () => { await updateOrderPaid(o.id, true); renderAdmin(); });
      actions.appendChild(payBtn);
    }
    card.appendChild(actions);
  }

  return card;
}

/* ---------------------------------------------------------
   13. ADMIN VIEW
--------------------------------------------------------- */
// Is the signed-in account on the staff list? (checked by the database, not the browser)
async function checkStaff() {
  const { data, error } = await supabaseClient.rpc("is_staff");
  return !error && data === true;
}

el("adminLoginBtn").addEventListener("click", tryAdminLogin);
el("adminPass").addEventListener("keydown", (e) => { if (e.key === "Enter") tryAdminLogin(); });
if (STAFF_PASSWORD_HINT) el("adminHint").textContent = "Hint: " + STAFF_PASSWORD_HINT;

async function tryAdminLogin() {
  const password = el("adminPass").value;
  const err = el("adminError");
  if (!password) { err.textContent = "Enter the staff password."; err.hidden = false; return; }
  if (STAFF_EMAIL.startsWith("your-staff-email")) { err.textContent = "Setup needed: set STAFF_EMAIL at the top of script.js."; err.hidden = false; return; }

  const btn = el("adminLoginBtn");
  btn.disabled = true;
  btn.textContent = "Signing in…";

  let ok = false;
  let msg = "Incorrect password.";
  const { error } = await supabaseClient.auth.signInWithPassword({ email: STAFF_EMAIL, password });
  if (!error) {
    ok = await checkStaff();
    if (!ok) { msg = "This account is not on the staff list."; await supabaseClient.auth.signOut(); }
  }

  btn.disabled = false;
  btn.textContent = "Sign In";
  if (!ok) { err.textContent = msg; err.hidden = false; return; }

  state.adminAuthed = true;
  err.hidden = true;
  el("adminPass").value = "";
  renderAdmin();
}

el("adminLogoutBtn").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  state.adminAuthed = false;
  renderAdmin();
});

// Keep staff signed in across page reloads; sign out cleanly if the session ends
supabaseClient.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") {
    setTimeout(() => { state.adminAuthed = false; if (!views.admin.hidden) renderAdmin(); }, 0);
  }
});
(async () => {
  const { data } = await supabaseClient.auth.getSession();
  if (data && data.session && (await checkStaff())) {
    state.adminAuthed = true;
    if (!views.admin.hidden) renderAdmin();
  }
})();

el("adminSearch").addEventListener("input", renderAdminOrderList);

async function renderAdmin() {
  el("adminLogin").hidden = state.adminAuthed;
  el("adminDash").hidden = !state.adminAuthed;
  if (!state.adminAuthed) return;

  el("adminDate").textContent = new Date().toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  el("orderList").innerHTML = `<p class="trackerEmpty">Loading orders…</p>`;
  state.orders = await fetchAllOrders();

  renderAdminStats();
  renderAdminTabs();
  renderAdminOrderList();
}

function renderAdminStats() {
  const today = state.orders;
  const totalSales = today.reduce((s, o) => s + o.total, 0);
  const pending = today.filter((o) => o.status === "Pending").length;
  const ready = today.filter((o) => o.status === "Ready").length;

  el("statRow").innerHTML = `
    <div class="statCard"><strong>${today.length}</strong><span>TOTAL ORDERS</span></div>
    <div class="statCard"><strong>${money(totalSales)}</strong><span>TOTAL SALES</span></div>
    <div class="statCard"><strong>${pending}</strong><span>PENDING</span></div>
    <div class="statCard"><strong>${ready}</strong><span>READY FOR PICKUP</span></div>
  `;
}

function renderAdminTabs() {
  const tabs = ["All", "Pending", "Preparing", "Ready", "Completed"];
  const bar = el("statusTabs");
  bar.innerHTML = "";
  tabs.forEach((t) => {
    const btn = document.createElement("button");
    btn.className = "catchip" + (state.adminStatusFilter === t ? " is-active" : "");
    btn.textContent = t;
    btn.addEventListener("click", () => { state.adminStatusFilter = t; renderAdminTabs(); renderAdminOrderList(); });
    bar.appendChild(btn);
  });
}

function renderAdminOrderList() {
  const q = el("adminSearch").value.trim().toLowerCase();
  const list = el("orderList");
  list.innerHTML = "";

  const filtered = state.orders.filter((o) => {
    const statusOk = state.adminStatusFilter === "All" || o.status === state.adminStatusFilter;
    const searchOk = !q || o.ticket.toLowerCase().includes(q) || (o.studentName || "").toLowerCase().includes(q);
    return statusOk && searchOk;
  });

  if (filtered.length === 0) {
    list.innerHTML = `<p class="trackerEmpty">No orders match here yet.</p>`;
    return;
  }
  filtered.forEach((o) => list.appendChild(buildOrderCard(o, true)));
}

/* ---------------------------------------------------------
   14. INIT
--------------------------------------------------------- */
renderCatbar();
renderMenu();
renderCart();
refreshHeroTicket();
showView("student");

if (missingEls.length) {
  console.error("index.html is missing elements script.js expects:", [...new Set(missingEls)]);
  showBanner("⚠️ The site files don't match (index.html is out of date). Re-upload index.html, script.js, styles.css and refresh.");
}
