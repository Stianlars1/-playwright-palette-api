import { ColorPaletteAutomation } from '../lib/ColorPaletteAutomation/ColorPaletteAutomation.js';
import { Scheme } from '../types/types.js';

export interface PaletteResponse {
    accent: string;
    gray: string;
    lightBackground: string;
    darkBackground: string;
    accentScale: {
        light: string[];
        dark: string[];
    };
    grayScale: {
        light: string[];
        dark: string[];
    };
}

export class PaletteService {
    private automation: ColorPaletteAutomation | null = null;

    private async getAutomation(): Promise<ColorPaletteAutomation> {
        if (!this.automation) {
            this.automation = new ColorPaletteAutomation();
        }
        return this.automation;
    }

    async generatePalette(hex: string, scheme: Scheme = 'analogous'): Promise<PaletteResponse> {
        const automation = await this.getAutomation();

        try {
            console.log('🚀 Initializing Playwright browser...');
            await automation.initialize();

            console.log('🎨 Generating base colors...');
            const baseColors = automation.generateBaseColors(hex, scheme);

            console.log('📊 Generating Radix scales...');
            const fullPalette = await automation.generateRadixPalette(baseColors);

            console.log('✅ Palette generation complete');

            return {
                accent: baseColors.accent,
                gray: baseColors.gray,
                lightBackground: baseColors.lightBackground,
                darkBackground: baseColors.darkBackground,
                accentScale: {
                    light: fullPalette.accent.lightSteps,
                    dark: fullPalette.accent.darkSteps
                },
                grayScale: {
                    light: fullPalette.gray.lightSteps,
                    dark: fullPalette.gray.darkSteps
                }
            };
        } finally {
            console.log('🧹 Cleaning up browser instance...');
            await automation.cleanup();
        }
    }

    async healthCheck(): Promise<boolean> {
        try {
            // Simple health check - verify we can create automation instance
            const automation = new ColorPaletteAutomation();
            return true;
        } catch (error) {
            console.error('Health check failed:', error);
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