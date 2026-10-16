// Kohl Ballistics installed app: online/offline switching, Online features settings, offline caching.
(() => {
  const $ = id => document.getElementById(id);
  const S = window.kbSample;

  // ---- Online features panel (Rifle & load tab) ----
  const panel = document.createElement("div");
  panel.className = "panel"; panel.id = "onlinePanel";
  panel.innerHTML = `
    <div class="row" style="justify-content:space-between"><h2 class="foldsrc">Online features</h2><span class="pill" id="olPill"></span></div>
    <p class="note" style="margin:0" id="olText"></p>
    <label class="field"><span class="lbl">Claude API key</span>
      <input type="password" id="olKey" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="sk-ant-..."></label>
    <div class="row" style="gap:8px">
      <button class="btn primary" id="olSave" type="button">Save key</button>
      <button class="btn" id="olTest" type="button">Test</button>
      <button class="btn" id="olRemove" type="button">Remove key</button>
    </div>
    <span class="note" id="olNote"></span>
    <details class="lesson"><summary>How to get a key</summary>
      <p>1. On a computer or phone, go to <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com</a> and sign in or create an account.</p>
      <p>2. Under Billing, add a payment method and a small credit. Under Limits, set a monthly spend limit, such as $5, so costs can never run away.</p>
      <p>3. Under API keys, create a key named "Kohl Ballistics" and copy it. Paste it above and tap Save key.</p>
      <p>The key stays on this phone only. It is never put in your backups. If your phone is lost, delete the key in the console and make a new one.</p>
    </details>`;
  const gear = $("tab-gear");
  const backupPanel = $("bkSave") && $("bkSave").closest(".panel");
  if (backupPanel) gear.insertBefore(panel, backupPanel); else gear.append(panel);
  if (window.kbFold) window.kbFold(panel, "online", "Online features", () => {
    const has = !!S.getKey(); return has && navigator.onLine ? "On · Spotter and photo reading ready" : has ? "Key saved · waiting for signal" : "Add a Claude API key to turn on the Spotter";
  });

  function refresh() {
    const has = !!S.getKey(), on = navigator.onLine, live = has && on;
    $("olPill").className = "pill " + (live ? "good" : has ? "warn" : "bad");
    $("olPill").textContent = live ? "On" : has ? "No signal" : "No key";
    $("olText").textContent = live
      ? "Spotter and box-photo reading are on. They turn off by themselves when you lose signal; everything else keeps working."
      : has ? "Your key is saved. Spotter and box-photo reading come back as soon as you have signal."
      : "Add your Claude API key to turn on the Spotter and box-photo reading whenever you have signal.";
    $("olRemove").hidden = !has; $("olTest").hidden = !has;
    $("olKey").placeholder = has ? "Key saved (ends …" + S.getKey().slice(-4) + "). Paste a new one to replace it." : "sk-ant-...";
    // Features appear and disappear with signal.
    $("spBtn").hidden = !live;
    if (!live && !$("spotter").hidden) { $("spotter").hidden = true; $("spBtn").setAttribute("aria-expanded", "false"); }
    ["pickCam", "pickLib"].forEach(id => { $(id).hidden = !live; });
    const bar = $("netBar");
    bar.hidden = on && !bar.dataset.update;
    if (bar.dataset.update) bar.textContent = bar.dataset.update;
    else if (!on) bar.textContent = "No signal. The calculator works; Spotter and photo reading return with signal.";
    if (window.kbFoldSums) window.kbFoldSums();
  }
  $("olSave").onclick = () => {
    const k = $("olKey").value.trim();
    if (!k) { $("olNote").textContent = "Paste your key first."; return; }
    if (!/^sk-ant-/.test(k)) { $("olNote").textContent = "That doesn't look like a Claude API key. Keys start with sk-ant-."; return; }
    S.setKey(k); $("olKey").value = ""; $("olNote").textContent = "Key saved on this phone."; refresh();
  };
  $("olTest").onclick = async () => {
    $("olNote").textContent = "Testing…";
    try { await S.test(); $("olNote").textContent = "Key works. Online features are ready."; }
    catch (e) {
      $("olNote").textContent = ({ offline: "No signal right now. Test again when you have signal.", bad_key: "The key was rejected. Check that you copied all of it, or make a new one.",
        no_credit: "The key works but the account has no credit. Add credit in the console.", rate_limited: "Too many requests. Try again in a minute." })[e && e.code]
        || ("Couldn't reach Claude: " + ((e && e.message) || "unknown error"));
    }
  };
  $("olRemove").onclick = () => {
    const b = $("olRemove");
    if (!b.dataset.armed) { b.dataset.armed = 1; b.textContent = "Tap again to remove"; setTimeout(() => { delete b.dataset.armed; b.textContent = "Remove key"; }, 4000); return; }
    delete b.dataset.armed; b.textContent = "Remove key"; S.setKey(""); $("olNote").textContent = "Key removed from this phone."; refresh();
  };
  addEventListener("online", refresh); addEventListener("offline", refresh); addEventListener("kb-online-change", refresh);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
  refresh();

  // ---- Install hint when opened in a browser tab instead of from the home screen ----
  const standalone = (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  let hintOff = false; try { hintOff = localStorage.getItem("kb-install-hint") === "off"; } catch (e) {}
  if (!standalone && !hintOff) {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const box = document.createElement("div");
    box.className = "installbar"; box.id = "installHint";
    box.innerHTML = `<p>${ios
        ? "Install for no-signal use: <b>Share</b> → <b>Add to Home Screen</b>."
        : "Install for no-signal use: <b>⋮</b> menu → <b>Install app</b>."}</p><button class="btn" id="ihClose" type="button">Got it</button>`;
    const shoot = $("tab-shoot"); shoot.insertBefore(box, shoot.firstChild);
    $("ihClose").onclick = () => { box.remove(); try { localStorage.setItem("kb-install-hint", "off"); } catch (e) {} };
  }

  // ---- Offline caching and updates ----
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").then(reg => {
      reg.addEventListener("updatefound", () => {
        const w = reg.installing; if (!w) return;
        w.addEventListener("statechange", () => {
          if (w.state === "installed" && navigator.serviceWorker.controller) { $("netBar").dataset.update = "Updating to the new version…"; refresh(); }
        });
      });
      // A phone app that is switched back to doesn't reload, so look for updates on every return with signal.
      let last = 0;
      const look = () => { if (navigator.onLine && !document.hidden && Date.now() - last > 60000) { last = Date.now(); reg.update().catch(() => {}); } };
      document.addEventListener("visibilitychange", look); addEventListener("online", look);
    }).catch(() => {});
    // The new version takes over by itself; reload into it if the page wasn't already moved over.
    const had = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener("controllerchange", () => { if (had) setTimeout(() => location.reload(), 1500); });
  }

  // ---- Which version is this? ----
  if (window.KB_VERSION) {
    const v = window.KB_VERSION, d = new Date(Date.UTC(+v.slice(0, 4), +v.slice(4, 6) - 1, +v.slice(6, 8), +v.slice(8, 10), +v.slice(10, 12)));
    const p = document.createElement("p"); p.className = "note"; p.id = "appVer"; p.style.textAlign = "center";
    p.textContent = "App version: " + d.toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
    gear.append(p);
  }
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
})();
