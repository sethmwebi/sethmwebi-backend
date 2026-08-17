import "dotenv/config";
import path from "path";
import { defineConfig, env } from "prisma/config";

module.exports = defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
