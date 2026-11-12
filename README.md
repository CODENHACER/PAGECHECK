# PAGECHECK

Extensión de Chrome que comprueba la seguridad de la página activa con un clic y lo explica en lenguaje claro: semáforo verde, naranja o rojo, procedencia y servidor, archivos y amenazas, cookies, fiabilidad, cifrado y agresividad de ventanas emergentes y publicidad.

## Instalación en modo desarrollador (Windows 11, Chrome)

1. Descarga o clona este repositorio.
2. Abre `chrome://extensions`.
3. Activa el **Modo de desarrollador**.
4. Pulsa **Cargar descomprimida** y selecciona la carpeta del proyecto (la que contiene `manifest.json`).
5. Fija el icono de PAGECHECK en la barra de Chrome.

Opcional: en **Opciones** puedes añadir una clave de API de Google Safe Browsing para activar la comprobación contra las listas de amenazas de Google.

## Estructura

```
manifest.json   Configuración de la extensión (Manifest V3)
popup.html/css  Interfaz del popup
background.js    Service worker: descarga la lista de URLhaus
popup.js        Comprobaciones y lógica de presentación
options.html/js Página de opciones (clave de API)
icons/          Iconos 16, 48 y 128 px
privacy.html   Política de privacidad (generada desde PRIVACY.md)
PRIVACY.md      Fuente de la política de privacidad
```

## Permisos y justificación (para Chrome Web Store)

| Permiso | Uso |
|---|---|
| `cookies` | Leer las cookies de la página activa para informar sobre ellas. |
| `scripting` | Analizar la estructura de la página activa cuando el usuario pulsa el botón. |
| `storage` | Guardar la clave de API opcional. |
| `contentSettings` | Leer si el navegador permite ventanas emergentes en la página activa. |
| `alarms` | Actualizar en segundo plano, cada 6 horas, la lista pública de URLhaus. |
| `<all_urls>` | Necesario para analizar cualquier web que el usuario decida comprobar. |

Finalidad única: informar al usuario sobre el nivel de seguridad de la página que está visitando.

## Publicación en Chrome Web Store: checklist

- [x] Correo de contacto en `PRIVACY.md` actualizado.
- [ ] Publicar el repositorio en GitHub y usar la URL de `PRIVACY.md` como política de privacidad en el panel de desarrollador.
- [ ] Justificar cada permiso de la tabla anterior en el formulario de revisión.
- [ ] Declarar en el panel que se envían a terceros la URL (solo con clave de Safe Browsing) y el nombre del dominio (DNS y RDAP).
- [ ] Preparar capturas de pantalla (1280×800 o 640×400) y el icono de 128 px.
- [ ] Revisar que la descripción de la ficha no prometa garantías de seguridad que la extensión no puede dar.

## Fuentes de datos y atribución

- **URLhaus** (abuse.ch, operado con Spamhaus): lista pública de dominios que distribuyen malware. Los datos se publican con licencia CC0. La lista se descarga del mirror del proyecto [curbengh/urlhaus-filter](https://github.com/curbengh/urlhaus-filter), que publica código bajo CC0 y MIT y no está respaldado por abuse.ch.
- PAGECHECK no está respaldado por abuse.ch ni por Google.

## Limitaciones

PAGECHECK no lee detalles del certificado, no escanea archivos y no sustituye a un antivirus. Sus resultados son orientativos.

## Licencia

Pendiente de definir por el autor.
