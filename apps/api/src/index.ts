import cors from "cors";
import express from "express";
import pinoHttp from "pino-http";
import { logger } from "./logger";
import routes from "./routes";

const app = express();

app.use(pinoHttp({ logger }));
app.use(cors());
app.use(express.json());
app.use("/api", routes);

const port = Number(process.env.PORT ?? 4000);

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Failed to start server");
    process.exit(1);
  }
  logger.info({ port }, "TrotroLink API listening");
});
