import { PrismaClient, User } from "../../generated/prisma/client";

export class UserAPI {
  prisma: PrismaClient;
  context: any;

  constructor({ prisma }: { prisma: PrismaClient }) {
    this.prisma = prisma;
  }

  // initialize the context
  initialize(config: { context: any }) {
    this.context = config.context;
  }

  async createUser(data: {
    email: string;
    name?: string | null;
    image?: string | null;
    role?: "USER" | "ADMIN" | "SUPERADMIN";
  }): Promise<User> {
    try {
      const user = await this.prisma.user.create({
        data,
      });
      return user;
    } catch (error) {
      throw new Error("Failed to create user");
    }
  }

  // get user by id
  async getUserById(userId: string): Promise<User | null> {
    try {
      return await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          posts: true,
          comments: true,
          likes: true,
          media: true,
        },
      });
    } catch (error) {
      console.log("Error fetching user by ID:", error);
      return null;
    }
  }

  // get user by id
  async getUserByEmail(email: string): Promise<User | null> {
    try {
      return await this.prisma.user.findUnique({
        where: { email },
        include: {
          posts: true,
          comments: true,
          likes: true,
          media: true,
        },
      });
    } catch (error) {
      console.log("Error fetching user by ID:", error);
      return null;
    }
  }

  // get a user's posts
  async getPostsByUserId(userId: string) {
    try {
      return await this.prisma.post.findMany({
        where: { authorId: userId },
      });
    } catch (error) {
      console.log("Error fetching posts by user: ", error);
      return null;
    }
  }

  // get a user's comments
  async getCommentsByUserId(userId: string) {
    try {
      return await this.prisma.comment.findMany({
        where: { userId },
      });
    } catch (error) {
      console.log("Error fetching comments by user:", error);
      return null;
    }
  }

  // get likes by userId
  async getLikesByUserId(userId: string) {
    try {
      return await this.prisma.like.findMany({
        where: { userId },
      });
    } catch (error) {
      console.log("Error fetching likes by user:", error);
      return null;
    }
  }

  // get media by user id
  async getMediaByUserId(userId: string) {
    try {
      return await this.prisma.media.findMany({
        where: { userId },
      });
    } catch (error) {
      console.log("Error fetching media by user: ", error);
      return null;
    }
  }

  // update the user profile
  async updateUserProfile(
    userId: string,
    data: Partial<User>,
  ): Promise<User | null> {
    try {
      return await this.prisma.user.update({
        where: { id: userId },
        data,
      });
    } catch (error) {
      console.log("Error updating user profile: ", error);
      return null;
    }
  }

  // delete user
  async deleteUser(userId: string): Promise<boolean> {
    try {
      await this.prisma.user.delete({
        where: { id: userId },
      });
      return true;
    } catch (error) {
      console.log("Error deleting user:", error);
      return false;
    }
  }
}
