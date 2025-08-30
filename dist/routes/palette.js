import { Router } from 'express';
import { PaletteService } from '../services/PaletteService.js';
const router = Router();
const paletteService = new PaletteService();
const validateHex = (hex) => {
    if (!hex)
        return 'Hex color is required';
    const cleaned = hex.trim().replace(/^#/, '');
    if (!/^[0-9A-Fa-f]{3}$/.test(cleaned) && !/^[0-9A-Fa-f]{6}$/.test(cleaned)) {
        return 'Invalid hex format. Use #RGB or #RRGGBB format';
    }
    return null;
};
const timeoutMiddleware = (req, res, next) => {
    const timeout = setTimeout(() => {
        if (!res.headersSent) {
            res.status(408).json({
                error: 'Request timeout',
                message: 'Palette generation took too long. Please try again.'
            });
        }
    }, 45000);
    res.on('finish', () => clearTimeout(timeout));
    res.on('close', () => clearTimeout(timeout));
    next();
};
router.post('/generate-palette', timeoutMiddleware, async (req, res) => {
    const startTime = Date.now();
    try {
        const { hex, scheme = 'analogous' } = req.body;
        console.log(`🎨 Generating palette for hex: ${hex}, scheme: ${scheme}`);
        const hexError = validateHex(hex);
        if (hexError) {
            return res.status(400).json({
                success: false,
                error: 'Validation error',
                message: hexError,
                received: { hex, scheme }
            });
        }
        const result = await paletteService.generatePalette(hex, scheme);
        const duration = Date.now() - startTime;
        console.log(`✅ Palette generated in ${duration}ms`);
        res.json({
            success: true,
            data: result,
            metadata: {
                generatedAt: new Date().toISOString(),
                processingTime: `${duration}ms`,
                inputHex: hex,
                inputScheme: scheme
            }
        });
    }
    catch (error) {
        const duration = Date.now() - startTime;
        console.error(`❌ Palette generation failed after ${duration}ms:`, error);
        res.status(500).json({
            success: false,
            error: 'Palette generation failed',
            message: error instanceof Error ? error.message : 'Unknown error occurred'
        });
    }
});
export { router as paletteRouter };
