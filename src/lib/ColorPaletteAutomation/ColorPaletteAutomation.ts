import { Browser, chromium, Page } from 'playwright';
import { hexToHSLString, hslToHex } from "../utils/color/colorConverters.js";
import { AdvancedColorTheory } from "../ColorTheory.js";
import { ColorPalette, GeneratedPalette, RadixColorScale, Scheme } from "../../types/types.js";

interface ExtractedColors {
    accent: string[];
    gray: string[];
}

export class ColorPaletteAutomation {
    private debugMode: boolean = false;

    public setDebugMode(enabled: boolean): void {
        this.debugMode = enabled;
    }

    private async createBrowser(): Promise<Browser> {
        return await chromium.launch({
            headless: !this.debugMode,
            slowMo: this.debugMode ? 100 : 0,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--disable-features=TranslateUI',
                '--disable-ipc-flooding-protection'
            ]
        });
    }

    generateBaseColors(brandColor?: string, scheme: Scheme = 'analogous'): {
        accent: string;
        gray: string;
        lightBackground: string;
        darkBackground: string;
    } {
        const normalize = (raw?: string): string | undefined => {
            if (!raw) return undefined;
            const cleaned = raw.trim().replace(/^#/, '').toUpperCase();
            if (/^[0-9A-F]{6}$/.test(cleaned)) return `#${cleaned}`;
            if (/^[0-9A-F]{3}$/.test(cleaned)) {
                const [r, g, b] = cleaned.split('');
                return `#${r}${r}${g}${g}${b}${b}`;
            }
            return undefined;
        };

        const seed = normalize(brandColor) ?? '#3B82F6';
        const theory = AdvancedColorTheory.generateHarmoniousPalette(seed, scheme);

        return {
            accent: seed,
            gray: theory.gray,
            lightBackground: theory.lightBg,
            darkBackground: theory.darkBg
        };
    }

    async generateRadixPalette(colors: ColorPalette): Promise<GeneratedPalette> {
        console.log('🚀 Starting parallel color extraction...');

        const [lightModeColors, darkModeColors] = await Promise.all([
            this.extractColorsForMode(colors, 'light'),
            this.extractColorsForMode(colors, 'dark')
        ]);

        const accentScale: RadixColorScale = {
            name: 'accent',
            lightSteps: lightModeColors.accent,
            darkSteps: darkModeColors.accent,
            lightHslSteps: lightModeColors.accent.map(hex => hexToHSLString(hex)),
            darkHslSteps: darkModeColors.accent.map(hex => hexToHSLString(hex))
        };

        const grayScale: RadixColorScale = {
            name: 'gray',
            lightSteps: lightModeColors.gray,
            darkSteps: darkModeColors.gray,
            lightHslSteps: lightModeColors.gray.map(hex => hexToHSLString(hex)),
            darkHslSteps: darkModeColors.gray.map(hex => hexToHSLString(hex))
        };

        console.log('✅ Parallel color extraction completed');

        return {
            accent: accentScale,
            gray: grayScale,
            css: {
                light: '',
                dark: '',
                variables: ''
            }
        };
    }

    private async extractColorsForMode(colors: ColorPalette, mode: 'light' | 'dark'): Promise<ExtractedColors> {
        const browser = await this.createBrowser();
        let page: Page | null = null;

        try {
            console.log(`🌐 [${mode}] Creating browser instance and navigating to Radix Colors...`);
            page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

            await page.goto('https://www.radix-ui.com/colors/custom', {
                waitUntil: 'networkidle',
                timeout: 30000
            });

            await page.waitForTimeout(1000);

            console.log(`🎨 [${mode}] Setting up ${mode} mode and filling inputs...`);
            await this.setupModeAndFillInputs(page, colors, mode);

            console.log(`📊 [${mode}] Extracting colors...`);
            const extractedColors = await this.extractColorsFromSwatches(page, mode);

            return extractedColors;

        } catch (error) {
            console.error(`❌ [${mode}] Error in color extraction:`, error);
            return {
                accent: this.generateFallbackAccentColors(),
                gray: this.generateFallbackGrayColors()
            };
        } finally {
            if (page) await page.close();
            await browser.close();
        }
    }

    private async setupModeAndFillInputs(page: Page, colors: ColorPalette, mode: 'light' | 'dark'): Promise<void> {
        try {
            // Set the correct mode first
            if (mode === 'dark') {
                const darkButton = await page.$('button[data-state="off"]:has-text("Dark")');
                if (darkButton) {
                    await darkButton.click();
                    await page.waitForTimeout(500);
                }
            } else {
                const lightButton = await page.$('button[data-state="off"]:has-text("Light")');
                if (lightButton) {
                    await lightButton.click();
                    await page.waitForTimeout(500);
                }
            }

            // Fill color inputs
            const bgColor = mode === 'dark' ? colors.darkBackground : colors.lightBackground;

            await page.fill('#accent', '');
            await page.fill('#gray', '');
            await page.fill('#bg', '');
            await page.waitForTimeout(200);

            await page.fill('#accent', colors.accent.replace('#', ''));
            await page.waitForTimeout(300);

            await page.fill('#gray', colors.gray.replace('#', ''));
            await page.waitForTimeout(300);

            await page.fill('#bg', bgColor.replace('#', ''));
            await page.waitForTimeout(500);

            // Verify swatches are loaded
            await page.waitForSelector('button.rt-reset.CustomSwatch_CustomSwatchTrigger__jlBrx', { timeout: 10000 });

            console.log(`✅ [${mode}] Mode setup and inputs filled successfully`);
        } catch (error) {
            console.error(`❌ [${mode}] Error in mode setup:`, error);
            throw error;
        }
    }

    private async extractColorsFromSwatches(page: Page, mode: 'light' | 'dark'): Promise<ExtractedColors> {
        console.log(`🎨 [${mode}] Extracting colors from swatches...`);

        try {
            const swatchButtons = await page.$$('button.rt-reset.CustomSwatch_CustomSwatchTrigger__jlBrx');
            console.log(`[${mode}] Found ${swatchButtons.length} color swatches`);

            if (swatchButtons.length < 24) {
                console.warn(`[${mode}] Expected 24 swatches but found ${swatchButtons.length}`);
            }

            const accentColors: string[] = [];
            const grayColors: string[] = [];

            // Extract accent colors (first 12 swatches)
            console.log(`📦 [${mode}] Extracting accent colors...`);
            for (let i = 0; i < Math.min(12, swatchButtons.length); i++) {
                try {
                    const color = await this.extractColorFromSwatchWithRetry(page, swatchButtons[i], i + 1, 'accent');
                    if (color && this.isValidHex(color)) {
                        accentColors.push(color);
                        console.log(`  [${mode}] Accent ${i + 1}: ${color}`);
                    } else {
                        accentColors.push(this.generateFallbackAccentColors()[i]);
                    }
                } catch (error) {
                    console.warn(`[${mode}] Failed to extract accent color ${i + 1}:`, error);
                    accentColors.push(this.generateFallbackAccentColors()[i]);
                }
                await page.waitForTimeout(50);
            }

            // Extract gray colors (next 12 swatches)
            console.log(`📦 [${mode}] Extracting gray colors...`);
            for (let i = 12; i < Math.min(24, swatchButtons.length); i++) {
                const grayIndex = i - 12;
                try {
                    const color = await this.extractColorFromSwatchWithRetry(page, swatchButtons[i], grayIndex + 1, 'gray');
                    if (color && this.isValidHex(color)) {
                        grayColors.push(color);
                        console.log(`  [${mode}] Gray ${grayIndex + 1}: ${color}`);
                    } else {
                        grayColors.push(this.generateFallbackGrayColors()[grayIndex]);
                    }
                } catch (error) {
                    console.warn(`[${mode}] Failed to extract gray color ${grayIndex + 1}:`, error);
                    grayColors.push(this.generateFallbackGrayColors()[grayIndex]);
                }
                await page.waitForTimeout(50);
            }

            console.log(`✅ [${mode}] Extracted ${accentColors.length} accent + ${grayColors.length} gray colors`);

            return {
                accent: accentColors,
                gray: grayColors
            };

        } catch (error) {
            console.error(`❌ [${mode}] Error extracting colors:`, error);
            return {
                accent: this.generateFallbackAccentColors(),
                gray: this.generateFallbackGrayColors()
            };
        }
    }

    private async extractColorFromSwatchWithRetry(
        page: Page,
        swatchButton: any,
        index: number,
        type: 'accent' | 'gray',
        maxRetries = 3
    ): Promise<string | null> {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await this.ensureNoDialogOpen(page);

                await swatchButton.click();

                const dialogOverlay = page.locator('.rt-DialogOverlay').first();
                await dialogOverlay.waitFor({ state: 'visible', timeout: 5000 });

                const hexButton = page.getByRole('button', { name: /^#[0-9A-F]{6}$/i }).first();
                await hexButton.waitFor({ state: 'visible', timeout: 3000 });
                const text = (await hexButton.textContent())?.trim();

                await page.keyboard.press('Escape');
                await dialogOverlay.waitFor({ state: 'detached', timeout: 3000 });

                if (text && this.isValidHex(text)) {
                    return text;
                }

            } catch (error) {
                await this.ensureNoDialogOpen(page);
                await page.waitForTimeout(200);
            }
        }

        return null;
    }

    private async ensureNoDialogOpen(page: Page): Promise<void> {
        try {
            const dialogOverlay = page.locator('.rt-DialogOverlay');
            const count = await dialogOverlay.count();

            if (count > 0) {
                await page.keyboard.press('Escape');
                await dialogOverlay.first().waitFor({ state: 'detached', timeout: 2000 });
            }
        } catch (error) {
            // Ignore cleanup errors
        }
    }

    private isValidHex(color: string): boolean {
        if (!color) return false;
        const hex = color.replace('#', '');
        return /^[0-9A-F]{6}$/i.test(hex) && hex !== '000000' && hex !== 'FFFFFF';
    }

    private generateFallbackAccentColors(): string[] {
        const baseHue = 217;
        const colors: string[] = [];

        for (let i = 1; i <= 12; i++) {
            const lightness = i <= 6
                ? 95 - (i - 1) * 8
                : 80 - (i - 7) * 12;

            const saturation = i === 9 ? 91 : Math.max(10, 90 - Math.abs(i - 9) * 8);

            const color = hslToHex({
                h: baseHue,
                s: saturation,
                l: Math.max(5, Math.min(95, lightness))
            });
            colors.push(color);
        }
        return colors;
    }

    private generateFallbackGrayColors(): string[] {
        const colors: string[] = [];

        for (let i = 1; i <= 12; i++) {
            const lightness = 95 - (i - 1) * 7;
            const color = hslToHex({
                h: 220,
                s: 5,
                l: Math.max(5, Math.min(95, lightness))
            });
            colors.push(color);
        }
        return colors;
    }
}