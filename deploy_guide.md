# Install Railway CLI (if not already installed)
npm install -g @railway/cli


# Login and deploy
railway login
railway init

# Select "Deploy from GitHub repo"
# Choose your monorepo
# Set root directory to: playwright-palette-api

# Deploy
railway up