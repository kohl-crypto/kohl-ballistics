// Kohl Ballistics installed app: talks to Claude directly with Lance's own API key.
// Same call shape the app uses inside claude.ai, so the rest of the app doesn't change.
(() => {
  const KEY = "kb-api-key";
  const BASE = window.KB_API_BASE || "https://api.anthropic.com";
  const MODELS = { quick: "claude-haiku-5-5", default: "claude-sonnet-5-5", complex: "claude-sonnet-5-5" };
  const getKey = () => { try { return localStorage.getItem(KEY) || ""; } catch (e) { return ""; } };
  const ready = () => navigator.onLine && !!getKey();
  const err = (code, message, text) => Object.assign({ code, message }, text ? { text } : {});

  async function call(body, signal) {
    if (!navigator.onLine) throw err("offline", "No signal");
    const key = getKey(); if (!key) throw err("no_key", "No API key saved");
    let r;
    try {
      r = await fetch(BASE + "/v1/messages", {
        method: "POST", signal,
        headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify(body)
      });
    } catch (e) {
      if (e && e.name === "AbortError") throw err("cancelled", "Stopped");
      throw err(navigator.onLine ? "upstream_error" : "offline", "Network error");
    }
    if (!r.ok) {
      let m = ""; try { m = (await r.json()).error.message || ""; } catch (e) {}
      const code = (r.status === 401 || r.status === 403) ? "bad_key"
        : r.status === 429 ? "rate_limited"
        : /credit|billing|balance/i.test(m) ? "no_credit"
        : r.status >= 500 ? "upstream_error" : "invalid_request";
      throw err(code, m || ("HTTP " + r.status));
    }
    return r.json();
  }

  // Shrink photos to about 1.2 megapixels before sending: plenty to read a box label, and cheaper.
  async function imageBlock(blob) {
    let bmp; try { bmp = await createImageBitmap(blob); } catch (e) { throw err("image_rejected", "Couldn't read that image"); }
    const s = Math.min(1, Math.sqrt(1.2e6 / (bmp.width * bmp.height)));
    const c = document.createElement("canvas"); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    return { type: "image", source: { type: "base64", media_type: "image/jpeg", data: c.toDataURL("image/jpeg", 0.85).split(",")[1] } };
  }

  function toMessages(input) {
    const arr = typeof input === "string" ? [{ role: "user", content: input }] : input.map(m => ({ role: m.role, content: String(m.content) }));
    const out = [];
    for (const m of arr) { const last = out[out.length - 1]; if (last && last.role === m.role) last.content += "\n\n" + m.content; else out.push({ ...m }); }
    return out;
  }

  async function run(input, opts = {}) {
    const model = MODELS[opts.modelTier || "default"] || MODELS.default;
    const msgs = toMessages(input);
    if (opts.images) {
      const list = opts.images instanceof Blob ? [opts.images] : Array.from(opts.images);
      const blocks = []; for (const b of list) blocks.push(await imageBlock(b));
      const last = msgs[msgs.length - 1]; last.content = [...blocks, { type: "text", text: last.content }];
    }
    const tools = (opts.tools || []).map(t => ({ name: t.name, description: t.description, input_schema: t.inputSchema || { type: "object", properties: {} } }));
    let text = "";
    for (let round = 0; round < 6; round++) {
      const body = { model, max_tokens: 1500, messages: msgs };
      if (tools.length) body.tools = tools;
      const res = await call(body, opts.signal);
      const blocks = res.content || [];
      const t = blocks.filter(b => b.type === "text").map(b => b.text).join("");
      if (t.trim()) text = text ? text + "\n\n" + t : t;
      const uses = blocks.filter(b => b.type === "tool_use");
      if (res.stop_reason !== "tool_use" || !uses.length) break;
      msgs.push({ role: "assistant", content: blocks });
      const results = [];
      for (const u of uses) {
        const tool = (opts.tools || []).find(x => x.name === u.name);
        let out, isErr = false;
        try {
          if (!tool) throw new Error("Unknown tool " + u.name);
          out = await tool.execute(u.input || {}, { signal: opts.signal || new AbortController().signal });
        } catch (e) { out = "Error: " + ((e && e.message) || e); isErr = true; }
        results.push({ type: "tool_result", tool_use_id: u.id, content: typeof out === "string" ? out : JSON.stringify(out), ...(isErr ? { is_error: true } : {}) });
      }
      msgs.push({ role: "user", content: results });
    }
    if (!text.trim()) throw err("empty_completion", "No answer");
    if (opts.onText) { try { opts.onText({ text, delta: text }); } catch (e) {} }
    return { text, truncated: false, modelTierApplied: opts.modelTier || "default" };
  }

  function parseJSON(t) {
    try { return JSON.parse(t); } catch (e) {}
    const f = t.match(/```(?:json)?\s*([\s\S]*?)```/); if (f) { try { return JSON.parse(f[1]); } catch (e) {} }
    const starts = ["{", "["].map(c => t.indexOf(c)).filter(i => i >= 0), a = starts.length ? Math.min(...starts) : -1, b = Math.max(t.lastIndexOf("}"), t.lastIndexOf("]"));
    if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e) {} }
    throw err("invalid_json", "Couldn't read the answer", t);
  }

  const sample = (input, opts) => run(input, opts);
  sample.json = async (input, opts = {}) => {
    const q = typeof input === "string" ? input + "\n\nReply with only the JSON value, no other text." : input;
    return parseJSON((await run(q, opts)).text);
  };
  sample.limits = async () => ({ maxPromptBytes: 262144, images: { maxCount: 4, maxInputBytes: 20e6, mediaTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"] }, tools: { maxCount: 8 } });
  sample.ready = ready;
  sample.getKey = getKey;
  sample.setKey = k => { try { if (k) localStorage.setItem(KEY, k); else localStorage.removeItem(KEY); } catch (e) {} window.dispatchEvent(new Event("kb-online-change")); };
  sample.test = () => call({ model: MODELS.quick, max_tokens: 8, messages: [{ role: "user", content: "Reply with the word OK." }] });
  window.kbSample = sample;
})();
