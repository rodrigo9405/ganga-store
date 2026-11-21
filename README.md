# Ganga Store

Tienda online de **Ganga Store — Luxury clothing** (Argentina). Sitio estático con base de datos en Supabase: la tienda y el panel leen y guardan todo ahí.

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
- Todo lo anterior, más las cuentas. El panel tiene **solo dos cuentas fijas** (súper administrador y administrador): no se pueden crear ni eliminar cuentas. El súper administrador puede cambiar los datos y contraseñas de las dos y desactivar la del administrador.
- El súper administrador entra con correo, contraseña y una **clave extra de 4 dígitos**, que puede cambiar en *Ajustes → Mi cuenta*.

## Base de datos (Supabase)

Todo vive en un proyecto de Supabase de la cuenta de la tienda: productos, categorías, promociones, ajustes, visitas, fotos (Storage) y las dos cuentas del panel (Supabase Auth).

- **La tienda** lee el catálogo directo de la base con la clave pública (`js/config.js`). Las reglas de seguridad (RLS) solo le dejan leer.
- **El panel** inicia sesión con Supabase Auth. Cada cambio se guarda solo, al instante, y tus clientes lo ven enseguida. Si se corta internet, lo pendiente queda en el dispositivo y se guarda cuando vuelve la conexión.
- **Cuentas:** solo dos, fijas (súper administrador y administrador). El registro de cuentas nuevas está desactivado en Supabase y el panel no permite crear ni eliminar cuentas.
- **Clave de 4 dígitos:** el súper administrador la elige en su primer ingreso y se la pide cada vez que entra. La verifica la base de datos (5 errores bloquean 15 minutos); sin ella, la cuenta no puede modificar nada.
- **Visitas:** una por cada vez que alguien abre la tienda, guardadas por día en hora de Buenos Aires.
- **Mantener activa la base:** Supabase pausa los proyectos gratuitos tras 7 días sin uso. La tarea `.github/workflows/mantener-base-activa.yml` la consulta una vez por día.

Los archivos SQL de `supabase/` documentan cómo se creó la base:

```
supabase/esquema.sql           tablas, reglas de seguridad, funciones y carpeta de fotos
supabase/datos_iniciales.sql   catálogo de ejemplo, promos y ajustes
supabase/cuentas.sql           vincula las dos cuentas de Authentication con su rol
```

## Puesta en marcha

1. **Hosting:** la tienda es un sitio estático (GitHub Pages o Cloudflare Pages). No necesita servidor.
2. **Cuentas:** en Supabase, *Authentication → Users → Add user → Create new user* (con *Auto Confirm User*) para los dos correos del panel. Después, ejecutá `supabase/cuentas.sql` en el *SQL Editor*.
3. **Primer ingreso:** entrá a `admin.html` con el correo y la contraseña del súper administrador y elegí la clave de 4 dígitos.

## Seguridad, en corto

- La clave de `js/config.js` es la pública ("publishable"): está pensada para ir en el sitio. Lo que cada uno puede leer o cambiar lo deciden las reglas de seguridad de la base.
- Ninguna contraseña queda en el repositorio: las maneja Supabase Auth.
- Usá contraseñas largas: es lo que protege el panel.

## Estructura

```
index.html          tienda
admin.html          panel
js/config.js        conexión con Supabase (dirección y clave pública)
js/db.js            lectura y guardado en la base de datos
js/vendor/          librería oficial de Supabase (para el panel)
supabase/           SQL de la base de datos
_headers, robots.txt  encabezados para Cloudflare y buscadores
css/                estilos (base, tienda, temas de temporada, panel)
js/core.js          utilidades, hora argentina, precios y promos
js/temas.js         calendario de fechas argentinas y decoraciones
js/visitas.js       contador de visitas
js/tienda.js        vista de clientes
js/admin/           panel (ingreso, visitas, catálogo, promos, cuentas, ajustes)
img/marca/          corona y favicon
img/demo/           fotos de ejemplo (se pueden borrar al cargar las reales)
fuentes/            Bodoni Moda y Jost (licencia SIL OFL)
```

Para probarlo en tu computadora: `python3 -m http.server` dentro de la carpeta y abrir `http://localhost:8000`.
