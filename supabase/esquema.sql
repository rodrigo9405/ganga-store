-- =====================================================================
-- Ganga Store — base de datos en Supabase
-- Tablas, seguridad (RLS), funciones y almacenamiento de fotos.
-- Se ejecuta una vez en el SQL Editor del proyecto.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------

-- Cuentas del panel: solo dos (un súper administrador y un administrador).
-- El inicio de sesión lo maneja Supabase Auth; acá van el rol y la clave de 4 dígitos.
create table if not exists public.perfiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  correo      text not null unique,
  nombre      text not null,
  rol         text not null unique check (rol in ('superadmin', 'admin')),
  activo      boolean not null default true,
  pin_hash    text,
  pin_fallos  integer not null default 0,
  pin_bloqueo timestamptz,
  creado      timestamptz not null default now()
);

-- Sesiones en las que el súper administrador ya escribió su clave de 4 dígitos
create table if not exists public.pin_sesiones (
  session_id uuid primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  creado     timestamptz not null default now()
);

-- Ajustes de la tienda (una sola fila)
create table if not exists public.ajustes (
  id          smallint primary key default 1 check (id = 1),
  datos       jsonb not null default '{}'::jsonb,
  actualizado timestamptz not null default now()
);

create table if not exists public.categorias (
  id     text primary key,
  nombre text not null,
  slug   text not null unique,
  orden  integer not null default 0,
  imagen text not null default '',
  creado timestamptz not null default now()
);

create table if not exists public.productos (
  id           text primary key,
  nombre       text not null,
  categoria_id text references public.categorias (id) on delete set null,
  precio       integer not null check (precio >= 0),
  descripcion  text not null default '',
  talles       text[] not null default '{}',
  colores      jsonb not null default '[]'::jsonb,   -- [{id, name, hex, images: [url, ...]}]
  visible      boolean not null default true,
  creado       timestamptz not null default now(),
  actualizado  timestamptz not null default now()
);
create index if not exists productos_categoria_idx on public.productos (categoria_id);

create table if not exists public.promociones (
  id        text primary key,
  titulo    text not null,
  subtitulo text not null default '',
  descuento integer not null check (descuento between 1 and 90),
  inicio    date not null,
  fin       date not null,
  estilo    text not null default 'negro' check (estilo in ('negro', 'claro', 'imagen')),
  productos text[] not null default '{}',
  imagen    text not null default '',
  activa    boolean not null default true,
  creado    timestamptz not null default now(),
  check (fin >= inicio)
);

-- Visitas por día (hora de Buenos Aires)
create table if not exists public.visitas (
  dia      date primary key,
  cantidad integer not null default 0
);

-- ---------------------------------------------------------------------
-- Quién puede editar
-- ---------------------------------------------------------------------

-- ¿El súper administrador ya escribió su clave de 4 dígitos en esta sesión?
create or replace function public.pin_ok()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.pin_sesiones s
    where s.user_id = auth.uid()
      and s.session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid
  );
$$;

-- Administrador activo, o súper administrador activo que ya puso su clave
create or replace function public.es_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.perfiles p
    where p.id = auth.uid() and p.activo
      and (p.rol = 'admin' or (p.rol = 'superadmin' and public.pin_ok()))
  );
$$;

create or replace function public.es_super()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.perfiles p
    where p.id = auth.uid() and p.activo and p.rol = 'superadmin' and public.pin_ok()
  );
$$;

-- ---------------------------------------------------------------------
-- Seguridad por filas (RLS)
-- ---------------------------------------------------------------------
alter table public.perfiles     enable row level security;
alter table public.pin_sesiones enable row level security;
alter table public.ajustes      enable row level security;
alter table public.categorias   enable row level security;
alter table public.productos    enable row level security;
alter table public.promociones  enable row level security;
alter table public.visitas      enable row level security;

-- Ajustes: todos leen, el equipo edita
drop policy if exists "ajustes_leer" on public.ajustes;
create policy "ajustes_leer" on public.ajustes for select to anon, authenticated using (true);
drop policy if exists "ajustes_editar" on public.ajustes;
create policy "ajustes_editar" on public.ajustes for update to authenticated
  using ((select public.es_staff())) with check ((select public.es_staff()));

-- Categorías
drop policy if exists "categorias_leer" on public.categorias;
create policy "categorias_leer" on public.categorias for select to anon, authenticated using (true);
drop policy if exists "categorias_crear" on public.categorias;
create policy "categorias_crear" on public.categorias for insert to authenticated with check ((select public.es_staff()));
drop policy if exists "categorias_editar" on public.categorias;
create policy "categorias_editar" on public.categorias for update to authenticated
  using ((select public.es_staff())) with check ((select public.es_staff()));
drop policy if exists "categorias_borrar" on public.categorias;
create policy "categorias_borrar" on public.categorias for delete to authenticated using ((select public.es_staff()));

-- Productos: los ocultos solo los ve el equipo
drop policy if exists "productos_leer" on public.productos;
create policy "productos_leer" on public.productos for select to anon, authenticated
  using (visible or (select public.es_staff()));
drop policy if exists "productos_crear" on public.productos;
create policy "productos_crear" on public.productos for insert to authenticated with check ((select public.es_staff()));
drop policy if exists "productos_editar" on public.productos;
create policy "productos_editar" on public.productos for update to authenticated
  using ((select public.es_staff())) with check ((select public.es_staff()));
drop policy if exists "productos_borrar" on public.productos;
create policy "productos_borrar" on public.productos for delete to authenticated using ((select public.es_staff()));

-- Promociones
drop policy if exists "promociones_leer" on public.promociones;
create policy "promociones_leer" on public.promociones for select to anon, authenticated using (true);
drop policy if exists "promociones_crear" on public.promociones;
create policy "promociones_crear" on public.promociones for insert to authenticated with check ((select public.es_staff()));
drop policy if exists "promociones_editar" on public.promociones;
create policy "promociones_editar" on public.promociones for update to authenticated
  using ((select public.es_staff())) with check ((select public.es_staff()));
drop policy if exists "promociones_borrar" on public.promociones;
create policy "promociones_borrar" on public.promociones for delete to authenticated using ((select public.es_staff()));

-- Perfiles: cada uno ve el suyo; el súper ve los dos. Se modifican solo con las funciones de abajo.
drop policy if exists "perfiles_leer" on public.perfiles;
create policy "perfiles_leer" on public.perfiles for select to authenticated
  using (id = (select auth.uid()) or (select public.es_super()));

-- pin_sesiones y visitas: sin políticas (solo se usan a través de funciones)

-- Permisos de la API
revoke all on public.perfiles, public.pin_sesiones, public.visitas from anon, authenticated;
grant select on public.ajustes, public.categorias, public.productos, public.promociones to anon, authenticated;
grant insert, update, delete on public.categorias, public.productos, public.promociones to authenticated;
grant update on public.ajustes to authenticated;
grant select (id, correo, nombre, rol, activo, creado) on public.perfiles to authenticated;

-- ---------------------------------------------------------------------
-- Funciones
-- ---------------------------------------------------------------------

-- Visitas: una por sesión del navegador (lo controla la tienda)
create or replace function public.registrar_visita()
returns void language sql volatile security definer set search_path = '' as $$
  insert into public.visitas (dia, cantidad)
  values ((now() at time zone 'America/Argentina/Buenos_Aires')::date, 1)
  on conflict (dia) do update set cantidad = public.visitas.cantidad + 1;
$$;

create or replace function public.visitas_rango(p_desde date, p_hasta date)
returns table (dia date, cantidad integer) language sql stable security definer set search_path = '' as $$
  select v.dia, v.cantidad from public.visitas v
  where public.es_staff() and v.dia between p_desde and p_hasta
  order by v.dia;
$$;

-- Estado de la clave de 4 dígitos del súper administrador en esta sesión
create or replace function public.estado_pin()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'tiene', p.pin_hash is not null,
    'verificado', public.pin_ok(),
    'bloqueo', case when p.pin_bloqueo > now() then p.pin_bloqueo end)
  from public.perfiles p
  where p.id = auth.uid() and p.rol = 'superadmin' and p.activo;
$$;

-- Primera vez: el súper administrador elige su clave de 4 dígitos
create or replace function public.crear_pin(p_pin text)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare v_sid uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
begin
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then raise exception 'La clave tiene que tener exactamente 4 números.'; end if;
  update public.perfiles
     set pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf')), pin_fallos = 0, pin_bloqueo = null
   where id = auth.uid() and rol = 'superadmin' and activo and pin_hash is null;
  if not found or v_sid is null then return false; end if;
  insert into public.pin_sesiones (session_id, user_id) values (v_sid, auth.uid()) on conflict (session_id) do nothing;
  return true;
end $$;

-- Verifica la clave de 4 dígitos. Después de 5 errores se bloquea 15 minutos.
create or replace function public.verificar_pin(p_pin text)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  v public.perfiles;
  v_sid uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
begin
  select * into v from public.perfiles where id = auth.uid() and rol = 'superadmin' and activo;
  if not found or v.pin_hash is null or v_sid is null then return 'mal'; end if;
  if v.pin_bloqueo is not null and v.pin_bloqueo > now() then return 'bloqueado'; end if;
  if p_pin ~ '^[0-9]{4}$' and extensions.crypt(p_pin, v.pin_hash) = v.pin_hash then
    update public.perfiles set pin_fallos = 0, pin_bloqueo = null where id = v.id;
    delete from public.pin_sesiones where creado < now() - interval '90 days';
    insert into public.pin_sesiones (session_id, user_id) values (v_sid, v.id) on conflict (session_id) do nothing;
    return 'ok';
  end if;
  if v.pin_fallos + 1 >= 5 then
    update public.perfiles set pin_fallos = 0, pin_bloqueo = now() + interval '15 minutes' where id = v.id;
    return 'bloqueado';
  end if;
  update public.perfiles set pin_fallos = pin_fallos + 1 where id = v.id;
  return 'mal';
end $$;

-- Cambiar la clave de 4 dígitos (pide la actual)
create or replace function public.cambiar_pin(p_actual text, p_nuevo text)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare v public.perfiles;
begin
  if not public.es_super() then raise exception 'Solo el súper administrador puede cambiar la clave de 4 dígitos.'; end if;
  if p_nuevo is null or p_nuevo !~ '^[0-9]{4}$' then raise exception 'La clave nueva tiene que tener exactamente 4 números.'; end if;
  select * into v from public.perfiles where id = auth.uid();
  if extensions.crypt(coalesce(p_actual, ''), v.pin_hash) <> v.pin_hash then return false; end if;
  update public.perfiles set pin_hash = extensions.crypt(p_nuevo, extensions.gen_salt('bf')) where id = v.id;
  return true;
end $$;

-- Cambiar la contraseña propia (pide la actual)
create or replace function public.cambiar_mi_contrasena(p_actual text, p_nueva text)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare v_hash text;
begin
  if not public.es_staff() then raise exception 'No tenés permiso para esta acción.'; end if;
  if p_nueva is null or length(p_nueva) < 10 then raise exception 'La contraseña nueva tiene que tener al menos 10 caracteres.'; end if;
  select encrypted_password into v_hash from auth.users where id = auth.uid();
  if v_hash is null or extensions.crypt(coalesce(p_actual, ''), v_hash) <> v_hash then return false; end if;
  update auth.users set encrypted_password = extensions.crypt(p_nueva, extensions.gen_salt('bf')), updated_at = now()
   where id = auth.uid();
  return true;
end $$;

-- El súper administrador cambia la contraseña del administrador
create or replace function public.cambiar_contrasena_cuenta(p_id uuid, p_nueva text)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.es_super() then raise exception 'Solo el súper administrador puede cambiar contraseñas de otras cuentas.'; end if;
  if p_id = auth.uid() then raise exception 'Tu propia contraseña se cambia en Ajustes, con la contraseña actual.'; end if;
  if p_nueva is null or length(p_nueva) < 10 then raise exception 'La contraseña tiene que tener al menos 10 caracteres.'; end if;
  if not exists (select 1 from public.perfiles where id = p_id) then raise exception 'Esa cuenta no existe.'; end if;
  update auth.users set encrypted_password = extensions.crypt(p_nueva, extensions.gen_salt('bf')), updated_at = now()
   where id = p_id;
end $$;

-- Nombre y estado de una cuenta. El súper edita las dos; cada uno puede cambiar su propio nombre.
create or replace function public.actualizar_cuenta(p_id uuid, p_nombre text, p_activo boolean)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  if coalesce(trim(p_nombre), '') = '' then raise exception 'Escribí el nombre.'; end if;
  if public.es_super() then
    if p_id = auth.uid() and not p_activo then raise exception 'No podés desactivar tu propia cuenta.'; end if;
    update public.perfiles set nombre = trim(p_nombre), activo = p_activo where id = p_id;
    -- una cuenta desactivada tampoco puede iniciar sesión
    update auth.users set banned_until = case when p_activo then null else 'infinity'::timestamptz end where id = p_id;
  elsif public.es_staff() and p_id = auth.uid() and p_activo then
    update public.perfiles set nombre = trim(p_nombre) where id = p_id;
  else
    raise exception 'No tenés permiso para cambiar esta cuenta.';
  end if;
end $$;

-- Permisos de las funciones
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.registrar_visita() to anon, authenticated;
grant execute on function public.visitas_rango(date, date) to authenticated;
grant execute on function public.estado_pin() to authenticated;
grant execute on function public.crear_pin(text) to authenticated;
grant execute on function public.verificar_pin(text) to authenticated;
grant execute on function public.cambiar_pin(text, text) to authenticated;
grant execute on function public.cambiar_mi_contrasena(text, text) to authenticated;
grant execute on function public.cambiar_contrasena_cuenta(uuid, text) to authenticated;
grant execute on function public.actualizar_cuenta(uuid, text, boolean) to authenticated;
-- las de RLS las usan las políticas
grant execute on function public.pin_ok() to anon, authenticated;
grant execute on function public.es_staff() to anon, authenticated;
grant execute on function public.es_super() to anon, authenticated;

-- ---------------------------------------------------------------------
-- Fotos (Storage): lectura pública, solo el equipo sube y borra
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "fotos_ver_equipo" on storage.objects;
create policy "fotos_ver_equipo" on storage.objects for select to authenticated
  using (bucket_id = 'fotos' and (select public.es_staff()));
drop policy if exists "fotos_subir" on storage.objects;
create policy "fotos_subir" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and (select public.es_staff()));
drop policy if exists "fotos_editar" on storage.objects;
create policy "fotos_editar" on storage.objects for update to authenticated
  using (bucket_id = 'fotos' and (select public.es_staff()));
drop policy if exists "fotos_borrar" on storage.objects;
create policy "fotos_borrar" on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and (select public.es_staff()));
