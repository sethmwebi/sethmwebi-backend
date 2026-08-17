import passport from "passport";
import {
  Strategy as JwtStrategy,
  ExtractJwt,
  StrategyOptions,
} from "passport-jwt";
import {
  GoogleCallbackParameters,
  Strategy as GoogleStrategy,
  Profile,
  VerifyCallback,
} from "passport-google-oauth20";
import { Strategy as LocalStrategy } from "passport-local";
import db from "../modules/db";
import { compare } from "bcrypt";
import { Request } from "express";
import { Account, User } from "../../generated/prisma/client";

type JwtPayload = {
  id: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
};

const jwtOptions: StrategyOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_ACCESS_SECRET!,
};

passport.use(
  new JwtStrategy(jwtOptions, async (jwtPayload: JwtPayload, done) => {
    try {
      const user = await db.user.findUnique({ where: { id: jwtPayload.id } });

      if (
        user &&
        user.email === jwtPayload.email &&
        user.role === jwtPayload.role
      ) {
        return done(null, user);
      }

      return done(null, false);
    } catch (error) {
      return done(error, false);
    }
  }),
);

passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    async (
      email: string,
      password: string,
      done: (
        error: any,
        user?: Express.User | false,
        info?: { message: string },
      ) => void,
    ) => {
      try {
        const user = await db.user.findUnique({
          where: { email },
          include: { accounts: true },
        });

        if (
          !user ||
          !user.accounts.some((acc: Account) => acc.type === "credentials")
        ) {
          return done(null, false, { message: "Invalid email or password" });
        }

        const credentialsAccount = user.accounts.find(
          (acc: Account) => acc.type === "credentials",
        );

        const isValidPassword = await compare(
          password,
          credentialsAccount?.accessToken || "",
        );

        if (!isValidPassword) {
          return done(null, false, { message: "Invalid email or password" });
        }

        return done(null, user);
      } catch (error) {
        return done(error, false);
      }
    },
  ),
);

export const authenticateJwt = (req: any): Promise<User | null> =>
  new Promise((resolve, reject) => {
    passport.authenticate(
      "jwt",
      { session: false },
      (err: Error | null, user: User | false | null) => {
        if (err) return reject(err);
        if (!user) return resolve(null);
        resolve(user);
      },
    )(req);
  });

export const authenticateLocal = (
  email: string,
  password: string,
): Promise<User | null> =>
  new Promise((resolve, reject) => {
    passport.authenticate(
      "local",
      { session: false },
      (err: Error | null, user: User | false | null) => {
        if (err) return reject(err);
        if (!user) return resolve(null);
        resolve(user);
      },
    )({ body: { email, password } });
  });

export default passport;
