import type { AuthContext } from "../modules/rbac/rbac.types";

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

export {};
