import { KeyValueCache } from "@apollo/utils.keyvaluecache";
import { PrismaClient } from "../generated/prisma/client";
import { Request, Response } from "express";
import {
  AccountAPI,
  CategoryAPI,
  CommentAPI,
  LikeAPI,
  MediaAPI,
  MessageAPI,
  PostAPI,
  PostCategoryAPI,
  PostTagAPI,
  TagAPI,
  UserAPI,
  VerificationTokenAPI,
} from "./datasources";
import { User } from "../generated/prisma/client";

export interface DataSourceContext {
  db: PrismaClient;
  user?: User | null;
  req: Request;
  res: Response;
  cache: KeyValueCache;
  dataSources: {
    accountAPI: AccountAPI;
    categoryAPI: CategoryAPI;
    commentAPI: CommentAPI;
    likeAPI: LikeAPI;
    mediaAPI: MediaAPI;
    postAPI: PostAPI;
    postCategoryAPI: PostCategoryAPI;
    postTagAPI: PostTagAPI;
    tagAPI: TagAPI;
    userAPI: UserAPI;
    verificationAPI: VerificationTokenAPI;
    messageAPI: MessageAPI;
  };
}
