import { Account, PrismaClient } from "../../generated/prisma/client";

export class AccountAPI {
  prisma: PrismaClient;
  context: any;

  constructor({ prisma }: { prisma: PrismaClient }) {
    this.prisma = prisma;
  }

  initialize(config: { context: any }) {
    this.context = config.context;
  }

  async getAccountByUserId(userId: string): Promise<Account | null> {
    try {
      return await this.prisma.account.findFirst({
        where: { userId },
      });
    } catch (error) {
      console.log("Error fetching account by user ID:", error);
      return null;
    }
  }
}
