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

router.get("/", async (_req: Request, res: Response) => {
    res.json({
        name: "Playwright Palette API",
        version: "1.0.0",
        endpoints: {
            health: "GET /health",
            generate: "POST /api/generate-palette",
        },
        example: {
            method: "POST",
            path: "/api/generate-palette",
            body: { hex: "#3B82F6", scheme: "analogous" },
        },
    });
});

router.get("/health", async (_req: Request, res: Response) => {
    const ok = await paletteService.healthCheck();
    res.status(ok ? 200 : 500).json({
        status: ok ? "ok" : "error",
        service: "Playwright Palette API",
        time: new Date().toISOString(),
    });
});

router.post("/api/generate-palette", async (req: Request, res: Response) => {
    const start = Date.now();

    try {
        const { hex, scheme } = req.body || {};
        const err = validateHex(hex);
        if (err) return res.status(400).json({ success: false, error: err });

        const allowed: Scheme[] = ["analogous", "complementary", "triadic", "monochromatic"];
        const useScheme: Scheme = allowed.includes(scheme) ? scheme : "analogous";

        // 45s overall safety timeout (Railway is generous, but keep it sane)
        const timeoutMs = Number(process.env.REQUEST_TIMEOUT_MS ?? 45000);

        const result = await Promise.race([
            paletteService.generatePalette(hex, useScheme),
            new Promise<never>((_, rej) => setTimeout(() => rej(new Error("Request timeout")), timeoutMs)),
        ]);

        const duration = Date.now() - start;
        return res.json({
            success: true,
            data: result,
            metadata: {
                generatedAt: new Date().toISOString(),
                processingTime: `${duration}ms`,
                inputHex: hex,
                inputScheme: useScheme,
            },
        });
    } catch (error: any) {
        const duration = Date.now() - start;
        console.error(`❌ Palette generation failed after ${duration}ms:`, error);

        if (String(error?.message || "").includes("timeout")) {
            return res.status(408).json({ success: false, error: "Request timed out" });
        }

        return res.status(500).json({
            success: false,
            error: "Palette generation failed",
            message: error?.message || "Unknown error",
        });
    }
});

export { router as paletteRouter };
