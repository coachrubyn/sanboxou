# Deployment Guide - Vercel

This guide will help you deploy the OU Football Dashboard to Vercel.

## Prerequisites

1. A Vercel account (sign up at [vercel.com](https://vercel.com))
2. Your project pushed to a Git repository (GitHub, GitLab, or Bitbucket)
3. Your CFBD API key ready

## Step 1: Push to Git Repository

If you haven't already, initialize a git repository and push your code:

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - OU Football Dashboard"

# Add your remote repository (replace with your repo URL)
git remote add origin https://github.com/yourusername/ou-football-dashboard.git

# Push to repository
git push -u origin main
```

## Step 2: Deploy to Vercel

### Option A: Deploy via Vercel Dashboard

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"Add New Project"**
3. Import your Git repository
4. Configure the project:
   - **Framework Preset**: Next.js (should auto-detect)
   - **Root Directory**: `./` (root)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)
   - **Install Command**: `npm install` (default)

### Option B: Deploy via Vercel CLI

```bash
# Install Vercel CLI globally
npm i -g vercel

# Login to Vercel
vercel login

# Deploy (from project root)
vercel

# Follow the prompts:
# - Set up and deploy? Yes
# - Which scope? (select your account)
# - Link to existing project? No (first time)
# - Project name? ou-football-dashboard (or your choice)
# - Directory? ./
# - Override settings? No
```

## Step 3: Configure Environment Variables

**Important**: You need to add your CFBD API key as an environment variable in Vercel.

### Via Vercel Dashboard:

1. Go to your project settings in Vercel
2. Navigate to **Settings** → **Environment Variables**
3. Add the following variable:
   - **Name**: `CFBD_API_KEY`
   - **Value**: Your CFBD API key
   - **Environment**: Production, Preview, and Development (select all)
4. Click **Save**

### Via Vercel CLI:

```bash
vercel env add CFBD_API_KEY
# Enter your API key when prompted
# Select all environments (Production, Preview, Development)
```

## Step 4: Important Notes for Vercel Deployment

### Python Script Execution

The project uses Python scripts for fetching roster data. Vercel supports Python via serverless functions, but you need to ensure:

1. **Python Runtime**: Vercel will automatically detect Python if you have a `requirements.txt` file
2. **Python Dependencies**: The `cfbd-python` directory contains the Python SDK
3. **API Route**: The `/api/roster` route executes Python scripts using `child_process.exec`

**Note**: Vercel serverless functions have a 10-second timeout on the Hobby plan and 60 seconds on Pro. The Python script execution should complete within this timeframe.

### File System Limitations

Vercel uses a read-only file system except for `/tmp`. The application writes cache files to `data/cache/`. For production:

- Cache files will be written but won't persist between deployments
- Consider using Vercel KV (Redis) or a database for persistent caching
- For now, the app will work but cache will reset on each deployment

### Build Configuration

The `next.config.ts` is already configured correctly. No changes needed.

## Step 5: Redeploy After Environment Variable Changes

After adding environment variables, you need to redeploy:

```bash
# Via CLI
vercel --prod

# Or trigger a new deployment via the dashboard
# (push a new commit or click "Redeploy" in Vercel dashboard)
```

## Step 6: Verify Deployment

1. Visit your Vercel deployment URL (e.g., `https://ou-football-dashboard.vercel.app`)
2. Test the following:
   - Home page loads
   - Team board displays players
   - Player profiles load with stats
   - API routes respond correctly

## Troubleshooting

### Build Fails

- Check build logs in Vercel dashboard
- Ensure all TypeScript errors are resolved
- Verify `package.json` has all dependencies

### API Routes Not Working

- Verify `CFBD_API_KEY` is set in environment variables
- Check Vercel function logs for errors
- Ensure Python scripts are accessible

### Python Script Execution Issues

- Verify Python 3.9+ is available (Vercel uses Python 3.9 by default)
- Check that `cfbd-python` directory is included in deployment
- Review function logs for Python execution errors

### Environment Variables Not Loading

- Ensure variables are set for the correct environment (Production/Preview/Development)
- Redeploy after adding environment variables
- Check variable names match exactly (case-sensitive)

## Production Optimizations

Consider these improvements for production:

1. **Caching Strategy**: Use Vercel KV or a database for persistent caching
2. **API Rate Limiting**: Implement rate limiting for CFBD API calls
3. **Error Monitoring**: Add error tracking (Sentry, etc.)
4. **Analytics**: Add analytics tracking
5. **CDN**: Vercel automatically provides CDN for static assets

## Custom Domain

To add a custom domain:

1. Go to **Settings** → **Domains** in Vercel
2. Add your domain
3. Follow DNS configuration instructions
4. Vercel will automatically provision SSL certificates

## Support

For Vercel-specific issues, check:
- [Vercel Documentation](https://vercel.com/docs)
- [Vercel Community](https://github.com/vercel/vercel/discussions)

For project-specific issues, check the main README.md file.
