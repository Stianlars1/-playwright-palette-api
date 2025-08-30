import { chromium } from 'playwright';
import { hexToHSLString, hslToHex } from "../utils/color/colorConverters.js";
import { AdvancedColorTheory } from "../ColorTheory.js";
export class ColorPaletteAutomation {
    browser = null;
    page = null;
    debugMode = false;
    storedColors = null;
    setDebugMode(enabled) {
        this.debugMode = enabled;
    }
    async initialize() {
        this.browser = await chromium.launch({
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
        this.page = await this.browser.newPage({
            viewport: { width: 1920, height: 1080 }
        });
    }
    async cleanup() {
        if (this.page) {
            await this.page.close();
            this.page = null;
        }
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
    generateBaseColors(brandColor, scheme = 'analogous') {
        const normalize = (raw) => {
            if (!raw)
                return undefined;
            const cleaned = raw.trim().replace(/^#/, '').toUpperCase();
            if (/^[0-9A-F]{6}$/.test(cleaned))
                return `#${cleaned}`;
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
    async generateRadixPalette(colors) {
        if (!this.page) {
            throw new Error('Browser not initialized. Call initialize() first.');
        }
        console.log('🌐 Navigating to Radix Colors...');
        await this.page.goto('https://www.radix-ui.com/colors/custom', {
            waitUntil: 'networkidle',
            timeout: 30000
        });
        // Wait for page to fully load and stabilize
        await this.page.waitForTimeout(1000);
        this.storedColors = colors;
        console.log('🎨 Filling initial color inputs...');
        await this.fillColorInputs(colors, false);
        console.log('☀️ Extracting light mode colors...');
        await this.ensureLightMode();
        const lightModeColors = await this.extractColorsFromSwatches('light');
        console.log('🌙 Switching to dark mode...');
        await this.switchToDarkMode();
        const darkModeColors = await this.extractColorsFromSwatches('dark');
        const accentScale = {
            name: 'accent',
            lightSteps: lightModeColors.accent,
            darkSteps: darkModeColors.accent,
            lightHslSteps: lightModeColors.accent.map(hex => hexToHSLString(hex)),
            darkHslSteps: darkModeColors.accent.map(hex => hexToHSLString(hex))
        };
        const grayScale = {
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
    async fillColorInputs(colors, isDark = false) {
        if (!this.page)
            return;
        try {
            const bgColor = isDark ? colors.darkBackground : colors.lightBackground;
            console.log(`🎨 Setting colors: accent=${colors.accent}, gray=${colors.gray}, bg=${bgColor}`);
            // Clear inputs first
            await this.page.fill('#accent', '');
            await this.page.fill('#gray', '');
            await this.page.fill('#bg', '');
            await this.page.waitForTimeout(200);
            // Fill inputs sequentially to avoid conflicts
            await this.page.fill('#accent', colors.accent.replace('#', ''));
            await this.page.waitForTimeout(300);
            await this.page.fill('#gray', colors.gray.replace('#', ''));
            await this.page.waitForTimeout(300);
            await this.page.fill('#bg', bgColor.replace('#', ''));
            await this.page.waitForTimeout(500);
            console.log('✅ Color inputs filled successfully');
        }
        catch (error) {
            console.error('❌ Error filling color inputs:', error);
            throw error;
        }
    }
    async ensureLightMode() {
        if (!this.page)
            return;
        try {
            // Check if light mode button exists and is not active
            const lightButton = await this.page.$('button[data-state="off"]:has-text("Light")');
            if (lightButton) {
                console.log('☀️ Clicking Light mode button');
                await lightButton.click();
                await this.page.waitForTimeout(1000);
            }
            else {
                console.log('☀️ Light mode already selected');
            }
            // Verify swatches are loaded
            await this.page.waitForSelector('button.rt-reset.CustomSwatch_CustomSwatchTrigger__jlBrx', { timeout: 10000 });
            await this.page.waitForTimeout(500);
        }
        catch (error) {
            console.log('⚠️ Could not ensure light mode, proceeding anyway');
        }
    }
    async switchToDarkMode() {
        if (!this.page)
            return;
        try {
            const darkButton = await this.page.$('button[data-state="off"]:has-text("Dark")');
            if (darkButton) {
                console.log('🌙 Clicking Dark mode button');
                await darkButton.click();
                await this.page.waitForTimeout(1000);
                if (this.storedColors) {
                    console.log('🎨 Refilling inputs after dark mode switch...');
                    await this.fillColorInputs(this.storedColors, true);
                }
            }
            else {
                console.log('⚠️ Could not find dark mode button');
            }
            // Verify swatches are loaded in dark mode
            await this.page.waitForSelector('button.rt-reset.CustomSwatch_CustomSwatchTrigger__jlBrx', { timeout: 10000 });
            await this.page.waitForTimeout(500);
        }
        catch (error) {
            console.error('❌ Error switching to dark mode:', error);
        }
    }
    async extractColorsFromSwatches(mode) {
        if (!this.page)
            throw new Error('Page not initialized');
        console.log(`🎨 Extracting ${mode} colors from swatches...`);
        try {
            const swatchButtons = await this.page.$$('button.rt-reset.CustomSwatch_CustomSwatchTrigger__jlBrx');
            console.log(`Found ${swatchButtons.length} color swatches`);
            if (swatchButtons.length < 24) {
                console.warn(`Expected 24 swatches but found ${swatchButtons.length}`);
            }
            const accentColors = [];
            const grayColors = [];
            // Extract accent colors (first 12 swatches) with improved error handling
            console.log(`📦 [${mode}] Extracting accent colors...`);
            for (let i = 0; i < Math.min(12, swatchButtons.length); i++) {
                try {
                    const color = await this.extractColorFromSwatchWithRetry(swatchButtons[i], i + 1, 'accent');
                    if (color && this.isValidHex(color)) {
                        accentColors.push(color);
                        console.log(`  Accent ${i + 1}: ${color}`);
                    }
                    else {
                        console.warn(`Invalid accent color ${i + 1}: ${color}`);
                        accentColors.push(this.generateFallbackAccentColors()[i]);
                    }
                }
                catch (error) {
                    console.warn(`Failed to extract accent color ${i + 1}:`, error);
                    accentColors.push(this.generateFallbackAccentColors()[i]);
                }
                // Small delay between extractions to prevent conflicts
                await this.page.waitForTimeout(50);
            }
            // Extract gray colors (next 12 swatches)
            console.log(`📦 [${mode}] Extracting gray colors...`);
            for (let i = 12; i < Math.min(24, swatchButtons.length); i++) {
                const grayIndex = i - 12;
                try {
                    const color = await this.extractColorFromSwatchWithRetry(swatchButtons[i], grayIndex + 1, 'gray');
                    if (color && this.isValidHex(color)) {
                        grayColors.push(color);
                        console.log(`  Gray ${grayIndex + 1}: ${color}`);
                    }
                    else {
                        console.warn(`Invalid gray color ${grayIndex + 1}: ${color}`);
                        grayColors.push(this.generateFallbackGrayColors()[grayIndex]);
                    }
                }
                catch (error) {
                    console.warn(`Failed to extract gray color ${grayIndex + 1}:`, error);
                    grayColors.push(this.generateFallbackGrayColors()[grayIndex]);
                }
                await this.page.waitForTimeout(50);
            }
            console.log(`✅ [${mode}] Extracted ${accentColors.length} accent + ${grayColors.length} gray colors`);
            return {
                accent: accentColors,
                gray: grayColors
            };
        }
        catch (error) {
            console.error(`❌ Error extracting ${mode} colors:`, error);
            return {
                accent: this.generateFallbackAccentColors(),
                gray: this.generateFallbackGrayColors()
            };
        }
    }
    async extractColorFromSwatchWithRetry(swatchButton, index, type, maxRetries = 3) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // Ensure no dialogs are open before starting
                await this.ensureNoDialogOpen();
                // Click the swatch
                await swatchButton.click();
                // Wait for dialog to appear with longer timeout
                const dialogOverlay = this.page.locator('.rt-DialogOverlay').first();
                await dialogOverlay.waitFor({ state: 'visible', timeout: 5000 });
                // Extract color value
                const hexButton = this.page.getByRole('button', { name: /^#[0-9A-F]{6}$/i }).first();
                await hexButton.waitFor({ state: 'visible', timeout: 3000 });
                const text = (await hexButton.textContent())?.trim();
                // Close dialog
                await this.page.keyboard.press('Escape');
                await dialogOverlay.waitFor({ state: 'detached', timeout: 3000 });
                if (text && this.isValidHex(text)) {
                    return text;
                }
                console.warn(`Attempt ${attempt} failed for ${type} ${index}: invalid color ${text}`);
            }
            catch (error) {
                console.warn(`Attempt ${attempt} failed for ${type} ${index}:`, error);
                // Ensure cleanup on failure
                await this.ensureNoDialogOpen();
                await this.page.waitForTimeout(200);
            }
        }
        return null;
    }
    async ensureNoDialogOpen() {
        if (!this.page)
            return;
        try {
            const dialogOverlay = this.page.locator('.rt-DialogOverlay');
            const count = await dialogOverlay.count();
            if (count > 0) {
                await this.page.keyboard.press('Escape');
                await dialogOverlay.first().waitFor({ state: 'detached', timeout: 2000 });
            }
        }
        catch (error) {
            // Ignore cleanup errors
        }
    }
    isValidHex(color) {
        if (!color)
            return false;
        const hex = color.replace('#', '');
        return /^[0-9A-F]{6}$/i.test(hex) && hex !== '000000' && hex !== 'FFFFFF';
    }
    generateFallbackAccentColors() {
        const baseHue = 217; // Blue hue for fallback
        const colors = [];
        for (let i = 1; i <= 12; i++) {
            const lightness = i <= 6
                ? 95 - (i - 1) * 8 // Light steps
                : 80 - (i - 7) * 12; // Darker steps
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
    generateFallbackGrayColors() {
        const colors = [];
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
