(function(){
  'use strict';
  var root = document.documentElement;

  // ---------- Tema claro/oscuro ----------
  var themeBtn = document.getElementById('themeBtn');
  if (themeBtn) {
    themeBtn.addEventListener('click', function(){
      var cur = root.getAttribute('data-theme') ||
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      var next = cur === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('vb-theme', next); } catch(e) {}
    });
  }

  // ---------- Menú móvil ----------
  var menuBtn = document.getElementById('menuBtn');
  var links = document.getElementById('navLinks');
  if (menuBtn && links) {
    menuBtn.addEventListener('click', function(){
      var open = links.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', String(open));
    });
    links.addEventListener('click', function(e){
      if (e.target.tagName === 'A') { links.classList.remove('open'); menuBtn.setAttribute('aria-expanded','false'); }
    });
  }

  // ---------- Formulario: Formspree + dataLayer ----------
  window.dataLayer = window.dataLayer || [];
  var FORMSPREE = 'https://formspree.io/f/mqpepryq';
  var form = document.getElementById('contactForm');
  if (!form) return;

  var msg = document.getElementById('formMsg');
  var btn = document.getElementById('submitBtn');
  var consent = document.getElementById('f-consent');

  // El botón sólo se habilita con el consentimiento tildado
  function syncBtn(){ btn.disabled = !consent.checked; }
  consent.addEventListener('change', syncBtn);
  syncBtn();

  // Teléfono a E.164: + código de país + número (sólo dígitos)
  function toE164(country, dial, raw){
    if (!raw) return '';
    var d = String(raw).replace(/\D/g, '').replace(/^00/, '');
    // Si escribió el código de país en el campo de teléfono, se quita
    if (dial && d.indexOf(dial) === 0 && d.length > dial.length + 7) d = d.slice(dial.length);
    d = d.replace(/^0+/, '');
    if (!d) return '';

    if (country === 'AR') {
      // Celulares de Argentina en E.164: +54 9 + área + número, sin el 0 ni el 15.
      if (d.length === 11 && d.charAt(0) === '9') d = d.slice(1);
      if (d.length === 12) {
        // Área (2, 3 o 4 dígitos) + 15 + abonado = 12 dígitos
        var areas = d.indexOf('11') === 0 ? [2] : [3, 4, 2];
        for (var i = 0; i < areas.length; i++) {
          var a = areas[i];
          if (d.substr(a, 2) === '15') { d = d.slice(0, a) + d.slice(a + 2); break; }
        }
      }
      // Área + abonado siempre suman 10 dígitos. Se asume celular (WhatsApp).
      if (d.length === 10) return '+549' + d;
      return '+54' + d;
    }
    return '+' + dial + d;
  }

  form.addEventListener('submit', function(e){
    e.preventDefault();
    if (!consent.checked) return;

    var sel = form.pais_codigo;
    var dial = sel.options[sel.selectedIndex].getAttribute('data-dial') || '';
    var svcSel = form.servicio;
    var phone = toE164(sel.value, dial, form.telefono.value);

    var payload = {
      nombre: form.nombre.value.trim(),
      apellido: form.apellido.value.trim(),
      empresa: form.empresa.value.trim(),
      email: form.email.value.trim(),
      pais: sel.value,
      codigo_pais: dial ? '+' + dial : '',
      telefono: form.telefono.value.trim(),
      telefono_e164: phone,
      servicio: svcSel ? svcSel.value : '',
      mensaje: form.mensaje.value.trim(),
      pagina: location.pathname,
      consentimiento: 'si',
      _subject: 'Consulta web · ' + ((form.nombre.value.trim() + ' ' + form.apellido.value.trim()).trim() || 'sin nombre')
    };

    btn.disabled = true;
    var prev = btn.innerHTML;
    btn.textContent = 'Enviando…';

    fetch(FORMSPREE, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function(r){
      if (!r.ok) throw new Error('Formspree ' + r.status);
      window.dataLayer.push({
        event: 'form_submit',
        form_name: 'contacto_web',
        form_service: payload.servicio,
        form_location: payload.pagina,
        form_data: {
          nombre: payload.nombre,
          apellido: payload.apellido,
          email: payload.email,
          phone: payload.telefono_e164,
          country: payload.pais,
          empresa: payload.empresa
        }
      });
      form.reset();
      syncBtn();
      btn.innerHTML = prev;
      msg.className = 'form-msg ok';
      msg.textContent = '¡Gracias! Tu consulta se envió. Te respondo dentro de las 24 horas hábiles.';
    }).catch(function(){
      btn.disabled = false;
      btn.innerHTML = prev;
      msg.className = 'form-msg err';
      msg.textContent = 'No se pudo enviar. Probá de nuevo o escribime a contacto@victorbogado.cloud';
    });
  });
})();
