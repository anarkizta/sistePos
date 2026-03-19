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

