import jwt from "jsonwebtoken";

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!JWT_ACCESS_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error(
    "Missing JWT_ACCESS_SECRET or JWT_REFRESH_SECRET environment variable",
  );
}

export type JwtPayloadInput = {
  id: string;
  email: string;
  role: "ADMIN" | "SUPERADMIN" | "USER";
  type?: string;
};

export type AccessTokenPayload = {
  id: string;
  email: string;
  role: JwtPayloadInput["role"];
};

export type RefreshTokenPayload = {
  id: string;
  email: string;
  role: JwtPayloadInput["role"];
  type: "refresh";
};

export const generateToken = (user: JwtPayloadInput): string => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    JWT_ACCESS_SECRET,
    { expiresIn: "1h" },
  );
};

export const generateRefreshToken = (user: JwtPayloadInput): string => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      type: "refresh",
    },
    JWT_REFRESH_SECRET,
    { expiresIn: "7d" },
  );
};

export const verifyToken = (token: string): AccessTokenPayload => {
  return jwt.verify(token, JWT_ACCESS_SECRET) as AccessTokenPayload;
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as RefreshTokenPayload;

  if (decoded.type !== "refresh") {
    throw new Error("Invalid token type: expected refresh token");
  }

  return decoded;
};
