// Gerador do tracker.js (script plug & play instalado pela agência nos sites dos clientes).

export function trackerSnippet(appUrl: string, key: string) {
  return `<!-- Téo CRM • Rastreamento SEO -> WhatsApp -->
<script async src="${appUrl}/api/tracker.js?k=${key}"></script>`;
}

/** Retorna o código JS servido em /api/tracker.js */
export function trackerScript(appUrl: string, key: string, opts: { whatsappNumber?: string | null; showFloatingButton?: boolean } = {}) {
  const cfg = JSON.stringify({ api: appUrl, key, wa: opts.whatsappNumber ?? null, button: !!opts.showFloatingButton });
  return `/*! Téo CRM tracker v1 */
(function(){
  if (window.TeoTracker) return;
  var CFG = ${cfg};
  var STORE = "teo_first_touch";
  var TTL = 30*24*3600*1000;

  function qs(name){ try { return new URLSearchParams(location.search).get(name); } catch(e){ return null; } }
  function host(u){ try { return new URL(u).hostname.replace(/^www\\./,""); } catch(e){ return ""; } }

  function detectOrigin(){
    var ref = document.referrer || "";
    var rh = host(ref);
    var src = (qs("utm_source")||"").toLowerCase(), med = (qs("utm_medium")||"").toLowerCase();
    if (qs("gclid") || qs("gbraid") || qs("wbraid") || (src.indexOf("google")>-1 && /cpc|ppc|paid|ads/.test(med))) return "GOOGLE_ADS";
    if (qs("fbclid") || /facebook|instagram|meta|fb|ig/.test(src)) return "FACEBOOK_ADS";
    if (/olx/.test(rh) || src==="olx") return "OLX";
    if (/zapimoveis|vivareal|imovelweb|chavesnamao/.test(rh)) return "PORTAIS";
    if (/(^|\\.)google\\.|bing\\.com|yahoo\\.|duckduckgo\\.|ecosia\\.|search\\.brave/.test(rh) && !/cpc|ppc|paid/.test(med)) return "SEO_ORGANICO";
    if (src && /organic|seo/.test(med)) return "SEO_ORGANICO";
    return "SITE_DIRETO";
  }

  function load(){ try { var v = JSON.parse(localStorage.getItem(STORE)||"null"); if (v && Date.now()-v.t < TTL) return v; } catch(e){} return null; }
  function save(v){ try { localStorage.setItem(STORE, JSON.stringify(v)); } catch(e){} }

  var touch = load();
  var origin = detectOrigin();
  // first-touch, mas um clique pago/orgânico novo substitui uma visita direta
  if (!touch || (touch.origin === "SITE_DIRETO" && origin !== "SITE_DIRETO")) {
    touch = {
      t: Date.now(), origin: origin,
      landingPage: location.origin + location.pathname,
      referrer: document.referrer || null,
      keyword: qs("utm_term") || qs("q") || null,
      utmSource: qs("utm_source"), utmMedium: qs("utm_medium"), utmCampaign: qs("utm_campaign"),
      code: null
    };
    save(touch);
  }

  function post(path, body, beacon){
    var url = CFG.api + path;
    var data = JSON.stringify(Object.assign({ key: CFG.key }, body));
    if (beacon && navigator.sendBeacon) { try { return navigator.sendBeacon(url, new Blob([data], {type:"text/plain"})); } catch(e){} }
    return fetch(url, { method:"POST", body:data, headers:{"Content-Type":"text/plain"}, keepalive:true, mode:"cors" }).then(function(r){ return r.json(); });
  }

  var ready = touch.code ? Promise.resolve(touch.code) : post("/api/track/session", {
    origin: touch.origin, landingPage: touch.landingPage, referrer: touch.referrer, keyword: touch.keyword,
    utmSource: touch.utmSource, utmMedium: touch.utmMedium, utmCampaign: touch.utmCampaign
  }).then(function(r){ if (r && r.code) { touch.code = r.code; save(touch); } return touch.code; }).catch(function(){ return null; });

  function refTag(code){ return "[Ref: #" + code + "]"; }

  function patchWaUrl(href, code){
    try {
      var u = new URL(href, location.href);
      var text = u.searchParams.get("text") || "Olá! Vim pelo site e gostaria de mais informações.";
      if (text.indexOf("Ref: #") === -1) text = text + "\\n\\n" + refTag(code);
      u.searchParams.set("text", text);
      return u.toString();
    } catch(e){ return href; }
  }

  function isWa(href){ return /(wa\\.me|api\\.whatsapp\\.com|web\\.whatsapp\\.com|whatsapp:\\/\\/)/i.test(href||""); }

  // Intercepta cliques em links/botões de WhatsApp e injeta o protocolo
  document.addEventListener("click", function(ev){
    var a = ev.target && ev.target.closest ? ev.target.closest("a[href]") : null;
    if (!a || !isWa(a.getAttribute("href"))) return;
    if (touch.code) { a.href = patchWaUrl(a.href, touch.code); post("/api/track/event", { code: touch.code, event: "whatsapp_click" }, true); return; }
    ev.preventDefault();
    var target = a.target;
    ready.then(function(code){
      var url = code ? patchWaUrl(a.href, code) : a.href;
      if (code) post("/api/track/event", { code: code, event: "whatsapp_click" }, true);
      if (target === "_blank") window.open(url, "_blank"); else location.href = url;
    });
  }, true);

  // Intercepta envios de formulário e cria o lead no CRM com a origem completa
  function pick(form, re){
    var els = form.querySelectorAll("input,select,textarea");
    for (var i=0;i<els.length;i++){ var el = els[i]; var id = (el.name+" "+el.id+" "+(el.placeholder||"")+" "+el.type).toLowerCase(); if (re.test(id) && el.value) return el.value; }
    return null;
  }
  document.addEventListener("submit", function(ev){
    var f = ev.target; if (!f || f.tagName !== "FORM" || f.hasAttribute("data-teo-ignore")) return;
    var phone = pick(f, /(tel|phone|fone|whats|celular)/);
    if (!phone) return;
    var fields = {}; try { new FormData(f).forEach(function(v,k){ if (typeof v === "string" && v.length < 500) fields[k] = v; }); } catch(e){}
    post("/api/track/form", {
      code: touch.code, name: pick(f, /(nome|name)/), phone: phone, email: pick(f, /(mail)/),
      message: pick(f, /(mensagem|message|obs|coment)/), page: location.href, fields: fields,
      origin: touch.origin, landingPage: touch.landingPage, referrer: touch.referrer, keyword: touch.keyword,
      utmSource: touch.utmSource, utmMedium: touch.utmMedium, utmCampaign: touch.utmCampaign
    }, true);
  }, true);

  // Botão flutuante opcional de WhatsApp
  if (CFG.button && CFG.wa) {
    var b = document.createElement("a");
    b.href = "https://wa.me/" + CFG.wa; b.target = "_blank"; b.rel = "noopener";
    b.setAttribute("aria-label", "Fale conosco no WhatsApp");
    b.style.cssText = "position:fixed;right:20px;bottom:20px;width:58px;height:58px;border-radius:50%;background:#25D366;box-shadow:0 6px 20px rgba(0,0,0,.2);display:flex;align-items:center;justify-content:center;z-index:2147483000";
    b.innerHTML = '<svg width="30" height="30" viewBox="0 0 24 24" fill="#fff"><path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5 2.5 1 3 .8 3.6.8.6-.1 1.7-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.3zM12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2z"/></svg>';
    (document.body ? Promise.resolve() : new Promise(function(r){ document.addEventListener("DOMContentLoaded", r); })).then(function(){ document.body.appendChild(b); });
  }

  window.TeoTracker = { touch: function(){ return touch; }, code: function(){ return ready; }, refTag: refTag };
})();`;
}

/** Gera códigos curtos legíveis: SEO-8492, ADS-1203, FB-5521, SITE-0042 */
export function codePrefix(origin: string) {
  return ({ SEO_ORGANICO: "SEO", GOOGLE_ADS: "ADS", FACEBOOK_ADS: "FB", OLX: "OLX", PORTAIS: "PRT", INDICACAO: "IND" } as Record<string, string>)[origin] ?? "SITE";
}
