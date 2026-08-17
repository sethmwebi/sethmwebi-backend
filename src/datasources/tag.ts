import { PrismaClient, Tag } from "../../generated/prisma/client";

export class TagAPI {
  prisma: PrismaClient;
  context: any;

  constructor({ prisma }: { prisma: PrismaClient }) {
    this.prisma = prisma;
  }

  initialize(config: { context: any }) {
    this.context = config.context;
  }

  async createTag(data: { name: string; slug: string }): Promise<Tag> {
    try {
      return await this.prisma.tag.create({
        data,
      });
    } catch (error) {
      console.error("Error creating tag:", error);
      throw new Error("Failed to create tag");
    }
  }

  async getTagById(tagId: string): Promise<Tag | null> {
    try {
      return await this.prisma.tag.findUnique({ where: { id: tagId } });
    } catch (error) {
      console.error("Error fetching tag by ID:", error);
      return null;
    }
  }

  async getTagBySlug(slug: string): Promise<Tag | null> {
    try {
      return await this.prisma.tag.findUnique({
        where: { slug },
      });
    } catch (error) {
      return null;
    }
  }

  async getTags(): Promise<Tag[]> {
    try {
      return await this.prisma.tag.findMany();
    } catch (error) {
      console.log("Error fetching tags: ", error);
      return [];
    }
  }
}
