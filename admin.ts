(() => {
interface Row { id: string; name: string; category: string; emoji: string | null; image_url: string | null; price_old: number; price: number; rating: number; active: boolean }

const cfg = (window as any).IVORY_CONFIG as { url: string; key: string };
const sb = (window as any).supabase.createClient(cfg.url, cfg.key);
const BUCKET = "product-images";
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
let rows: Row[] = [];
let editing: Row | null = null;

function say(el: HTMLElement, text: string, ok = false): void {
  el.textContent = text; el.className = "msg " + (text ? (ok ? "ok" : "err") : "");
}
const money = (n: number): string => Number(n).toLocaleString("ar-EG");

async function showApp(on: boolean): Promise<void> {
  $("loginBox").classList.toggle("hide", on);
  $("app").classList.toggle("hide", !on);
  $("out").classList.toggle("hide", !on);
  if (on) await load();
}

async function load(): Promise<void> {
  const { data, error } = await sb.from("products").select("*").order("created_at", { ascending: false });
  if (error) { say($("fm"), "تعذر تحميل المنتجات: " + error.message); return; }
  rows = data as Row[];
  render();
}

function render(): void {
  $("cnt").textContent = String(rows.length);
  $("cats").innerHTML = "";
  Array.from(new Set(rows.map(r => r.category))).forEach(c => { const o = document.createElement("option"); o.value = c; $("cats").appendChild(o); });
  const tb = $("tb"); tb.innerHTML = "";
  rows.forEach(r => {
    const tr = document.createElement("tr"); if (!r.active) tr.className = "off";
    const th = document.createElement("td");
    if (r.image_url && /^https:\/\//.test(r.image_url)) { const i = document.createElement("img"); i.src = r.image_url; i.alt = ""; th.appendChild(i); }
    else { th.className = "em"; th.textContent = r.emoji || "🎀"; }
    tr.appendChild(th);
    [r.name, r.category, money(r.price_old), money(r.price), r.active ? "ظاهر" : "مخفي"].forEach(t => { const td = document.createElement("td"); td.textContent = t; tr.appendChild(td); });
    const act = document.createElement("td");
    const e = document.createElement("button"); e.className = "btn sm gray"; e.textContent = "تعديل"; e.onclick = () => startEdit(r);
    const d = document.createElement("button"); d.className = "btn sm red"; d.textContent = "حذف"; d.style.marginInlineStart = "6px"; d.onclick = () => remove(r);
    act.append(e, d); tr.appendChild(act); tb.appendChild(tr);
  });
}

function startEdit(r: Row): void {
  editing = r;
  $<HTMLInputElement>("nm").value = r.name; $<HTMLInputElement>("ct").value = r.category;
  $<HTMLInputElement>("po").value = String(r.price_old); $<HTMLInputElement>("pn").value = String(r.price);
  $<HTMLSelectElement>("rt").value = String(r.rating); $<HTMLInputElement>("em2").value = r.emoji || "";
  $<HTMLSelectElement>("ac").value = r.active ? "1" : "0"; $<HTMLInputElement>("im").value = "";
  $("ft").textContent = "✏️ تعديل المنتج (اتركي الصورة فارغة للإبقاء على الحالية)";
  $("cn").classList.remove("hide"); window.scrollTo({ top: 0, behavior: "smooth" });
}
function resetForm(): void {
  editing = null; $<HTMLFormElement>("pf").reset(); $("ft").textContent = "➕ إضافة منتج جديد"; $("cn").classList.add("hide");
}

async function upload(file: File): Promise<string> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("نوع الصورة غير مدعوم (PNG أو JPG أو WEBP)");
  if (file.size > 2 * 1024 * 1024) throw new Error("حجم الصورة أكبر من 2 ميجا");
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type, cacheControl: "31536000" });
  if (error) throw new Error("فشل رفع الصورة: " + error.message);
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl as string;
}

async function remove(r: Row): Promise<void> {
  if (!confirm(`حذف "${r.name}" نهائياً؟`)) return;
  const { error } = await sb.from("products").delete().eq("id", r.id);
  if (error) { alert("فشل الحذف: " + error.message); return; }
  if (editing && editing.id === r.id) resetForm();
  await load();
}

$("loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  const { error } = await sb.auth.signInWithPassword({ email: $<HTMLInputElement>("em").value.trim(), password: $<HTMLInputElement>("pw").value });
  if (error) { say($("lmsg"), "بيانات الدخول غير صحيحة"); return; }
  $<HTMLInputElement>("pw").value = ""; say($("lmsg"), ""); await showApp(true);
});
$("out").onclick = async () => { await sb.auth.signOut(); await showApp(false); };
$("cn").onclick = resetForm;

$("pf").addEventListener("submit", async e => {
  e.preventDefault();
  const btn = $<HTMLButtonElement>("sv"); btn.disabled = true; say($("fm"), "جاري الحفظ...", true);
  try {
    const old = Number($<HTMLInputElement>("po").value), now = Number($<HTMLInputElement>("pn").value);
    if (!(now > 0) || old < now) throw new Error("السعر بعد الخصم لازم يكون أكبر من صفر وأقل من أو يساوي السعر قبل الخصم");
    const file = $<HTMLInputElement>("im").files?.[0];
    const rec: Record<string, unknown> = {
      name: $<HTMLInputElement>("nm").value.trim(), category: $<HTMLInputElement>("ct").value.trim(),
      price_old: old, price: now, rating: Number($<HTMLSelectElement>("rt").value),
      emoji: $<HTMLInputElement>("em2").value.trim() || "🎀", active: $<HTMLSelectElement>("ac").value === "1"
    };
    if (file) rec.image_url = await upload(file);
    const res = editing ? await sb.from("products").update(rec).eq("id", editing.id) : await sb.from("products").insert(rec);
    if (res.error) throw new Error(res.error.message);
    say($("fm"), editing ? "تم تحديث المنتج ✅" : "تمت إضافة المنتج ✅", true);
    resetForm(); await load();
  } catch (err) { say($("fm"), (err as Error).message); }
  btn.disabled = false;
});

sb.auth.getSession().then(({ data }: any) => showApp(!!data.session));
})();
