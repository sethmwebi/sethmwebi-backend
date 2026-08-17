import { PrismaClient, Message } from "../../generated/prisma/client";

export class MessageAPI {
  prisma: PrismaClient;
  context: any;

  constructor({ prisma }: { prisma: PrismaClient }) {
    this.prisma = prisma;
  }

  initialize(config: { context: any }) {
    this.context = config.context;
  }

  async createMessage(
    name: string,
    email: string,
    message: string,
  ): Promise<Message> {
    try {
      return await this.prisma.message.create({
        data: { name, email, message },
      });
    } catch (error) {
      console.log("Error creating message: ", error);
      throw error;
    }
  }

  async getMessages(): Promise<Message[]> {
    try {
      return await this.prisma.message.findMany({
        orderBy: { createdAt: "desc" },
      });
    } catch (error) {
      console.log("Error fetching messages:", error);
      return [];
    }
  }

  async getMessage(id: string): Promise<Message | null> {
    try {
      return await this.prisma.message.findUnique({ where: { id } });
    } catch (error) {
      console.log("Error fetching message:", error);
      return null;
    }
  }

  async markAsRead(id: string): Promise<Message> {
    try {
      return await this.prisma.message.update({
        where: { id },
        data: { read: true },
      });
    } catch (error) {
      console.log("Error marking message as read:", error);
      throw error;
    }
  }

  async getUnreadMessages(): Promise<Message[]> {
    try {
      return await this.prisma.message.findMany({
        where: { read: false },
        orderBy: { createdAt: "desc" },
      });
    } catch (error) {
      console.error("Error fetching unread messages:", error);
      return [];
    }
  }

  async deleteMessage(id: string): Promise<Message> {
    try {
      return await this.prisma.message.delete({ where: { id } });
    } catch (error) {
      console.error("Error deleting message:", error);
      throw error;
    }
  }
}
