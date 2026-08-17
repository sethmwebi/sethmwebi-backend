import { PrismaClient, PostCategory } from "../../generated/prisma/client";

export class PostCategoryAPI {
  prisma: PrismaClient;
  context: any;

  constructor({ prisma }: { prisma: PrismaClient }) {
    this.prisma = prisma;
  }

  initialize(config: { context: any }) {
    this.context = config.context;
  }

  async createPostCategory(
    postId: string,
    categoryId: string,
  ): Promise<PostCategory> {
    try {
      return await this.prisma.postCategory.create({
        data: { postId, categoryId },
      });
    } catch (error) {
      console.error("Error creating post category: ", error);
      throw error;
    }
  }

  async getPostCategories(postId: string): Promise<PostCategory[]> {
    try {
      return await this.prisma.postCategory.findMany({
        where: { postId },
      });
    } catch (error) {
      console.error("Error fetching post categories: ", error);
      return [];
    }
  }
}
