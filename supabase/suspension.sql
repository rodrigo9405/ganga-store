-- =====================================================================
-- Ganga Store — suspender la tienda (por ejemplo, por falta de pago)
-- Solo el súper administrador puede suspenderla o reactivarla.
-- Mientras está suspendida:
--   * la tienda muestra "Página en mantenimiento" y la API no entrega el catálogo,
--   * el administrador no puede iniciar sesión ni modificar nada,
--   * el súper administrador sigue entrando normalmente para reactivarla.
-- Se ejecuta una vez en el SQL Editor (después de esquema.sql). Se puede repetir sin problema.
-- =====================================================================

create table if not exists public.negocio (
  id      smallint primary key default 1 check (id = 1),
  activo  boolean not null default true,
  cambiado timestamptz not null default now()
);
insert into public.negocio (id) values (1) on conflict (id) do nothing;
alter table public.negocio enable row level security;
revoke all on public.negocio from anon, authenticated;

-- ¿La tienda está activa?
create or replace function public.negocio_activo()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select n.activo from public.negocio n where n.id = 1), true);
$$;

-- Lo consulta la tienda (sin sesión) para saber si mostrar la página de mantenimiento
create or replace function public.estado_negocio()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('activo', n.activo, 'desde', n.cambiado) from public.negocio n where n.id = 1;
$$;

-- El administrador solo puede editar si la tienda está activa
create or replace function public.es_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.perfiles p
    where p.id = auth.uid() and p.activo
      and ((p.rol = 'admin' and public.negocio_activo())
        or (p.rol = 'superadmin' and public.pin_ok()))
  );
$$;

-- Suspender o reactivar la tienda (solo el súper administrador, con su clave de 4 dígitos)
create or replace function public.cambiar_estado_negocio(p_activo boolean)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.es_super() then
    raise exception 'Solo el súper administrador puede suspender o reactivar la tienda.';
  end if;
  update public.negocio set activo = p_activo, cambiado = now() where id = 1;
  -- el administrador no puede iniciar sesión mientras la tienda está suspendida
  update auth.users u
     set banned_until = case when p_activo and p.activo then null else 'infinity'::timestamptz end
    from public.perfiles p
   where p.id = u.id and p.rol = 'admin';
end $$;

-- Activar o desactivar una cuenta respeta la suspensión de la tienda
create or replace function public.actualizar_cuenta(p_id uuid, p_nombre text, p_activo boolean)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare v_rol text;
begin
  if coalesce(trim(p_nombre), '') = '' then raise exception 'Escribí el nombre.'; end if;
  select rol into v_rol from public.perfiles where id = p_id;
  if public.es_super() then
    if p_id = auth.uid() and not p_activo then raise exception 'No podés desactivar tu propia cuenta.'; end if;
    update public.perfiles set nombre = trim(p_nombre), activo = p_activo where id = p_id;
    update auth.users
       set banned_until = case when p_activo and (v_rol = 'superadmin' or public.negocio_activo()) then null else 'infinity'::timestamptz end
     where id = p_id;
  elsif public.es_staff() and p_id = auth.uid() and p_activo then
    update public.perfiles set nombre = trim(p_nombre) where id = p_id;
  else
    raise exception 'No tenés permiso para cambiar esta cuenta.';
  end if;
end $$;

-- Las visitas no se cuentan mientras la tienda está suspendida
create or replace function public.registrar_visita()
returns void language sql volatile security definer set search_path = '' as $$
  insert into public.visitas (dia, cantidad)
  select (now() at time zone 'America/Argentina/Buenos_Aires')::date, 1
  where public.negocio_activo()
  on conflict (dia) do update set cantidad = public.visitas.cantidad + 1;
$$;

-- El catálogo solo se entrega si la tienda está activa (el súper lo sigue viendo en el panel)
drop policy if exists "ajustes_leer" on public.ajustes;
create policy "ajustes_leer" on public.ajustes for select to anon, authenticated
  using ((select public.negocio_activo()) or (select public.es_staff()));
drop policy if exists "categorias_leer" on public.categorias;
create policy "categorias_leer" on public.categorias for select to anon, authenticated
  using ((select public.negocio_activo()) or (select public.es_staff()));
drop policy if exists "productos_leer" on public.productos;
create policy "productos_leer" on public.productos for select to anon, authenticated
  using (((select public.negocio_activo()) and visible) or (select public.es_staff()));
drop policy if exists "promociones_leer" on public.promociones;
create policy "promociones_leer" on public.promociones for select to anon, authenticated
  using ((select public.negocio_activo()) or (select public.es_staff()));

-- Permisos
revoke execute on function public.negocio_activo() from public;
revoke execute on function public.estado_negocio() from public;
revoke execute on function public.cambiar_estado_negocio(boolean) from public, anon;
grant execute on function public.negocio_activo() to anon, authenticated;
grant execute on function public.estado_negocio() to anon, authenticated;
grant execute on function public.cambiar_estado_negocio(boolean) to authenticated;

select public.estado_negocio() as estado;
