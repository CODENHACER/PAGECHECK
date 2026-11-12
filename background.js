// PAGECHECK: service worker.
// Descarga la lista pública de dominios de URLhaus (abuse.ch, CC0) y la guarda en el navegador.
// La comprobación posterior se hace en local, por lo que ninguna URL de navegación sale del equipo.

const ALARMA = 'urlhaus-actualizacion';
const PERIODO_MIN = 360;                 // se actualiza cada 6 horas
const ANTIGUEDAD_MAX_MS = 6 * 3600 * 1000;
const MINIMO_DOMINIOS = 100;             // evita guardar una respuesta de error como si fuera la lista

// Mirrors del proyecto curbengh/urlhaus-filter (versión lite: solo URLs activas).
// Si el primero falla, se prueba el segundo.
const FUENTES = [
  'https://malware-filter.pages.dev/urlhaus-filter-hosts-online.txt',
  'https://curbengh.github.io/urlhaus-filter/urlhaus-filter-hosts-online.txt',
];

// Acepta tanto formato hosts ("0.0.0.0 dominio") como lista de dominios simple.
function parsearLista(texto) {
  const dominios = new Set();
  for (const linea of texto.split('\n')) {
    const l = linea.trim();
    if (!l || l.startsWith('#') || l.startsWith('!')) continue;
    const partes = l.split(/\s+/);
    const candidato = /^(0\.0\.0\.0|127\.0\.0\.1)$/.test(partes[0]) ? partes[1] : partes[0];
    if (candidato && candidato.includes('.') && /^[a-z0-9.-]+$/i.test(candidato)) {
      dominios.add(candidato.toLowerCase());
    }
  }
  return [...dominios];
}

async function actualizarLista() {
  for (const url of FUENTES) {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) continue;
      const dominios = parsearLista(await r.text());
      if (dominios.length < MINIMO_DOMINIOS) continue;
      await chrome.storage.local.set({
        urlhaus: { dominios, actualizado: new Date().toISOString(), fuente: url },
      });
      return true;
    } catch {
      // se prueba la siguiente fuente
    }
  }
  return false;
}

// Descarga solo si no hay datos o si la copia guardada es antigua
async function asegurarListaActualizada() {
  const { urlhaus } = await chrome.storage.local.get('urlhaus');
  const antigua = !urlhaus || Date.now() - new Date(urlhaus.actualizado).getTime() > ANTIGUEDAD_MAX_MS;
  if (antigua) await actualizarLista();
}

function programarAlarma() {
  chrome.alarms.create(ALARMA, { periodInMinutes: PERIODO_MIN });
}

chrome.runtime.onInstalled.addListener(() => {
  programarAlarma();
  asegurarListaActualizada();
});

chrome.runtime.onStartup.addListener(() => {
  programarAlarma();
  asegurarListaActualizada();
});

chrome.alarms.onAlarm.addListener((alarma) => {
  if (alarma.name === ALARMA) actualizarLista();
});
