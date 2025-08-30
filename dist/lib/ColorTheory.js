import { hexToHSL, hslToHex } from './utils/color/colorConverters.js';
export class AdvancedColorTheory {
    static generateHarmoniousPalette(baseColor, scheme = 'analogous') {
        const hsl = hexToHSL(baseColor);
        switch (scheme) {
            case 'analogous':
                return this.generateAnalogous(hsl);
            case 'complementary':
                return this.generateComplementary(hsl);
            case 'triadic':
                return this.generateTriadic(hsl);
            case 'monochromatic':
                return this.generateMonochromatic(hsl);
            default:
                return this.generateAnalogous(hsl);
        }
    }
    static generateAnalogous(baseHSL) {
        const accent = hslToHex({
            h: baseHSL.h,
            s: Math.max(70, baseHSL.s),
            l: 55
        });
        const gray = hslToHex({
            h: (baseHSL.h + 30) % 360,
            s: 8,
            l: 50
        });
        const lightBg = hslToHex({
            h: (baseHSL.h + 15) % 360,
            s: 20,
            l: 98
        });
        const darkBg = hslToHex({
            h: (baseHSL.h + 15) % 360,
            s: 15,
            l: 8
        });
        return { accent, gray, lightBg, darkBg };
    }
    static generateComplementary(baseHSL) {
        const accent = hslToHex({
            h: baseHSL.h,
            s: Math.max(80, baseHSL.s),
            l: 55
        });
        const gray = hslToHex({
            h: (baseHSL.h + 180) % 360,
            s: 6,
            l: 50
        });
        const lightBg = hslToHex({
            h: baseHSL.h,
            s: 25,
            l: 98
        });
        const darkBg = hslToHex({
            h: (baseHSL.h + 180) % 360,
            s: 20,
            l: 8
        });
        return { accent, gray, lightBg, darkBg };
    }
    static generateTriadic(baseHSL) {
        const accent = hslToHex({
            h: baseHSL.h,
            s: Math.max(75, baseHSL.s),
            l: 55
        });
        const gray = hslToHex({
            h: (baseHSL.h + 120) % 360,
            s: 10,
            l: 50
        });
        const lightBg = hslToHex({
            h: (baseHSL.h + 240) % 360,
            s: 15,
            l: 98
        });
        const darkBg = hslToHex({
            h: (baseHSL.h + 240) % 360,
            s: 12,
            l: 8
        });
        return { accent, gray, lightBg, darkBg };
    }
    static generateMonochromatic(baseHSL) {
        const accent = hslToHex({
            h: baseHSL.h,
            s: Math.max(85, baseHSL.s),
            l: 55
        });
        const gray = hslToHex({
            h: baseHSL.h,
            s: 5,
            l: 50
        });
        const lightBg = hslToHex({
            h: baseHSL.h,
            s: 20,
            l: 98
        });
        const darkBg = hslToHex({
            h: baseHSL.h,
            s: 15,
            l: 8
        });
        return { accent, gray, lightBg, darkBg };
    }
}
