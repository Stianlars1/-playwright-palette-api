import { Browser, chromium, Page } from 'playwright';
import { hexToHSLString, hslToHex } from "../utils/color/colorConverters.js";
import { AdvancedColorTheory } from "../ColorTheory.js";
import { ColorPalette, GeneratedPalette, RadixColorScale, Scheme } from "../../types/types.js";

export class ColorPaletteAutomation {
    private browser: Browser | null = null;
    private page: Page | null = null;
    private debugMode: boolean = false;
    private storedColors: ColorPalette | null = null;

    public setDebugMode(enabled: boolean): void {
        this.debugMode = enabled;
    }

    async initialize(): Promise<void> {
        this.browser = await chromium.launch({
            headless: !this.debugMode,
            slowMo: this.debugMode ? 200 : 0,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        });
        this.page = await this.browser.newPage();
    }

    async cleanup(): Promise<void> {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
        if (this.page) {
            this.page = null;
        }
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
        if (!this.page) {
            throw new Error('Browser not initialized. Call initialize() first.');
        }

        console.log('📂 Navigating to Radix Colors...');
        await this.page.goto('https://www.radix-ui.com/colors/custom', {
            waitUntil: 'networkidle',
            timeout: 30000
        });

        this.storedColors = colors;

        console.log('🎨 Filling color inputs...');
        await this.fillColorInputs(colors, false);

        console.log('☀️ Ensuring Light mode is selected...');
        await this.ensureLightMode();

        console.log('☀️ Extracting light mode colors...');
        const lightModeColors = await this.extractColorsFromSwatches('light');

        console.log('🌙 Switching to dark mode...');
        await this.switchToDarkMode();

        console.log('🌙 Extracting dark mode colors...');
        const darkModeColors = await this.extractColorsFromSwatches('dark');

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

    private async fillColorInputs(colors: ColorPalette, isDark = false): Promise<void> {
        if (!this.page) return;

        try {
            console.log(`🎨 Setting accent color: ${colors.accent}`);
            await this.page.fill('#accent', colors.accent.replace('#', ''));
            await this.page.waitForTimeout(100);

            console.log(`🎨 Setting gray color: ${colors.gray}`);
            await this.page.fill('#gray', colors.gray.replace('#', ''));
            await this.page.waitForTimeout(100);

            console.log(`🎨 Setting background color: ${isDark ? colors.darkBackground : colors.lightBackground}`);
            await this.page.fill('#bg', (isDark ? colors.darkBackground : colors.lightBackground).replace('#', ''));
            await this.page.waitForTimeout(100);

            console.log('✅ Color inputs filled successfully');
        } catch (error) {
            console.error('❌ Error filling color inputs:', error);
            throw error;
        }
    }

    private async ensureLightMode(): Promise<void> {
        if (!this.page) return;

        try {
            const lightButton = await this.page.$('button[data-state="off"]:has-text("Light")');
            if (lightButton) {
                console.log('☀️ Clicking Light mode button');
                await lightButton.click();
                await this.page.waitForTimeout(500);
            } else {
                console.log('☀️ Light mode already selected');
            }
        } catch (error) {
            console.log('⚠️ Could not ensure light mode, proceeding anyway');
        }
    }

    private async switchToDarkMode(): Promise<void> {
        if (!this.page) return;

        try {
            const darkButton = await this.page.$('button[data-state="off"]:has-text("Dark")');
            if (darkButton) {
                console.log('🌙 Clicking Dark mode button');
                await darkButton.click();
                await this.page.waitForTimeout(500);

                if (this.storedColors) {
                    console.log('🎨 Refilling inputs after dark mode switch...');
                    await this.fillColorInputs(this.storedColors, true);
                }

                console.log('✅ Switched to dark mode and refilled inputs');
            } else {
                console.log('⚠️ Could not find dark mode button');
            }
        } catch (error) {
            console.error('❌ Error switching to dark mode:', error);
        }
    }

    private async extractColorsFromSwatches(mode: 'light' | 'dark'): Promise<{
        accent: string[];
        gray: string[];
    }> {
        if (!this.page) throw new Error('Page not initialized');

        console.log(`🎨 Extracting ${mode} colors from individual swatches...`);

        const accentColors: string[] = [];
        const grayColors: string[] = [];

        try {
            const swatchButtons = await this.page.$$('button.rt-reset.CustomSwatch_CustomSwatchTrigger__jlBrx');
            console.log(`Found ${swatchButtons.length} color swatches`);

            // Extract accent colors (first 12 swatches)
            for (let i = 0; i < Math.min(12, swatchButtons.length); i++) {
                try {
                    console.log(`Extracting accent color ${i + 1}...`);
                    const color = await this.extractColorFromSwatch(swatchButtons[i]);
                    if (color) {
                        accentColors.push(color);
                        await this.ensureNoDialogOpen();
                        console.log(`  Accent ${i + 1}: ${color}`);
                    }
                } catch (error) {
                    console.warn(`Failed to extract accent color ${i + 1}:`, error);
                }
            }

            // Extract gray colors (next 12 swatches)
            for (let i = 12; i < Math.min(24, swatchButtons.length); i++) {
                try {
                    console.log(`Extracting gray color ${i - 11}...`);
                    await this.ensureNoDialogOpen();
                    const color = await this.extractColorFromSwatch(swatchButtons[i]);
                    if (color) {
                        grayColors.push(color);
                        console.log(`  Gray ${i - 11}: ${color}`);
                    }
                } catch (error) {
                    console.warn(`Failed to extract gray color ${i - 11}:`, error);
                }
            }

            console.log(`✅ Extracted ${accentColors.length} accent colors and ${grayColors.length} gray colors`);

            return { accent: accentColors, gray: grayColors };
        } catch (error) {
            console.error(`❌ Error extracting ${mode} colors:`, error);
            return {
                accent: this.generateFallbackAccentColors(),
                gray: this.generateFallbackGrayColors()
            };
        }
    }

    private async extractColorFromSwatch(swatchButton: any): Promise<string | null> {
        if (!this.page) return null;

        try {
            const dialogOverlay = this.page.locator('.rt-DialogOverlay');

            await swatchButton.click();
            await dialogOverlay.first().waitFor({ state: 'visible', timeout: 2000 });

            const hexButton = this.page.getByRole('button', { name: /^#[0-9A-F]{6}$/i }).first();
            await hexButton.waitFor({ state: 'visible', timeout: 2000 });
            const text = (await hexButton.textContent())?.trim() ?? null;

            await this.page.keyboard.press('Escape');
            await dialogOverlay.first().waitFor({ state: 'detached', timeout: 2000 });

            return text;
        } catch (error) {
            console.warn('Failed to extract color from swatch:', error);
            return null;
        }
    }

    private async ensureNoDialogOpen() {
        if (!this.page) return;
        const dialogOverlay = this.page.locator('.rt-DialogOverlay');
        if (await dialogOverlay.count()) {
            await this.page.keyboard.press('Escape');
            await dialogOverlay.first().waitFor({ state: 'detached' });
        }
    }

    private generateFallbackAccentColors(): string[] {
        const colors: string[] = [];
        for (let i = 1; i <= 12; i++) {
            const lightness = 95 - (i - 1) * 7;
            const color = hslToHex({
                h: 217,
                s: Math.max(10, 90 - (i - 1) * 5),
                l: Math.max(5, lightness)
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
                l: Math.max(5, lightness)
            });
            colors.push(color);
        }
        return colors;
    }
}