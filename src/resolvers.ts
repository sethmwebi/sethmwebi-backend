import { compare, hash } from "bcrypt";
import { GraphQLError } from "graphql";
import {
  verifyRefreshToken,
  generateRefreshToken,
  generateToken,
} from "./lib/authUtils";
import {
  CreateCommentSchema,
  CreateLikeSchema,
  CreateMediaSchema,
  CreateMessageSchema,
  CreatePostCategorySchema,
  CreatePostSchema,
  CreatePostTagSchema,
  CreateTagSchema,
  CreateUserSchema,
  LoginSchema,
  RegisterSchema,
  SanitizedCreateCommentInput,
  SanitizedCreateLikeInput,
  SanitizedCreateMediaInput,
  SanitizedCreateMessageInput,
  SanitizedCreatePostCategoryInput,
  SanitizedCreatePostInput,
  SanitizedCreatePostTagInput,
  SanitizedCreateTagInput,
  SanitizedLoginUserInput,
  SanitizedRegisterUserInput,
  SanitizedUpdateCommentInput,
  SanitizedUpdatePostInput,
  UpdateCommentSchema,
  UpdateUserProfileSchema,
} from "./schemas";
import { Resolvers, Role } from "./types";
import { getGraphQLRateLimiter } from "graphql-rate-limit";
import { verifyGoogleIdToken } from "./lib/google-auth";

const rateLimiter = getGraphQLRateLimiter({
  identifyContext: (ctx) => ctx.user?.id ?? ctx.req?.ip ?? "anonymous",
});

async function checkRateLimit(
  resolverArgs: { parent: any; args: any; context: any; info: any },
  config: { max: number; window: string },
  message = "Too many requests. Please try again later.",
) {
  const errorMessage = await rateLimiter(resolverArgs, config);
  if (errorMessage) {
    throw new GraphQLError(message, {
      extensions: { code: "RATE_LIMITED", status: 429 },
    });
  }
}

export const resolvers: Resolvers = {
  Query: {
    me: async (parent, args, context, info) => {
      const { user, db } = context;

      // Authenticated users: 60 requests / minute
      await checkRateLimit(
        { parent, args, context, info },
        { max: 60, window: "1m" },
      );

      if (!user) {
        throw new GraphQLError(
          "You must be logged in to access this resource.",
          { extensions: { code: "UNAUTHENTICATED", status: 401 } },
        );
      }

      try {
        const dbUser = await db.user.findUnique({
          where: { id: user.id },
          include: { accounts: true },
        });

        if (!dbUser) {
          throw new GraphQLError(
            "User not found. Please ensure the user ID is correct.",
            { extensions: { code: "BAD_USER_INPUT", status: 404 } },
          );
        }

        return {
          ...dbUser,
          role: dbUser.role as Role,
          emailVerified: dbUser.emailVerified
            ? dbUser.emailVerified.toString()
            : null,
          createdAt: dbUser.createdAt.toString(),
          updatedAt: dbUser.updatedAt.toString(),
          accounts: dbUser.accounts.map((account) => ({
            ...account,
            createdAt: new Date(account.createdAt).toISOString(),
            updatedAt: new Date(account.updatedAt).toISOString(),
          })),
        };
      } catch (error) {
        console.error("Error in 'me' resolver: ", error);
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to fetch user data.", {
          extensions: { code: "INTERNAL_SERVER_ERROR", status: 500 },
        });
      }
    },

    getUserById: async (parent, args, context, info) => {
      const { dataSources } = context;
      const { id } = args as { id: string };

      // Public endpoint — moderate limit: 30 requests / minute
      await checkRateLimit(
        { parent, args, context, info },
        { max: 30, window: "1m" },
      );

      try {
        const user = await dataSources.userAPI.getUserById(id);
        if (!user) {
          throw new GraphQLError("User not found.", {
            extensions: { code: "USER_NOT_FOUND", status: 404 },
          });
        }
        return {
          ...user,
          role: user.role as Role,
          emailVerified: user.emailVerified
            ? user.emailVerified.toString()
            : null,
          createdAt: user.createdAt.toString(),
          updatedAt: user.updatedAt.toString(),
        };
      } catch (error) {
        console.log("Error in getUserById resolver: ", error);
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to fetch user.", {
          extensions: { code: "INTERNAL_SERVER_ERROR", status: 500 },
        });
      }
    },

    getPostsByUserId: async (parent, args, context, info) => {
      const { dataSources } = context;
      const { id } = args as { id: string };

      // Public listing — 30 requests / minute
      await checkRateLimit(
        { parent, args, context, info },
        { max: 30, window: "1m" },
      );

      try {
        const posts = await dataSources.userAPI.getPostsByUserId(id);
        if (!posts || posts.length === 0) {
          throw new Error("No posts found for the user");
        }
        return posts.map((post) => ({
          ...post,
          createdAt: post.createdAt.toString(),
          updatedAt: post.updatedAt.toString(),
        }));
      } catch (error) {
        throw new Error("Failed to fetch posts by user id");
      }
    },

    getPostBySlug: async (parent, args, context, info) => {
      const { dataSources } = context;
      const { slug } = args as { slug: string };

      try {
        const post = await dataSources.postAPI.getPostBySlug(slug);
        if (!post) {
          throw new GraphQLError(`Post with slug "${slug}" not found`, {
            extensions: { code: "POST_NOT_FOUND", status: 404 },
          });
        }
        return {
          ...post,
          createdAt: post.createdAt.toString(),
          updatedAt: post.updatedAt.toString(),
        };
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to fetch post by slug", {
          extensions: { code: "INTERNAL_SERVER_ERROR", status: 500 },
        });
      }
    },

    getCommentsBySlug: async (parent, args, context, info) => {
      const { dataSources } = context;
      const { slug } = args as { slug: string };

      try {
        const comments = await dataSources.commentAPI.getCommentsBySlug(slug);

        if (!comments || comments.length == 0) {
          return [];
        }

        return comments.map((comment) => ({
          ...comment,
          createdAt: comment.createdAt.toISOString(),
        }));
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to fetch comments by slug", {
          extensions: { code: "INTERNAL_SERVER_ERROR", status: 500 },
        });
      }
    },

    getCommentsByUserId: async (parent, args, context, info) => {
      const { dataSources } = context;
      const { id } = args as { id: string };

      await checkRateLimit(
        { parent, args, context, info },
        { max: 30, window: "1m" },
      );

      try {
        const comments = await dataSources.userAPI.getCommentsByUserId(id);
        if (!comments || comments.length === 0) {
          throw new GraphQLError("No posts found for the user", {
            extensions: { code: "NO_POSTS_FOUND", status: 404 },
          });
        }
        return comments.map((comment) => ({
          ...comment,
          createdAt: comment.createdAt.toString(),
        }));
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to fetch posts by user ID", {
          extensions: { code: "INTERNAL_SERVER_ERROR", status: 500 },
        });
      }
    },

    getLikesByUserId: async (parent, args, context, info) => {
      const { dataSources } = context;
      const { id } = args as { id: string };

      await checkRateLimit(
        { parent, args, context, info },
        { max: 30, window: "1m" },
      );

      try {
        const likes = await dataSources.userAPI.getLikesByUserId(id);
        if (!likes || likes.length === 0) {
          throw new GraphQLError("No likes found for the user", {
            extensions: { code: "NO_LIKES_FOUND", status: 404 },
          });
        }
        return likes.map((like) => ({
          ...like,
          createdAt: like.createdAt.toString(),
        }));
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to fetch likes by user ID.", {
          extensions: { code: "INTERNAL_SERVER_ERROR", status: 500 },
        });
      }
    },

    getMediaByUserId: async (parent, args, context, info) => {
      const { dataSources } = context;
      const { id } = args as { id: string };

      await checkRateLimit(
        { parent, args, context, info },
        { max: 30, window: "1m" },
      );

      try {
        const media = await dataSources.userAPI.getMediaByUserId(id);
        if (!media || media.length === 0) {
          throw new GraphQLError("No media found for this user", {
            extensions: { code: "NO_MEDIA_FOUND", status: 404 },
          });
        }
        return media;
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to fetch media by user ID", {
          extensions: { code: "INTERNAL_SERVER_ERROR", status: 500 },
        });
      }
    },

    account: async (parent, args, context, info) => {
      const { dataSources, user } = context;

      // Authenticated — 60 requests / minute
      await checkRateLimit(
        { parent, args, context, info },
        { max: 60, window: "1m" },
      );

      try {
        if (!user || !user.id) {
          throw new GraphQLError("User is not authenticated", {
            extensions: { code: "UNAUTHENTICATED", status: 401 },
          });
        }
        const account = await dataSources.accountAPI.getAccountByUserId(
          user.id!,
        );
        if (!account) {
          throw new GraphQLError(`Account not found for user ID: ${user.id}`, {
            extensions: { code: "ACCOUNT_NOT_FOUND", status: 404 },
          });
        }
        return {
          ...account,
          createdAt: account.createdAt.toString(),
          updatedAt: account.updatedAt.toString(),
        };
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to fetch account information", {
          extensions: { code: "INTERNAL_SERVER_ERROR", status: 500 },
        });
      }
    },

    category: async (parent, args, context, info) => {
      const { dataSources } = context;
      const { id } = args as { id: string };

      await checkRateLimit(
        { parent, args, context, info },
        { max: 60, window: "1m" },
      );

      try {
        const category = await dataSources.categoryAPI.getCategoryById(id);
        if (!category) {
          throw new GraphQLError(`Category with ID ${id} not found.`, {
            extensions: { code: "CATEGORY_NOT_FOUND", status: 404 },
          });
        }
        return category;
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to fetch category", {
          extensions: { code: "INTERNAL_SERVER_ERROR", status: 500 },
        });
      }
    },

    categories: async (parent, args, context, info) => {
      const { dataSources } = context;

      await checkRateLimit(
        { parent, args, context, info },
        { max: 60, window: "1m" },
      );

      try {
        const categories = await dataSources.categoryAPI.getCategories();
        if (!categories || categories.length === 0) {
          throw new GraphQLError("No categories found.", {
            extensions: { code: "CATEGORIES_NOT_FOUND", status: 404 },
          });
        }
        return categories;
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to fetch categories", {
          extensions: { code: "INTERNAL_SERVER_ERROR", status: 500 },
        });
      }
    },

    comment: async (parent, args, context, info) => {
      const { dataSources } = context;
      const { id } = args as { id: string };

      await checkRateLimit(
        { parent, args, context, info },
        { max: 60, window: "1m" },
      );

      try {
        const comment = await dataSources.commentAPI.getCommentById(id);
        if (!comment) {
          throw new GraphQLError(`Comment with ID ${id} not found`, {
            extensions: { code: "COMMENT_NOT_FOUND", status: 404 },
          });
        }
        return { ...comment, createdAt: comment.createdAt.toString() };
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to fetch comment", {
          extensions: { code: "INTERNAL_SERVER_ERROR", status: 500 },
        });
      }
    },

    post: async (parent, args, context, info) => {
      const { dataSources } = context;
      const { id } = args as { id: string };

      await checkRateLimit(
        { parent, args, context, info },
        { max: 60, window: "1m" },
      );

      try {
        const post = await dataSources.postAPI.getPostById(id);
        if (!post) {
          throw new GraphQLError(`Post with ID ${id} not found`, {
            extensions: { code: "POST_NOT_FOUND", status: 404 },
          });
        }
        return {
          ...post,
          createdAt: post.createdAt.toString(),
          updatedAt: post.updatedAt.toString(),
        };
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to fetch post", {
          extensions: { code: "INTERNAL_SERVER_ERROR", status: 500 },
        });
      }
    },

    posts: async (parent, args, context, info) => {
      const { dataSources } = context;

      await checkRateLimit(
        { parent, args, context, info },
        { max: 60, window: "1m" },
      );

      try {
        const posts = await dataSources.postAPI.getAllPosts();
        if (!posts || posts.length === 0) {
          throw new GraphQLError("No posts found", {
            extensions: { code: "POSTS_NOT_FOUND", status: 404 },
          });
        }
        return posts.map((post) => ({
          ...post,
          createdAt: post.createdAt.toString(),
          updatedAt: post.createdAt.toString(),
        }));
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to fetch posts", {
          extensions: { code: "INTERNAL_SERVER_ERROR", status: 500 },
        });
      }
    },

    getPostCategories: async (parent, args, context, info) => {
      const { dataSources } = context;
      const { postId } = args as { postId: string };

      await checkRateLimit(
        { parent, args, context, info },
        { max: 60, window: "1m" },
      );

      try {
        const postCategories =
          await dataSources.postCategoryAPI.getPostCategories(postId);
        if (!postCategories || postCategories.length === 0) {
          throw new GraphQLError("No categories found for the specified post", {
            extensions: { code: "CATEGORIES_NOT_FOUND", status: 404 },
          });
        }
        return postCategories;
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to fetch post categories", {
          extensions: { code: "INTERNAL_SERVER_ERROR", status: 500 },
        });
      }
    },

    getPostTags: async (parent, args, context, info) => {
      const { dataSources } = context;
      const { postId } = args as { postId: string };

      await checkRateLimit(
        { parent, args, context, info },
        { max: 60, window: "1m" },
      );

      try {
        const postTags = await dataSources.postTagAPI.getPostTags(postId);
        if (!postTags || postTags.length === 0) {
          throw new GraphQLError("No tags for the specified user", {
            extensions: { code: "TAGS_NOT_FOUND", status: 404 },
          });
        }
        return postTags;
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to fetch post tags", {
          extensions: { code: "INTERNAL_SERVER_ERROR", status: 500 },
        });
      }
    },

    getTagById: async (parent, args, context, info) => {
      const { dataSources } = context;
      const { tagId } = args as { tagId: string };

      await checkRateLimit(
        { parent, args, context, info },
        { max: 60, window: "1m" },
      );

      try {
        const tag = await dataSources.tagAPI.getTagById(tagId);
        if (!tag) {
          throw new GraphQLError(`Tag with ID ${tagId} not found`, {
            extensions: { code: "TAG_NOT_FOUND", status: 404 },
          });
        }
        return tag;
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to fetch tag by ID", {
          extensions: { code: "INTERNAL_SERVER_ERROR", status: 500 },
        });
      }
    },

    tags: async (parent, args, context, info) => {
      const { dataSources } = context;

      await checkRateLimit(
        { parent, args, context, info },
        { max: 60, window: "1m" },
      );

      try {
        const tags = await dataSources.tagAPI.getTags();
        if (!tags || tags.length === 0) {
          throw new GraphQLError("No tags found", {
            extensions: { code: "TAGS_NOT_FOUND", status: 404 },
          });
        }
        return tags;
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to fetch tags", {
          extensions: { code: "INTERNAL_SERVER_ERROR", status: 500 },
        });
      }
    },

    // Inbox queries — tighter limit since they're auth-gated and potentially expensive
    getMessages: async (parent, args, context, info) => {
      const { dataSources, user } = context;

      // 20 requests / minute — inbox polling protection
      await checkRateLimit(
        { parent, args, context, info },
        { max: 20, window: "1m" },
        "Too many requests. Please slow down your message polling.",
      );

      try {
        if (!user) {
          throw new GraphQLError(
            "You must be logged in to access this resource.",
            { extensions: { code: "UNAUTHENTICATED", status: 401 } },
          );
        }
        const messages = await dataSources.messageAPI.getMessages();
        if (!messages || messages.length === 0) {
          throw new GraphQLError("No messages found.", {
            extensions: { code: "MESSAGES_NOT_FOUND", status: 404 },
          });
        }
        return messages.map((message) => ({
          ...message,
          read: message.read ? "true" : "false",
          createdAt: message.createdAt.toString(),
        }));
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to fetch messages", {
          extensions: { code: "INTERNAL_SERVER_ERROR", status: 500 },
        });
      }
    },

    getMessage: async (parent, args, context, info) => {
      const { dataSources, user } = context;
      const { id } = args as { id: string };

      await checkRateLimit(
        { parent, args, context, info },
        { max: 30, window: "1m" },
      );

      try {
        if (!user) {
          throw new GraphQLError(
            "You must be logged in to access this resource.",
            { extensions: { code: "UNAUTHENTICATED", status: 401 } },
          );
        }
        const message = await dataSources.messageAPI.getMessage(id);
        if (!message) {
          throw new GraphQLError(`Message with ID ${id} not found.`, {
            extensions: { code: "MESSAGE_NOT_FOUND", status: 404 },
          });
        }
        return {
          ...message,
          read: message.read ? "true" : "false",
          createdAt: message.createdAt.toString(),
        };
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to fetch message", {
          extensions: { code: "INTERNAL_SERVER_ERROR", status: 500 },
        });
      }
    },

    getUnreadMessages: async (parent, args, context, info) => {
      const { dataSources, user } = context;

      // Same as getMessages — inbox polling
      await checkRateLimit(
        { parent, args, context, info },
        { max: 20, window: "1m" },
        "Too many requests. Please slow down your message polling.",
      );

      try {
        if (!user) {
          throw new GraphQLError(
            "You must be logged in to access this resource.",
            { extensions: { code: "UNAUTHENTICATED", status: 401 } },
          );
        }
        const messages = await dataSources.messageAPI.getUnreadMessages();
        if (!messages || messages.length === 0) {
          throw new GraphQLError("No unread messages found.", {
            extensions: { code: "MESSAGES_NOT_FOUND", status: 404 },
          });
        }
        return messages.map((message) => ({
          ...message,
          read: message.read ? "true" : "false",
          createdAt: message.createdAt.toString(),
        }));
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to fetch unread messages", {
          extensions: { code: "INTERNAL_SERVER_ERROR", status: 500 },
        });
      }
    },
  },

  Tag: {
    posts: async (parent, args, context, info) => {
      const { dataSources } = context;
      const tag = parent;

      await checkRateLimit(
        { parent, args, context, info },
        { max: 60, window: "1m" },
      );

      try {
        const posts = await dataSources.postTagAPI.getPostTagsByTagId(tag.id);
        if (!posts || posts.length === 0) {
          throw new GraphQLError(`No posts found for tag with ID ${tag.id}`, {
            extensions: { code: "POSTS_NOT_FOUND", status: 404 },
          });
        }
        return posts.map((post) => ({
          ...post,
          createdAt: post.createdAt.toString(),
          updatedAt: post.updatedAt.toString(),
        }));
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to fetch posts.", {
          extensions: { code: "INTERNAL_SERVER_ERROR", status: 500 },
        });
      }
    },
  },
  Post: {
    tags: async (parent, args, context, info) => {
      const { dataSources } = context;
      try {
        const tags = await dataSources.postTagAPI.getPostTags(parent.id);
        if (!tags || tags.length === 0) return [];
        return tags;
      } catch (error) {
        throw new GraphQLError("Failed to fetch tags for post.", {
          extensions: { code: "INTERNAL_SERVER_ERROR", status: 500 },
        });
      }
    },
    comments: async (parent, args, context, info) => {
      const { dataSources } = context;

      try {
        const comments = await dataSources.commentAPI.getCommentsBySlug(
          parent.slug,
        );

        return comments.map((comment) => ({
          ...comment,
          createdAt: comment.createdAt.toString(),
        }));
      } catch (error) {
        throw new GraphQLError("Failed to fetch comments for post", {
          extensions: { code: "INTERNAL_SERVER_ERROR", status: 500 },
        });
      }
    },
  },

  User: {
    media: async (parent, args, context, info) => {
      const { dataSources } = context;

      await checkRateLimit(
        { parent, args, context, info },
        { max: 30, window: "1m" },
      );

      try {
        const media = await dataSources.mediaAPI.getMediaByUserId(parent.id);
        if (!media || media.length === 0) {
          throw new GraphQLError(
            `No media found for user with ID ${parent.id}`,
            { extensions: { code: "MEDIA_NOT_FOUND", status: 404 } },
          );
        }
        return media;
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to fetch media for user", {
          extensions: { code: "INTERNAL_SERVER_ERROR", status: 500 },
        });
      }
    },
  },

  Mutation: {
    // -------------------------------------------------------------------------
    // Auth — strictest limits to prevent brute force
    // -------------------------------------------------------------------------
    register: async (parent, args, context, info) => {
      const { db } = context;
      const { data } = args as { data: SanitizedRegisterUserInput };

      // 5 registrations / 15 minutes per IP
      await checkRateLimit(
        { parent, args, context, info },
        { max: 5, window: "15m" },
        "Too many registration attempts. Please try again later.",
      );

      try {
        const {
          email,
          name,
          password,
          provider = "local",
          type = "credentials",
        } = RegisterSchema.parse(data);
        const existingUser = await db.user.findUnique({ where: { email } });
        if (existingUser) {
          throw new GraphQLError("Email already in use", {
            extensions: { code: "EMAIL_IN_USE", status: 409 },
          });
        }

        const hashedPassword = await hash(password, 10);

        const newUser = await db.user.create({
          data: {
            name,
            email,
            role: "USER",
            accounts: {
              create: {
                type,
                provider,
                providerAccountId: email,
                accessToken: hashedPassword,
              },
            },
          },
          include: { accounts: true },
        });

        return {
          user: {
            ...newUser,
            role: newUser.role as Role,
            emailVerified: newUser.emailVerified
              ? newUser.emailVerified.toString()
              : null,
            createdAt: newUser.createdAt.toString(),
            updatedAt: newUser.updatedAt.toString(),
            accounts: newUser.accounts.map((account) => ({
              ...account,
              createdAt: account.createdAt.toString(),
              updatedAt: account.updatedAt.toString(),
            })),
          },
        };
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        if (error.name === "ZodError") throw error;
        throw new GraphQLError("Failed to register user", {
          extensions: {
            code: "REGISTRATION_FAILED",
            status: 500,
            originalError: error.message,
          },
        });
      }
    },

    login: async (parent, args, context, info) => {
      const { db, res } = context;
      const { data } = args as { data: SanitizedLoginUserInput };

      // 10 login attempts / 15 minutes per IP — brute force protection
      await checkRateLimit(
        { parent, args, context, info },
        { max: 10, window: "15m" },
        "Too many login attempts. Please try again later.",
      );

      try {
        const { email, password } = LoginSchema.parse(data);

        const user = await db.user.findUnique({
          where: { email },
          include: { accounts: true },
        });

        if (!user || !user.accounts.length) {
          throw new GraphQLError("Invalid email or password", {
            extensions: { code: "INVALID_CREDENTIALS", status: 401 },
          });
        }

        const credentialsAccount = user.accounts.find(
          (account) =>
            account.type === "credentials" && account.provider === "local",
        );

        if (!credentialsAccount) {
          throw new GraphQLError("Invalid email or password", {
            extensions: { code: "INVALID_CREDENTIALS", status: 401 },
          });
        }

        const validPassword = await compare(
          password,
          credentialsAccount.accessToken || "",
        );

        if (!validPassword) {
          throw new GraphQLError("Invalid email or password", {
            extensions: { code: "INVALID_CREDENTIALS", status: 401 },
          });
        }

        const token = generateToken(user);
        const refreshToken = generateRefreshToken(user);

        res.cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 15 * 60 * 1000,
        });

        return {
          token,
          refreshToken,
          user: {
            ...user,
            role: user.role as Role,
            emailVerified: user.emailVerified
              ? user.emailVerified.toString()
              : null,
            createdAt: user.createdAt.toString(),
            updatedAt: user.updatedAt.toString(),
            accounts: user.accounts.map((account) => ({
              ...account,
              createdAt: account.createdAt.toString(),
              updatedAt: account.updatedAt.toString(),
            })),
          },
        };
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        if (error.name === "ZodError") throw error;
        throw new GraphQLError("Failed to log in", {
          extensions: {
            code: "LOGIN_FAILED",
            status: 500,
            originalError: error.message,
          },
        });
      }
    },

    loginWithGoogle: async (parent, args, context, info) => {
      const { db, res } = context;
      const { idToken } = args as { idToken: string };

      await checkRateLimit(
        { parent, args, context, info },
        { max: 10, window: "15m" },
        "Too many login attempts. Please try again later",
      );

      try {
        const googleUser = await verifyGoogleIdToken(idToken);

        let user = await db.user.findUnique({
          where: { email: googleUser.email },
        });

        if (!user) {
          user = await db.user.create({
            data: {
              name: googleUser.name,
              email: googleUser.email,
              image: googleUser.image,
              role: "USER",
              emailVerified: googleUser.emailVerified ? new Date() : null,
            },
          });
        }

        const token = generateToken(user);
        const refreshToken = generateRefreshToken(user);

        res.cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 15 * 60 * 1000,
        });

        await db.account.upsert({
          where: {
            provider_providerAccountId: {
              provider: "google",
              providerAccountId: googleUser.id,
            },
          },
          create: {
            type: "oauth",
            provider: "google",
            providerAccountId: googleUser.id,
            accessToken: token,
            refreshToken,
            tokenType: "Bearer",
            expiresAt: Math.floor(Date.now() / 1000) + 3600,
            scope: "profile email",

            user: { connect: { id: user.id } },
          },
          update: {
            accessToken: token,
            refreshToken,
            expiresAt: Math.floor(Date.now() / 1000) + 60 * 60 * 7,
          },
        });

        return {
          token,
          refreshToken,
          user: {
            ...user,
            role: user.role as Role,
            emailVerified: user.emailVerified
              ? user.emailVerified.toString()
              : null,
            createdAt: user.createdAt.toString(),
            updatedAt: user.updatedAt.toString(),
          },
        };
      } catch (error: any) {
        console.error("Google login error:", error);

        throw new GraphQLError("Failed to log in with google", {
          extensions: {
            code: "UNAUTHENTICATED",
            status: 401,
            originalError: error.message,
          },
        });
      }
    },
    refreshToken: async (parent, args, context) => {
      const { db } = context;
      const { refreshToken } = args as { refreshToken: string };

      if (!refreshToken) {
        throw new GraphQLError("Refresh token is required", {
          extensions: { code: "BAD_USER_INPUT", status: 400 },
        });
      }

      try {
        const payload = verifyRefreshToken(refreshToken);

        if (payload.type !== "refresh") {
          throw new Error("Invalid token type");
        }

        const user = await db.user.findUnique({ where: { id: payload.id } });

        if (!user) {
          throw new GraphQLError("User not found", {
            extensions: { code: "UNAUTHENTICATED", status: 401 },
          });
        }

        const storedToken = await db.account.findFirst({
          where: { userId: user.id, refreshToken },
        });

        if (!storedToken) {
          throw new GraphQLError("Refresh token revoked", {
            extensions: { code: "UNAUTHENTICATED", status: 401 },
          });
        }

        const newAccessToken = generateToken(user);
        const newRefreshToken = generateRefreshToken(user);

        await db.account.updateMany({
          where: { userId: user.id },
          data: { refreshToken: newRefreshToken },
        });

        return {
          token: newAccessToken,
          refreshToken: newRefreshToken,
          user: {
            ...user,
            role: user.role as Role,
            emailVerified: user.emailVerified?.toString() ?? null,
            createdAt: user.createdAt.toString(),
            updatedAt: user.updatedAt.toString(),
          },
        };
      } catch (error: any) {
        console.error("Refresh token error:", error.message);

        throw new GraphQLError("Invalid or expired refresh token", {
          extensions: { code: "UNAUTHENTICATED", status: 401 },
        });
      }
    },
    // -------------------------------------------------------------------------
    // User management — admin-like actions, moderate limits
    // -------------------------------------------------------------------------
    createUser: async (parent, args, context, info) => {
      const { dataSources } = context;
      const { data } = args as {
        data: { email: string; name?: string; image?: string; role?: Role };
      };

      // 10 user creations / 10 minutes
      await checkRateLimit(
        { parent, args, context, info },
        { max: 10, window: "10m" },
      );

      try {
        const sanitizedData = CreateUserSchema.parse({
          ...data,
          name: data.name ?? null,
          image: data.image ?? null,
        });
        const newUser = await dataSources.userAPI.createUser(sanitizedData);
        return {
          ...newUser,
          role: newUser.role as Role,
          emailVerified: newUser.emailVerified
            ? newUser.emailVerified.toString()
            : null,
          createdAt: newUser.createdAt.toString(),
          updatedAt: newUser.updatedAt.toString(),
        };
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        if (error.name === "ZodError") throw error;
        throw new GraphQLError("Failed to register user", {
          extensions: {
            code: "REGISTRATION_FAILED",
            status: 500,
            originalError: error.message,
          },
        });
      }
    },

    updateUserProfile: async (parent, args, context, info) => {
      const { dataSources } = context;
      const { id, data } = args as {
        id: string;
        data: { email: string; name?: string; image?: string; role?: Role };
      };

      // 20 profile updates / 10 minutes
      await checkRateLimit(
        { parent, args, context, info },
        { max: 20, window: "10m" },
      );

      try {
        const sanitizedData = UpdateUserProfileSchema.parse({
          ...data,
          name: data.name ?? null,
          image: data.image ?? null,
        });
        const updatedUser = await dataSources.userAPI.updateUserProfile(
          id,
          sanitizedData,
        );
        if (!updatedUser) {
          throw new GraphQLError("User not found", {
            extensions: { code: "USER_NOT_FOUND", status: 404 },
          });
        }
        return {
          ...updatedUser,
          role: updatedUser.role as Role,
          emailVerified: updatedUser.emailVerified
            ? updatedUser.emailVerified.toString()
            : null,
          createdAt: updatedUser.createdAt.toString(),
          updatedAt: updatedUser.updatedAt.toString(),
        };
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        if (error.name === "ZodError") throw error;
        throw new GraphQLError("Failed to update user profile", {
          extensions: {
            code: "UPDATE_FAILED",
            status: 500,
            originalError: error.message,
          },
        });
      }
    },

    deleteUser: async (parent, args, context, info) => {
      const { dataSources } = context;
      const { id } = args as { id: string };

      // 5 deletions / 10 minutes — destructive action
      await checkRateLimit(
        { parent, args, context, info },
        { max: 5, window: "10m" },
      );

      try {
        const success = await dataSources.userAPI.deleteUser(id);
        if (!success) {
          throw new GraphQLError("User deletion failed", {
            extensions: { code: "DELETION_FAILED", status: 500 },
          });
        }
        return success;
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        if (error.name === "ZodError") throw error;
        throw new GraphQLError("Failed to delete user", {
          extensions: {
            code: "INTERNAL_SERVER_ERROR",
            status: 500,
            originalError: error.message,
          },
        });
      }
    },

    // -------------------------------------------------------------------------
    // Content mutations — prevent spam
    // -------------------------------------------------------------------------
    createPost: async (parent, args, context, info) => {
      const { dataSources } = context;
      const { data } = args as { data: SanitizedCreatePostInput };

      // 10 posts / 10 minutes
      await checkRateLimit(
        { parent, args, context, info },
        { max: 10, window: "10m" },
        "You are posting too frequently. Please wait before creating another post.",
      );

      try {
        const sanitizedData = CreatePostSchema.parse(data);
        const post = await dataSources.postAPI.createPost(sanitizedData);
        return {
          ...post,
          createdAt: post.createdAt.toString(),
          updatedAt: post.updatedAt.toString(),
        };
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        if (error.name === "ZodError") throw error;
        throw new GraphQLError("Failed to create post", {
          extensions: {
            code: "POST_CREATION_FAILED",
            status: 500,
            originalError: error.message,
          },
        });
      }
    },

    updatePost: async (parent, args, context, info) => {
      const { dataSources } = context;
      const { id, data } = args as {
        id: string;
        data: SanitizedUpdatePostInput;
      };

      // 30 updates / 10 minutes
      await checkRateLimit(
        { parent, args, context, info },
        { max: 30, window: "10m" },
      );

      try {
        const updatedPost = await dataSources.postAPI.updatePost(id, data);
        if (!updatedPost) {
          throw new GraphQLError(`Post with ID ${id} not found`, {
            extensions: { code: "POST_NOT_FOUND", status: 404 },
          });
        }
        return {
          ...updatedPost,
          createdAt: updatedPost.createdAt.toString(),
          updatedAt: updatedPost.updatedAt.toString(),
        };
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        if (error.name === "ZodError") throw error;
        throw new GraphQLError("Failed to update the post", {
          extensions: {
            code: "POST_UPDATE_FAILED",
            status: 500,
            originalError: error.message,
          },
        });
      }
    },

    deletePost: async (parent, args, context, info) => {
      const { dataSources } = context;
      const { id } = args as { id: string };

      // 10 deletions / 10 minutes
      await checkRateLimit(
        { parent, args, context, info },
        { max: 10, window: "10m" },
      );

      try {
        const isDeleted = await dataSources.postAPI.deletePost(id);
        if (!isDeleted) {
          throw new GraphQLError(`Failed to delete post with ID ${id}`, {
            extensions: { code: "POST_DELETION_FAILED", status: 404 },
          });
        }
        return true;
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to delete post", {
          extensions: {
            code: "POST_DELETION_ERROR",
            status: 500,
            originalError: error.message,
          },
        });
      }
    },

    createComment: async (parent, args, context, info) => {
      const { dataSources } = context;
      const { data } = args as { data: SanitizedCreateCommentInput };

      // 20 comments / 5 minutes — anti-spam
      await checkRateLimit(
        { parent, args, context, info },
        { max: 20, window: "5m" },
        "You are commenting too frequently. Please slow down.",
      );

      try {
        const sanitizedData = CreateCommentSchema.parse(data);
        const comment =
          await dataSources.commentAPI.createComment(sanitizedData);
        return { ...comment, createdAt: comment.createdAt.toString() };
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        if (error.name === "ZodError") throw error;
        throw new GraphQLError("Failed to create comment", {
          extensions: {
            code: "COMMENT_CREATION_FAILED",
            status: 500,
            originalError: error.message,
          },
        });
      }
    },
    updateComment: async (parent, args, context, info) => {
      const { dataSources } = context;
      const { id, data } = args as {
        id: string;
        data: SanitizedUpdateCommentInput;
      };

      await checkRateLimit(
        { parent, args, context, info },
        { max: 20, window: "5m" },
      );

      try {
        const sanitizedData = UpdateCommentSchema.parse(data);
        const comment = await dataSources.commentAPI.updateComment(
          id,
          sanitizedData,
        );

        if (!comment) {
          throw new GraphQLError(`Comment with ID ${id} not found`, {
            extensions: { code: "COMMENT_NOT_FOUND", status: 404 },
          });
        }

        return { ...comment, createdAt: comment.createdAt.toString() };
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        if (error.name === "ZodError") throw error;
        throw new GraphQLError("Failed to update comment", {
          extensions: {
            code: "COMMENT_UPDATE_FAILED",
            status: 500,
          },
        });
      }
    },

    deleteComment: async (parent, args, context, info) => {
      const { dataSources } = context;
      const { id } = args as { id: string };

      await checkRateLimit(
        { parent, args, context, info },
        { max: 20, window: "5m" },
      );

      try {
        const success = await dataSources.commentAPI.deleteComment(id);
        if (!success) {
          throw new GraphQLError(`Comment with ID ${id} not found`, {
            extensions: { code: "COMMENT_NOT_FOUND", status: 404 },
          });
        }
        return success;
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        if (error.name === "ZodError") throw error;
        throw new GraphQLError("Failed to delete comment", {
          extensions: {
            code: "COMMENT_DELETION_FAILED",
            status: 500,
            originalError: error.message,
          },
        });
      }
    },

    createLike: async (parent, args, context, info) => {
      const { dataSources } = context;
      const { data } = args as { data: SanitizedCreateLikeInput };

      // 30 likes / 1 minute — quick action but still bounded
      await checkRateLimit(
        { parent, args, context, info },
        { max: 30, window: "1m" },
        "You are liking too frequently. Please slow down.",
      );

      try {
        const sanitizedData = CreateLikeSchema.parse(data);
        const like = await dataSources.likeAPI.createLike(sanitizedData);
        return { ...like, createdAt: like.createdAt.toString() };
      } catch (error) {
        if (error.name === "ZodError") throw error;
        throw new GraphQLError("Failed to create like", {
          extensions: {
            code: "LIKE_CREATION_FAILED",
            status: 500,
            originalError: error.message,
          },
        });
      }
    },

    deleteLike: async (parent, args, context, info) => {
      const { dataSources } = context;
      const { id } = args as { id: string };

      await checkRateLimit(
        { parent, args, context, info },
        { max: 30, window: "1m" },
      );

      try {
        const success = await dataSources.likeAPI.deleteLike(id);
        if (!success) {
          throw new GraphQLError(`Like with ID ${id} not found`, {
            extensions: { code: "LIKE_NOT_FOUND", status: 404 },
          });
        }
        return success;
      } catch (error) {
        if (error.name === "ZodError") throw error;
        throw new GraphQLError("Failed to delete like", {
          extensions: {
            code: "LIKE_DELETION_FAILED",
            status: 500,
            originalError: error.message,
          },
        });
      }
    },

    createPostTag: async (parent, args, context, info) => {
      const { dataSources } = context;
      const { data } = args as { data: SanitizedCreatePostTagInput };

      await checkRateLimit(
        { parent, args, context, info },
        { max: 20, window: "5m" },
      );

      try {
        const sanitizedData = CreatePostTagSchema.parse(data);
        return await dataSources.postTagAPI.createPostTag(sanitizedData);
      } catch (error) {
        if (error.name === "ZodError") throw error;
        throw new GraphQLError("Failed to create post tag", {
          extensions: {
            code: "POST_TAG_CREATION_FAILED",
            status: 500,
            originalError: error.message,
          },
        });
      }
    },

    createTag: async (parent, args, context, info) => {
      const { dataSources } = context;
      const { data } = args as { data: SanitizedCreateTagInput };

      // 10 tags / 10 minutes
      await checkRateLimit(
        { parent, args, context, info },
        { max: 10, window: "10m" },
      );

      try {
        const sanitizedData = CreateTagSchema.parse(data);
        const existingTag = await dataSources.tagAPI.getTagBySlug(
          sanitizedData.slug,
        );
        if (existingTag) {
          throw new GraphQLError(
            `A tag with slug "${sanitizedData.slug}" already exists`,
            { extensions: { code: "TAG_ALREADY_EXISTS", status: 400 } },
          );
        }
        return await dataSources.tagAPI.createTag(data);
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        if (error.name === "ZodError") throw error;
        throw new GraphQLError("Failed to create tag", {
          extensions: {
            code: "TAG_CREATION_FAILED",
            status: 500,
            originalError: error.message,
          },
        });
      }
    },

    createPostCategory: async (parent, args, context, info) => {
      const { dataSources } = context;
      const { data } = args as { data: SanitizedCreatePostCategoryInput };

      await checkRateLimit(
        { parent, args, context, info },
        { max: 20, window: "5m" },
      );

      try {
        const sanitizedData = CreatePostCategorySchema.parse(data);
        return await dataSources.postCategoryAPI.createPostCategory(
          sanitizedData.postId,
          sanitizedData.categoryId,
        );
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        if (error.name === "ZodError") throw error;
        throw new GraphQLError("Failed to create post category", {
          extensions: {
            code: "POST_CATEGORY_CREATION_FAILED",
            status: 500,
            originalError: error.message,
          },
        });
      }
    },

    createMedia: async (parent, args, context, info) => {
      const { dataSources } = context;
      const { data } = args as { data: SanitizedCreateMediaInput };

      // 20 uploads / 10 minutes
      await checkRateLimit(
        { parent, args, context, info },
        { max: 20, window: "10m" },
        "Too many media uploads. Please wait before uploading again.",
      );

      try {
        const sanitizedData = CreateMediaSchema.parse(data);
        return await dataSources.mediaAPI.createMedia(sanitizedData);
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        if (error.name === "ZodError") throw error;
        throw new GraphQLError("Failed to create media", {
          extensions: {
            code: "MEDIA_CREATION_FAILED",
            status: 500,
            originalError: error.message,
          },
        });
      }
    },

    // -------------------------------------------------------------------------
    // Messages — contact form, strictest write limit
    // -------------------------------------------------------------------------
    createMessage: async (parent, args, context, info) => {
      const { dataSources } = context;
      const { data } = args as { data: SanitizedCreateMessageInput };

      // 3 messages / 10 minutes — contact form abuse prevention
      await checkRateLimit(
        { parent, args, context, info },
        { max: 3, window: "10m" },
        "You have sent too many messages. Please wait before sending another.",
      );

      try {
        const sanitizedData = CreateMessageSchema.parse(data);
        const message = await dataSources.messageAPI.createMessage(
          sanitizedData.name,
          sanitizedData.email,
          sanitizedData.message,
        );
        return {
          ...message,
          read: message.read ? "true" : "false",
          createdAt: message.createdAt.toString(),
        };
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        if (error.name === "ZodError") throw error;
        throw new GraphQLError("Failed to create message", {
          extensions: {
            code: "MESSAGE_CREATION_FAILED",
            status: 500,
            originalError: error.message,
          },
        });
      }
    },

    markMessageAsRead: async (parent, args, context, info) => {
      const { dataSources, user } = context;
      const { id } = args as { id: string };

      await checkRateLimit(
        { parent, args, context, info },
        { max: 30, window: "1m" },
      );

      try {
        if (!user) {
          throw new GraphQLError(
            "You must be logged in to access this resource.",
            { extensions: { code: "UNAUTHENTICATED", status: 401 } },
          );
        }
        const message = await dataSources.messageAPI.markAsRead(id);
        if (!message) {
          throw new GraphQLError(`Message with ID ${id} not found.`, {
            extensions: { code: "MESSAGE_NOT_FOUND", status: 404 },
          });
        }
        return {
          ...message,
          read: message.read ? "true" : "false",
          createdAt: message.createdAt.toString(),
        };
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to mark message as read", {
          extensions: {
            code: "MESSAGE_UPDATE_FAILED",
            status: 500,
            originalError: error.message,
          },
        });
      }
    },

    deleteMessage: async (parent, args, context, info) => {
      const { dataSources, user } = context;
      const { id } = args as { id: string };

      await checkRateLimit(
        { parent, args, context, info },
        { max: 10, window: "5m" },
      );

      try {
        if (!user) {
          throw new GraphQLError(
            "You must be logged in to access this resource.",
            { extensions: { code: "UNAUTHENTICATED", status: 401 } },
          );
        }
        const success = await dataSources.messageAPI.deleteMessage(id);
        if (!success) {
          throw new GraphQLError(`Message with ID ${id} not found.`, {
            extensions: { code: "MESSAGE_NOT_FOUND", status: 404 },
          });
        }
        return true;
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to delete message", {
          extensions: {
            code: "MESSAGE_DELETION_FAILED",
            status: 500,
            originalError: error.message,
          },
        });
      }
    },
  },
};
