import { PrismaClient, Like } from "../../generated/prisma/client";

export class LikeAPI {
  prisma: PrismaClient;
  context: any;

  constructor({ prisma }: { prisma: PrismaClient }) {
    this.prisma = prisma;
  }

  initialize(config: { context: any }) {
    this.context = config.context;
  }

  async createLike(data: { postId: string; userId: string }): Promise<Like> {
    try {
      return await this.prisma.like.create({
        data,
      });
    } catch (error) {
      console.error("Error creating like: ", error);
      throw error;
    }
  }

  async deleteLike(likeId: string): Promise<boolean> {
    try {
      await this.prisma.like.delete({
        where: { id: likeId },
      });
      return true;
    } catch (error) {
      console.log("Error deleting like: ", error);
      return false;
    }
  }
}
