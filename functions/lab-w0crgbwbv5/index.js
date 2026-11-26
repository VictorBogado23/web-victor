// Laboratorio: simula el front de WooCommerce + plugin "GTM Server Side" de Stape.
// URL fija, sin clave ni cookie de acceso: se le pueden sumar utm_* y cualquier otro parámetro.
// Sigue oculto: fuera de menús y del sitemap, con noindex por meta y por cabecera.

const BASE = '/lab-w0crgbwbv5/';
const COOKIE_NONCE = 'vb_lab_nonce';

function hexAleatorio(bytes) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// 404 mínimo para los métodos que no sean GET.
function noEncontrado() {
  return new Response(
    '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>404</title>' +
      '<meta name="robots" content="noindex, nofollow"></head><body><h1>404</h1>' +
      '<p>Not Found</p></body></html>',
    {
      status: 404,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'x-robots-tag': 'noindex, nofollow',
        'cache-control': 'no-store',
      },
    }
  );
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);

  // Compatibilidad con los links viejos que traían ?k=: se quita y se redirige,
  // para que la clave no quede registrada en Analytics. Se conservan los utm_* y demás.
  if (url.searchParams.has('k')) {
    const destino = new URL(url.toString());
    destino.searchParams.delete('k');
    return new Response(null, {
      status: 302,
      headers: {
        location: destino.pathname + destino.search,
        'x-robots-tag': 'noindex, nofollow',
        'cache-control': 'no-store',
      },
    });
  }

  // Nonce nuevo por carga de página, para el CSRF del endpoint (double submit).
  const nonce = hexAleatorio(16);
  const cabeceras = new Headers({
    'content-type': 'text/html; charset=utf-8',
    'x-robots-tag': 'noindex, nofollow',
    'cache-control': 'no-store, max-age=0',
    'referrer-policy': 'same-origin',
  });
  cabeceras.append(
    'set-cookie',
    COOKIE_NONCE + '=' + nonce + '; Path=' + BASE + '; HttpOnly; Secure; SameSite=Lax; Max-Age=7200'
  );

  return new Response(paginaHtml(nonce), { status: 200, headers: cabeceras });
}

// Cualquier otro método en esta ruta tampoco existe.
export async function onRequest(context) {
  if (context.request.method === 'GET') return onRequestGet(context);
  return noEncontrado();
}

function paginaHtml(nonce) {
  return '<!DOCTYPE html>\n' +
'<html lang="es-AR">\n' +
'<head>\n' +
'<meta charset="UTF-8">\n' +
'<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">\n' +
'<meta name="robots" content="noindex, nofollow">\n' +
// Misma carga de GTM que el resto del sitio (Custom Loader de Stape + contenedor web). No se duplica.
'<!-- Google Tag Manager -->\n' +
'<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({\'gtm.start\':new Date().getTime(),event:\'gtm.js\'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s);j.async=true;j.src="https://elemental.victorbogado.cloud/7hykymxot.js?"+i;f.parentNode.insertBefore(j,f);})(window,document,\'script\',\'dataLayer\',\'l=HQtFKi0mVF0%2BW0FaKDgtTgJSSkNITR0GSRkRDg0ECwobCBkJFkUaBBsaHA%3D%3D\');</script>\n' +
'<!-- End Google Tag Manager -->\n' +
'<!-- Google Tag Manager (GTM-5NWBD8WC) -->\n' +
'<script async src="https://www.googletagmanager.com/gtm.js?id=GTM-5NWBD8WC"></script>\n' +
'<script>\n' +
'  window.dataLayer = window.dataLayer || [];\n' +
'  function gtag(){dataLayer.push(arguments);}\n' +
'  gtag(\'js\', new Date());\n' +
'</script>\n' +
'<!-- End Google Tag Manager (GTM-5NWBD8WC) -->\n' +
'<title>Lab de tracking</title>\n' +
'<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">\n' +
'<style>\n' +
':root{--bg:#F5F7FB;--surface:#FFFFFF;--surface2:#EEF2F9;--line:#D8E0EE;--txt:#0A1628;--muted:#5B6882;--accent:#1E4FD8;--soft:#E7EDFC;--ok:#0E7A55;--okbg:#DDF5EC;--err:#B42318;--errbg:#FDE8E6;--warn:#8A5A00;--warnbg:#FDF0D5;--mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;--sans:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}\n' +
'@media(prefers-color-scheme:dark){:root{--bg:#070C18;--surface:#0E1627;--surface2:#141E34;--line:#223050;--txt:#EAF0FB;--muted:#93A1C0;--accent:#3B82F6;--soft:#122245;--ok:#34D399;--okbg:#0D2B22;--err:#FCA5A5;--errbg:#3B1413;--warn:#FBBF24;--warnbg:#3A2D12;color-scheme:dark}}\n' +
'*{box-sizing:border-box}\n' +
'body{margin:0;background:var(--bg);color:var(--txt);font-family:var(--sans);font-size:15px;line-height:1.6}\n' +
'.wrap{max-width:1080px;margin:0 auto;padding:28px 18px 64px}\n' +
'h1{font-size:22px;margin:0 0 4px;letter-spacing:-.01em}\n' +
'.sub{color:var(--muted);font-size:13.5px;margin:0 0 22px}\n' +
'.aviso{background:var(--warnbg);color:var(--warn);border:1px solid currentColor;border-radius:9px;padding:10px 14px;font-size:13px;margin-bottom:22px}\n' +
'.cols{display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:start}\n' +
'@media(max-width:860px){.cols{grid-template-columns:1fr}}\n' +
'.card{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:18px;margin-bottom:16px;min-width:0}\n' +
'.card h2{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin:0 0 14px;font-weight:600;font-family:var(--mono)}\n' +
'.prod{display:flex;gap:14px;align-items:center;margin-bottom:16px}\n' +
'.prod img{width:72px;height:72px;object-fit:cover;border-radius:9px;border:1px solid var(--line);flex:none}\n' +
'.prod b{display:block;font-size:16px}\n' +
'.prod span{color:var(--muted);font-size:13px;font-family:var(--mono)}\n' +
'button{font:inherit;font-weight:600;font-size:14px;border-radius:9px;padding:11px 16px;border:1px solid transparent;cursor:pointer;background:var(--accent);color:#fff}\n' +
'button.sec{background:var(--surface2);color:var(--txt);border-color:var(--line);font-weight:500}\n' +
'button:disabled{opacity:.45;cursor:not-allowed}\n' +
'.pasos{display:grid;gap:9px}\n' +
'.paso{display:grid;grid-template-columns:26px 1fr auto;gap:10px;align-items:center}\n' +
'.paso .n{width:26px;height:26px;border-radius:7px;background:var(--soft);color:var(--accent);font-family:var(--mono);font-size:11px;display:flex;align-items:center;justify-content:center}\n' +
'.paso .ev{font-family:var(--mono);font-size:12.5px;color:var(--muted);min-width:0;overflow-wrap:anywhere}\n' +
'.paso button{width:100%}\n' +
'fieldset{border:1px solid var(--line);border-radius:9px;padding:12px 14px;margin:14px 0 0}\n' +
'legend{font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);padding:0 6px}\n' +
'label.radio{display:flex;gap:9px;align-items:flex-start;font-size:13.5px;margin:6px 0;cursor:pointer}\n' +
'label.radio input{margin:3px 0 0;accent-color:var(--accent);flex:none}\n' +
'label.radio small{display:block;color:var(--muted);font-size:12px}\n' +
'input[type=text]{width:100%;background:var(--bg);border:1px solid var(--line);color:var(--txt);border-radius:8px;padding:9px 11px;font-family:var(--mono);font-size:12.5px;margin-top:4px}\n' +
'.kv{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;font-size:13px;margin-bottom:12px}\n' +
'.kv dt{color:var(--muted)}\n' +
'.kv dd{margin:0;font-family:var(--mono);font-size:12.5px;overflow-wrap:anywhere}\n' +
'pre{background:var(--surface2);border:1px solid var(--line);border-radius:9px;padding:12px;margin:0 0 12px;overflow-x:auto;font-family:var(--mono);font-size:11.5px;line-height:1.55;max-height:300px}\n' +
'.ev-item{margin-bottom:10px}\n' +
'.ev-item .hd{display:flex;justify-content:space-between;gap:10px;font-family:var(--mono);font-size:11.5px;color:var(--muted);margin-bottom:4px}\n' +
'.ev-item .hd b{color:var(--accent)}\n' +
'.pill{display:inline-block;font-family:var(--mono);font-size:11px;padding:2px 9px;border-radius:999px}\n' +
'.pill.ok{background:var(--okbg);color:var(--ok)}\n' +
'.pill.err{background:var(--errbg);color:var(--err)}\n' +
'table{width:100%;border-collapse:collapse;font-size:12.5px}\n' +
'th,td{text-align:left;padding:7px 9px;border-bottom:1px solid var(--line);font-family:var(--mono);font-size:11.5px;overflow-wrap:anywhere}\n' +
'th{color:var(--muted);font-weight:500;text-transform:uppercase;letter-spacing:.06em;font-size:10.5px}\n' +
'.fila-btns{display:flex;gap:9px;flex-wrap:wrap;margin-top:12px}\n' +
'.vacio{color:var(--muted);font-size:13px;font-style:italic}\n' +
'</style>\n' +
'</head>\n' +
'<body>\n' +
'<!-- Google Tag Manager (noscript) -->\n' +
'<noscript><iframe src="https://elemental.victorbogado.cloud/ns.html?id=GTM-5J497QST" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>\n' +
'<!-- End Google Tag Manager (noscript) -->\n' +
'<div class="wrap">\n' +
'  <h1>Lab de tracking</h1>\n' +
'  <p class="sub">Simula WooCommerce con el plugin GTM Server Side de Stape: los mismos pushes al dataLayer y el mismo webhook <code>order_paid</code> al servidor.</p>\n' +
'  <div class="aviso">Página de pruebas privada. No indexable. Los datos son ficticios.</div>\n' +
'  <div class="cols">\n' +
'    <div>\n' +
'      <div class="card">\n' +
'        <h2>Producto de prueba</h2>\n' +
'        <div class="prod">\n' +
'          <img src="/assets/og.png" alt="">\n' +
'          <div><b>Producto test</b><span>test-1 &middot; Test &middot; 25.00 EUR</span></div>\n' +
'        </div>\n' +
'        <div class="pasos">\n' +
'          <div class="paso"><span class="n">1</span><span class="ev">view_item (al cargar)</span><span class="pill ok" id="p1">listo</span></div>\n' +
'          <div class="paso"><span class="n">2</span><span class="ev">add_to_cart</span><button id="bAdd">A&ntilde;adir al carrito</button></div>\n' +
'          <div class="paso"><span class="n">3</span><span class="ev">view_cart</span><button id="bCart" class="sec" disabled>Ver carrito</button></div>\n' +
'          <div class="paso"><span class="n">4</span><span class="ev">begin_checkout</span><button id="bCheck" class="sec" disabled>Ir al checkout</button></div>\n' +
'          <div class="paso"><span class="n">5</span><span class="ev">order_paid (servidor)</span><button id="bPay" disabled>Confirmar pago</button></div>\n' +
'          <div class="paso"><span class="n">6</span><span class="ev">purchase (gracias)</span><span class="pill" id="p6">pendiente</span></div>\n' +
'        </div>\n' +
'        <fieldset>\n' +
'          <legend>Modo de pago</legend>\n' +
'          <label class="radio"><input type="radio" name="modo" value="inmediato" checked><span>Pago inmediato<small>Env&iacute;a las cookies del comprador, como cuando el pedido pasa a Procesando en la misma request del checkout.</small></span></label>\n' +
'          <label class="radio"><input type="radio" name="modo" value="diferido"><span>Pago diferido<small>Sin cookies, como cuando confirma la pasarela por callback o lo marca el admin.</small></span></label>\n' +
'          <label style="display:block;font-size:12.5px;color:var(--muted);margin-top:10px">Header de vista previa (opcional)\n' +
'            <input type="text" id="prev" placeholder="x-gtm-server-preview" autocomplete="off"></label>\n' +
'        </fieldset>\n' +
'        <div class="fila-btns"><button id="bNuevo" class="sec">Nuevo pedido</button></div>\n' +
'      </div>\n' +
'      <div class="card">\n' +
'        <h2>Estado</h2>\n' +
'        <dl class="kv">\n' +
'          <dt>cart_hash</dt><dd id="sHash">&mdash;</dd>\n' +
'          <dt>transaction_id</dt><dd id="sTx">&mdash;</dd>\n' +
'          <dt>Destino</dt><dd id="sUrl">&mdash;</dd>\n' +
'        </dl>\n' +
'      </div>\n' +
'    </div>\n' +
'    <div>\n' +
'      <div class="card">\n' +
'        <h2>Pushes al dataLayer</h2>\n' +
'        <div id="dlList"><p class="vacio">Todav&iacute;a no hay pushes.</p></div>\n' +
'      </div>\n' +
'      <div class="card">\n' +
'        <h2>Webhook order_paid</h2>\n' +
'        <div id="whBox"><p class="vacio">Sin env&iacute;os en esta sesi&oacute;n.</p></div>\n' +
'      </div>\n' +
'      <div class="card">\n' +
'        <h2>Historial</h2>\n' +
'        <div id="hist"><p class="vacio">Sin pedidos registrados.</p></div>\n' +
'        <div class="fila-btns"><button id="bCopiar" class="sec">Copiar como tabla</button><button id="bBorrar" class="sec">Borrar historial</button></div>\n' +
'      </div>\n' +
'    </div>\n' +
'  </div>\n' +
'</div>\n' +
'<script>\n' +
'(function(){\n' +
'  "use strict";\n' +
'  var NONCE = "' + nonce + '";\n' +
'  var ENDPOINT = "' + BASE + 'webhook";\n' +
'  var CLAVE_HIST = "vb_lab_hist";\n' +
'  var IMG = location.origin + "/assets/og.png";\n' +
'\n' +
'  // Ítem con el mismo formato y orden de claves que emite el plugin.\n' +
'  function item(extra){\n' +
'    var base = {\n' +
'      item_name: "Producto test",\n' +
'      item_brand: "",\n' +
'      item_id: "test-1",\n' +
'      item_sku: "",\n' +
'      price: "25.00",\n' +
'      imageUrl: IMG,\n' +
'      item_category: "Test"\n' +
'    };\n' +
'    if (extra) for (var k in extra) base[k] = extra[k];\n' +
'    return base;\n' +
'  }\n' +
'\n' +
'  window.dataLayer = window.dataLayer || [];\n' +
'  var pushes = [];\n' +
'\n' +
'  // Antes de cada evento de ecommerce se limpia el objeto anterior.\n' +
'  function push(obj){\n' +
'    window.dataLayer.push({ ecommerce: null });\n' +
'    window.dataLayer.push(obj);\n' +
'    pushes.push({ hora: new Date().toLocaleTimeString("es-AR"), obj: obj });\n' +
'    pintarPushes();\n' +
'  }\n' +
'\n' +
'  function $(id){ return document.getElementById(id); }\n' +
'  function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }\n' +
'\n' +
'  function pintarPushes(){\n' +
'    var cont = $("dlList");\n' +
'    if (!pushes.length) { cont.innerHTML = "<p class=\\"vacio\\">Todavía no hay pushes.</p>"; return; }\n' +
'    var html = "";\n' +
'    for (var i = pushes.length - 1; i >= 0; i--) {\n' +
'      var p = pushes[i];\n' +
'      html += "<div class=\\"ev-item\\"><div class=\\"hd\\"><b>" + esc(p.obj.event) + "</b><span>" + esc(p.hora) + "</span></div>";\n' +
'      html += "<pre>" + esc(JSON.stringify(p.obj, null, 2)) + "</pre></div>";\n' +
'    }\n' +
'    cont.innerHTML = html;\n' +
'  }\n' +
'\n' +
'  // ---- cart_hash: 32 hex en la cookie woocommerce_cart_hash, como hace WooCommerce ----\n' +
'  function nuevoHash(){\n' +
'    var b = new Uint8Array(16); crypto.getRandomValues(b);\n' +
'    var s = ""; for (var i = 0; i < b.length; i++) s += ("0" + b[i].toString(16)).slice(-2);\n' +
'    return s;\n' +
'  }\n' +
'  function setHash(v){\n' +
'    document.cookie = "woocommerce_cart_hash=" + v + "; path=/; SameSite=Lax" + (location.protocol === "https:" ? "; Secure" : "");\n' +
'    $("sHash").textContent = v;\n' +
'  }\n' +
'  function borrarHash(){\n' +
'    document.cookie = "woocommerce_cart_hash=; path=/; Max-Age=0";\n' +
'    $("sHash").textContent = "—";\n' +
'  }\n' +
'  function leerHash(){\n' +
'    var m = document.cookie.match(/(?:^|;\\s*)woocommerce_cart_hash=([^;]*)/);\n' +
'    return m ? m[1] : null;\n' +
'  }\n' +
'\n' +
'  // ---- 1. view_item al cargar ----\n' +
'  push({\n' +
'    event: "view_item",\n' +
'    ecomm_pagetype: "product",\n' +
'    ecommerce: { currency: "EUR", value: "25.00", items: [ item() ] },\n' +
'    user_data: []\n' +
'  });\n' +
'\n' +
'  // ---- 2. add_to_cart ----\n' +
'  $("bAdd").addEventListener("click", function(){\n' +
'    setHash(nuevoHash());\n' +
'    push({\n' +
'      event: "add_to_cart",\n' +
'      ecomm_pagetype: "product",\n' +
'      ecommerce: { currency: "EUR", value: "25.00", items: [ item({ index: 1, quantity: 1 }) ] },\n' +
'      user_data: {}\n' +
'    });\n' +
'    $("bAdd").disabled = true;\n' +
'    $("bCart").disabled = false;\n' +
'  });\n' +
'\n' +
'  // ---- 3. view_cart ----\n' +
'  $("bCart").addEventListener("click", function(){\n' +
'    push({\n' +
'      event: "view_cart",\n' +
'      ecomm_pagetype: "basket",\n' +
'      cart_quantity: 1,\n' +
'      cart_total: "25.00",\n' +
'      ecommerce: { currency: "EUR", items: [ item({ quantity: 1, index: 1 }) ] },\n' +
'      user_data: []\n' +
'    });\n' +
'    $("bCart").disabled = true;\n' +
'    $("bCheck").disabled = false;\n' +
'  });\n' +
'\n' +
'  // ---- 4. begin_checkout ----\n' +
'  $("bCheck").addEventListener("click", function(){\n' +
'    push({\n' +
'      event: "begin_checkout",\n' +
'      ecomm_pagetype: "basket",\n' +
'      ecommerce: { currency: "EUR", value: "25.00", items: [ item({ quantity: 1, index: 1 }) ] },\n' +
'      user_data: []\n' +
'    });\n' +
'    $("bCheck").disabled = true;\n' +
'    $("bPay").disabled = false;\n' +
'  });\n' +
'\n' +
'  // ---- 5. Confirmar pago: el servidor arma y envía el webhook ----\n' +
'  var pagando = false;\n' +
'  $("bPay").addEventListener("click", function(){\n' +
'    if (pagando) return;\n' +
'    pagando = true;\n' +
'    var btn = $("bPay"); var prev = btn.textContent; btn.textContent = "Enviando…"; btn.disabled = true;\n' +
'    var modo = document.querySelector("input[name=modo]:checked").value;\n' +
'    var cabPrev = $("prev").value.trim();\n' +
'\n' +
'    fetch(ENDPOINT, {\n' +
'      method: "POST",\n' +
'      credentials: "same-origin",\n' +
'      headers: { "content-type": "application/json", "x-lab-nonce": NONCE },\n' +
'      body: JSON.stringify({ modo: modo, preview: cabPrev })\n' +
'    }).then(function(r){\n' +
'      return r.json().then(function(j){ return { http: r.status, data: j }; });\n' +
'    }).then(function(res){\n' +
'      pintarWebhook(res);\n' +
'      var d = res.data || {};\n' +
'      if (res.http === 200 && d.ok) {\n' +
'        $("sTx").textContent = d.transaction_id;\n' +
'        gracias(d.transaction_id, d.billing_email);\n' +
'        guardarHist({ fecha: new Date().toISOString(), modo: modo, tx: d.transaction_id, hash: d.cart_hash || "", estado: "HTTP " + (d.sgtm && d.sgtm.status) });\n' +
'      } else {\n' +
'        guardarHist({ fecha: new Date().toISOString(), modo: modo, tx: (d.transaction_id || "—"), hash: leerHash() || "", estado: "error " + res.http });\n' +
'        btn.disabled = false;\n' +
'      }\n' +
'      btn.textContent = prev; pagando = false;\n' +
'    }).catch(function(e){\n' +
'      pintarWebhook({ http: 0, data: { error: String(e) } });\n' +
'      btn.textContent = prev; btn.disabled = false; pagando = false;\n' +
'    });\n' +
'  });\n' +
'\n' +
'  // ---- 6. Página de gracias: purchase una sola vez por pedido ----\n' +
'  var yaCompro = false;\n' +
'  function gracias(tx, email){\n' +
'    if (yaCompro) return;\n' +
'    yaCompro = true;\n' +
'    push({\n' +
'      event: "purchase",\n' +
'      ecomm_pagetype: "purchase",\n' +
'      ecommerce: {\n' +
'        transaction_id: tx,\n' +
'        affiliation: "",\n' +
'        value: "25.00",\n' +
'        tax: "0.00",\n' +
'        shipping: "0.00",\n' +
'        currency: "EUR",\n' +
'        coupon: "",\n' +
'        discount_amount: "0.00",\n' +
'        items: [ item({ discount: "0.00", quantity: 1, index: 1 }) ]\n' +
'      },\n' +
'      user_data: {\n' +
'        customer_id: 0,\n' +
'        billing_first_name: "Test",\n' +
'        billing_last_name: "Lab",\n' +
'        billing_country: "ES",\n' +
'        billing_email: email,\n' +
'        new_customer: "true"\n' +
'      }\n' +
'    });\n' +
'    var p6 = $("p6"); p6.className = "pill ok"; p6.textContent = "enviado";\n' +
'  }\n' +
'\n' +
'  function pintarWebhook(res){\n' +
'    var d = res.data || {};\n' +
'    var html = "";\n' +
'    var clase = (res.http === 200 && d.ok) ? "ok" : "err";\n' +
'    html += "<div class=\\"ev-item\\"><div class=\\"hd\\"><b>POST " + esc(d.url || ENDPOINT) + "</b>";\n' +
'    html += "<span class=\\"pill " + clase + "\\">endpoint HTTP " + esc(res.http) + "</span></div></div>";\n' +
'    if (d.body) html += "<div class=\\"hd\\" style=\\"margin-bottom:4px\\">Body enviado</div><pre>" + esc(JSON.stringify(d.body, null, 2)) + "</pre>";\n' +
'    if (d.sgtm) {\n' +
'      var cs = (d.sgtm.status >= 200 && d.sgtm.status < 300) ? "ok" : "err";\n' +
'      html += "<div class=\\"hd\\" style=\\"margin-bottom:4px\\">Respuesta del sGTM <span class=\\"pill " + cs + "\\">HTTP " + esc(d.sgtm.status) + "</span></div>";\n' +
'      html += "<pre>" + esc(d.sgtm.body === "" ? "(cuerpo vacío)" : d.sgtm.body) + "</pre>";\n' +
'    }\n' +
'    if (d.error) html += "<pre>" + esc(d.error) + "</pre>";\n' +
'    $("whBox").innerHTML = html;\n' +
'    if (d.url) $("sUrl").textContent = d.url;\n' +
'  }\n' +
'\n' +
'  // ---- Historial en localStorage ----\n' +
'  function leerHist(){\n' +
'    try { return JSON.parse(localStorage.getItem(CLAVE_HIST) || "[]"); } catch (e) { return []; }\n' +
'  }\n' +
'  function guardarHist(fila){\n' +
'    var h = leerHist(); h.push(fila);\n' +
'    try { localStorage.setItem(CLAVE_HIST, JSON.stringify(h.slice(-50))); } catch (e) {}\n' +
'    pintarHist();\n' +
'  }\n' +
'  function pintarHist(){\n' +
'    var h = leerHist(); var cont = $("hist");\n' +
'    if (!h.length) { cont.innerHTML = "<p class=\\"vacio\\">Sin pedidos registrados.</p>"; return; }\n' +
'    var html = "<table><thead><tr><th>Fecha</th><th>Modo</th><th>transaction_id</th><th>cart_hash</th><th>Estado</th></tr></thead><tbody>";\n' +
'    for (var i = h.length - 1; i >= 0; i--) {\n' +
'      var f = h[i];\n' +
'      html += "<tr><td>" + esc(new Date(f.fecha).toLocaleString("es-AR")) + "</td><td>" + esc(f.modo) + "</td><td>" + esc(f.tx) + "</td><td>" + esc(f.hash) + "</td><td>" + esc(f.estado) + "</td></tr>";\n' +
'    }\n' +
'    cont.innerHTML = html + "</tbody></table>";\n' +
'  }\n' +
'  $("bCopiar").addEventListener("click", function(){\n' +
'    var h = leerHist();\n' +
'    var txt = "fecha\\tmodo\\ttransaction_id\\tcart_hash\\testado\\n";\n' +
'    for (var i = 0; i < h.length; i++) txt += h[i].fecha + "\\t" + h[i].modo + "\\t" + h[i].tx + "\\t" + h[i].hash + "\\t" + h[i].estado + "\\n";\n' +
'    var b = this; var prev = b.textContent;\n' +
'    navigator.clipboard.writeText(txt).then(function(){\n' +
'      b.textContent = "Copiado"; setTimeout(function(){ b.textContent = prev; }, 1400);\n' +
'    }).catch(function(){ b.textContent = "No se pudo copiar"; setTimeout(function(){ b.textContent = prev; }, 1800); });\n' +
'  });\n' +
'  $("bBorrar").addEventListener("click", function(){\n' +
'    try { localStorage.removeItem(CLAVE_HIST); } catch (e) {}\n' +
'    pintarHist();\n' +
'  });\n' +
'\n' +
'  // ---- Nuevo pedido: reinicia carrito y cart_hash ----\n' +
'  $("bNuevo").addEventListener("click", function(){\n' +
'    borrarHash();\n' +
'    yaCompro = false; pagando = false;\n' +
'    $("sTx").textContent = "—";\n' +
'    $("bAdd").disabled = false;\n' +
'    $("bCart").disabled = true;\n' +
'    $("bCheck").disabled = true;\n' +
'    $("bPay").disabled = true;\n' +
'    var p6 = $("p6"); p6.className = "pill"; p6.textContent = "pendiente";\n' +
'    $("whBox").innerHTML = "<p class=\\"vacio\\">Sin envíos en esta sesión.</p>";\n' +
'    push({\n' +
'      event: "view_item",\n' +
'      ecomm_pagetype: "product",\n' +
'      ecommerce: { currency: "EUR", value: "25.00", items: [ item() ] },\n' +
'      user_data: []\n' +
'    });\n' +
'  });\n' +
'\n' +
'  // Estado inicial\n' +
'  var hashActual = leerHash();\n' +
'  if (hashActual) $("sHash").textContent = hashActual;\n' +
'  pintarHist();\n' +
'})();\n' +
'</script>\n' +
'</body>\n' +
'</html>\n';
}
