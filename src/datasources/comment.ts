import { PrismaClient, Comment } from "../../generated/prisma/client";

export class CommentAPI {
  prisma: PrismaClient;
  context: any;

  constructor({ prisma }: { prisma: PrismaClient }) {
    this.prisma = prisma;
  }

  initialize(config: { context: any }) {
    this.context = config.context;
  }

  async createComment(data: {
    content: string;
    slug: string;
    userId: string;
    parentId?: string;
  }): Promise<Comment> {
    try {
      return await this.prisma.comment.create({
        data: {
          content: data.content,
          slug: data.slug, // relation field to Post.slug
          userId: data.userId,
          ...(data.parentId ? { parentId: data.parentId } : {}),
        },
        include: {
          user: true,
          post: true,
          replies: true,
        },
      });
    } catch (error) {
      console.error("Error creating comment:", error);
      throw error;
    }
  }

  async updateComment(
    id: string,
    data: { content: string },
  ): Promise<Comment | null> {
    try {
      return await this.prisma.comment.update({
        where: { id },
        data: {
          content: data.content,
        },
        include: {
          user: true,
          post: true,
          replies: true,
        },
      });
    } catch (error) {
      console.error("Error updating comment:", error);
      return null;
    }
  }

  async getCommentById(commentId: string): Promise<Comment | null> {
    try {
      return await this.prisma.comment.findUnique({
        where: { id: commentId },
        include: {
          user: true,
          post: true,
          replies: {
            include: { user: true },
            orderBy: { createdAt: "asc" },
          },
        },
      });
    } catch (error) {
      console.log("Error fetching comment by ID: ", error);
      return null;
    }
  }

  async getCommentsBySlug(slug: string): Promise<Comment[]> {
    try {
      return await this.prisma.comment.findMany({
        where: {
          slug, // matches the relation field
          parentId: null, // only top-level comments
        },
        include: {
          user: true,
          post: true,
          replies: {
            include: { user: true },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    } catch (error) {
      console.log("Error fetching comments by slug: ", error);
      return [];
    }
  }

  async deleteComment(commentId: string): Promise<boolean> {
    try {
      await this.prisma.comment.delete({
        where: { id: commentId },
      });
      return true;
    } catch (error) {
      console.error("Error deleting comment: ", error);
      return false;
    }
  }
}
