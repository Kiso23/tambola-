# Load Balancing Setup for 100+ Users

## Overview

The optimized setup uses:
- **PostgreSQL** - Production-grade database (replaces SQLite)
- **Redis** - Caching layer for fast data retrieval
- **Node.js Clustering** - Multi-process load balancing (uses all CPU cores)

This setup can handle 100-1000+ concurrent users.

## Installation Steps

### 1. Install PostgreSQL

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib redis-server
```

**macOS:**
```bash
brew install postgresql redis
```

**Windows:**
- Download PostgreSQL: https://www.postgresql.org/download/windows/
- Download Redis: https://github.com/microsoftarchive/redis/releases

### 2. Start Services

**Linux:**
```bash
sudo service postgresql start
sudo service redis-server start
```

**macOS:**
```bash
brew services start postgresql
brew services start redis
```

### 3. Create Database

```bash
# Run setup script
bash setup-postgres.sh

# Or manually:
createdb tambola_game
```

### 4. Migrate Existing Data (if any)

```bash
node migrate-to-postgres.js
```

### 5. Install Node Dependencies

```bash
npm install
# Already installed: pg redis cluster
```

### 6. Switch to Optimized Server

Replace old server with optimized version:

```bash
# Backup original
mv server.js server-sqlite.js

# Use optimized version
mv server-optimized.js server.js

# Start with clustering
npm start
```

## What's Changed

### Database (SQLite → PostgreSQL)

**Before (Single server):**
```javascript
import sqlite3 from 'sqlite3';
const db = new sqlite3.Database('tickets.db');
```

**After (Production-grade):**
```javascript
import pg from 'pg';
const pool = new Pool({
    user: 'postgres',
    password: 'postgres',
    host: 'localhost',
    database: 'tambola_game'
});
```

### Caching (New - Redis)

```javascript
import redis from 'redis';
const redisClient = redis.createClient();

// Cache pending payments for 5 seconds
await redisClient.setEx('pending_payments', 5, JSON.stringify(data));
```

### Clustering (New - Multi-process)

```javascript
import cluster from 'cluster';

if (cluster.isPrimary) {
    // Main process spawns workers
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }
} else {
    // Worker processes handle requests
    // Auto-restart on crash
}
```

## Performance Improvements

### Before (Single Server + SQLite):
- Max capacity: ~50-100 users (with slowdowns)
- Database locks on concurrent writes
- Single point of failure
- CPU usage: 1 core

### After (PostgreSQL + Redis + Clustering):
- Capacity: 100-1000+ users
- Concurrent writes handled smoothly
- Auto-restart on crash
- CPU usage: All cores utilized

## Monitoring

### Check Database
```bash
psql -U postgres -d tambola_game -c "SELECT COUNT(*) FROM tickets;"
```

### Check Redis
```bash
redis-cli ping  # Should return PONG
redis-cli info  # Show stats
```

### Check Running Servers
```bash
# See all Node processes
ps aux | grep node

# See port listeners
lsof -i :3000
```

## Configuration

### Database Connection
Edit server.js, line ~25:
```javascript
const pool = new Pool({
    user: 'postgres',
    password: 'postgres',  // Change if needed
    host: 'localhost',
    port: 5432,
    database: 'tambola_game'
});
```

### Redis Connection
Edit server.js, line ~40:
```javascript
const redisClient = redis.createClient({
    host: 'localhost',
    port: 6379
});
```

### Number of Worker Processes
Edit server.js, line ~11:
```javascript
const numCPUs = os.cpus().length;  // Auto-uses all cores
// Or manually set:
const numCPUs = 4;  // For 4-core machine
```

## Troubleshooting

### PostgreSQL Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
Solution: Start PostgreSQL service
```bash
sudo service postgresql start
```

### Redis Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```
Solution: Start Redis service
```bash
sudo service redis-server start
```

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::3000
```
Solution: Kill existing process
```bash
pkill -f "node server.js"
# Then restart
npm start
```

### High Memory Usage
If memory usage is high:
1. Reduce worker count: Change `numCPUs`
2. Reduce connection pool: Change `max: 20` in pool config
3. Monitor with: `top` or `htop`

## Rollback to SQLite

If needed, revert to single-server mode:

```bash
# Stop current server
pkill -f "node server.js"

# Restore original
mv server.js server-optimized.js
mv server-sqlite.js server.js

# Start
npm start
```

## Performance Testing

### Load Test 100 Users

```bash
# Using Apache Bench
ab -n 1000 -c 100 http://localhost:3000/api/pending-payments

# Using autocannon
npx autocannon -c 100 -d 30 http://localhost:3000/api/pending-payments
```

### Expected Results:
- Requests/sec: 500+
- Avg latency: 50-100ms
- P95: 200ms
- P99: 500ms

## Production Deployment

For production with 100+ users:

1. Use remote PostgreSQL database
   - Cloud: AWS RDS, Azure Database, DigitalOcean
   - Cost: $15-50/month

2. Use managed Redis
   - Cloud: AWS ElastiCache, Azure Cache
   - Cost: $10-30/month

3. Deploy across multiple servers
   - Use Nginx load balancer
   - Each server runs Node.js cluster

4. Set up monitoring
   - New Relic, DataDog, or Prometheus
   - Monitor CPU, memory, response times

## Support

For issues or questions:
1. Check troubleshooting section
2. Review PostgreSQL docs: https://www.postgresql.org/docs/
3. Review Redis docs: https://redis.io/documentation
4. Check Node.js cluster docs: https://nodejs.org/api/cluster.html
