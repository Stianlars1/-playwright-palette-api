import { ColorPaletteAutomation } from "../lib/ColorPaletteAutomation/ColorPaletteAutomation.js";
import { Scheme } from "../types/types.js";

export interface PaletteResponse {
    accent: string;
    gray: string;
    lightBackground: string;
    darkBackground: string;
    accentScale: { light: string[]; dark: string[] };
    grayScale: { light: string[]; dark: string[] };
}

export class PaletteService {
    private automation: ColorPaletteAutomation | null = null;

    private async getAutomation(): Promise<ColorPaletteAutomation> {
        if (!this.automation) {
            this.automation = new ColorPaletteAutomation();
            if (process.env.DEBUG_AUTOMATION === "1") this.automation.setDebugMode(true);
            await this.automation.initialize();
        }
        return this.automation;
    }

    async generatePalette(hex: string, scheme: Scheme = "analogous", opts?: { harmonized?: boolean }): Promise<PaletteResponse> {
        const automation = await this.getAutomation();

        // 1) Base colors (optionally harmonized accent)
        const baseColors = automation.generateBaseColors(hex, scheme, { harmonized: !!opts?.harmonized });

        // 2) Extract full ramps (parallel light+dark)
        const full = await automation.generateRadixPaletteParallel({
            accent: baseColors.accent,
            gray: baseColors.gray,
            lightBackground: baseColors.lightBackground,
            darkBackground: baseColors.darkBackground,
        });

        // 3) Keep browser warm if enabled
        if (process.env.KEEP_BROWSER_ALIVE !== "1") {
            await this.shutdown();
        }

        return {
            accent: baseColors.accent,
            gray: baseColors.gray,
            lightBackground: baseColors.lightBackground,
            darkBackground: baseColors.darkBackground,
            accentScale: { light: full.accent.lightSteps, dark: full.accent.darkSteps },
            grayScale: { light: full.gray.lightSteps, dark: full.gray.darkSteps },
        };
    }

    async healthCheck(): Promise<boolean> {
        try {
            await this.getAutomation();
            return true;
        } catch (err) {
            console.error("Health check failed:", err);
            return false;
        }
    }

    async shutdown(): Promise<void> {
        if (this.automation) {
            await this.automation.cleanup();
            this.automation = null;
        }
    }
}
