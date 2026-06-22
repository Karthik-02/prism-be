import type { UserStatus } from "@prisma/client";

export interface AuthContext {
  userId: string;
  sessionTokenId: string;
  email: string;
  status: UserStatus;
  permissions: Set<string>;
}
