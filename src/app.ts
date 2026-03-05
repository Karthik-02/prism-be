import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";

import { env } from "./config/env";
import { API_BASE_PATH } from "./config/routes.constants";
import { errorHandler, notFoundHandler } from "./middlewares/error-handler";
import { requestLogger } from "./middlewares/request-logger";
import { apiRouter } from "./routes";

const app = express();

app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(requestLogger);

app.use(API_BASE_PATH, apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export { app };
