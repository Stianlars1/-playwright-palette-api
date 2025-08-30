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
    async generatePalette(hex: string, scheme: Scheme = 'analogous'): Promise<PaletteResponse> {
        const automation = new ColorPaletteAutomation();

        try {
            console.log('🎨 Generating base colors...');
            const baseColors = automation.generateBaseColors(hex, scheme);

            console.log('📊 Generating Radix scales in parallel...');
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
        } catch (error) {
            console.error('Palette generation error:', error);
            throw error;
        }
    }

    async healthCheck(): Promise<boolean> {
        try {
            const automation = new ColorPaletteAutomation();
            return true;
        } catch (error) {
            console.error('Health check failed:', error);
            return false;
        }
    }
}