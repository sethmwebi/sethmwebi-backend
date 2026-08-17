import fs from "fs";
import path from "node:path";
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
const connectionString = `${process.env.DATABASE_URL}`;

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function deleteAllData(orderedFileNames: string[]) {
  console.log(" Deleting existing data...");

  for (const fileName of orderedFileNames.slice().reverse()) {
    const modelName = path.basename(fileName, path.extname(fileName));
    const model: any = (prisma as any)[modelName];

    if (!model) {
      console.warn(` Skipping unknown model: ${modelName}`);
      continue;
    }

    try {
      await model.deleteMany({});
    } catch (error: any) {
      console.error(`Failed to clear ${modelName}:`, error.message || error);
    }
  }
}

async function main() {
  const dataDirectory = path.join(__dirname, "seedData");

  const orderedFileNames = [
    "category.json",
    "tag.json",
    "verificationToken.json",
    "message.json",
    "user.json",
    "account.json",
    "post.json",
    "media.json",
    "postCategory.json",
    "postTag.json",
    "comment.json",
    "like.json",
  ];

  await deleteAllData(orderedFileNames);

  console.log("\nStarting seeding...\n");

  for (const fileName of orderedFileNames) {
    const filePath = path.join(dataDirectory, fileName);

    if (!fs.existsSync(filePath)) {
      console.warn(`Skipping missing file: ${fileName}`);
      continue;
    }

    let jsonData: any;
    try {
      jsonData = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch (err) {
      console.error(`Failed to parse ${fileName}:`, err);
      continue;
    }

    const modelName = path.basename(fileName, path.extname(fileName));
    const model: any = (prisma as any)[modelName];

    if (!model) {
      console.warn(` Skipping unknown model: ${modelName}`);
      continue;
    }

    for (const data of jsonData) {
      try {
        await model.create({ data });
      } catch (createErr: any) {
        console.error(
          `Error creating in ${modelName}:`,
          createErr.message || createErr,
        );
      }
    }
  }

  console.log("\nSeeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
