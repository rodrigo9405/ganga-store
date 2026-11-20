-- Ganga Store — vincula las dos cuentas creadas en Authentication → Users con su rol.
-- Ejecutar después de crear los usuarios ssadd@rdsfs.com y addlucho@rdsfs.com.
insert into public.perfiles (id, correo, nombre, rol)
select u.id, lower(u.email),
       case when lower(u.email) = 'ssadd@rdsfs.com' then 'Súper administrador' else 'Administrador' end,
       case when lower(u.email) = 'ssadd@rdsfs.com' then 'superadmin' else 'admin' end
from auth.users u
where lower(u.email) in ('ssadd@rdsfs.com', 'addlucho@rdsfs.com')
on conflict (id) do update set correo = excluded.correo, rol = excluded.rol;

select correo, nombre, rol, activo from public.perfiles order by rol desc;
