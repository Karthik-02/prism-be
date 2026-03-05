import type { UserStatus } from "@prisma/client";
import jwt, { type JwtPayload, type Secret, type SignOptions } from "jsonwebtoken";

import { env } from "../config/env";
import { HTTP_STATUS } from "../config/http.constants";
import { AppError } from "./app-error";

const JWT_ERROR_MESSAGE = {
  INVALID_TOKEN: "Invalid token",
  INVALID_OR_EXPIRED_TOKEN: "Invalid or expired token"
} as const;

export interface AuthTokenPayload extends JwtPayload {
  sub: string;
  email: string;
  status: UserStatus;
}

const tokenExpiry: SignOptions["expiresIn"] = env.JWT_EXPIRES_IN as SignOptions["expiresIn"];

const signOptions: SignOptions = {
  expiresIn: tokenExpiry
};

export const signAuthToken = (payload: Omit<AuthTokenPayload, "iat" | "exp">): string =>
  jwt.sign(payload, env.JWT_SECRET as Secret, signOptions);

export const verifyAuthToken = (token: string): AuthTokenPayload => {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET as Secret);

    if (typeof decoded === "string") {
      throw new AppError(JWT_ERROR_MESSAGE.INVALID_TOKEN, HTTP_STATUS.UNAUTHORIZED);
    }

    return decoded as AuthTokenPayload;
  } catch {
    throw new AppError(JWT_ERROR_MESSAGE.INVALID_OR_EXPIRED_TOKEN, HTTP_STATUS.UNAUTHORIZED);
  }
};
