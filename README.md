# OU Football Dashboard

A comprehensive, production-ready dashboard for monitoring and managing the University of Oklahoma football team. Built with modern web technologies, this platform provides real-time player analytics, performance tracking, and team management tools for coaches, analysts, and staff.

## 🎯 Overview

The OU Football Dashboard is a full-stack web application that consolidates player data from multiple sources into a unified, intuitive interface. It combines on-field statistics from the College Football Data API with high-performance metrics, player development tracking, and team management capabilities.

### Key Highlights

- **Real-Time Data Integration**: Seamlessly pulls roster and statistics from the CFBD API
- **High-Performance Caching**: Redis/Vercel KV integration ensures fast load times and reduced API costs
- **Comprehensive Analytics**: Track everything from game stats to GPS metrics to force plate testing
- **Intuitive Team Management**: Drag-and-drop interface for organizing players and depth charts
- **Production-Ready**: Deployed on Vercel with optimized caching strategies

## ✨ Features

### 🏈 Team Management

**Position-Based Organization**
- Granular position groups: QB, RB, WR, TE, T, G, C, ILB, EDGE, IDL, CB, S, K, P, LS
- Automatic position mapping from CFBD's generic positions to detailed roles
- Visual team board with color-coded position groups

**Role & Depth Chart Management**
- Assign players to Starter, Back-Up, Practice Player, or Rehab roles
- Drag-and-drop interface for easy reorganization
- Persistent depth chart overrides from official team data
- Reset functionality to restore default depth chart positions

**Player Cards**
- Automatic headshot generation from OU athletics website
- Web scraping integration for accurate player photos
- Real-time roster updates with 30-day cache persistence

### 📊 Player Analytics

**Multi-Season Statistics**
- View player performance across multiple seasons (2020-2026)
- Game-by-game statistics with year filtering
- Position-specific advanced metrics with percentile rankings
- Comprehensive stat categories: passing, rushing, receiving, defensive stats

**CFBD API Integration**
- Real-time on-field statistics from College Football Data API
- Player stats: passing yards, rushing yards, receiving yards, touchdowns
- Defensive stats: tackles, sacks, interceptions, passes defended
- Advanced metrics: efficiency ratings, success rates, explosive plays

### 🏃 High Performance Monitoring

**Catapult GPS Data**
- **Player Load Tracking**: Monitor training load and intensity
- **ACR (Acute:Chronic Ratio)**: Injury risk assessment with alert system (highlights values > 1.2)
- **Velocity Metrics**: Max velocity, high-speed running thresholds
- **Distance Tracking**: Total distance, high-intensity distance
- **Acceleration/Deceleration**: High-intensity acceleration and deceleration events
- **Week Pattern Visualization**: Realistic display of 5 practices + 1 game per week
- **Longitudinal Charts**: Interactive trend analysis with metric dropdowns

**Force Plate Testing**
- **10+ Metrics Tracked**: Peak Force, Mean Force, Rate of Force Development (RFD)
- **Jump Analysis**: Jump Height, Power Output, Eccentric/Concentric Rates
- **Biomechanical Data**: Time to Peak Force, Impulse, Stiffness
- **Metric Selector**: Dropdown to view different metrics in table and chart views
- **Trend Analysis**: Visual trend lines for each metric over time
- **Statistical Analysis**: Coefficient of Variation (CoV) and percent change tracking

**Body Composition**
- **Longitudinal Tracking**: View body composition tests over time
- **Key Metrics**: Weight, Body Fat %, Muscle Mass, BMI
- **Test History**: Complete history table of all body composition tests
- **Multi-Metric Charts**: Visualize trends across all measurements

### 👤 Player Profiles

**Comprehensive Dashboards**
- Individual player pages with consolidated stats and metrics
- Multi-season performance comparison
- Game-by-game performance breakdown
- Advanced metrics with percentile rankings

**Player Development**
- Physical, tactical, mental, and technical ratings
- Development tracking over time
- Notes system for coaches and staff
- Practice and game summary tracking

## 🏗️ Architecture

### Technology Stack

- **Frontend**: Next.js 16, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Python 3.9+
- **Caching**: Redis / Vercel KV (30-day TTL for persistent data)
- **Data Sources**: College Football Data API (CFBD)
- **Deployment**: Vercel (serverless functions)
- **Analytics**: Vercel Analytics integration

### Data Flow

1. **Roster Data**: Python scripts fetch OU roster from CFBD API → Process and validate → Store in Redis with 30-day TTL
2. **Player Stats**: API routes check Redis cache first → Fallback to CFBD API if needed → Cache results for 30 days
3. **Headshots**: Web scraping from soonersports.com → Store in Redis → Validate and generate URLs
4. **Depth Chart**: Local JSON file with overrides → Applied to roster data on API response

### Caching Strategy

- **Roster Data**: 30-day TTL (relatively static, updated periodically)
- **Player Statistics**: 30-day TTL (seasonal data, infrequent updates)
- **Headshots**: 30-day TTL (static images, scraped once)
- **Game Stats**: 30-day TTL (historical data, doesn't change)
- **Advanced Stats**: 30-day TTL (calculated metrics, stable)

The caching layer significantly reduces API calls and improves response times while ensuring data freshness.

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.9+ (for CFBD Python library)
- **CFBD API Key** ([Get one here](https://collegefootballdata.com/))
- **Redis** (optional, for local development) or **Vercel KV** (for production)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd sanboxou

# Install Node.js dependencies
npm install

# Install Python dependencies for CFBD library
cd cfbd-python
pip3 install -r requirements.txt
cd ..

# Install Python dependencies for scripts
pip3 install -r requirements.txt

# Create .env.local file with your API keys
cat > .env.local << EOF
CFBD_API_KEY=your_cfbd_api_key_here
REDIS_URL=your_redis_url_here  # Optional for local dev
EOF

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Environment Variables

Create a `.env.local` file in the root directory:

```env
# Required
CFBD_API_KEY=your_cfbd_api_key_here

# Optional (for local development)
REDIS_URL=redis://localhost:6379

# For Vercel deployment, set these in Vercel dashboard:
# - REDIS_URL (or use Vercel KV)
# - CFBD_API_KEY
```

### Pre-populating Cache

To populate Redis with all player data (recommended before deployment):

```bash
# Fetch roster data (defaults to 2025 season)
python3 scripts/fetch_ou_roster.py "$CFBD_API_KEY"

# Fetch all player statistics (this may take a while)
python3 scripts/fetch_all_player_data.py "$CFBD_API_KEY"

# Scrape and cache headshots
curl -X POST http://localhost:3000/api/roster/scrape-headshots
```

## 📁 Project Structure

```
sanboxou/
├── app/                          # Next.js app directory
│   ├── api/                      # API routes
│   │   ├── cache/                # Cache management
│   │   ├── cfbd-advanced-stats/  # Advanced statistics endpoint
│   │   ├── cfbd-game-stats/      # Game-by-game stats
│   │   ├── cfbd-stats/           # Basic CFBD statistics
│   │   ├── player-development/   # Development tracking
│   │   ├── player-notes/         # Notes system
│   │   └── roster/               # Roster management
│   │       ├── roles/            # Role management
│   │       └── scrape-headshots/ # Headshot scraping
│   ├── player-development/       # Development pages
│   ├── player-profile/           # Individual player pages
│   └── team/                     # Team board page
├── components/                   # React components
│   ├── NavigationBar.tsx         # Main navigation
│   ├── PlayerCard.tsx            # Player card component
│   └── TeamBoard.tsx             # Team board component
├── lib/                          # Utility libraries
│   ├── cache.ts                  # Caching utilities
│   ├── cfbd-api.ts               # CFBD API client
│   ├── data.ts                   # Data fetching
│   ├── depth-chart.ts            # Depth chart logic
│   ├── ou-headshots.ts           # Headshot generation
│   ├── player-stats.ts           # Statistics utilities
│   ├── redis-cache.ts            # Redis/Vercel KV integration
│   ├── roster-cache.ts           # Roster caching
│   └── types.ts                  # TypeScript types
├── scripts/                      # Python scripts
│   ├── fetch_ou_roster.py       # Fetch and cache roster
│   └── fetch_all_player_data.py  # Fetch all player stats
├── data/                         # Local data storage
│   ├── cache/                    # Cached player stats
│   ├── depth-chart.json          # Depth chart overrides
│   ├── player-development/       # Development data
│   ├── player-notes/             # Player notes
│   └── roster-roles.json         # Saved role assignments
├── cfbd-python/                  # CFBD Python SDK
└── public/                       # Static assets
```

## 🔧 Development

### Available Scripts

```bash
# Development server (with hot reload)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint

# Type check
npm run type-check
```

### Python Scripts

```bash
# Fetch OU roster for a specific year (default: 2025)
python3 scripts/fetch_ou_roster.py "$CFBD_API_KEY" [year] [team]

# Fetch all player data (stats, game stats, advanced stats)
python3 scripts/fetch_all_player_data.py "$CFBD_API_KEY"
```

## 🚢 Deployment

### Vercel Deployment

1. **Connect Repository**: Link your GitHub repository to Vercel
2. **Set Environment Variables**:
   - `CFBD_API_KEY`: Your CFBD API key
   - `REDIS_URL`: Your Redis connection string (or use Vercel KV)
3. **Deploy**: Push to main branch or use `vercel --prod`

### Pre-Deployment Checklist

- [ ] Run `fetch_ou_roster.py` to populate roster cache
- [ ] Run `fetch_all_player_data.py` to populate player stats cache
- [ ] Scrape headshots via API endpoint
- [ ] Verify all environment variables are set in Vercel
- [ ] Test build locally: `npm run build`

## 📊 Position Groups

The dashboard uses granular position groups for better organization:

- **Offense**: QB, RB, WR, TE, T (Tackle), G (Guard), C (Center)
- **Defense**: ILB (Inside Linebacker), EDGE (Edge Rusher), IDL (Interior Defensive Line), CB (Cornerback), S (Safety)
- **Special Teams**: K (Kicker), P (Punter), LS (Long Snapper)

Positions are automatically mapped from CFBD's generic positions (DL, LB, OL) to these granular roles, with depth chart overrides taking precedence.

## 🔍 API Integration

### CFBD API

The dashboard integrates with the [College Football Data API](https://collegefootballdata.com/) using the official Python SDK:

- **Roster Data**: Complete OU roster with player information
- **Player Stats**: Season and career statistics
- **Game Stats**: Game-by-game performance data
- **Advanced Stats**: Position-specific advanced metrics

### Headshot Generation

Headshots are automatically generated and validated:

1. **Priority 1**: Scraped headshots from `soonersports.com` (stored in Redis)
2. **Priority 2**: Generated URLs based on player name patterns
3. **Priority 3**: Validated URLs checked for existence
4. **Fallback**: Default generated URL

Headshot URLs follow the OU athletics pattern:
```
https://images.sidearmdev.com/crop?url={encoded_url}&width=180&height=270&type=webp
```

## 🎨 UI/UX

- **Clean, Professional Design**: Minimalist interface focused on data
- **Responsive Layout**: Fully responsive for desktop, tablet, and mobile
- **Interactive Charts**: Recharts integration for all data visualization
- **Drag-and-Drop**: Intuitive player organization
- **Fast Load Times**: Optimized caching and lazy loading

## 📝 Recent Updates

### Version 2.1 - Caching & Performance
- ✅ Implemented Redis/Vercel KV caching with 30-day TTL
- ✅ Pre-population scripts for roster and player data
- ✅ Headshot scraping and caching system
- ✅ Depth chart override system
- ✅ Position mapping from generic to granular positions

### Version 2.0 - High Performance Enhancements
- ✅ Added High Speed Running, High Intensity Accelerations, and High Intensity Decelerations
- ✅ Implemented ACR alert system (highlights values > 1.2)
- ✅ Updated Catapult week pattern (5 practices + 1 game)
- ✅ Added longitudinal charts with metric dropdowns
- ✅ Expanded Force Plate to support 10+ metrics
- ✅ Enhanced Body Composition with multiple test tracking

## 🗺️ Roadmap

### Completed ✅
- [x] CFBD API integration for roster and statistics
- [x] Redis caching layer with persistent storage
- [x] Player profile pages with comprehensive stats
- [x] High Performance monitoring (Catapult, Force Plate, Body Composition)
- [x] Drag-and-drop team management
- [x] Depth chart integration
- [x] Headshot scraping and validation
- [x] Multi-season statistics tracking
- [x] Game-by-game statistics with filtering
- [x] Player development tracking
- [x] Notes system

### Planned 🚧
- [ ] Advanced filtering and search functionality
- [ ] Export/reporting features (PDF, CSV)
- [ ] Real-time data integration with Catapult and Force Plate systems
- [ ] Predictive analytics and injury risk modeling
- [ ] Mobile app companion
- [ ] Multi-team support
- [ ] Custom dashboard builder

## 📄 License

This project is for demonstration and educational purposes.

## 🤝 Contributing

This is a private project for the University of Oklahoma football program. For questions or suggestions, please contact the development team.

---

**Built with ❤️ for OU Football**
