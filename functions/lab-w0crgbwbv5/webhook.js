// Endpoint servidor-a-servidor del laboratorio: arma y envía el webhook order_paid al sGTM,
// igual que hace el plugin "GTM Server Side" de Stape en WooCommerce.
// Sólo POST, protegido por la cookie de acceso y un nonce (double submit).

const BASE = '/lab-w0crgbwbv5/';
const COOKIE_ACCESO = 'vb_lab';
const COOKIE_NONCE = 'vb_lab_nonce';
const URL_WEBHOOK_POR_DEFECTO = 'https://gvixggkx.usu.stape.io/webhook';
const VERSION_PLUGIN = '2.3.12';
const LIMITE_POR_HORA = 10;

// Cookies que lee el plugin, en el mismo orden.
const COOKIES_FIJAS = [
  '_fbp', '_fbc', 'FPGCLAW', '_gcl_aw', 'ttclid', '_dcid', 'FPID', 'FPLC',
  '_ttp', 'FPGCLGB', 'li_fat_id', '_epik', '_scid', '_scclid', '_uetmsclkid', '_ga',
];
// Y además todas las que empiecen por estos prefijos.
const PREFIJOS = ['_ga_', 'cmplz_'];

// Ventana de envíos en memoria del isolate. Es un freno razonable, no una garantía:
// Cloudflare puede levantar varios isolates, así que el tope real puede ser algo mayor.
let ventana = [];

function leerCookies(request) {
  const crudo = request.headers.get('cookie') || '';
  const fuera = {};
  for (const parte of crudo.split(';')) {
    const i = parte.indexOf('=');
    if (i === -1) continue;
    const nombre = parte.slice(0, i).trim();
    if (nombre) fuera[nombre] = parte.slice(i + 1).trim();
  }
  return fuera;
}

function igualSeguro(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

async function derivarToken(clave) {
  const datos = new TextEncoder().encode(clave + '|vb-lab-v1');
  const hash = await crypto.subtle.digest('SHA-256', datos);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function json(cuerpo, status) {
  return new Response(JSON.stringify(cuerpo), {
    status: status || 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-robots-tag': 'noindex, nofollow',
      'cache-control': 'no-store',
    },
  });
}

function noEncontrado() {
  return new Response('Not Found', {
    status: 404,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'x-robots-tag': 'noindex, nofollow' },
  });
}

export async function onRequest(context) {
  const { request, env } = context;

  // Sólo POST. Cualquier otro método no revela que la ruta exista.
  if (request.method !== 'POST') return noEncontrado();

  const clave = env.LAB_KEY;
  if (!clave) return noEncontrado();

  const cookies = leerCookies(request);
  const token = await derivarToken(clave);

  // 1) Cookie de acceso.
  if (!igualSeguro(cookies[COOKIE_ACCESO] || '', token)) return noEncontrado();

  // 2) Nonce: la cabecera tiene que coincidir con la cookie emitida al pintar la página.
  const nonceCabecera = request.headers.get('x-lab-nonce') || '';
  const nonceCookie = cookies[COOKIE_NONCE] || '';
  if (!nonceCookie || !igualSeguro(nonceCabecera, nonceCookie)) {
    return json({ ok: false, error: 'Nonce inválido o ausente.' }, 403);
  }

  // 3) Mismo origen.
  const origen = request.headers.get('origin');
  const propio = new URL(request.url).origin;
  if (origen && origen !== propio) {
    return json({ ok: false, error: 'Origen no permitido.' }, 403);
  }

  // 4) Límite de envíos.
  const ahora = Date.now();
  ventana = ventana.filter((t) => ahora - t < 3600000);
  if (ventana.length >= LIMITE_POR_HORA) {
    return json(
      { ok: false, error: 'Límite de ' + LIMITE_POR_HORA + ' envíos por hora alcanzado. Probá más tarde.' },
      429
    );
  }

  let entrada = {};
  try {
    entrada = await request.json();
  } catch (e) {
    entrada = {};
  }
  const modo = entrada.modo === 'diferido' ? 'diferido' : 'inmediato';
  const preview = typeof entrada.preview === 'string' ? entrada.preview.trim() : '';

  const marca = Date.now();
  const transactionId = 'TEST-' + marca;
  const email = 'test-' + marca + '@example.invalid';
  const cartHash = cookies['woocommerce_cart_hash'] || '';

  // Ítem con el formato exacto del plugin: precios en string con dos decimales.
  const item = {
    item_name: 'Producto test',
    item_brand: '',
    item_id: 'test-1',
    item_sku: '',
    price: '25.00',
    imageUrl: propio + '/assets/og.png',
    item_category: 'Test',
    discount: '0.00',
    quantity: 1,
    index: 1,
  };

  const cuerpo = {
    event: 'order_paid',
    cart_hash: cartHash,
    ecommerce: {
      transaction_id: transactionId,
      affiliation: '',
      value: '25.00',
      tax: '0.00',
      shipping: '0.00',
      currency: 'EUR',
      coupon: '',
      discount_amount: '0.00',
      items: [item],
    },
    user_data: {
      customer_id: 0,
      billing_first_name: 'Test',
      billing_last_name: 'Lab',
      billing_country: 'ES',
      billing_email: email,
    },
  };

  // En "Pago inmediato" viajan las cookies del comprador, como en la request del checkout.
  // En "Pago diferido" no hay navegador detrás, así que no se envía ninguna.
  if (modo === 'inmediato') {
    const reenviadas = {};
    for (const nombre of COOKIES_FIJAS) {
      if (Object.prototype.hasOwnProperty.call(cookies, nombre)) reenviadas[nombre] = cookies[nombre];
    }
    for (const nombre of Object.keys(cookies)) {
      if (reenviadas[nombre] !== undefined) continue;
      if (PREFIJOS.some((p) => nombre.startsWith(p))) reenviadas[nombre] = cookies[nombre];
    }
    cuerpo.cookies = reenviadas;
    // El plugin manda client_id en la raíz cuando existe _dcid.
    if (reenviadas['_dcid']) cuerpo.client_id = reenviadas['_dcid'];
  }

  const destino = env.SGTM_WEBHOOK_URL || URL_WEBHOOK_POR_DEFECTO;
  const cabeceras = {
    'content-type': 'application/json',
    'cache-control': 'no-cache',
    'x-stape-app-version': VERSION_PLUGIN,
  };
  if (preview) cabeceras['x-gtm-server-preview'] = preview;

  ventana.push(ahora);

  let respuesta;
  try {
    const r = await fetch(destino, {
      method: 'POST',
      headers: cabeceras,
      body: JSON.stringify(cuerpo),
    });
    const texto = await r.text();
    respuesta = { status: r.status, body: texto.slice(0, 2000) };
  } catch (e) {
    return json(
      {
        ok: false,
        url: destino,
        modo: modo,
        transaction_id: transactionId,
        cart_hash: cartHash,
        body: cuerpo,
        error: 'No se pudo contactar al sGTM: ' + String(e),
      },
      502
    );
  }

  return json({
    ok: true,
    url: destino,
    modo: modo,
    transaction_id: transactionId,
    billing_email: email,
    cart_hash: cartHash,
    headers: cabeceras,
    body: cuerpo,
    sgtm: respuesta,
  });
}
