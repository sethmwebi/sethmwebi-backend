import { PrismaClient, Media } from "../../generated/prisma/client";

export class MediaAPI {
  prisma: PrismaClient;
  context: any;

  constructor({ prisma }: { prisma: PrismaClient }) {
    this.prisma = prisma;
  }

  initialize(config: { context: any }) {
    this.context = config.context;
  }

  async createMedia(data: {
    url: string;
    type: string;
    postId: string;
    userId: string;
  }): Promise<Media> {
    try {
      return await this.prisma.media.create({
        data,
      });
    } catch (error) {
      console.log("Error creating media: ", error);
      throw error;
    }
  }

  async getMediaByUserId(userId: string): Promise<Media[]> {
    try {
      return await this.prisma.media.findMany({
        where: { userId },
      });
    } catch (error) {
      throw new Error("Failed to fetch media by user.");
    }
  }
}
