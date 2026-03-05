import type { UserStatus } from "@prisma/client";

export interface AuthContext {
  userId: string;
  email: string;
  status: UserStatus;
  permissions: Set<string>;
}
