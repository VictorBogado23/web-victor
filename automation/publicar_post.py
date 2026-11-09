# -*- coding: utf-8 -*-
"""
Publicador del blog de victorbogado.cloud (repo VictorBogado23/web-victor).

Lo usan las tareas programadas de Claude (miércoles: Google Ads, viernes: Analytics/GTM)
desde el workbench de Composio. Cloudflare Pages publica solo cuando entra el commit en main.

Uso en el workbench de Composio (donde existe run_composio_tool):

    src = <contenido de automation/publicar_post.py leído del repo>
    exec(src, globals())
    res = publicar({
        "slug": "google-ads-2026-11-04",            # [a-z0-9-], único
        "titulo": "Novedades de Google Ads: ...",
        "descripcion": "Resumen de 150-160 caracteres para Google y redes.",
        "categoria": "Google Ads",                  # o "Analytics y GTM"
        "fecha": "2026-11-04",                      # YYYY-MM-DD (hora Argentina)
        "contenido_html": "<p>...</p><h2>...</h2>...",  # cuerpo del artículo
    })
    print(res)   # {"ok": True, "url": "...", "commit_url": "..."}

publicar(..., dry_run=True) arma todo sin commitear y devuelve los archivos generados.
"""
import base64, html, io, json, re, glob

OWNER, REPO, BRANCH = "VictorBogado23", "web-victor", "main"
WEB = "victorbogado-web"           # carpeta que publica Cloudflare Pages
SITE = "https://victorbogado.cloud"
MANIFEST = WEB + "/blog/posts.json"
SITEMAP = WEB + "/sitemap.xml"
CATEGORIAS = {"Google Ads": "google-ads", "Analytics y GTM": "analytics"}
MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
         "septiembre", "octubre", "noviembre", "diciembre"]

# ---------------------------------------------------------------- backend (GitHub vía Composio)

def _unwrap(res):
    return res[0] if isinstance(res, tuple) else res

def leer(path):
    """Devuelve el texto del archivo en main, o None si no existe."""
    res, err = run_composio_tool("GITHUB_GET_REPOSITORY_CONTENT",
                                 {"owner": OWNER, "repo": REPO, "path": path, "ref": BRANCH})
    if err:
        if "404" in str(err) or "Not Found" in str(err):
            return None
        raise RuntimeError("No pude leer %s: %s" % (path, err))
    data = (_unwrap(res) or {}).get("data", {})
    c = data.get("content", data)
    if isinstance(c, dict) and "content" in c:
        b64 = re.sub(r"\s+", "", str(c["content"]))
        return base64.b64decode(b64 + "=" * (-len(b64) % 4)).decode("utf-8")
    if isinstance(c, list):
        raise RuntimeError("%s es una carpeta" % path)
    return None

def commitear(archivos, mensaje):
    res, err = run_composio_tool("GITHUB_COMMIT_MULTIPLE_FILES", {
        "owner": OWNER, "repo": REPO, "branch": BRANCH, "message": mensaje,
        "upserts": [{"path": p, "content": c, "encoding": "utf-8"} for p, c in archivos.items()],
    })
    if err:
        raise RuntimeError("Falló el commit: %s" % err)
    data = (_unwrap(res) or {}).get("data", {})
    return data.get("commit_url") or (data.get("commit") or {}).get("html_url", "")

# ---------------------------------------------------------------- utilidades

def esc(s):
    return html.escape(str(s), quote=True)

def fecha_legible(iso):
    y, m, d = [int(x) for x in iso.split("-")]
    return "%d de %s de %d" % (d, MESES[m - 1], y)

def fecha_corta(iso):
    y, m, d = [int(x) for x in iso.split("-")]
    return "%d %s %d" % (d, MESES[m - 1][:3], y)

def minutos_lectura(contenido):
    palabras = len(re.sub(r"<[^>]+>", " ", contenido).split())
    return max(1, round(palabras / 200))

def titulo_seo(titulo, sufijo=" · Blog de Victor Bogado", limite=60):
    """Agrega el sufijo de marca sólo si entra dentro del límite recomendado
    para el <title> (si no, se corta en los resultados de Google)."""
    return titulo + sufijo if len(titulo) + len(sufijo) <= limite else titulo

LOGO = ('<svg viewBox="0 0 120 120" width="{w}" height="{w}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
        '<defs><linearGradient id="{id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1E4FD8"/>'
        '<stop offset="1" stop-color="#06B6D4"/></linearGradient></defs><rect width="120" height="120" rx="28" fill="url(#{id})"/>'
        '<text x="60" y="63" text-anchor="middle" dominant-baseline="central" font-family="Sora,Arial,sans-serif" '
        'font-weight="600" font-size="52" letter-spacing="-2" fill="#fff">VB</text></svg>')

# ---------------------------------------------------------------- imagen og:image por post

def _fuente(bold=True):
    patrones = ["*ejavuSans-Bold*.ttf"] if bold else ["*ejavuSans.ttf"]
    for pat in patrones:
        hits = glob.glob("/usr/share/fonts/**/%s" % pat, recursive=True)
        if hits:
            return hits[0]
    hits = glob.glob("/usr/share/fonts/**/*.ttf", recursive=True)
    return hits[0] if hits else None

def _envolver(draw, texto, fuente, ancho_max):
    palabras, lineas, actual = texto.split(), [], ""
    for w in palabras:
        prueba = (actual + " " + w).strip()
        if draw.textlength(prueba, font=fuente) <= ancho_max:
            actual = prueba
        else:
            if actual:
                lineas.append(actual)
            actual = w
    if actual:
        lineas.append(actual)
    return lineas

def generar_og(titulo, categoria):
    """Genera el og:image 1200x630 de un post con el lenguaje visual del sitio
    (fondo navy, badge VB con gradiente azul-cian, titulo del post). Devuelve bytes
    PNG, o None si Pillow/las fuentes no estan disponibles (no bloquea la publicacion:
    el post se publica igual con el og.png generico del sitio)."""
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        return None
    fb, fr = _fuente(True), _fuente(False)
    if not fb or not fr:
        return None
    W, H = 1200, 630
    img = Image.new("RGB", (W, H), (10, 22, 40))
    for r, alpha in [(520, 18), (380, 26), (260, 34)]:
        glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        gd = ImageDraw.Draw(glow)
        cx, cy = W - 120, 80
        gd.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(6, 182, 212, alpha))
        img = Image.alpha_composite(img.convert("RGBA"), glow).convert("RGB")
    draw = ImageDraw.Draw(img, "RGBA")

    bs = 56
    badge = Image.new("RGBA", (bs, bs), (0, 0, 0, 0))
    px = badge.load()
    c1, c2 = (0x1E, 0x4F, 0xD8), (0x06, 0xB6, 0xD4)
    for y in range(bs):
        for x in range(bs):
            t = (x + y) / (2 * (bs - 1))
            px[x, y] = (int(c1[0] + (c2[0] - c1[0]) * t), int(c1[1] + (c2[1] - c1[1]) * t),
                        int(c1[2] + (c2[2] - c1[2]) * t), 255)
    mascara = Image.new("L", (bs, bs), 0)
    ImageDraw.Draw(mascara).rounded_rectangle([0, 0, bs - 1, bs - 1], radius=13, fill=255)
    badge.putalpha(mascara)
    img.paste(badge, (72, 64), badge)
    draw = ImageDraw.Draw(img, "RGBA")
    f_vb = ImageFont.truetype(fb, 24)
    bbox = draw.textbbox((0, 0), "VB", font=f_vb)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text((72 + bs / 2 - tw / 2 - bbox[0], 64 + bs / 2 - th / 2 - bbox[1]), "VB", font=f_vb, fill=(255, 255, 255, 255))

    draw.text((144, 70), "Victor Bogado", font=ImageFont.truetype(fb, 24), fill=(255, 255, 255, 255))
    draw.text((144, 102), "BLOG \u00b7 TRACKING Y GOOGLE ADS", font=ImageFont.truetype(fr, 15), fill=(140, 160, 190, 255))

    f_pill = ImageFont.truetype(fb, 17)
    ptxt = categoria.upper()
    pad_x, pad_y = 18, 10
    pbbox = draw.textbbox((0, 0), ptxt, font=f_pill)
    pw, ph = pbbox[2] - pbbox[0], pbbox[3] - pbbox[1]
    px0, py0 = 72, 170
    draw.rounded_rectangle([px0, py0, px0 + pw + pad_x * 2, py0 + ph + pad_y * 2],
                            radius=(ph + pad_y * 2) // 2, outline=(6, 182, 212, 200), width=2, fill=(6, 182, 212, 30))
    draw.text((px0 + pad_x - pbbox[0], py0 + pad_y - pbbox[1]), ptxt, font=f_pill, fill=(100, 220, 235, 255))

    f_tit = ImageFont.truetype(fb, 58)
    ty = 250
    for linea in _envolver(draw, titulo, f_tit, W - 144)[:4]:
        draw.text((72, ty), linea, font=f_tit, fill=(255, 255, 255, 255))
        ty += 70

    f_dom = ImageFont.truetype(fr, 20)
    dtxt = "victorbogado.cloud"
    dbbox = draw.textbbox((0, 0), dtxt, font=f_dom)
    draw.text((W - 72 - (dbbox[2] - dbbox[0]), H - 72), dtxt, font=f_dom, fill=(150, 170, 200, 255))

    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()

def commitear_binario(path, data_bytes, mensaje):
    content_b64 = base64.b64encode(data_bytes).decode()
    res, err = run_composio_tool("GITHUB_CREATE_OR_UPDATE_FILE_CONTENTS", {
        "owner": OWNER, "repo": REPO, "path": path, "message": mensaje, "content": content_b64,
    })
    if err:
        raise RuntimeError("Fall\u00f3 el commit de %s: %s" % (path, err))
    data = (_unwrap(res) or {}).get("data", {})
    return (data.get("content") or {}).get("html_url", "")

def pagina(titulo, descripcion, url, og_type, jsonld, cuerpo, imagen_og=None):
    return """<!DOCTYPE html>
<html lang="es-AR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s);j.async=true;j.src="https://elemental.victorbogado.cloud/7hykymxot.js?"+i;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','l=HQtFKi0mVF0%%2BW0FaKDgtTgJSSkNITR0GSRkRDg0ECwobCBkJFkUaBBsaHA%%3D%%3D');</script>
<!-- End Google Tag Manager -->
<!-- Google Tag Manager (GTM-5NWBD8WC) -->
<script async src="https://www.googletagmanager.com/gtm.js?id=GTM-5NWBD8WC"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
</script>
<!-- End Google Tag Manager (GTM-5NWBD8WC) -->
<title>%(t)s</title>
<meta name="description" content="%(d)s">
<link rel="canonical" href="%(u)s">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta name="author" content="Victor Bogado">
<meta property="og:type" content="%(og)s">
<meta property="og:site_name" content="Victor Bogado">
<meta property="og:locale" content="es_AR">
<meta property="og:url" content="%(u)s">
<meta property="og:title" content="%(t)s">
<meta property="og:description" content="%(d)s">
<meta property="og:image" content="%(img)s">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0A1628">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/favicon-180.png">
<link rel="alternate" type="application/feed+json" title="Blog de Victor Bogado" href="/blog/posts.json">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/styles.css">
<script>try{var t=localStorage.getItem('vb-theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}</script>
<script type="application/ld+json">
%(ld)s
</script>
</head>
<body>
<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://elemental.victorbogado.cloud/ns.html?id=GTM-5J497QST" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->
<a class="skip" href="#main">Saltar al contenido</a>
<nav class="nav" aria-label="Principal">
  <div class="wrap">
    <a class="brand" href="/" aria-label="Victor Bogado, inicio">%(logo_nav)s
      <span><span class="nm">Victor Bogado</span><span class="rl">TRACKING · GOOGLE ADS</span></span></a>
    <div class="nav-links" id="navLinks"><a href="/gtm-server-side/">GTM Server-Side</a><a href="/stape/">Stape</a><a href="/api-conversiones-meta/">Meta CAPI</a><a href="/google-ads/">Google Ads</a><a href="/google-analytics-4/">GA4</a><a href="/blog/" aria-current="page">Blog</a><a href="/contacto/" class="nav-cta">Contactar</a></div>
    <div class="nav-tools">
      <button class="icon-btn" id="themeBtn" type="button" aria-label="Cambiar tema claro u oscuro">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
      </button>
      <button class="icon-btn menu-btn" id="menuBtn" type="button" aria-label="Abrir menú" aria-expanded="false" aria-controls="navLinks">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
      </button>
    </div>
  </div>
</nav>
<main id="main">
%(cuerpo)s
<section class="alt"><div class="wrap blog-cta">
  <div><p class="eyebrow">¿Tu medición está al día?</p>
  <h2 class="title">Revisemos tu cuenta y tu tracking</h2>
  <p class="lead">Si alguna de estas novedades te afecta y no sabés por dónde empezar, contame qué usás y lo vemos.</p></div>
  <div class="cta-row"><a href="/contacto/" class="btn primary">Contactar <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a></div>
</div></section>
</main>
<footer>
  <div class="wrap">
    <div class="fgrid">
      <div>
        <a class="brand" href="/">%(logo_foot)s<span><span class="nm">Victor Bogado</span><span class="rl">TRACKING · GOOGLE ADS</span></span></a>
        <p>Consultor de medición y Google Ads. Implemento tracking server-side con Stape para que tus campañas optimicen con datos completos.</p>
      </div>
      <div><h2>Servicios</h2><ul><li><a href="/gtm-server-side/">GTM Server-Side</a></li><li><a href="/stape/">Implementación de Stape</a></li><li><a href="/api-conversiones-meta/">API de Conversiones de Meta</a></li><li><a href="/conversiones-mejoradas/">Conversiones mejoradas</a></li><li><a href="/google-tag-manager/">Google Tag Manager</a></li><li><a href="/google-analytics-4/">Google Analytics 4</a></li><li><a href="/google-ads/">Google Ads</a></li></ul></div>
      <div><h2>Contacto</h2><ul>
        <li><a href="/contacto/">Formulario de contacto</a></li>
        <li><a href="/blog/">Blog: novedades semanales</a></li>
        <li><span style="font-family:var(--font-mono);font-size:13.5px;color:var(--muted)">contacto@victorbogado.cloud</span></li>
      </ul></div>
    </div>
    <div class="fbottom"><span>© %(anio)s Victor Bogado</span><span>GTM Server-Side · Stape · Google Ads · GA4</span></div>
  </div>
</footer>
<script src="/assets/main.js" defer></script>
</body>
</html>
""" % {"t": esc(titulo), "d": esc(descripcion), "u": url, "og": og_type, "site": SITE,
       "img": imagen_og or (SITE + "/assets/og.png"),
       "ld": json.dumps(jsonld, ensure_ascii=False, indent=1).replace("</", "<\\/"),
       "logo_nav": LOGO.format(w=40, id="lg-nav"), "logo_foot": LOGO.format(w=34, id="lg-foot"),
       "cuerpo": cuerpo, "anio": "2026"}

AUTOR = {"@type": "Person", "name": "Victor Bogado", "url": SITE + "/"}

# ---------------------------------------------------------------- páginas

def html_post(p, otros, imagen_url=None):
    url = "%s/blog/%s/" % (SITE, p["slug"])
    img_url = imagen_url or (SITE + "/assets/og.png")
    ld = {"@context": "https://schema.org", "@graph": [
        {"@type": "BlogPosting", "headline": p["titulo"], "description": p["descripcion"],
         "datePublished": p["fecha"], "dateModified": p["fecha"], "inLanguage": "es-AR",
         "articleSection": p["categoria"], "mainEntityOfPage": url, "url": url,
         "image": img_url, "author": AUTOR,
         "publisher": {"@type": "Person", "name": "Victor Bogado"}},
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Inicio", "item": SITE + "/"},
            {"@type": "ListItem", "position": 2, "name": "Blog", "item": SITE + "/blog/"},
            {"@type": "ListItem", "position": 3, "name": p["titulo"], "item": url}]}]}
    rel = ""
    if otros:
        rel = ('<section><div class="wrap"><p class="eyebrow">Ediciones anteriores</p>'
               '<h2 class="title">Seguí leyendo</h2><div class="related">%s</div></div></section>') % "".join(
            '<a href="/blog/%s/"><b>%s</b><span>%s · %s</span></a>' % (
                o["slug"], esc(o["titulo"]), esc(o["categoria"]), fecha_corta(o["fecha"])) for o in otros[:3])
    cuerpo = """<header class="page-hero post-hero">
  <div class="wrap">
    <div>
      <p class="crumbs"><a href="/">Inicio</a><span aria-hidden="true">/</span><a href="/blog/">Blog</a><span aria-hidden="true">/</span><span>%(cat)s</span></p>
      <p class="eyebrow">%(cat)s · Novedades semanales</p>
      <h1>%(t)s</h1>
      <p class="lead">%(d)s</p>
      <p class="post-meta"><time datetime="%(f)s">%(fl)s</time><span aria-hidden="true">·</span><span>%(min)d min de lectura</span><span aria-hidden="true">·</span><span>Por Victor Bogado</span></p>
    </div>
  </div>
</header>
<section class="alt"><div class="wrap"><article class="prose post-body">
%(c)s
<p class="post-nota">Este resumen se arma cada semana con fuentes oficiales de Google y medios especializados. Los enlaces llevan a la fuente original.</p>
<p><a href="/blog/">← Ver todas las ediciones</a></p>
</article></div></section>
%(rel)s""" % {"cat": esc(p["categoria"]), "t": esc(p["titulo"]), "d": esc(p["descripcion"]), "f": p["fecha"],
             "fl": fecha_legible(p["fecha"]), "min": p.get("minutos", 1), "c": p["contenido_html"], "rel": rel}
    return pagina(titulo_seo(p["titulo"]), p["descripcion"], url, "article", ld, cuerpo, imagen_og=img_url).replace(
        '<a href="/blog/" aria-current="page">Blog</a>', '<a href="/blog/">Blog</a>', 1)

def html_blog(posts):
    url = SITE + "/blog/"
    titulo = "Blog: novedades de Google Ads, GTM y GA4"
    desc = ("Cada semana, lo que cambió en Google Ads, Google Tag Manager, server-side y GA4, "
            "explicado en español y con lo que tenés que hacer.")
    ld = {"@context": "https://schema.org", "@graph": [
        {"@type": "Blog", "name": "Blog de Victor Bogado", "url": url, "description": desc,
         "inLanguage": "es-AR", "author": AUTOR,
         "blogPost": [{"@type": "BlogPosting", "headline": p["titulo"], "datePublished": p["fecha"],
                       "url": "%s/blog/%s/" % (SITE, p["slug"])} for p in posts[:20]]},
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Inicio", "item": SITE + "/"},
            {"@type": "ListItem", "position": 2, "name": "Blog", "item": url}]}]}
    if posts:
        filtros = '<div class="post-filtros" role="group" aria-label="Filtrar por tema"><button type="button" aria-pressed="true" data-cat="">Todo</button>%s</div>' % "".join(
            '<button type="button" aria-pressed="false" data-cat="%s">%s</button>' % (v, esc(k)) for k, v in CATEGORIAS.items())
        tarjetas = "".join(
            '<a class="post-card" href="/blog/%(s)s/" data-cat="%(cs)s"><span class="post-meta"><span class="tag">%(c)s</span>'
            '<time datetime="%(f)s">%(fc)s</time></span><b>%(t)s</b><span class="ex">%(d)s</span><span class="more">Leer edición →</span></a>' % {
                "s": p["slug"], "cs": CATEGORIAS.get(p["categoria"], "otros"), "c": esc(p["categoria"]),
                "f": p["fecha"], "fc": fecha_corta(p["fecha"]), "t": esc(p["titulo"]), "d": esc(p["descripcion"])}
            for p in posts)
        lista = filtros + '<div class="post-list" id="postList">%s</div>' % tarjetas + """
<script>(function(){var b=document.querySelectorAll('.post-filtros button'),c=document.querySelectorAll('.post-card');
b.forEach(function(x){x.addEventListener('click',function(){var k=x.getAttribute('data-cat');
b.forEach(function(y){y.setAttribute('aria-pressed',String(y===x))});
c.forEach(function(z){z.hidden=!!k&&z.getAttribute('data-cat')!==k})})})})();</script>"""
    else:
        lista = ('<div class="post-vacio"><b>La primera edición sale este miércoles.</b>'
                 '<span>Los miércoles publico las novedades de Google Ads y los viernes las de Analytics, GTM y server-side.</span></div>')
    cuerpo = """<header class="page-hero blog-hero">
  <div class="wrap">
    <div>
      <p class="crumbs"><a href="/">Inicio</a><span aria-hidden="true">/</span><span>Blog</span></p>
      <p class="eyebrow">Blog</p>
      <h1>Novedades de <span class="hl">Google Ads, GTM y GA4</span></h1>
      <p class="lead">Cada semana reviso los anuncios oficiales de Google y los medios especializados, y te cuento qué cambió y qué conviene hacer. Miércoles: Google Ads. Viernes: Analytics, Tag Manager y server-side.</p>
    </div>
  </div>
</header>
<section class="alt"><div class="wrap">
%s
</div></section>""" % lista
    return pagina(titulo + " · Victor Bogado", desc, url, "website", ld, cuerpo)

def sitemap_actualizado(xml, posts):
    xml = re.sub(r"\s*<url><loc>%s/blog/[^<]*</loc>.*?</url>" % re.escape(SITE), "", xml, flags=re.S)
    hoy = posts[0]["fecha"] if posts else "2026-11-02"
    filas = ['<url><loc>%s/blog/</loc><lastmod>%s</lastmod><priority>0.7</priority></url>' % (SITE, hoy)]
    filas += ['<url><loc>%s/blog/%s/</loc><lastmod>%s</lastmod><priority>0.6</priority></url>' % (
        SITE, p["slug"], p["fecha"]) for p in posts]
    return xml.replace("</urlset>", "\n".join(filas) + "\n</urlset>")

# ---------------------------------------------------------------- API pública

def validar(p):
    for k in ("slug", "titulo", "descripcion", "categoria", "fecha", "contenido_html"):
        if not str(p.get(k, "")).strip():
            raise ValueError("Falta el campo '%s'" % k)
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", p["slug"]):
        raise ValueError("slug inválido: %r" % p["slug"])
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", p["fecha"]):
        raise ValueError("fecha inválida (usar YYYY-MM-DD): %r" % p["fecha"])
    if p["categoria"] not in CATEGORIAS:
        raise ValueError("categoria debe ser una de %s" % list(CATEGORIAS))
    if re.search(r"<\s*(script|iframe|style|html|body|head)\b", p["contenido_html"], re.I):
        raise ValueError("contenido_html no puede tener <script>, <iframe>, <style> ni documento completo")

def armar(p, posts_previos):
    validar(p)
    p = dict(p)
    p["minutos"] = minutos_lectura(p["contenido_html"])
    entrada = {k: p[k] for k in ("slug", "titulo", "descripcion", "categoria", "fecha", "minutos")}
    posts = [x for x in posts_previos if x["slug"] != p["slug"]] + [entrada]
    posts.sort(key=lambda x: (x["fecha"], x["slug"]), reverse=True)
    otros = [x for x in posts if x["slug"] != p["slug"]]
    return p, posts, otros

def publicar(post, dry_run=False):
    previos = json.loads(leer(MANIFEST) or "[]")
    p, posts, otros = armar(post, previos)
    og_bytes = generar_og(p["titulo"], p["categoria"])
    img_url = ("%s/blog/%s/og.png" % (SITE, p["slug"])) if og_bytes else None
    archivos = {
        "%s/blog/%s/index.html" % (WEB, p["slug"]): html_post(p, otros, imagen_url=img_url),
        WEB + "/blog/index.html": html_blog(posts),
        MANIFEST: json.dumps(posts, ensure_ascii=False, indent=1) + "\n",
        SITEMAP: sitemap_actualizado(leer(SITEMAP), posts),
    }
    url = "%s/blog/%s/" % (SITE, p["slug"])
    if dry_run:
        return {"ok": True, "dry_run": True, "url": url, "archivos": archivos,
                "og_image_bytes": len(og_bytes) if og_bytes else 0}
    img_commit_url = None
    if og_bytes:
        img_commit_url = commitear_binario(
            "%s/blog/%s/og.png" % (WEB, p["slug"]), og_bytes, "Blog: og:image de %s" % p["titulo"])
    commit_url = commitear(archivos, "Blog: %s" % p["titulo"])
    return {"ok": True, "url": url, "commit_url": commit_url, "og_image_commit_url": img_commit_url}

def reconstruir_indice(dry_run=False):
    """Regenera /blog/ y el sitemap desde posts.json (sin publicar un post nuevo)"""
    posts = json.loads(leer(MANIFEST) or "[]")
    archivos = {WEB + "/blog/index.html": html_blog(posts),
                MANIFEST: json.dumps(posts, ensure_ascii=False, indent=1) + "\n",
                SITEMAP: sitemap_actualizado(leer(SITEMAP), posts)}
    if dry_run:
        return archivos
    return commitear(archivos, "Blog: regenerar índice")
