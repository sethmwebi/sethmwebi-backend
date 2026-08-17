import {
  Post,
  PostTag,
  PrismaClient,
  Tag,
} from "../../generated/prisma/client";

export class PostTagAPI {
  prisma: PrismaClient;
  context: any;

  constructor({ prisma }: { prisma: PrismaClient }) {
    this.prisma = prisma;
  }

  initialize(config: { context: any }) {
    this.context = config.context;
  }

  async createPostTag(data: {
    postId: string;
    tagId: string;
  }): Promise<PostTag> {
    try {
      return await this.prisma.postTag.create({ data });
    } catch (error) {
      console.log("Error creating post tag: ", error);
      throw error;
    }
  }

  async getPostTagsByTagId(tagId: string): Promise<Post[]> {
    try {
      const postTags = await this.prisma.postTag.findMany({
        where: { tagId },
        include: { post: true },
      });
      return postTags.map((postTag) => postTag.post);
    } catch (error) {
      return [];
    }
  }

  async getPostTags(postId: string): Promise<Tag[]> {
    try {
      const postTags = await this.prisma.postTag.findMany({
        where: { postId },
        include: { tag: true },
      });
      return postTags.map((postTag) => postTag.tag);
    } catch (error) {
      console.error("Error fetching post tags: ", error);
      return [];
    }
  }
}
