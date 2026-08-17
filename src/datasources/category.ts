import { PrismaClient, Category } from "../../generated/prisma/client";

export class CategoryAPI {
  prisma: PrismaClient;
  context: any;

  constructor({ prisma }: { prisma: PrismaClient }) {
    this.prisma = prisma;
  }

  initialize(config: { context: any }) {
    this.context = config.context;
  }

  async getCategoryById(categoryId: string): Promise<Category | null> {
    try {
      return await this.prisma.category.findUnique({
        where: { id: categoryId },
      });
    } catch (error) {
      console.error("Error fetching category by ID: ", error);
      return null;
    }
  }

  async getCategories(): Promise<Category[]> {
    try {
      return await this.prisma.category.findMany();
    } catch (error) {
      console.error("Error fetching categories: ", error);
      return [];
    }
  }
}
