

## Step 8: Create Root README

```bash
cd /Users/stian.larsen/privat/nettsider/color-palette-automation

cat > README.md << 'EOF'
# Color Palette Automation Monorepo

Comprehensive color palette generation system with CLI and API services.

## Structure

- **`color-palette-automation-script/`** - CLI tool for local palette generation
- **`playwright-palette-api/`** - RESTful API service for web applications

## Quick Start

### Install Dependencies
```bash
npm run install:all
```

### Development

#### CLI Tool
```bash
npm run dev:cli "#3B82F6" analogous
```

#### API Service
```bash
npm run dev:api
# API available at http://localhost:3000
```

### Testing API
```bash
curl -X POST http://localhost:3000/api/generate-palette \
  -H "Content-Type: application/json" \
  -d '{"hex": "#3B82F6", "scheme": "analogous"}'
```

## Deployment

### Railway (API Service)
1. Connect Railway to the `playwright-palette-api` directory
2. Railway auto-detects Dockerfile and deploys
3. API will be available at your Railway URL

### Frontend Integration
```typescript
const response = await fetch('https://your-api.railway.app/api/generate-palette', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ hex: '#3B82F6', scheme: 'analogous' })
});

const { data } = await response.json();
console.log(data.accentScale.light); // ['#f0f9ff', '#e0f2fe', ...]
```

## Features

- 🎨 Generate harmonious color palettes from single HEX codes
- 🌈 Multiple schemes: analogous, complementary, triadic, monochromatic
- 🎯 Exact Radix UI color scales (12 steps light + dark)
- 🖥️ CLI for local development
- 🌐 REST API for web applications
- 🚀 Production-ready with Docker deployment

```
