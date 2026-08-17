import { PrismaClient, Post } from "../../generated/prisma/client";

export class PostAPI {
  prisma: PrismaClient;
  context: any;

  constructor({ prisma }: { prisma: PrismaClient }) {
    this.prisma = prisma;
  }

  initialize(config: { context: any }) {
    this.context = config.context;
  }

  async createPost(data: {
    title: string;
    content: string;
    slug: string;
    imageUrl?: string;
    authorId: string;
  }): Promise<Post> {
    try {
      return await this.prisma.post.create({
        data: {
          title: data.title,
          slug: data.slug,
          content: data.content,
          imageUrl: data.imageUrl || null,
          author: { connect: { id: data.authorId } },
        },
        include: {
          author: true,
        },
      });
    } catch (error) {
      console.error("Error creating post: ", error);
      throw error;
    }
  }

  async getPostById(postId: string): Promise<Post | null> {
    try {
      return await this.prisma.post.findUnique({
        where: { id: postId },
        include: { author: true, comments: true, likes: true, tags: true },
      });
    } catch (error) {
      console.error("Error fetching post by ID:", error);
      return null;
    }
  }

  async updatePost(
    postId: string,
    data: Partial<Omit<Post, "id" | "createdAt" | "updatedAt">>,
  ): Promise<Post | null> {
    try {
      return await this.prisma.post.update({
        where: { id: postId },
        data,
      });
    } catch (error) {
      console.error("Error updating post:", error);
      return null;
    }
  }

  async deletePost(postId: string): Promise<boolean> {
    try {
      const post = await this.prisma.post.delete({
        where: {
          id: postId,
        },
      });

      return !!post;
    } catch (error) {
      console.log("Error deleting post: ", error);
      return false;
    }
  }

  async getPostBySlug(slug: string): Promise<Post | null> {
    try {
      return await this.prisma.post.findFirst({
        where: { slug },
        include: { author: true, comments: true },
      });
    } catch (error) {
      console.log("Error fetching post by slug: ", error);
      throw error;
    }
  }
  async getAllPosts(): Promise<Post[]> {
    try {
      return await this.prisma.post.findMany({
        include: { author: true, comments: true, tags: true, likes: true },
      });
    } catch (error) {
      console.error("Error fetching posts: ", error);
      return [];
    }
  }
}
