import { Browser, chromium, Page, Locator } from "playwright";
import { hexToHSLString, hslToHex } from "../utils/color/colorConverters.js";
import { AdvancedColorTheory } from "../ColorTheory.js";
import { ColorPalette, GeneratedPalette, RadixColorScale, Scheme } from "../../types/types.js";

interface ExtractedColors {
    accent: string[];
    gray: string[];
}

export class ColorPaletteAutomation {
    private browser: Browser | null = null;
    private page: Page | null = null; // kept for sequential fallback
    private debugMode = false;
    private storedColors: ColorPalette | null = null;

    public setDebugMode(enabled: boolean): void {
        this.debugMode = enabled;
    }

    async initialize(): Promise<void> {
        if (this.browser) return;

        this.browser = await chromium.launch({
            headless: !this.debugMode,
            slowMo: this.debugMode ? 100 : 0,
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-accelerated-2d-canvas",
                "--no-first-run",
                "--no-zygote",
                "--disable-gpu",
                "--disable-background-timer-throttling",
                "--disable-backgrounding-occluded-windows",
                "--disable-renderer-backgrounding",
                "--disable-features=TranslateUI",
                "--disable-ipc-flooding-protection",
            ],
        });

        this.page = await this.browser.newPage({ viewport: { width: 1920, height: 1080 } });
    }

    async cleanup(): Promise<void> {
        if (this.page) {
            await this.page.close();
            this.page = null;
        }
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }

    // ----- Color seeding (unchanged) -----
    generateBaseColors(
        brandColor?: string,
        scheme: Scheme = "analogous",
        opts?: { harmonized?: boolean }
    ): { accent: string; gray: string; lightBackground: string; darkBackground: string } {
        const normalize = (raw?: string): string | undefined => {
            if (!raw) return undefined;
            const cleaned = raw.trim().replace(/^#/, "").toUpperCase();
            if (/^[0-9A-F]{6}$/.test(cleaned)) return `#${cleaned}`;
            if (/^[0-9A-F]{3}$/.test(cleaned)) {
                const [r, g, b] = cleaned.split("");
                return `#${r}${r}${g}${g}${b}${b}`;
            }
            return undefined;
        };

        const useHarmonized = !!opts?.harmonized;


        const seed = normalize(brandColor) ?? "#3B82F6";
        const theory = AdvancedColorTheory.generateHarmoniousPalette(seed, scheme);

        return {
            accent: useHarmonized ? theory.accent : seed,
            gray: theory.gray,
            lightBackground: theory.lightBg,
            darkBackground: theory.darkBg,
        };
    }

    async generateRadixPaletteParallel(colors: ColorPalette): Promise<GeneratedPalette> {
        if (!this.browser) throw new Error("Browser not initialized. Call initialize() first.");

        const url = "https://www.radix-ui.com/colors/custom";
        this.storedColors = colors;

        // Two isolated contexts (cookie/storage isolation) under ONE warm browser
        const [ctxLight, ctxDark] = await Promise.all([
            this.browser.newContext({ viewport: { width: 1920, height: 1080 } }),
            this.browser.newContext({ viewport: { width: 1920, height: 1080 } }),
        ]);

        try {
            const [lightPage, darkPage] = await Promise.all([
                ctxLight.newPage(),
                ctxDark.newPage(),
            ]);

            // Load both pages in parallel
            await Promise.all([
                lightPage.goto(url, { waitUntil: "networkidle", timeout: 30_000 }),
                darkPage.goto(url, { waitUntil: "networkidle", timeout: 30_000 }),
            ]);

            // Do the full flow for each mode concurrently
            const [lightResult, darkResult] = await Promise.all([
                (async () => {
                    await this.ensureLightModeOn(lightPage);
                    await this.fillColorInputsOn(lightPage, colors, /* isDark */ false);
                    return this.extractColorsFromSwatchesOn(lightPage, "light");
                })(),
                (async () => {
                    await this.switchToDarkModeOn(darkPage, colors);
                    await this.fillColorInputsOn(darkPage, colors, /* isDark */ true);
                    return this.extractColorsFromSwatchesOn(darkPage, "dark");
                })(),
            ]);

            const accentScale: RadixColorScale = {
                name: "accent",
                lightSteps: lightResult.accent,
                darkSteps: darkResult.accent,
                lightHslSteps: lightResult.accent.map((hex) => hexToHSLString(hex)),
                darkHslSteps: darkResult.accent.map((hex) => hexToHSLString(hex)),
            };

            const grayScale: RadixColorScale = {
                name: "gray",
                lightSteps: lightResult.gray,
                darkSteps: darkResult.gray,
                lightHslSteps: lightResult.gray.map((hex) => hexToHSLString(hex)),
                darkHslSteps: darkResult.gray.map((hex) => hexToHSLString(hex)),
            };

            return {
                accent: accentScale,
                gray: grayScale,
                css: { light: "", dark: "", variables: "" },
            };
        } finally {
            // Always close contexts even if one side throws
            await Promise.allSettled([ctxLight.close(), ctxDark.close()]);
        }
    }

    // ===== Sequential (kept for fallback/back-compat) =====
    async generateRadixPalette(colors: ColorPalette): Promise<GeneratedPalette> {
        if (!this.page) throw new Error("Browser not initialized. Call initialize() first.");

        await this.page.goto("https://www.radix-ui.com/colors/custom", { waitUntil: "networkidle", timeout: 30_000 });
        await this.page.waitForTimeout(500);

        this.storedColors = colors;

        await this.ensureLightModeOn(this.page);
        await this.fillColorInputsOn(this.page, colors, false);
        const lightModeColors = await this.extractColorsFromSwatchesOn(this.page, "light");

        await this.switchToDarkModeOn(this.page, colors);
        await this.fillColorInputsOn(this.page, colors, true);
        const darkModeColors = await this.extractColorsFromSwatchesOn(this.page, "dark");

        const accentScale: RadixColorScale = {
            name: "accent",
            lightSteps: lightModeColors.accent,
            darkSteps: darkModeColors.accent,
            lightHslSteps: lightModeColors.accent.map(hex => hexToHSLString(hex)),
            darkHslSteps: darkModeColors.accent.map(hex => hexToHSLString(hex)),
        };

        const grayScale: RadixColorScale = {
            name: "gray",
            lightSteps: lightModeColors.gray,
            darkSteps: darkModeColors.gray,
            lightHslSteps: lightModeColors.gray.map(hex => hexToHSLString(hex)),
            darkHslSteps: darkModeColors.gray.map(hex => hexToHSLString(hex)),
        };

        return { accent: accentScale, gray: grayScale, css: { light: "", dark: "", variables: "" } };
    }

    // ---------- Page-scoped helpers (parallel-safe) ----------

    private async fillColorInputsOn(page: Page, colors: ColorPalette, isDark = false): Promise<void> {
        const bgColor = isDark ? colors.darkBackground : colors.lightBackground;
        // Always clear, then fill
        await page.fill("#accent", "");
        await page.fill("#gray", "");
        await page.fill("#bg", "");
        await page.waitForTimeout(100);

        await page.fill("#accent", colors.accent.replace("#", ""));
        await page.waitForTimeout(120);

        await page.fill("#gray", colors.gray.replace("#", ""));
        await page.waitForTimeout(120);

        await page.fill("#bg", bgColor.replace("#", ""));
        await page.waitForTimeout(200);
    }

    private async ensureLightModeOn(page: Page): Promise<void> {
        try {
            const lightBtn = page.locator('button:has-text("Light")');
            const isOff = await lightBtn.getAttribute("data-state");
            if (isOff === "off") {
                await lightBtn.click();
                await page.waitForTimeout(300);
            }
            await page.waitForSelector("button.rt-reset.CustomSwatch_CustomSwatchTrigger__jlBrx", { timeout: 10_000 });
        } catch {
            // best effort
        }
    }

    private async switchToDarkModeOn(page: Page, colorsForRefill?: ColorPalette): Promise<void> {
        try {
            const darkBtn = page.locator('button:has-text("Dark")');
            const isOff = await darkBtn.getAttribute("data-state");
            if (isOff === "off") {
                await darkBtn.click();
                await page.waitForTimeout(300);
            }
            const toFill = colorsForRefill ?? this.storedColors;
            if (toFill) await this.fillColorInputsOn(page, toFill, true);
            await page.waitForSelector("button.rt-reset.CustomSwatch_CustomSwatchTrigger__jlBrx", { timeout: 10_000 });
        } catch {
            // best effort
        }
    }

    private async ensureNoDialogOpenOn(page: Page): Promise<void> {
        const dialog = page.getByRole("dialog");
        if (await dialog.isVisible({ timeout: 200 }).catch(() => false)) {
            await page.keyboard.press("Escape");
            await dialog.waitFor({ state: "detached", timeout: 1000 }).catch(() => {});
        }
    }

    private async extractColorsFromSwatchesOn(page: Page, mode: "light" | "dark"): Promise<ExtractedColors> {
        console.log(`🎨 Extracting ${mode} colors...`);

        // Grab all swatches (Radix currently renders 24: 12 accent, 12 gray)
        const swatchButtons = page.locator("button.rt-reset.CustomSwatch_CustomSwatchTrigger__jlBrx");
        const count = await swatchButtons.count();
        if (count < 24) {
            console.warn(`Expected 24 swatches, found ${count}. Continuing with what we have.`);
        }

        const accent: string[] = [];
        const gray: string[] = [];

        // First 12 = accent
        for (let i = 0; i < Math.min(12, count); i++) {
            try {
                const swatch = swatchButtons.nth(i);
                const color = await this.extractHexFromOpenDialog(page, swatch, i + 1, "accent");
                accent.push(color ?? this.generateFallbackAccentColors()[i]);
            } catch (e) {
                console.warn(`Failed to extract accent ${i + 1}:`, e);
                accent.push(this.generateFallbackAccentColors()[i]);
            }
            await page.waitForTimeout(30);
        }

        // Next 12 = gray
        for (let i = 12; i < Math.min(24, count); i++) {
            const idx = i - 12;
            try {
                const swatch = swatchButtons.nth(i);
                const color = await this.extractHexFromOpenDialog(page, swatch, idx + 1, "gray");
                gray.push(color ?? this.generateFallbackGrayColors()[idx]);
            } catch (e) {
                console.warn(`Failed to extract gray ${idx + 1}:`, e);
                gray.push(this.generateFallbackGrayColors()[idx]);
            }
            await page.waitForTimeout(30);
        }

        // Pad if needed
        while (accent.length < 12) accent.push(this.generateFallbackAccentColors()[accent.length]);
        while (gray.length < 12) gray.push(this.generateFallbackGrayColors()[gray.length]);

        return { accent, gray };
    }

    /**
     * KEY FIX: scope inside the dialog and resolve duplicates by taking `.first()`.
     * Never call `.waitFor()` on a non-unique locator in strict mode.
     */
    private async extractHexFromOpenDialog(
        page: Page,
        swatchButton: Locator,
        index: number,
        type: "accent" | "gray",
        maxRetries = 3
    ): Promise<string | null> {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await this.ensureNoDialogOpenOn(page);

                // 1) Open dialog for this swatch
                await swatchButton.scrollIntoViewIfNeeded();
                await swatchButton.click();

                // 2) Get the dialog container
                const dialog = page.getByRole("dialog");
                await dialog.waitFor({ state: "visible", timeout: 2000 });

                // 3) Within dialog, find any button whose accessible name is a HEX and pick the first
                const hexButtons = dialog.getByRole("button", { name: /^#[0-9A-F]{3,6}$/i });
                await hexButtons.first().waitFor({ state: "visible", timeout: 1500 });

                const hexText = (await hexButtons.first().innerText()).trim().toUpperCase();

                // 4) Close dialog
                await page.keyboard.press("Escape");
                await dialog.waitFor({ state: "detached", timeout: 1000 }).catch(() => {});

                if (this.isValidHex(hexText)) return hexText;
            } catch (err) {
                console.warn(`Attempt ${attempt}/${maxRetries} failed for ${type} step ${index}`, err);
                // best-effort close
                const dialog = page.getByRole("dialog");
                if (await dialog.isVisible({ timeout: 200 }).catch(() => false)) {
                    await page.keyboard.press("Escape").catch(() => {});
                }
                await page.waitForTimeout(120 * attempt);
            }
        }
        return null;
    }

    // ----- utils -----
    private isValidHex(value?: string | null): value is string {
        if (!value) return false;
        const cleaned = value.trim().replace(/^#/, "").toUpperCase();
        return /^[0-9A-F]{6}$/.test(cleaned) || /^[0-9A-F]{3}$/.test(cleaned);
    }

    private generateFallbackAccentColors(): string[] {
        const arr: string[] = [];
        for (let i = 1; i <= 12; i++) {
            const l = 97 - (i - 1) * 7;
            const color = hslToHex({ h: 220, s: 90, l: Math.max(7, Math.min(97, l)) });
            arr.push(color);
        }
        return arr;
    }

    private generateFallbackGrayColors(): string[] {
        const arr: string[] = [];
        for (let i = 1; i <= 12; i++) {
            const l = 95 - (i - 1) * 7;
            const color = hslToHex({ h: 220, s: 5, l: Math.max(5, Math.min(95, l)) });
            arr.push(color);
        }
        return arr;
    }
}
