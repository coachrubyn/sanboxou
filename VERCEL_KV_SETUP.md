# Vercel KV Setup Guide

## Overview

The roster cache now uses **Vercel KV** (Redis) for persistent, shared caching across all serverless function instances. This provides:

- ✅ **Persistent cache** across deployments
- ✅ **Shared cache** across all function instances
- ✅ **Automatic expiration** (1 hour TTL)
- ✅ **Fallback support** (works without KV too)

## Setup Steps

### 1. Create Vercel KV Database

1. Go to your Vercel project dashboard
2. Navigate to **Storage** → **Create Database**
3. Select **KV** (Redis)
4. Choose a name (e.g., `roster-cache`)
5. Select a region (choose closest to your users)
6. Click **Create**

### 2. Link KV to Your Project

After creating the KV database:

1. You'll see environment variables automatically added:
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
2. These are automatically available in your serverless functions

### 3. Redeploy Your Project

After linking KV, redeploy:

```bash
vercel --prod
```

Or trigger a new deployment from the Vercel dashboard.

## How It Works

The cache system uses a **3-tier fallback strategy**:

1. **Vercel KV** (if available) - Best for production
2. **In-memory cache** - Fast fallback
3. **File cache** - Works locally

### Cache Priority

```
Request → Vercel KV → In-Memory → File Cache → API Call
```

## Environment Variables

Vercel automatically provides these when KV is linked:

- `KV_REST_API_URL` - KV REST API endpoint
- `KV_REST_API_TOKEN` - Authentication token

**No manual configuration needed!** Vercel handles this automatically.

## Testing

### Test Locally (without KV)

The cache will work locally using file + in-memory cache:

```bash
npm run dev
# Visit http://localhost:3000/api/roster
```

### Test on Vercel (with KV)

1. Deploy to Vercel
2. Visit your deployment URL
3. Check logs for `[KV CACHE HIT]` or `[KV CACHE SAVE]` messages

## Cache Behavior

- **TTL**: 1 hour (60 minutes)
- **Key Format**: `roster:{team}:{year}`
- **Automatic Expiration**: KV handles expiration automatically
- **Force Refresh**: Use `?refresh=true` to bypass cache

## Monitoring

Check Vercel KV usage in your dashboard:

1. Go to **Storage** → **KV**
2. View metrics:
   - Operations per second
   - Memory usage
   - Data size

## Troubleshooting

### Cache Not Working

1. **Check KV is linked**: Verify `KV_REST_API_URL` exists in environment variables
2. **Check logs**: Look for `[KV]` messages in function logs
3. **Fallback works**: Even without KV, in-memory and file cache will work

### KV Connection Errors

If you see KV connection errors:

1. Verify KV database is created and linked
2. Check environment variables are set
3. Redeploy after linking KV
4. The system will automatically fall back to in-memory cache

## Benefits

✅ **Persistent**: Cache survives deployments  
✅ **Shared**: All function instances share the same cache  
✅ **Fast**: Redis is extremely fast  
✅ **Reliable**: Automatic expiration and error handling  
✅ **Scalable**: Works with any number of function instances  

## Cost

Vercel KV pricing:
- **Hobby**: Free tier available (limited)
- **Pro**: Included in Pro plan
- Check [Vercel Pricing](https://vercel.com/pricing) for details

## Next Steps

1. Create KV database in Vercel dashboard
2. Link it to your project (automatic)
3. Redeploy your project
4. Monitor cache hits in logs

The cache will automatically use KV when available, and gracefully fall back when it's not!
