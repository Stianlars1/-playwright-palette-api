import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { paletteRouter } from './routes/palette.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? process.env.FRONTEND_URLS?.split(',') || ['https://yourfrontend.vercel.app']
        : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:3001'],
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging in development
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
        next();
    });
}

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'playwright-palette-api',
        version: '1.0.0',
        uptime: process.uptime()
    });
});

// Root endpoint with API documentation
app.get('/', (req, res) => {
    res.json({
        name: 'Playwright Palette API',
        version: '1.0.0',
        description: 'Generate Radix UI color palettes using Playwright automation',
        documentation: {
            health: 'GET /health',
            generatePalette: 'POST /api/generate-palette'
        },
        usage: {
            endpoint: '/api/generate-palette',
            method: 'POST',
            body: {
                hex: 'string (required) - HEX color code (#RGB or #RRGGBB)',
                scheme: 'string (optional) - analogous|complementary|triadic|monochromatic'
            },
            example: {
                hex: '#3B82F6',
                scheme: 'analogous'
            }
        }
    });
});

// API routes
app.use('/api', paletteRouter);

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Not found',
        message: `Route ${req.method} ${req.originalUrl} not found`,
        availableRoutes: ['/health', '/', '/api/generate-palette']
    });
});

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('API Error:', error);

    res.status(error.status || 500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
    });
});

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
    console.log(`${signal} received, shutting down gracefully`);
    process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

app.listen(PORT, () => {
    console.log(`🎨 Playwright Palette API running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`Documentation: http://localhost:${PORT}/`);
});