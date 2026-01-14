# Python on Vercel Setup Guide

## Overview

Vercel supports Python serverless functions! Your project is now configured to use Python for fetching CFBD roster data.

## How It Works

1. **Python Serverless Function**: Located at `api/python/roster.py`
   - This is a Vercel serverless function that uses Python runtime
   - Accessible at `/api/python/roster` endpoint
   - Uses the CFBD Python library for accurate data fetching

2. **TypeScript Route**: Located at `app/api/roster/route.ts`
   - Tries Python serverless function first (works on Vercel)
   - Falls back to local Python script (works locally)
   - Falls back to direct HTTP API calls (works everywhere)

## File Structure

```
├── api/
│   └── python/
│       └── roster.py          # Vercel Python serverless function
├── app/
│   └── api/
│       └── roster/
│           └── route.ts       # Next.js API route (calls Python function)
├── scripts/
│   └── fetch_ou_roster.py     # Local Python script
├── cfbd-python/               # CFBD Python library
└── requirements.txt           # Python dependencies
```

## Vercel Configuration

Vercel will automatically:
- Detect Python files in the `api/` directory
- Install dependencies from `requirements.txt`
- Use Python 3.12 runtime (default)
- Make the function available at `/api/python/roster`

## Dependencies

The `requirements.txt` file includes:
- `python_dateutil >= 2.5.3`
- `setuptools >= 21.0.0`
- `urllib3 >= 1.25.3, < 3.0.0`
- `pydantic >= 1.10.5, < 2`
- `aenum >= 3.1.11`

The CFBD Python library is included as a local package in `cfbd-python/`.

## How the Route Works

1. **First**: Tries to call `/api/python/roster` (Python serverless function on Vercel)
2. **Second**: Tries to execute local Python script (for local development)
3. **Third**: Falls back to direct HTTP API calls (universal fallback)

This ensures:
- ✅ Python works on Vercel (via serverless function)
- ✅ Python works locally (via script execution)
- ✅ Always works (via HTTP fallback)

## Testing

To test locally:
```bash
npm run dev
# Visit http://localhost:3000/api/roster
```

The route will try Python script execution first, then fall back to HTTP API.

## Deployment

When you deploy to Vercel:
1. Vercel detects `api/python/roster.py`
2. Installs Python dependencies from `requirements.txt`
3. Makes the function available at `/api/python/roster`
4. The TypeScript route calls it automatically

## Troubleshooting

If Python function doesn't work on Vercel:
- Check that `requirements.txt` exists and has correct dependencies
- Verify `cfbd-python/` directory is included in deployment
- Check Vercel function logs for Python errors
- The route will automatically fall back to HTTP API calls

## Benefits

✅ **Accurate Data**: Python library provides better data formatting
✅ **Headshots**: Proper player data structure for headshot generation
✅ **Reliability**: Multiple fallback options ensure it always works
✅ **Vercel Compatible**: Uses Vercel's native Python runtime support
