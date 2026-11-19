(() => {
interface Product { id: string; name: string; cat: string; emoji: string; img: string | null; old: number; price: number; rate: number }
interface CartItem { p: Product; qty: number }
interface Cfg { url: string; key: string }

const WHATSAPP = "201065594784";
const cfg = (window as any).IVORY_CONFIG as Cfg | undefined;

// منتجات احتياطية تظهر لو تعذر الاتصال بقاعدة البيانات
const fallback: Product[] = [
  { id: "1", name: "طقم حلل جرانيت وردي 10 قطع", cat: "حلل", emoji: "🍲", img: null, old: 2400, price: 1599, rate: 5 },
  { id: "2", name: "مقلاة غير لاصقة 28 سم", cat: "حلل", emoji: "🍳", img: null, old: 650, price: 399, rate: 5 },
  { id: "3", name: "طقم سكاكين ستانلس 6 قطع", cat: "أدوات", emoji: "🔪", img: null, old: 800, price: 520, rate: 4 },
  { id: "4", name: "خلاط كهربائي 1000 واط", cat: "أجهزة", emoji: "🥤", img: null, old: 1900, price: 1250, rate: 5 }
];
let products: Product[] = [];

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const fmt = (n: number): string => n.toLocaleString("ar-EG") + " ج.م";
const esc = (s: unknown): string => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
const safeUrl = (u: string | null): string | null => (u && /^https:\/\//.test(u) ? u : null);
let cart: CartItem[] = [];
let cat = "الكل";

async function loadProducts(): Promise<void> {
  if (!cfg) { products = fallback; return; }
  try {
    const r = await fetch(`${cfg.url}/rest/v1/products?select=*&active=eq.true&order=created_at.asc`,
      { headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` } });
    if (!r.ok) throw new Error(String(r.status));
    const rows = await r.json() as any[];
    products = rows.map(x => ({ id: x.id, name: x.name, cat: x.category, emoji: x.emoji || "🎀",
      img: safeUrl(x.image_url), old: Number(x.price_old), price: Number(x.price), rate: Number(x.rating) }));
  } catch { products = fallback; }
}
const thumb = (p: Product): string => p.img ? `<img src="${esc(p.img)}" alt="${esc(p.name)}" loading="lazy">` : esc(p.emoji);

function toast(msg: string): void {
  const t = $("ts"); t.textContent = msg; t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 1800);
}
function renderTabs(): void {
  const cats = ["الكل", ...Array.from(new Set(products.map(p => p.cat)))];
  $("tabs").innerHTML = cats.map(c => `<button class="tab ${c === cat ? "on" : ""}" data-c="${esc(c)}">${esc(c)}</button>`).join("");
}
function renderGrid(): void {
  const list = products.filter(p => cat === "الكل" || p.cat === cat);
  if (!list.length) { $("grid").innerHTML = `<p style="grid-column:1/-1;text-align:center;color:var(--mu)">لا توجد منتجات حالياً 🌸</p>`; return; }
  $("grid").innerHTML = list.map((p, i) => {
    const off = p.old > p.price ? Math.round((1 - p.price / p.old) * 100) : 0;
    return `<div class="pc rv" style="transition-delay:${i * 60}ms">${off ? `<span class="dis">-${off}%</span>` : ""}
    <div class="pi">${thumb(p)}</div><div class="pb"><h4>${esc(p.name)}</h4>
    <div class="rt">${"★".repeat(p.rate)}${"☆".repeat(5 - p.rate)}</div>
    <div class="pr"><b>${fmt(p.price)}</b>${off ? `<s>${fmt(p.old)}</s>` : ""}</div>
    <button class="add" data-id="${esc(p.id)}">أضيفي للسلة 🛒</button></div></div>`;
  }).join("");
  observe();
}
function renderCart(): void {
  const n = cart.reduce((s, c) => s + c.qty, 0);
  $("cc").textContent = String(n);
  $("tt").textContent = fmt(cart.reduce((s, c) => s + c.qty * c.p.price, 0));
  $("items").innerHTML = cart.length ? cart.map(c => `<div class="ci"><span class="e">${thumb(c.p)}</span>
    <div><b>${esc(c.p.name)}</b><br><small>${fmt(c.p.price)}</small></div>
    <div class="q"><button data-m="${esc(c.p.id)}">−</button> ${c.qty} <button data-a="${esc(c.p.id)}">+</button></div></div>`).join("")
    : `<p style="text-align:center;color:var(--mu);margin-top:40px">السلة فارغة 🌸</p>`;
}
function addToCart(id: string): void {
  const p = products.find(x => x.id === id); if (!p) return;
  const f = cart.find(c => c.p.id === id);
  if (f) f.qty++; else cart.push({ p, qty: 1 });
  renderCart(); toast("تمت الإضافة للسلة 💖");
  $("cc").animate([{ transform: "scale(1.8)" }, { transform: "scale(1)" }], 300);
}
function change(id: string, d: number): void {
  const f = cart.find(c => c.p.id === id); if (!f) return;
  f.qty += d; cart = cart.filter(c => c.qty > 0); renderCart();
}
function drawer(open: boolean): void {
  $("dr").classList.toggle("open", open); $("ov").classList.toggle("open", open);
}
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: .12 });
function observe(): void { document.querySelectorAll(".rv:not(.in)").forEach(e => io.observe(e)); }
function counters(): void {
  document.querySelectorAll<HTMLElement>("[data-n]").forEach(el => {
    const end = parseFloat(el.dataset.n || "0"); let v = 0;
    const step = () => { v += end / 60; if (v >= end) { v = end; } el.textContent = (end % 1 ? v.toFixed(1) : Math.floor(v).toLocaleString("en")) + (end > 100 ? "+" : "");
      if (v < end) requestAnimationFrame(step); };
    step();
  });
}
function countdown(): void {
  const end = Date.now() + 3 * 864e5 + 5 * 36e5;
  const tick = () => {
    const s = Math.max(0, Math.floor((end - Date.now()) / 1000));
    const v = [Math.floor(s / 86400), Math.floor(s % 86400 / 3600), Math.floor(s % 3600 / 60), s % 60];
    v.forEach((x, i) => $("d" + (i + 1)).textContent = String(x).padStart(2, "0"));
  };
  tick(); setInterval(tick, 1000);
}

$("tabs").addEventListener("click", e => {
  const c = (e.target as HTMLElement).dataset.c; if (!c) return;
  cat = c; renderTabs(); renderGrid();
});
$("grid").addEventListener("click", e => {
  const id = (e.target as HTMLElement).dataset.id; if (id) addToCart(id);
});
$("items").addEventListener("click", e => {
  const d = (e.target as HTMLElement).dataset;
  if (d.a) change(d.a, 1);
  if (d.m) change(d.m, -1);
});
$("cb").onclick = () => drawer(true);
$("cl").onclick = $("ov").onclick = () => drawer(false);
$("bg").onclick = () => $("lk").classList.toggle("open");
$("lk").onclick = () => $("lk").classList.remove("open");
$("nf").addEventListener("submit", e => { e.preventDefault(); toast("شكراً لاشتراكك 🎀"); (e.target as HTMLFormElement).reset(); });
$("th").onclick = () => {
  const r = document.documentElement; const dark = r.dataset.theme !== "dark";
  r.dataset.theme = dark ? "dark" : "light"; $("th").textContent = dark ? "☀️" : "🌙";
};
$("ck").onclick = () => {
  if (!cart.length) { toast("السلة فارغة"); return; }
  const lines = cart.map(c => `• ${c.p.name} × ${c.qty} = ${fmt(c.p.price * c.qty)}`).join("\n");
  const total = fmt(cart.reduce((s, c) => s + c.qty * c.p.price, 0));
  window.open(`https://wa.me/${WHATSAPP}?text=` + encodeURIComponent(`طلب جديد من Ivory 🎀\n${lines}\nالإجمالي: ${total}`), "_blank");
};

$("grid").innerHTML = `<p style="grid-column:1/-1;text-align:center;color:var(--mu)">جاري تحميل المنتجات... ✨</p>`;
countdown(); observe(); counters(); renderCart();
loadProducts().then(() => { renderTabs(); renderGrid(); });
})();
