import { GraphQLSchema, defaultFieldResolver, GraphQLError } from "graphql";
import { MapperKind, getDirective, mapSchema } from "@graphql-tools/utils";

export function authDirective(directiveName: string) {
  const typeDirectiveArgumentMaps: Record<string, any> = {};

  return {
    authDirectiveTypeDefs: `directive @${directiveName}(
      requires: Role = USER,
    ) on OBJECT | FIELD_DEFINITION

    enum Role {
      USER
      ADMIN
      SUPERADMIN
    }`,
    authDirectiveTransformer: (schema: GraphQLSchema) =>
      mapSchema(schema, {
        [MapperKind.TYPE]: (type) => {
          const authDirective = getDirective(schema, type, directiveName)?.[0];
          if (authDirective) {
            typeDirectiveArgumentMaps[type.name] = authDirective;
          }
          return type;
        },
        [MapperKind.OBJECT_FIELD]: (fieldConfig, _fieldName, typeName) => {
          const authDirective =
            getDirective(schema, fieldConfig, directiveName)?.[0] ??
            typeDirectiveArgumentMaps[typeName];

          if (authDirective) {
            const { requires } = authDirective;
            if (requires) {
              const { resolve = defaultFieldResolver } = fieldConfig;

              fieldConfig.resolve = function (source, args, context, info) {
                const user = context.user;

                if (!user) {
                  throw new GraphQLError("You must be logged in!", {
                    extensions: { code: "UNAUTHENTICATED", status: 401 },
                  });
                }

                const roles = ["USER", "ADMIN", "SUPERADMIN"];
                const userRoleIndex = roles.indexOf(user.role);
                const requiredRoleIndex = roles.indexOf(requires);

                if (
                  requiredRoleIndex < 0 ||
                  userRoleIndex < requiredRoleIndex
                ) {
                  throw new GraphQLError(
                    "You do not have permission to access this resource!",
                    { extensions: { code: "FORBIDDEN", status: 403 } },
                  );
                }

                return resolve(source, args, context, info);
              };
            }
          }
          return fieldConfig;
        },
      }),
  };
}
