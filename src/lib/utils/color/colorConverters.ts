export interface HSLColor {
    h: number;
    s: number;
    l: number;
}

export function hexToHSL(hex: string): HSLColor {
    const clean = hex.trim().replace(/^#/, '');

    // Handle 3-digit hex
    const fullHex = clean.length === 3
        ? clean.split('').map(char => char + char).join('')
        : clean;

    const r = parseInt(fullHex.slice(0, 2), 16) / 255;
    const g = parseInt(fullHex.slice(2, 4), 16) / 255;
    const b = parseInt(fullHex.slice(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return {
        h: Math.round(h * 360),
        s: Math.round(s * 100),
        l: Math.round(l * 100)
    };
}

export function hslToHex(hsl: HSLColor): string {
    const { h, s, l } = hsl;
    const sNorm = s / 100;
    const lNorm = l / 100;

    const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = lNorm - c / 2;

    let r = 0, g = 0, b = 0;

    if (0 <= h && h < 60) {
        r = c; g = x; b = 0;
    } else if (60 <= h && h < 120) {
        r = x; g = c; b = 0;
    } else if (120 <= h && h < 180) {
        r = 0; g = c; b = x;
    } else if (180 <= h && h < 240) {
        r = 0; g = x; b = c;
    } else if (240 <= h && h < 300) {
        r = x; g = 0; b = c;
    } else if (300 <= h && h < 360) {
        r = c; g = 0; b = x;
    }

    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
}

export function hexToHSLString(hex: string): string {
    const hsl = hexToHSL(hex);
    return `${hsl.h} ${hsl.s}% ${hsl.l}%`;
}

export function normalizeHex(raw: string): string | null {
    if (!raw) return null;

    const cleaned = raw.trim().replace(/^#/, '').toUpperCase();

    if (/^[0-9A-F]{6}$/.test(cleaned)) {
        return `#${cleaned}`;
    }

    if (/^[0-9A-F]{3}$/.test(cleaned)) {
        const [r, g, b] = cleaned.split('');
        return `#${r}${r}${g}${g}${b}${b}`;
    }

    return null;
}