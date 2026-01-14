# OU Football Dashboard

A comprehensive monitoring dashboard for the University of Oklahoma football team, built with Next.js, TypeScript, and Tailwind CSS.

## Features

### Team Management
- **Position-Based Team Board**: Organize players by position groups (Offense, Defense, Special Teams)
- **Role Management**: Assign players to Starter, Back-Up, Practice Player, or Rehab roles
- **Drag-and-Drop Interface**: Easily reorganize players within position groups
- **Depth Chart Integration**: Automatic role assignment based on official depth chart data

### Player Analytics
- **Multi-Season Statistics**: View player stats across multiple seasons (2020-2026)
- **Game-to-Game Stats**: Detailed game-by-game performance with year filtering
- **Advanced Metrics**: Position-specific advanced statistics with percentile rankings
- **CFBD API Integration**: Real-time on-field statistics from College Football Data API

### High Performance Monitoring

#### Catapult GPS Data
- **Comprehensive Metrics**: Player Load, ACR (Acute:Chronic Ratio), Max Velocity, Total Distance
- **High Intensity Metrics**: High Speed Running, High Intensity Accelerations, High Intensity Decelerations
- **Week Pattern Display**: Shows realistic week pattern (5 practices + 1 game per week)
- **ACR Alert System**: Conditional formatting highlights ACR values over 1.2
- **Longitudinal Charts**: Interactive charts with metric dropdown for trend analysis

#### Force Plate Testing
- **Multiple Metrics**: Track 10+ force plate metrics including:
  - Peak Force, Mean Force, Rate of Force Development
  - Jump Height, Power Output, Eccentric/Concentric Rates
  - Time to Peak Force, Impulse, Stiffness
- **Metric Selector**: Dropdown to view different metrics in table and chart
- **Trend Analysis**: Visual trend lines for each metric over time
- **Statistical Analysis**: Coefficient of Variation (CoV) and percent change tracking

#### Body Composition
- **Multiple Test Tracking**: Longitudinal view of body composition tests over time
- **Key Metrics**: Weight, Body Fat %, Muscle Mass, BMI
- **Test History Table**: Complete history of all body composition tests
- **Longitudinal Charts**: Multi-metric charts showing trends across all measurements

### Player Profiles
- **Comprehensive Dashboards**: Individual player pages with all stats and metrics
- **OU Headshots**: Automatic headshot URL generation from OU athletics website
- **Player Development**: Physical, tactical, mental, and technical ratings
- **Notes System**: Track player notes and development over time

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Python 3.9+ (for CFBD Python library)
- CFBD API key

### Installation

```bash
# Install Node.js dependencies
npm install

# Install Python dependencies for CFBD library
cd cfbd-python
pip3 install -r requirements.txt
cd ..

# Create .env.local file with your CFBD API key
echo "CFBD_API_KEY=your_api_key_here" > .env.local

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Environment Variables

Create a `.env.local` file in the root directory with your CFBD API key:

```
CFBD_API_KEY=your_api_key_here
```

The API key is used by the Python script to fetch roster data from the CFBD API.

## Project Structure

```
ou-football-dashboard/
├── app/
│   ├── api/
│   │   ├── cfbd-stats/     # CFBD API integration
│   │   └── roster/         # Roster data endpoint (uses Python script)
│   ├── team/               # Team board page
│   └── page.tsx            # Home (redirects to /team)
├── app/
│   ├── api/                # API routes
│   │   ├── cfbd-stats/     # CFBD statistics endpoints
│   │   ├── cfbd-game-stats/ # Game-by-game stats
│   │   ├── cfbd-advanced-stats/ # Advanced metrics
│   │   ├── roster/        # Roster management
│   │   └── player-notes/   # Player notes system
│   ├── player-profile/     # Individual player profile pages
│   ├── player-development/ # Player development tracking
│   └── team/               # Team board page
├── components/
│   ├── NavigationBar.tsx    # Main navigation
│   ├── PlayerCard.tsx      # Individual player card
│   └── TeamBoard.tsx       # Position-based team board
├── lib/
│   ├── types.ts            # TypeScript types and interfaces
│   ├── cfbd-api.ts         # CFBD API client
│   ├── ou-headshots.ts     # Headshot URL generator
│   ├── status-determiner.ts # Status logic
│   ├── data.ts             # Data fetching utilities
│   ├── mock-data.ts        # Mock data generators
│   └── player-stats.ts     # Player statistics utilities
├── scripts/
│   ├── fetch_ou_roster.py  # Python script to fetch OU roster from CFBD
│   └── explore_cfbd_stats.py # CFBD stats exploration
├── data/                   # Local data storage
│   ├── cache/              # Cached player stats
│   ├── game-stats/         # Game statistics
│   ├── player-development/ # Development data
│   └── player-notes/       # Player notes
├── cfbd-python/            # CFBD Python SDK
└── .env.local              # Environment variables (not committed)
```

## Position Groups

- **Offense**: QB, RB, WR, TE, OL
- **Defense**: DL, LB, CB, S
- **Special Teams**: K, P, LS

## UI/UX Improvements

- **Clean Design**: Removed emojis and excessive conditional formatting for professional appearance
- **Status Display**: Status information removed from player cards and profiles for cleaner interface
- **Interactive Charts**: Recharts integration for all longitudinal data visualization
- **Responsive Design**: Fully responsive layout for desktop and mobile devices

## CFBD API Integration

The dashboard integrates with the College Football Data API using the official Python SDK to fetch:
- **Roster Data**: Complete OU roster with player information (name, position, jersey number, class year, etc.)
- **Player Stats**: Passing yards, rushing yards, receiving yards, touchdowns
- **Defensive Stats**: Tackles, sacks, interceptions

The roster data is fetched via a Python script (`scripts/fetch_ou_roster.py`) that uses the CFBD Python library. The Next.js API route calls this script to get real-time roster information.

## OU Headshots

Headshots are automatically generated using the OU athletics website pattern:
```
https://images.sidearmdev.com/crop?url={encoded_url}&width=180&height=270&type=webp
```

## Development

```bash
# Development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint
npm run lint
```

## Recent Updates

### Version 2.0 - High Performance Enhancements
- ✅ Added High Speed Running, High Intensity Accelerations, and High Intensity Decelerations to Catapult data
- ✅ Implemented ACR conditional formatting (highlights values > 1.2)
- ✅ Updated Catapult type to show realistic week pattern (5 practices + game, removed training)
- ✅ Added longitudinal charts with metric dropdowns for Catapult, Force Plate, and Body Composition
- ✅ Expanded Force Plate to support 10+ metrics with dropdown selector
- ✅ Enhanced Body Composition with multiple test tracking and longitudinal charts
- ✅ Removed emojis and conditional formatting from player cards
- ✅ Removed status display from player profiles
- ✅ Improved game stats to fetch data across all available years (2020-2026)

### Completed Features
- [x] Integrate actual roster data from CFBD API
- [x] Add player profile pages with detailed stats
- [x] Integrate GPS/Catapult performance metrics
- [x] Add notes system for player tracking
- [x] Multi-season statistics tracking
- [x] Game-by-game statistics with year filtering
- [x] High Performance monitoring (Catapult, Force Plate, Body Composition)
- [x] Longitudinal data visualization with charts

### Future Enhancements
- [ ] Implement filtering and search functionality
- [ ] Add export/reporting features
- [ ] Real-time data integration with Catapult and Force Plate systems
- [ ] Advanced analytics and predictive modeling

## License

This project is for demonstration purposes.
