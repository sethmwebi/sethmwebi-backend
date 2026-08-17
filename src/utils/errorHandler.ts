import { GraphQLError } from "graphql";
import { ZodError } from "zod";
import { resolvers as rawResolvers } from "../resolvers";

const handleResolverErrors = (resolver: Function) => {
  return async (...args: any[]) => {
    try {
      return await resolver(...args);
    } catch (error) {
      if (error instanceof ZodError) {
        console.error("Validation error:", error.issues);
        throw new GraphQLError("Validation error occured:", {
          extensions: {
            code: "BAD_USER_INPUT",
            status: 400,
            issues: error.issues,
          },
        });
      }

      if (error instanceof GraphQLError) {
        //custom errors pass through
        throw error;
      }

      console.error("Unexpected error: ", error);
      throw new GraphQLError("An internal server error occured.", {
        extensions: {
          code: "INTERNAL_SERVER_ERROR",
          status: 500,
        },
      });
    }
  };
};

const wrapResolversWithErrorHandler = (resolvers: any) => {
  const wrappedResolvers: any = {};
  for (const type in resolvers) {
    wrappedResolvers[type] = {};
    for (const field in resolvers[type]) {
      wrappedResolvers[type][field] = handleResolverErrors(
        resolvers[type][field],
      );
    }
  }
  return wrappedResolvers;
};

export const resolvers = wrapResolversWithErrorHandler(rawResolvers);
