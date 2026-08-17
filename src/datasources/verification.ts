import { PrismaClient, VerificationToken } from "../../generated/prisma/client";

export class VerificationTokenAPI {
  prisma: PrismaClient;
  context: any;

  constructor({ prisma }: { prisma: PrismaClient }) {
    this.prisma = prisma;
  }

  initialize(config: { context: any }) {
    this.context = config.context;
  }

  async createVerificationToken(
    identifier: string,
    token: string,
    expires: Date,
  ): Promise<VerificationToken> {
    try {
      return await this.prisma.verificationToken.create({
        data: { identifier, token, expires },
      });
    } catch (error) {
      console.error("Error creating verification token: ", error);
      throw error;
    }
  }

  async getVerificationToken(
    identifier: string,
    token: string,
  ): Promise<VerificationToken | null> {
    try {
      return await this.prisma.verificationToken.findUnique({
        where: { identifier_token: { identifier, token } },
      });
    } catch (error) {
      console.error("Error fetching verification token:", error);
      return null;
    }
  }
}
