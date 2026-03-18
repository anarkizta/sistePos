require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');

async function test() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  const url = new URL(databaseUrl);
  const adapter = new PrismaMariaDb({
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
  });

  const prisma = new PrismaClient({ log: ['info'], adapter });

  try {
    console.log("Intentando conectar a MySQL...");
    const productsCount = await prisma.product.count();
    console.log("Conexión exitosa. Cantidad de productos en la base de datos:", productsCount);
    
    if (productsCount > 0) {
      const firstProduct = await prisma.product.findFirst();
      console.log("Primer producto encontrado:", firstProduct.name);
    } else {
      console.log("No hay productos en la base de datos.");
    }

  } catch (error) {
    console.error("Error al conectar con la base de datos:", error.message);
    if (error.code) console.error("Prisma Error Code:", error.code);
  } finally {
    await prisma.$disconnect();
  }
}

test();
