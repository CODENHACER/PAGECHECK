# Política de privacidad de PAGECHECK

Última actualización: 12 de noviembre de 2026

PAGECHECK es una extensión de Chrome que comprueba la seguridad de la página que tienes abierta en la pestaña activa cuando tú pulsas el botón "Comprobar esta página".

## Qué datos se procesan

- **Análisis local**: PAGECHECK lee en tu navegador la estructura de la página activa (enlaces, formularios, recursos cargados, título y descripción) y la lista de cookies asociadas a esa web. Este análisis se hace en tu equipo.
- **Cabeceras de seguridad**: PAGECHECK solicita la página una vez para leer sus cabeceras de seguridad. No guarda su contenido.
- **Clave de API (opcional)**: si la introduces en Opciones, se guarda en el almacenamiento de sincronización de Chrome y solo se usa para consultar Google Safe Browsing.

## Qué datos se envían a terceros

Para completar algunas comprobaciones, PAGECHECK envía datos a los siguientes servicios. Cada uno aplica su propia política de privacidad:

- **Google Safe Browsing** (solo si has añadido una clave de API): se envía la dirección completa de la página que analizas, para saber si aparece en las listas de amenazas.
- **Google DNS over HTTPS** (dns.google): se envía el nombre del dominio para obtener la dirección IP del servidor.
- **RDAP (rdap.org)**: se envía el nombre del dominio para obtener la fecha de registro.

- **Lista de URLhaus**: cada 6 horas, PAGECHECK descarga en segundo plano una lista pública de dominios desde GitHub Pages (mirror de curbengh/urlhaus-filter). Esa descarga no contiene datos tuyos. Como con cualquier servidor web, el proveedor de alojamiento puede registrar la dirección IP de la petición según su propia política. La comprobación de tus páginas se hace después en tu equipo, sin enviar la URL a nadie.

PAGECHECK no envía a estos servicios tu historial de navegación, cookies ni el contenido de las páginas.

## Qué no hacemos

- No vendemos datos personales ni los cedemos a terceros con fines de publicidad.
- No usamos los datos para mostrarte anuncios ni para perfilarte.
- No tenemos servidores propios: no almacenamos ningún dato fuera de tu navegador.
- No usamos analítica ni rastreadores dentro de la extensión.

## Permisos y su uso

- `cookies`: leer las cookies de la página activa para informarte sobre ellas.
- `scripting`: ejecutar el análisis de la página activa cuando pulsas el botón.
- `storage`: guardar la clave de API opcional en tu navegador.
- `contentSettings`: leer si tu navegador permite ventanas emergentes en la página activa.
- `alarms`: programar la actualización de la lista de URLhaus cada 6 horas.
- `<all_urls>`: necesario para analizar cualquier página que tú decidas comprobar.

## Tus opciones

Puedes eliminar la clave de API desde Opciones en cualquier momento y desinstalar la extensión desde `chrome://extensions`, lo que borra todos sus datos locales.

## Contacto

Para cualquier consulta sobre esta política, escribe a: noticiasbuenas2024@gmail.com
