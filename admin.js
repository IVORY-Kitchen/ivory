"use strict";
(() => {
    const cfg = window.IVORY_CONFIG;
    const sb = window.supabase.createClient(cfg.url, cfg.key);
    const BUCKET = "product-images";
    const $ = (id) => document.getElementById(id);
    let rows = [];
    let editing = null;
    function say(el, text, ok = false) {
        el.textContent = text;
        el.className = "msg " + (text ? (ok ? "ok" : "err") : "");
    }
    const money = (n) => Number(n).toLocaleString("ar-EG");
    async function showApp(on) {
        $("loginBox").classList.toggle("hide", on);
        $("app").classList.toggle("hide", !on);
        $("out").classList.toggle("hide", !on);
        if (on)
            await load();
    }
    async function load() {
        const { data, error } = await sb.from("products").select("*").order("created_at", { ascending: false });
        if (error) {
            say($("fm"), "تعذر تحميل المنتجات: " + error.message);
            return;
        }
        rows = data;
        render();
    }
    function render() {
        $("cnt").textContent = String(rows.length);
        $("cats").innerHTML = "";
        Array.from(new Set(rows.map(r => r.category))).forEach(c => { const o = document.createElement("option"); o.value = c; $("cats").appendChild(o); });
        const tb = $("tb");
        tb.innerHTML = "";
        rows.forEach(r => {
            const tr = document.createElement("tr");
            if (!r.active)
                tr.className = "off";
            const th = document.createElement("td");
            if (r.image_url && /^https:\/\//.test(r.image_url)) {
                const i = document.createElement("img");
                i.src = r.image_url;
                i.alt = "";
                th.appendChild(i);
            }
            else {
                th.className = "em";
                th.textContent = r.emoji || "🎀";
            }
            tr.appendChild(th);
            [r.name, r.category, money(r.price_old), money(r.price), r.active ? "ظاهر" : "مخفي"].forEach(t => { const td = document.createElement("td"); td.textContent = t; tr.appendChild(td); });
            const act = document.createElement("td");
            const e = document.createElement("button");
            e.className = "btn sm gray";
            e.textContent = "تعديل";
            e.onclick = () => startEdit(r);
            const d = document.createElement("button");
            d.className = "btn sm red";
            d.textContent = "حذف";
            d.style.marginInlineStart = "6px";
            d.onclick = () => remove(r);
            act.append(e, d);
            tr.appendChild(act);
            tb.appendChild(tr);
        });
    }
    function startEdit(r) {
        editing = r;
        $("nm").value = r.name;
        $("ct").value = r.category;
        $("po").value = String(r.price_old);
        $("pn").value = String(r.price);
        $("rt").value = String(r.rating);
        $("em2").value = r.emoji || "";
        $("ac").value = r.active ? "1" : "0";
        $("im").value = "";
        $("ft").textContent = "✏️ تعديل المنتج (اتركي الصورة فارغة للإبقاء على الحالية)";
        $("cn").classList.remove("hide");
        window.scrollTo({ top: 0, behavior: "smooth" });
    }
    function resetForm() {
        editing = null;
        $("pf").reset();
        $("ft").textContent = "➕ إضافة منتج جديد";
        $("cn").classList.add("hide");
    }
    async function upload(file) {
        if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
            throw new Error("نوع الصورة غير مدعوم (PNG أو JPG أو WEBP)");
        if (file.size > 2 * 1024 * 1024)
            throw new Error("حجم الصورة أكبر من 2 ميجا");
        const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error } = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type, cacheControl: "31536000" });
        if (error)
            throw new Error("فشل رفع الصورة: " + error.message);
        return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    }
    async function remove(r) {
        if (!confirm(`حذف "${r.name}" نهائياً؟`))
            return;
        const { error } = await sb.from("products").delete().eq("id", r.id);
        if (error) {
            alert("فشل الحذف: " + error.message);
            return;
        }
        if (editing && editing.id === r.id)
            resetForm();
        await load();
    }
    $("loginForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const { error } = await sb.auth.signInWithPassword({ email: $("em").value.trim(), password: $("pw").value });
        if (error) {
            say($("lmsg"), "بيانات الدخول غير صحيحة");
            return;
        }
        $("pw").value = "";
        say($("lmsg"), "");
        await showApp(true);
    });
    $("out").onclick = async () => { await sb.auth.signOut(); await showApp(false); };
    $("cn").onclick = resetForm;
    $("pf").addEventListener("submit", async (e) => {
        var _a;
        e.preventDefault();
        const btn = $("sv");
        btn.disabled = true;
        say($("fm"), "جاري الحفظ...", true);
        try {
            const old = Number($("po").value), now = Number($("pn").value);
            if (!(now > 0) || old < now)
                throw new Error("السعر بعد الخصم لازم يكون أكبر من صفر وأقل من أو يساوي السعر قبل الخصم");
            const file = (_a = $("im").files) === null || _a === void 0 ? void 0 : _a[0];
            const rec = {
                name: $("nm").value.trim(), category: $("ct").value.trim(),
                price_old: old, price: now, rating: Number($("rt").value),
                emoji: $("em2").value.trim() || "🎀", active: $("ac").value === "1"
            };
            if (file)
                rec.image_url = await upload(file);
            const res = editing ? await sb.from("products").update(rec).eq("id", editing.id) : await sb.from("products").insert(rec);
            if (res.error)
                throw new Error(res.error.message);
            say($("fm"), editing ? "تم تحديث المنتج ✅" : "تمت إضافة المنتج ✅", true);
            resetForm();
            await load();
        }
        catch (err) {
            say($("fm"), err.message);
        }
        btn.disabled = false;
    });
    sb.auth.getSession().then(({ data }) => showApp(!!data.session));
})();
