import express from "express";
import cors from "cors";
import helmet from "helmet";
import { paletteRouter } from "./routes/palette.js";

const app = express();
const PORT = process.env.PORT || 3000;

// Security
app.use(
    helmet({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false,
    })
);

// JSON parser
app.use(express.json({ limit: "1mb" }));

// CORS
const defaultLocal = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
];
const envOrigins =
    (process.env.FRONTEND_URLS || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

const allowedOrigins = envOrigins.length ? envOrigins : defaultLocal;

app.use(
    cors({
        origin: (origin, cb) => {
            if (!origin) return cb(null, true); // curl/postman
            if (allowedOrigins.includes(origin)) return cb(null, true);
            cb(new Error(`CORS blocked: ${origin}`));
        },
        credentials: false,
    })
);

// Routes
app.use(paletteRouter);

// Graceful shutdown
const graceful = (sig: string) => {
    console.log(`${sig} received, exiting...`);
    process.exit(0);
};

process.on("SIGTERM", () => graceful("SIGTERM"));
process.on("SIGINT", () => graceful("SIGINT"));

app.listen(PORT, () => {
    console.log(`🎨 Playwright Palette API running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`Documentation: http://localhost:${PORT}/`);
});
