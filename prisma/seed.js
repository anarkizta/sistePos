require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { PrismaMariaDb } = require("@prisma/adapter-mariadb");
const bcrypt = require("bcryptjs");

function createPrisma() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  const url = new URL(databaseUrl);
  const adapter = new PrismaMariaDb({
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
  });

  return new PrismaClient({ adapter });
}

async function main() {
  const prisma = createPrisma();
  // Roles base
  const roles = [
    { code: "ADMIN", name: "Administrador" },
    { code: "CAJERO", name: "Cajero" },
    { code: "SUPERVISOR", name: "Supervisor" },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: { name: role.name },
      create: role,
    });
  }

  // Permisos (codigo en espanol, sin tildes)
  const permissions = [
    { code: "venta_cobrar", name: "Vender y cobrar" },
    { code: "inventario_consultar", name: "Consultar existencias" },
    { code: "venta_anular", name: "Anular venta (void)" },
    { code: "descuento_aplicar", name: "Aplicar descuento" },
    { code: "inventario_merma_ajustar", name: "Ajustar inventario (merma/ajuste)" },
    { code: "producto_crear", name: "Crear producto" },
    { code: "producto_editar", name: "Editar producto" },
    { code: "producto_costo_cambiar", name: "Cambiar costo de producto" },
    { code: "producto_precio_cambiar", name: "Cambiar precio de producto" },
    { code: "reporte_ventas_ver", name: "Ver reportes de ventas" },
    { code: "reporte_ganancias_ver", name: "Ver ganancias y utilidades" },
    { code: "usuario_crear", name: "Crear usuario" },
    { code: "usuario_editar", name: "Editar usuario" },
    { code: "usuario_borrar", name: "Borrar usuario" },
    { code: "rol_asignar", name: "Asignar roles" },
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: { name: perm.name, description: perm.description ?? null },
      create: perm,
    });
  }

  const roleByCode = async (code) => prisma.role.findUnique({ where: { code } });
  const permByCode = async (code) =>
    prisma.permission.findUnique({ where: { code } });

  const cajeroPerms = [
    "venta_cobrar",
    "inventario_consultar",
    "descuento_aplicar",
  ];

  const supervisorPerms = [
    ...cajeroPerms,
    "venta_anular",
    "inventario_merma_ajustar",
    "producto_crear",
    "producto_editar",
    "producto_precio_cambiar",
    "reporte_ventas_ver",
  ];

  const adminPerms = permissions.map((p) => p.code);

  const rolePermMatrix = [
    { role: "CAJERO", perms: cajeroPerms },
    { role: "SUPERVISOR", perms: supervisorPerms },
    { role: "ADMIN", perms: adminPerms },
  ];

  for (const row of rolePermMatrix) {
    const role = await roleByCode(row.role);
    if (!role) throw new Error(`Role not found: ${row.role}`);

    for (const permCode of row.perms) {
      const perm = await permByCode(permCode);
      if (!perm) throw new Error(`Permission not found: ${permCode}`);

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId: perm.id },
        },
        update: {},
        create: { roleId: role.id, permissionId: perm.id },
      });
    }
  }

  // Usuario administrador inicial (opcional via env)
  // Variables soportadas:
  // - SEED_ADMIN_USERNAME (requerida)
  // - SEED_ADMIN_DISPLAY_NAME (opcional)
  // - SEED_ADMIN_CREDENTIAL_TYPE = PIN|PASSWORD (opcional; default PASSWORD si hay password)
  // - SEED_ADMIN_PASSWORD (opcional; min 6)
  // - SEED_ADMIN_PIN (opcional; min 4)
  const adminUsername = process.env.SEED_ADMIN_USERNAME;
  const adminDisplayName = process.env.SEED_ADMIN_DISPLAY_NAME || "Administrador";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const adminPin = process.env.SEED_ADMIN_PIN;

  if (adminUsername) {
    const credentialTypeEnv = String(process.env.SEED_ADMIN_CREDENTIAL_TYPE || "").toUpperCase();

    const hasPassword = typeof adminPassword === "string" && adminPassword.length >= 6;
    const hasPin = typeof adminPin === "string" && adminPin.length >= 4;

    if (!hasPassword && !hasPin) {
      throw new Error(
        "SEED_ADMIN_USERNAME fue provisto pero falta SEED_ADMIN_PASSWORD (>=6) o SEED_ADMIN_PIN (>=4).",
      );
    }

    /** @type {"PIN"|"PASSWORD"} */
    const chosenType =
      credentialTypeEnv === "PIN" || credentialTypeEnv === "PASSWORD"
        ? credentialTypeEnv
        : hasPassword
          ? "PASSWORD"
          : "PIN";

    const passwordHash =
      chosenType === "PASSWORD" ? await bcrypt.hash(adminPassword, 12) : null;
    const pinHash = chosenType === "PIN" ? await bcrypt.hash(adminPin, 12) : null;

    const adminRole = await prisma.role.findUnique({ where: { code: "ADMIN" } });
    if (!adminRole) throw new Error("Role not found: ADMIN");

    const user = await prisma.user.upsert({
      where: { username: adminUsername },
      update: {
        displayName: adminDisplayName,
        credentialType: chosenType,
        passwordHash,
        pinHash,
        isActive: true,
      },
      create: {
        username: adminUsername,
        displayName: adminDisplayName,
        credentialType: chosenType,
        passwordHash,
        pinHash,
        isActive: true,
      },
    });

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: adminRole.id } },
      update: {},
      create: { userId: user.id, roleId: adminRole.id },
    });
  }

  await prisma.$disconnect();
}

main()
  .then(async () => {})
  .catch(async (e) => {
    console.error(e);
    process.exit(1);
  });

