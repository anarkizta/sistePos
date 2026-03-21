## Configuracion: Admin inicial y login

Este proyecto usa MySQL y Prisma (adapter MariaDB) con `DATABASE_URL`.

### Variables requeridas

- **DATABASE_URL**: cadena de conexion a MySQL.

Formato:

`mysql://USUARIO:CLAVE@HOST:PUERTO/NOMBRE_DB`

Ejemplo:

`mysql://root:password@localhost:3306/sistepos`

### Seed: usuario administrador inicial (opcional, recomendado)

Si defines **SEED_ADMIN_USERNAME**, al ejecutar `npx prisma db seed` se creara/actualizara un usuario y se le asignara el rol **ADMIN**.

Variables:

- **SEED_ADMIN_USERNAME**: (requerida para activar seed de admin) ej: `admin`
- **SEED_ADMIN_DISPLAY_NAME**: (opcional) ej: `Administrador`
- **SEED_ADMIN_CREDENTIAL_TYPE**: `PIN` o `PASSWORD` (opcional)
- **SEED_ADMIN_PASSWORD**: (opcional, minimo 6) ej: `admin123`
- **SEED_ADMIN_PIN**: (opcional, minimo 4) ej: `1234`

Notas:

- Debes definir **SEED_ADMIN_PASSWORD** o **SEED_ADMIN_PIN** (al menos uno).
- Si defines ambos, `SEED_ADMIN_CREDENTIAL_TYPE` decide cual se usa.

### Comandos

- Migraciones (si no las has aplicado aun):

```bash
npx prisma migrate dev
```

- Seed:

```bash
npx prisma db seed
```

### Permisos de clientes

Tras actualizar el seed se crean **cliente_consultar** y **cliente_gestionar** (cajero, supervisor y administrador los tienen por defecto). Si ya tenias la base cargada, ejecuta de nuevo:

```bash
npx prisma db seed
```

### Turnos y caja (Paso 7)

- Permisos: **turno_abrir**, **turno_cerrar** (cajero), **turno_arqueo** (supervisor).
- APIs: `GET /api/tiendas`, `GET /api/turnos/actual?storeId=&terminalId=`, `GET|POST /api/turnos`, `PATCH /api/turnos/[id]/cerrar`.
- El seed crea sucursal **PRINCIPAL** y caja **CAJA01** y enlaza el usuario admin seed a esa sucursal (`store_user`).
- Los cajeros deben tener fila activa en `store_user` para esa sucursal (o rol supervisor/administrador).

### Auditoria (operaciones)

Las altas, ediciones y bajas de **productos** y **clientes** registran filas en `audit_event` y cambios en `audit_event_field`. El inicio de sesion exitoso registra `sesion_iniciar`.

### Bloqueo por intentos fallidos

- **Ventana**: 10 minutos, maximo **5** intentos fallidos por alias (`username`).
- **Bloqueo en cuenta**: si el usuario existe en BD, al llegar a 5 fallos en la ventana se guarda `user.lockedUntil` (**15 minutos** desde ese momento). Un login correcto **limpia** `lockedUntil`.
- **Consulta de estado** (sin cookie): `GET /api/auth/login-status?username=TU_ALIAS` devuelve si esta bloqueado, intentos en ventana y fechas aproximadas de desbloqueo.

