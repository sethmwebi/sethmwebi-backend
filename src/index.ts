import dotenv from "dotenv";
dotenv.config();
import express, { Request, Response } from "express";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express5";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import http from "http";
import cors from "cors";
import { readFileSync } from "fs";
import path from "path";
import { gql } from "graphql-tag";
import { resolvers } from "./utils/errorHandler";
import { authDirective } from "./directives/authDirective";
import { ApolloServerPluginLandingPageLocalDefault } from "@apollo/server/plugin/landingPage/default";
import {
  UserAPI,
  AccountAPI,
  VerificationTokenAPI,
  PostAPI,
  CommentAPI,
  LikeAPI,
  CategoryAPI,
  TagAPI,
  PostCategoryAPI,
  PostTagAPI,
  MediaAPI,
  MessageAPI,
} from "./datasources";
import { DataSourceContext } from "./context";
import db from "./modules/db";
import passport from "passport";
import { authenticateJwt } from "./lib/passport";
import { ZodError } from "zod";
import { makeExecutableSchema } from "@graphql-tools/schema";
import depthLimit from "graphql-depth-limit";

const app = express();

const httpServer = http.createServer(app);

const baseTypeDefs = gql(
  readFileSync(path.resolve(__dirname, "./schema.graphql"), {
    encoding: "utf-8",
  }),
);

// auth directive
const { authDirectiveTypeDefs, authDirectiveTransformer } =
  authDirective("auth");
async function startApolloServer() {
  let schema = makeExecutableSchema({
    typeDefs: [authDirectiveTypeDefs, baseTypeDefs],
    resolvers,
  });
  schema = authDirectiveTransformer(schema);

  const server = new ApolloServer<DataSourceContext>({
    schema,
    introspection: true,
    includeStacktraceInErrorResponses: process.env.NODE_ENV === "development",
    validationRules: [depthLimit(6, { ignore: ["__schema", "__type"] })],
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      ApolloServerPluginLandingPageLocalDefault({ embed: true }),
    ],
    formatError: (formattedError, error: any) => {
      if (error.originalError instanceof ZodError) {
        return {
          message: "Validation error occurred.",
          extensions: {
            code: "BAD_USER_INPUT",
            status: 400,
            errors: error.originalError.errors,
          },
        };
      }
      if (formattedError.extensions?.code === "INTERNAL_SERVER_ERROR") {
        console.error("Internal server error:", error); // Better logging
        return {
          message: "An internal server error occurred.",
          extensions: { code: "INTERNAL_SERVER_ERROR", status: 500 },
        };
      }
      return formattedError;
    },
  });

  await server.start();

  app.use(cors<cors.CorsRequest>());
  app.use(express.json());
  app.use(passport.initialize());

  // Fixed middleware usage
  app.use(
    "/",
    expressMiddleware(server, {
      context: async ({ req, res }): Promise<DataSourceContext> => {
        const user = await authenticateJwt(req);

        return {
          db,
          cache: server.cache, // or your cache instance
          user,
          req,
          res,
          dataSources: {
            accountAPI: new AccountAPI({ prisma: db }),
            categoryAPI: new CategoryAPI({ prisma: db }),
            commentAPI: new CommentAPI({ prisma: db }),
            likeAPI: new LikeAPI({ prisma: db }),
            mediaAPI: new MediaAPI({ prisma: db }),
            postAPI: new PostAPI({ prisma: db }),
            postCategoryAPI: new PostCategoryAPI({ prisma: db }),
            postTagAPI: new PostTagAPI({ prisma: db }),
            tagAPI: new TagAPI({ prisma: db }),
            userAPI: new UserAPI({ prisma: db }),
            verificationAPI: new VerificationTokenAPI({ prisma: db }),
            messageAPI: new MessageAPI({ prisma: db }),
          },
        };
      },
    }),
  );

  await new Promise<void>((resolve) =>
    httpServer.listen({ port: 4000 }, resolve),
  );

  console.log(`🚀 Server ready at http://localhost:4000/`);
}

startApolloServer();
