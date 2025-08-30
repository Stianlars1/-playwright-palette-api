import { Router, Request, Response } from "express";
import { PaletteService } from "../services/PaletteService.js";
import { Scheme } from "../types/types.js";

const router = Router();
const paletteService = new PaletteService();

const validateHex = (hex: string): string | null => {
    if (!hex) return "Hex color is required";
    const cleaned = hex.trim().replace(/^#/, "");
    if (!/^[0-9A-Fa-f]{3}$/.test(cleaned) && !/^[0-9A-Fa-f]{6}$/.test(cleaned)) {
        return "Invalid hex format. Use #RGB or #RRGGBB format";
    }
    return null;
};

const formatMs = (ms: number) => (ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`);

const parseBool = (v: unknown): boolean => {
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v === 1;
    if (typeof v === "string") return ["1", "true", "yes", "on"].includes(v.toLowerCase());
    return false;
};

router.get("/", async (_req: Request, res: Response) => {
    res.json({
        name: "Playwright Palette API",
        version: process.env.npm_package_version || "1.0.0",
        endpoints: {
            health: "GET /health",
            generate: "POST /api/generate-palette",
        },
        example: {
            method: "POST",
            path: "/api/generate-palette",
            body: { hex: "#3B82F6", scheme: "analogous", harmonized: false },
        },
    });
});

router.get("/health", async (_req: Request, res: Response) => {
    const ok = await paletteService.healthCheck();
    res.status(ok ? 200 : 500).json({
        status: ok ? "ok" : "error",
        service: "Playwright Palette API",
        time: new Date().toISOString(),
        keepBrowserAlive: process.env.KEEP_BROWSER_ALIVE === "1",
        nodeEnv: process.env.NODE_ENV || "development",
        uptimeSec: Math.round(process.uptime()),
    });
});

router.post("/api/generate-palette", async (req: Request, res: Response) => {
    const start = Date.now();

    try {
        const { hex, scheme, harmonized } = req.body || {};
        const err = validateHex(hex);
        if (err) return res.status(400).json({ success: false, error: err });

        const allowed: Scheme[] = ["analogous", "complementary", "triadic", "monochromatic"];
        const useScheme: Scheme = allowed.includes(scheme) ? scheme : "analogous";
        const useHarmonized = parseBool(harmonized);

        const timeoutMs = Number(process.env.REQUEST_TIMEOUT_MS ?? 45000);

        const result = await Promise.race([
            paletteService.generatePalette(hex, useScheme, { harmonized: useHarmonized }),
            new Promise<never>((_, rej) => setTimeout(() => rej(new Error("Request timeout")), timeoutMs)),
        ]);

        const duration = Date.now() - start;
        res.setHeader("X-Processing-Time", `${duration}`);

        const counts = {
            accentLight: result.accentScale.light.length,
            accentDark: result.accentScale.dark.length,
            grayLight: result.grayScale.light.length,
            grayDark: result.grayScale.dark.length,
        };

        const mu = process.memoryUsage();
        const mem = {
            rssMB: +(mu.rss / 1024 / 1024).toFixed(1),
            heapUsedMB: +(mu.heapUsed / 1024 / 1024).toFixed(1),
        };

        return res.json({
            success: true,
            data: result,
            metadata: {
                generatedAt: new Date().toISOString(),
                processingTimeMs: duration,
                processingTime: formatMs(duration),
                inputHex: hex,
                inputScheme: useScheme,
                harmonized: useHarmonized,
                counts,
                worker: "parallel",
                keepBrowserAlive: process.env.KEEP_BROWSER_ALIVE === "1",
                mem,
                nodeEnv: process.env.NODE_ENV || "development",
            },
        });
    } catch (error: any) {
        const duration = Date.now() - start;
        res.setHeader("X-Processing-Time", `${duration}`);

        if (String(error?.message || "").includes("timeout")) {
            return res.status(408).json({
                success: false,
                error: "Request timed out",
                metadata: { processingTimeMs: duration, processingTime: formatMs(duration) },
            });
        }

        return res.status(500).json({
            success: false,
            error: "Palette generation failed",
            message: error?.message || "Unknown error",
            metadata: { processingTimeMs: duration, processingTime: formatMs(duration) },
        });
    }
});

export { router as paletteRouter };
