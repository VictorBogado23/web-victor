# Automatización del blog

Las tareas programadas de Claude publican acá las novedades semanales:

- **Miércoles**: Google Ads (`/blog/google-ads-AAAA-MM-DD/`)
- **Viernes**: Analytics, GTM y server-side (`/blog/analytics-AAAA-MM-DD/`)

`publicar_post.py` genera la página del artículo, actualiza `/blog/`, `blog/posts.json` y el `sitemap.xml`,
y hace un solo commit en `main`. Cloudflare Pages publica la carpeta `victorbogado-web/` automáticamente.

Esta carpeta no se publica en el sitio. Para borrar un artículo: eliminá su carpeta en `victorbogado-web/blog/`,
sacá su entrada de `posts.json` y regenerá el índice con `reconstruir_indice()` (o editá `blog/index.html` a mano).
