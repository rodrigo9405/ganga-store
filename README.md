# Ganga Store

Tienda online de **Ganga Store — Luxury clothing** (Argentina). Sitio estático, sin base de datos ni servidor: se publica gratis en Cloudflare con dominio propio, y este repositorio privado guarda los productos, promos y ajustes.

- **Tienda:** `index.html`
- **Panel de administración:** `admin.html` (en Cloudflare también responde en `/admin`; hay un enlace discreto al pie de la tienda)

## Qué incluye

**Vista de clientes**
- Inicio con la promo del mes en grande (descuento, cuenta regresiva en hora argentina y productos) o el producto del mes.
- Menú de tres rayitas con las categorías; listado con filtro por talle y orden por precio.
- Detalle de producto con fotos por color: debajo de la foto están los círculos de color y al tocar uno cambian las fotos. Talles disponibles y botón para consultar por WhatsApp con producto, color y talle ya escritos.
- Sección Contactanos con WhatsApp, Instagram, Facebook, TikTok, teléfono, email y mapa (se muestra solo lo que esté cargado) y horario de atención con "abierto ahora".
- Diseño automático por fechas argentinas: Navidad, Año Nuevo, San Valentín, Carnaval, Pascuas, 25 de Mayo / 20 de Junio / 9 de Julio, Día del Padre, Día del Amigo, Día de las Infancias, Primavera, Día de la Madre y Halloween. El resto del año, minimalista.

**Panel (administrador)**
- Visitas por día, semana, mes y año, con gráfico y tabla.
- Crear, editar, ordenar y eliminar categorías.
- Cargar productos con fotos por color (se comprimen solas), talles, precio y descripción; ocultarlos o marcarlos como producto del mes.
- Promociones con descuento, fechas, productos incluidos y tres estilos de cartel, con vista previa.
- Datos de la tienda, redes, horarios, diseño de temporada (automático, siempre minimalista o fijo) y copia de seguridad.

**Súper administrador**
- Todo lo anterior, más las cuentas: ver cuántas hay activas, crear, editar, desactivar, cambiar contraseñas y eliminar.

## Cómo funciona sin base de datos

1. Lo que cambiás en el panel se guarda primero en tu navegador (borrador). Podés verlo con "Vista previa".
2. Al tocar **Publicar**, el panel sube los cambios a este repositorio **privado** (`data/store.js`, `data/cuentas.js` y las fotos en `img/subidas/`) con un token de GitHub que queda guardado solo en tu dispositivo.
3. Cloudflare detecta el cambio y actualiza la tienda en tu dominio en uno o dos minutos.

Las cuentas del equipo están en `data/cuentas.js`, separadas de los datos de la tienda: la tienda nunca descarga ese archivo y se puede proteger junto con el panel.

Las visitas se cuentan con [Abacus](https://abacus.jasoncameron.dev), un contador público y gratuito (una visita por sesión del navegador; las del equipo no se cuentan).

## Puesta en marcha (privada, con dominio propio)

**1. Repositorio privado.** En GitHub: *Settings → General → Danger Zone → Change repository visibility → Make private*.

**2. Dominio y hosting en Cloudflare** (gratis salvo el dominio).
1. Creá una cuenta en [cloudflare.com](https://dash.cloudflare.com/sign-up).
2. Comprá el dominio en *Domain Registration → Register Domains* (por ejemplo un `.com`; se paga con tarjeta internacional). Si comprás el dominio en otro lado, agregalo a Cloudflare y cambiá los servidores DNS por los que te indique.
3. Entrá a *Workers & Pages → Create → Pages → Connect to Git*, autorizá GitHub y elegí `ganga-store`. Sin comando de compilación, carpeta de salida `/`. Tocá *Deploy*.
4. En el proyecto, *Custom domains → Set up a custom domain* y escribí tu dominio (por ejemplo `www.tudominio.com`).
5. En el panel de la tienda, *Ajustes → Datos de la tienda → Dominio propio*, escribí ese mismo dominio y publicá. Así, quien entre por la dirección técnica `*.pages.dev` pasa a tu dominio.

**3. Proteger el panel con Cloudflare Access** (gratis hasta 50 personas).
1. En Cloudflare, *Zero Trust → Access → Applications → Add an application → Self-hosted*.
2. Dominio: el tuyo, ruta `admin`. Agregá otra ruta igual con `data/cuentas.js`.
3. Política *Allow* con *Emails*: los correos de las personas del equipo. El ingreso es con un código que llega al correo (*One-time PIN*).
Desde ese momento, el panel ni siquiera se abre si tu correo no está en la lista; después se pide además usuario y contraseña.
4. Opcional: protegé también la dirección técnica `ganga-store.pages.dev` desde el proyecto de Pages (*Settings → Access policy*). Igual, quien entre por ahí con el navegador es enviado a tu dominio.

**4. Primer ingreso.** Entrá a `https://tudominio.com/admin` con el usuario `superadmin` y la contraseña inicial que te pasé. Te va a pedir que la cambies. Después, en *Ajustes → Publicación*, pegá el token de GitHub (los pasos están ahí; permiso *Contents: Read and write* sobre este repositorio) y tocá **Publicar**.

## Seguridad, en corto

- El código y los datos viven en un repositorio privado. El público solo ve la tienda.
- El token de GitHub nunca se sube al repositorio. Sin token nadie puede cambiar la tienda publicada.
- Con Cloudflare Access, el panel y el archivo de cuentas quedan cerrados a los correos autorizados. Las contraseñas además se guardan con hash PBKDF2 (150.000 iteraciones).
- Si dos personas publican a la vez, gana la última; el panel avisa si alguien publicó mientras editabas.

## Estructura

```
index.html          tienda
admin.html          panel
data/store.js       datos publicados de la tienda (lo escribe el panel)
data/cuentas.js     cuentas del panel (no lo carga la tienda)
_headers, robots.txt  encabezados para Cloudflare y buscadores
css/                estilos (base, tienda, temas de temporada, panel)
js/core.js          utilidades, hora argentina, precios y promos
js/temas.js         calendario de fechas argentinas y decoraciones
js/visitas.js       contador de visitas
js/github.js        publicación en GitHub
js/tienda.js        vista de clientes
js/admin/           panel (ingreso, visitas, catálogo, promos, cuentas, ajustes)
img/marca/          corona y favicon
img/demo/           fotos de ejemplo (se pueden borrar al cargar las reales)
img/subidas/        fotos cargadas desde el panel
fuentes/            Bodoni Moda y Jost (licencia SIL OFL)
```

Para probarlo en tu computadora: `python3 -m http.server` dentro de la carpeta y abrir `http://localhost:8000`.
