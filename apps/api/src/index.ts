import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import pinoHttp from "pino-http";
import { logger } from "./logger";
import routes from "./routes";
import { processOverstays } from "./routes/payments";

const app = express();

app.use(pinoHttp({ logger }));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false })); // USSD providers post forms
app.use("/api", routes);

// The union dashboard is one static page; it calls /api/union/* with the union key.
// Self-hosted font files for the dashboard (no third-party requests).
app.use("/fonts", express.static(fileURLToPath(new URL("../public/fonts", import.meta.url)), { maxAge: "30d" }));
app.get("/union", (_req, res) => res.sendFile(fileURLToPath(new URL("../public/union.html", import.meta.url))));

// Async route errors land here (Express 5 forwards rejected promises): log and answer with JSON.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Internal error" });
});

// Charges passengers who ignored the overstay prompt for 60 seconds.
setInterval(() => void processOverstays().catch((err) => logger.error({ err }, "Overstay job failed")), 10_000).unref();

const port = Number(process.env.PORT ?? 4000);

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Failed to start server");
    process.exit(1);
  }
  logger.info({ port }, "TrotroLink API listening");
});
