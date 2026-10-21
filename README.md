# Ganga Store

Tienda online de **Ganga Store — Luxury clothing** (Argentina). Sitio estático, sin base de datos ni servidor: se publica gratis con GitHub Pages y el propio repositorio guarda los productos, promos y ajustes.

- **Tienda:** `index.html`
- **Panel de administración:** `admin.html` (también hay un enlace discreto al pie de la tienda, "Acceso para el equipo")

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
2. Al tocar **Publicar**, el panel sube los cambios a este repositorio (`data/store.js` y las fotos en `img/subidas/`) usando un token de GitHub que queda guardado solo en tu dispositivo.
3. GitHub Pages actualiza la tienda en uno o dos minutos y todos los clientes ven lo nuevo.

Las visitas se cuentan con [Abacus](https://abacus.jasoncameron.dev), un contador público y gratuito (una visita por sesión del navegador; las del equipo no se cuentan).

## Puesta en marcha

1. **Activar GitHub Pages:** en el repositorio, *Settings → Pages → Build and deployment*, origen *Deploy from a branch*, rama `main`, carpeta `/ (root)`. La tienda queda en `https://<usuario>.github.io/ganga-store/`.
2. **Entrar al panel** (`.../ganga-store/admin.html`) con el usuario `superadmin` y la contraseña inicial que te pasé. Te va a pedir que la cambies.
3. **Crear el token de GitHub** (una sola vez por dispositivo) desde *Ajustes → Publicación*: el panel explica los pasos. Permiso necesario: *Contents: Read and write* sobre este repositorio.
4. Cargá Instagram y demás redes en *Ajustes*, revisá productos y promos, y tocá **Publicar**.

## Seguridad, en corto

- El token de GitHub nunca se sube al repositorio. Sin token nadie puede cambiar la tienda publicada, aunque entre al panel.
- Las contraseñas se guardan con hash PBKDF2 (150.000 iteraciones). Como el repositorio es público, usá contraseñas largas.
- Si dos personas publican a la vez, gana la última; el panel avisa si alguien publicó mientras editabas.

## Estructura

```
index.html          tienda
admin.html          panel
data/store.js       datos publicados (lo escribe el panel)
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
