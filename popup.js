// PAGECHECK: lógica del popup.
// Todo texto procedente de la web analizada se muestra con textContent (nunca innerHTML),
// para que una página maliciosa no pueda inyectar código en la extensión.

const $ = (id) => document.getElementById(id);

const SECCIONES = [
  { id: 'procedencia', titulo: 'Procedencia y servidor' },
  { id: 'archivos', titulo: 'Archivos y amenazas' },
  { id: 'cookies', titulo: 'Cookies' },
  { id: 'fiabilidad', titulo: 'Fiabilidad' },
  { id: 'cifrado', titulo: 'Cifrado' },
  { id: 'publicidad', titulo: 'Ventanas y publicidad' },
];

const VEREDICTOS = {
  ok: {
    icono: '✓',
    titulo: 'Sin problemas detectados',
    texto: 'Las comprobaciones básicas no muestran riesgos. Ninguna herramienta garantiza el 100 %, así que mantén la prudencia con tus datos.',
  },
  warn: {
    icono: '!',
    titulo: 'Revisar antes de continuar',
    texto: 'La conexión puede estar cifrada, pero hay aspectos que conviene revisar antes de dar datos personales.',
  },
  bad: {
    icono: '✕',
    titulo: 'Riesgos importantes',
    texto: 'Se han encontrado problemas serios. No introduzcas contraseñas, datos bancarios ni información personal.',
  },
};

// Traducción de las categorías de Google Safe Browsing a lenguaje claro
const AMENAZAS = {
  MALWARE: 'distribuye software malicioso',
  SOCIAL_ENGINEERING: 'intenta engañarte para robarte datos (phishing)',
  UNWANTED_SOFTWARE: 'instala software no deseado',
  POTENTIALLY_HARMFUL_APPLICATION: 'contiene aplicaciones potencialmente dañinas',
};

// Cabeceras de seguridad que el servidor puede activar
const CABECERAS = [
  { clave: 'hsts', nombre: 'obligar siempre a usar HTTPS' },
  { clave: 'csp', nombre: 'controlar qué scripts pueden ejecutarse' },
  { clave: 'frame', nombre: 'impedir que otros sitios copien esta página' },
  { clave: 'xcto', nombre: 'evitar que el navegador interprete archivos de forma incorrecta' },
  { clave: 'referrer', nombre: 'controlar qué información se envía al seguir enlaces' },
];

// ---------- Utilidades de interfaz ----------

function el(tag, clase, texto) {
  const e = document.createElement(tag);
  if (clase) e.className = clase;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

function estado(msg) {
  $('estado').textContent = msg || '';
}

function limpiarResultado() {
  $('resultado').hidden = true;
  $('secciones').replaceChildren();
}

function dominioBase(host) {
  return host.split('.').slice(-2).join('.');
}

// ---------- Recogida de datos ----------

// Se inyecta en la página analizada. Debe ser autocontenida (sin referencias externas).
function escaneoEnPagina() {
  const base = (h) => h.split('.').slice(-2).join('.');
  const miBase = base(location.hostname);

  // Redes publicitarias conocidas (lista orientativa)
  const REDES_PUBLICITARIAS = [
    'doubleclick.net', 'googlesyndication.com', 'googleadservices.com', 'adservice.google.com',
    'taboola.com', 'outbrain.com', 'criteo.com', 'adnxs.com', 'amazon-adsystem.com',
    'moatads.com', 'pubmatic.com', 'rubiconproject.com', 'openx.net', 'smartadserver.com',
    'media.net', 'ezoic.net', 'adform.net', 'mgid.com', 'revcontent.com',
  ];

  const activos = [];   // scripts, marcos y hojas de estilo sin cifrar
  const pasivos = [];   // imágenes, audio y vídeo sin cifrar
  const terceros = new Set();
  const redesAds = new Set();

  document
    .querySelectorAll('script[src], iframe[src], link[rel~="stylesheet"][href], img[src], audio[src], video[src], source[src]')
    .forEach((node) => {
      const valor = node.getAttribute('src') || node.getAttribute('href');
      let u;
      try { u = new URL(valor, location.href); } catch { return; }
      if (u.protocol === 'http:') {
        const critico = ['SCRIPT', 'IFRAME', 'LINK'].includes(node.tagName);
        (critico ? activos : pasivos).push(u.href);
      }
      if (u.hostname && base(u.hostname) !== miBase) terceros.add(base(u.hostname));
      const red = REDES_PUBLICITARIAS.find((d) => u.hostname === d || u.hostname.endsWith('.' + d));
      if (red) redesAds.add(red);
    });

  const formsInseguros = [...document.querySelectorAll('form')].filter((f) => {
    try {
      return new URL(f.getAttribute('action') || location.href, location.href).protocol === 'http:';
    } catch { return false; }
  }).length;

  const ejecutables = /\.(exe|msi|bat|cmd|scr|ps1|vbs|jar|apk|com|dmg|pkg)$/i;
  const descargas = [...new Set(
    [...document.querySelectorAll('a[href]')]
      .map((a) => a.href)
      .filter((h) => {
        try { return ejecutables.test(new URL(h).pathname); } catch { return false; }
      })
  )].slice(0, 20);

  // Superposiciones: elementos fijos que cubren al menos el 30 % de la pantalla
  // (avisos, pop-ups, banners de bloqueo). Y bloques con nombres típicos de anuncios.
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const area = vw * vh;
  const patronPublicidad = /(^|[\s_-])(ads?|advert\w*|sponsor\w*|popup|pop-up|interstitial)([\s_-]|$)/i;
  let superposiciones = 0;
  let elementosPublicitarios = 0;
  const nodos = document.body ? document.body.getElementsByTagName('*') : [];
  const limite = Math.min(nodos.length, 4000);
  for (let i = 0; i < limite; i++) {
    const n = nodos[i];
    const nombres = (typeof n.className === 'string' ? n.className : '') + ' ' + (n.id || '');
    if (patronPublicidad.test(nombres)) elementosPublicitarios++;
    const cs = getComputedStyle(n);
    if (cs.position === 'fixed' && cs.display !== 'none' && cs.visibility !== 'hidden') {
      const r = n.getBoundingClientRect();
      const cubierto = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0))
                     * Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      if (cubierto >= area * 0.3) superposiciones++;
    }
  }

  // Descripción de la página
  const meta = (sel) => {
    const n = document.querySelector(sel);
    return n ? (n.getAttribute('content') || '').trim().slice(0, 300) : '';
  };
  const info = {
    titulo: (document.title || '').trim().slice(0, 200),
    descripcion: meta('meta[name="description"]') || meta('meta[property="og:description"]'),
    sitio: meta('meta[property="og:site_name"]'),
    idioma: document.documentElement.lang || '',
  };

  return {
    info,
    activos: activos.length,
    pasivos: pasivos.length,
    formsInseguros,
    terceros: [...terceros],
    descargas,
    superposiciones,
    elementosPublicitarios,
    redesPublicitarias: [...redesAds],
  };
}

async function escanearPagina(tabId) {
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: escaneoEnPagina,
    });
    return result;
  } catch {
    return null;
  }
}

// Conexión real: si el certificado no es válido, fetch falla.
// Además leemos las cabeceras de seguridad del servidor.
async function comprobarConexion(url) {
  try {
    const r = await fetch(url, { method: 'GET', credentials: 'omit', cache: 'no-store', redirect: 'follow' });
    r.body?.cancel().catch(() => {});
    const h = (n) => r.headers.get(n);
    const csp = h('content-security-policy') || '';
    const origen = new URL(url).hostname;
    const final = new URL(r.url).hostname;
    return {
      ok: true,
      server: h('server'),
      cabeceras: {
        hsts: !!h('strict-transport-security'),
        csp: !!csp,
        frame: !!h('x-frame-options') || /frame-ancestors/i.test(csp),
        xcto: !!h('x-content-type-options'),
        referrer: !!h('referrer-policy'),
      },
      redirigidoA: dominioBase(final) !== dominioBase(origen) ? final : null,
    };
  } catch {
    return { ok: false, offline: !navigator.onLine };
  }
}

// IP del servidor mediante DNS over HTTPS (solo se envía el nombre del dominio)
async function resolverIP(host) {
  try {
    const r = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(host)}&type=A`);
    const j = await r.json();
    const a = (j.Answer || []).find((x) => x.type === 1);
    return a ? a.data : null;
  } catch {
    return null;
  }
}

// Fecha de registro del dominio mediante RDAP (solo se envía el nombre del dominio)
async function consultarDominio(host) {
  try {
    const r = await fetch(`https://rdap.org/domain/${dominioBase(host)}`);
    if (!r.ok) return null;
    const j = await r.json();
    const ev = (j.events || []).find((e) => e.eventAction === 'registration');
    return ev ? new Date(ev.eventDate) : null;
  } catch {
    return null;
  }
}

// Google Safe Browsing (requiere clave de API propia, configurable en Opciones)
async function comprobarSafeBrowsing(url) {
  const { apiKey } = await chrome.storage.sync.get('apiKey');
  if (!apiKey) return { configurado: false };
  try {
    const r = await fetch(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client: { clientId: 'pagecheck', clientVersion: '1.0.0' },
          threatInfo: {
            threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
            platformTypes: ['ANY_PLATFORM'],
            threatEntryTypes: ['URL'],
            threatEntries: [{ url }],
          },
        }),
      }
    );
    if (!r.ok) return { configurado: true, error: true };
    const j = await r.json();
    return { configurado: true, amenazas: (j.matches || []).map((m) => m.threatType) };
  } catch {
    return { configurado: true, error: true };
  }
}

// Búsqueda local en la lista de URLhaus guardada por background.js.
// Mira el dominio completo y sus dominios padre (la lista bloquea sitios enteros).
async function consultarURLhaus(hostname) {
  const { urlhaus } = await chrome.storage.local.get('urlhaus');
  if (!urlhaus || !urlhaus.dominios || !urlhaus.dominios.length) {
    return { disponible: false };
  }
  const conjunto = new Set(urlhaus.dominios);
  const partes = hostname.split('.');
  let coincidencia = null;
  for (let i = 0; i < partes.length - 1; i++) {
    const candidato = partes.slice(i).join('.');
    if (conjunto.has(candidato)) {
      coincidencia = candidato;
      break;
    }
  }
  return { disponible: true, coincidencia, actualizado: urlhaus.actualizado };
}

// Ajuste de Chrome para ventanas emergentes de esta web ('allow' o 'block')
async function comprobarPopups(url) {
  try {
    const { setting } = await chrome.contentSettings.popups.get({ primaryUrl: url });
    return setting;
  } catch {
    return null;
  }
}

function resumenCookies(cookies) {
  const ahora = Date.now() / 1000;
  let persistentes = 0;
  let inseguras = 0;
  let maxDias = 0;
  for (const c of cookies) {
    if (!c.session && c.expirationDate) {
      persistentes++;
      maxDias = Math.max(maxDias, Math.round((c.expirationDate - ahora) / 86400));
    }
    if (!c.secure) inseguras++;
  }
  return { total: cookies.length, persistentes, inseguras, maxDias };
}

// ---------- Construcción de los resultados en lenguaje claro ----------

function construirChequeos({ url, pagina, cookies, conexion, ip, fecha, seguridad, urlhaus, popups }) {
  const c = [];
  const add = (seccion, nivel, titulo, texto) => c.push({ seccion, nivel, titulo, texto });
  const https = url.protocol === 'https:';
  const host = url.hostname;

  // 1. Procedencia y servidor
  add('procedencia', 'info', 'Dirección de la página',
    `Estás en ${host}. Comprueba que es exactamente el sitio que buscas: los fraudes suelen usar nombres casi idénticos.`);
  add('procedencia', ip ? 'info' : 'unknown', 'Servidor',
    ip ? `Está alojada en la dirección ${ip}. Por sí solo, esto no indica si el sitio es fiable.`
       : 'No se pudo determinar la dirección del servidor.');
  if (conexion.ok) {
    add('procedencia', 'info', 'Software del servidor',
      conexion.server ? `El servidor declara usar "${conexion.server}".`
                      : 'El servidor no revela qué software utiliza. Es una buena práctica.');
    if (conexion.redirigidoA) {
      add('procedencia', 'warn', 'Te redirige a otro dominio',
        `La página te lleva a ${conexion.redirigidoA}. Comprueba que es un sitio que reconoces.`);
    } else {
      add('procedencia', 'ok', 'Sin redirecciones externas', 'Te quedas en el mismo dominio durante la visita.');
    }
  }

  // 2. Archivos y amenazas
  if (!seguridad.configurado) {
    add('archivos', 'unknown', 'Listas de amenazas de Google',
      'No activada. Añade tu clave de API de Google Safe Browsing en Opciones para comprobar esta web contra las listas de Google.');
  } else if (seguridad.error) {
    add('archivos', 'unknown', 'Listas de amenazas de Google',
      'No se pudo consultar. Revisa la clave de API en Opciones.');
  } else if (seguridad.amenazas.length) {
    const motivos = seguridad.amenazas.map((t) => AMENAZAS[t] || 'representa un riesgo');
    add('archivos', 'bad', 'Google ha marcado esta página', `Según Google, esta web ${motivos.join(' y ')}.`);
  } else {
    add('archivos', 'ok', 'Sin alertas de Google',
      'La página no aparece en las listas de amenazas de Google Safe Browsing, la misma base que usa Chrome para avisarte.');
  }

  if (!urlhaus.disponible) {
    add('archivos', 'unknown', 'Lista de URLhaus',
      'Todavía no se ha descargado la lista pública de URLhaus. La extensión la descarga sola en segundo plano; vuelve a comprobar más tarde.');
  } else {
    const fechaLista = urlhaus.actualizado
      ? new Date(urlhaus.actualizado).toLocaleString('es-ES')
      : 'desconocida';
    if (urlhaus.coincidencia) {
      add('archivos', 'bad', 'Aparece en la lista de URLhaus',
        `El dominio ${urlhaus.coincidencia} figura en la lista pública de URLhaus, que recoge sitios usados para distribuir malware. Lista del ${fechaLista}. Evita abrirla y no descargues nada de ella. Las listas comunitarias también pueden tener errores.`);
    } else {
      add('archivos', 'ok', 'No aparece en la lista de URLhaus',
        `Comprobado contra la lista del ${fechaLista}. Una web muy reciente puede no aparecer todavía.`);
    }
  }

  if (!pagina) {
    add('archivos', 'unknown', 'Programas para descargar', 'No se pudo analizar el contenido de la página.');
  } else if (pagina.descargas.length) {
    add('archivos', 'warn', 'Enlaces a programas',
      `La página ofrece ${pagina.descargas.length} enlace(s) a archivos que se ejecutan en tu PC (.exe, .msi, .bat…). Descárgalos solo si confías plenamente en el sitio y pásalos por tu antivirus.`);
  } else {
    add('archivos', 'ok', 'Sin programas para descargar',
      'No hay enlaces directos a programas ni scripts, así que no hay archivos ejecutables que revisar en esta página.');
  }
  add('archivos', 'info', 'Qué no puede comprobar',
    'PAGECHECK no descarga ni escanea archivos. Para un archivo concreto, usa siempre tu antivirus.');

  // 3. Cookies
  const ck = resumenCookies(cookies);
  if (ck.total === 0) {
    add('cookies', 'ok', 'Cookies', 'Esta página no guarda cookies en tu navegador.');
  } else {
    const dias = ck.maxDias > 0 ? ` (algunas duran hasta unos ${ck.maxDias} días)` : '';
    const detalle = `Guarda ${ck.total} cookie(s); ${ck.persistentes} permanecen aunque cierres el navegador${dias}.`;
    if (ck.inseguras > 0) {
      add('cookies', 'warn', 'Cookies sin protección',
        `${ck.inseguras} de ${ck.total} no están marcadas para enviarse solo cifradas. ${detalle}`);
    } else {
      add('cookies', 'ok', 'Cookies protegidas', `Todas las cookies se envían cifradas. ${detalle}`);
    }
  }
  if (pagina) {
    const n = pagina.terceros.length;
    if (n === 0) {
      add('cookies', 'ok', 'Sin empresas externas', 'No carga contenido de terceros, así que no hay seguimiento externo visible.');
    } else if (n < 8) {
      add('cookies', 'info', 'Algunas empresas externas',
        `La página carga contenido de ${n} dominio(s) externos. Pueden usar cookies de seguimiento.`);
    } else {
      add('cookies', 'warn', 'Muchas empresas externas',
        `La página carga contenido de ${n} dominios externos (publicidad, analítica o redes sociales). Suelen usar cookies para seguir tu actividad entre webs.`);
    }
  }

  // 4. Fiabilidad
  if (!fecha) {
    add('fiabilidad', 'unknown', 'Antigüedad del dominio', 'No se pudo consultar el registro del dominio.');
  } else {
    const meses = (Date.now() - fecha.getTime()) / (30.44 * 86400000);
    if (meses < 6) {
      add('fiabilidad', 'warn', 'Dominio muy reciente',
        `Se registró hace unos ${Math.max(1, Math.round(meses))} mes(es). Los sitios fraudulentos suelen ser recientes. No es una prueba, pero merece cautela.`);
    } else if (meses >= 24) {
      add('fiabilidad', 'ok', 'Dominio con trayectoria', `Se registró hace más de ${Math.floor(meses / 12)} años.`);
    } else {
      add('fiabilidad', 'info', 'Antigüedad del dominio', `Se registró hace unos ${Math.round(meses)} meses.`);
    }
  }

  if (!conexion.ok) {
    add('fiabilidad', 'unknown', 'Protecciones del servidor', 'No se pudieron leer las cabeceras del servidor.');
  } else {
    const cab = conexion.cabeceras;
    const presentes = CABECERAS.filter((x) => cab[x.clave]).length;
    const faltan = CABECERAS.filter((x) => !cab[x.clave]).map((x) => x.nombre);
    const nivel = presentes >= 4 ? 'ok' : presentes <= 1 ? 'warn' : 'info';
    let texto = `Tiene ${presentes} de ${CABECERAS.length} protecciones recomendadas.`;
    if (faltan.length) texto += ` No tiene: ${faltan.join('; ')}.`;
    add('fiabilidad', nivel, 'Protecciones del servidor', texto);
  }

  // 5. Cifrado
  add('cifrado', https ? 'ok' : 'bad',
    https ? 'Conexión cifrada (HTTPS)' : 'Conexión sin cifrar (HTTP)',
    https
      ? 'Los datos viajan cifrados entre tu ordenador y el servidor, así que nadie en la misma red WiFi puede leerlos fácilmente.'
      : 'Cualquiera en la misma red WiFi podría ver o modificar lo que envías y recibes. No introduzcas contraseñas ni datos bancarios.');

  if (https) {
    if (conexion.ok) {
      add('cifrado', 'ok', 'Certificado válido', 'El navegador ha conectado y ha verificado la identidad del servidor.');
    } else if (conexion.offline) {
      add('cifrado', 'unknown', 'Certificado', 'Sin conexión a Internet; no se ha podido comprobar.');
    } else {
      add('cifrado', 'bad', 'Certificado no válido o conexión rechazada',
        'No se ha podido verificar la identidad del servidor. Puede ser un sitio falsificado o estar mal configurado. No introduzcas datos.');
    }

    if (pagina) {
      if (pagina.activos > 0) {
        add('cifrado', 'warn', 'Partes sin cifrar en la página',
          `${pagina.activos} elemento(s) importantes (scripts o marcos) se cargan sin cifrar. Alguien en medio podría alterarlos.`);
      } else if (pagina.pasivos > 0) {
        add('cifrado', 'info', 'Imágenes o vídeos sin cifrar',
          `${pagina.pasivos} elemento(s) multimedia se cargan sin cifrar. Riesgo bajo.`);
      } else {
        add('cifrado', 'ok', 'Todo el contenido va cifrado', 'No se han encontrado elementos cargados sin cifrar.');
      }

      if (pagina.formsInseguros > 0) {
        add('cifrado', 'bad', 'Formularios sin cifrar',
          'Hay formularios que envían datos sin cifrar. Lo que escribas en ellos (contraseñas, tarjetas) viajaría desprotegido.');
      }
    }

    if (conexion.ok) {
      add('cifrado', conexion.cabeceras.hsts ? 'ok' : 'info', 'Refuerzo HTTPS (HSTS)',
        conexion.cabeceras.hsts
          ? 'El sitio obliga a usar siempre HTTPS, incluso si intentas entrar por HTTP.'
          : 'El sitio no obliga a usar HTTPS en futuras visitas. No es un fallo grave, pero es una mejora recomendada.');
    }
  }

  // 6. Ventanas y publicidad
  if (popups === 'allow') {
    add('publicidad', 'warn', 'Ventanas emergentes permitidas',
      'Has permitido que esta web abra ventanas emergentes. Puedes revocarlo desde el icono de la barra de direcciones o en la configuración de Chrome.');
  } else if (popups === 'block') {
    add('publicidad', 'ok', 'Ventanas emergentes bloqueadas', 'Tu navegador bloquea las ventanas emergentes de esta web.');
  } else {
    add('publicidad', 'unknown', 'Ventanas emergentes', 'No se pudo leer la configuración de Chrome para esta web.');
  }

  if (!pagina) {
    add('publicidad', 'unknown', 'Superposiciones y anuncios', 'No se pudo analizar el contenido de la página.');
  } else {
    if (pagina.superposiciones > 0) {
      add('publicidad', 'warn', 'Elementos que tapan la página',
        `Hay ${pagina.superposiciones} elemento(s) que cubren gran parte de la pantalla (avisos, pop-ups o banners). Suelen ser molestos y a veces engañosos: no pulses sobre ellos sin leer.`);
    } else {
      add('publicidad', 'ok', 'Sin ventanas que tapen la página', 'No hay avisos ni pop-ups que cubran la pantalla.');
    }

    const redes = pagina.redesPublicitarias.length;
    const bloques = pagina.elementosPublicitarios;
    if (redes >= 5 || bloques >= 10) {
      add('publicidad', 'warn', 'Publicidad muy intensiva',
        `Se detectan ${redes} redes publicitarias y ${bloques} bloque(s) con nombres de anuncio. Puede ralentizar la página y empeorar la privacidad.`);
    } else if (redes > 0 || bloques > 0) {
      add('publicidad', 'info', 'Publicidad moderada',
        `Se detectan ${redes} redes publicitarias y ${bloques} bloque(s) de anuncios.`);
    } else {
      add('publicidad', 'ok', 'Sin publicidad detectada', 'No se han encontrado anuncios conocidos en la página.');
    }
  }

  return c;
}

function nivelGeneral(chequeos) {
  const niveles = chequeos.map((x) => x.nivel);
  if (niveles.includes('bad')) return 'bad';
  if (niveles.includes('warn')) return 'warn';
  return 'ok';
}

// ---------- Render ----------

function mostrarSobre(pagina) {
  const tarjeta = $('sobre');
  if (!pagina || !pagina.info) {
    tarjeta.hidden = true;
    return;
  }
  const { titulo, descripcion, sitio, idioma } = pagina.info;
  $('sobre-titulo').textContent = titulo || 'Sin título';
  $('sobre-desc').textContent = descripcion || 'Esta página no incluye una descripción.';
  $('sobre-meta').textContent = `Idioma: ${idioma || 'no indicado'}${sitio ? ' · Sitio: ' + sitio : ''}`;
  tarjeta.hidden = false;
}

function mostrar(chequeos, pagina) {
  const nivel = nivelGeneral(chequeos);
  const v = VEREDICTOS[nivel];

  mostrarSobre(pagina);

  $('semaforo').className = `semaforo ${nivel}`;
  $('icono').textContent = v.icono;
  $('veredicto').textContent = v.titulo;
  $('resumen').textContent = v.texto;

  const cont = $('secciones');
  cont.replaceChildren();
  for (const s of SECCIONES) {
    const items = chequeos.filter((x) => x.seccion === s.id);
    if (!items.length) continue;

    const bloque = el('section', 'seccion');
    bloque.appendChild(el('h2', null, s.titulo));
    for (const it of items) {
      const fila = el('div', `item ${it.nivel}`);
      fila.appendChild(el('span', 'punto'));
      const cuerpo = el('div', 'cuerpo');
      cuerpo.appendChild(el('strong', null, it.titulo));
      cuerpo.appendChild(el('p', null, it.texto));
      fila.appendChild(cuerpo);
      bloque.appendChild(fila);
    }
    cont.appendChild(bloque);
  }
  $('resultado').hidden = false;
}

// ---------- Flujo principal ----------

async function comprobar() {
  $('btn').disabled = true;
  limpiarResultado();
  estado('Analizando la página…');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !/^https?:\/\//.test(tab.url)) {
      estado('Esta página no se puede analizar (es una página interna del navegador).');
      return;
    }

    const url = new URL(tab.url);
    $('dominio').textContent = url.hostname;

    const [pagina, cookies, conexion, ip, fecha, seguridad, popups, urlhaus] = await Promise.all([
      escanearPagina(tab.id),
      chrome.cookies.getAll({ url: tab.url }).catch(() => []),
      comprobarConexion(tab.url),
      resolverIP(url.hostname),
      consultarDominio(url.hostname),
      comprobarSafeBrowsing(tab.url),
      comprobarPopups(tab.url),
      consultarURLhaus(url.hostname),
    ]);

    mostrar(construirChequeos({ url, pagina, cookies, conexion, ip, fecha, seguridad, urlhaus, popups }), pagina);
    estado('');
  } catch (e) {
    estado(`No se pudo completar la comprobación: ${e.message}`);
  } finally {
    $('btn').disabled = false;
  }
}

$('btn').addEventListener('click', comprobar);
$('opciones').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

$('privacidad').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: chrome.runtime.getURL('privacy.html') });
});
