import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import cluster from 'cluster';
import os from 'os';
import pg from 'pg';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const numCPUs = os.cpus().length;

// Log environment variables on startup
console.log('\n📋 ENVIRONMENT VARIABLES:');
console.log(`   DB_HOST: ${process.env.DB_HOST || 'NOT SET'}`);
console.log(`   DB_NAME: ${process.env.DB_NAME || 'NOT SET'}`);
console.log(`   DB_USER: ${process.env.DB_USER || 'NOT SET'}`);
console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'NOT SET'}`);
console.log(`   PORT: ${process.env.PORT || 'NOT SET'}\n`);

// Validate required environment variables
const requiredVars = ['BREVO_API_KEY'];
for (const varName of requiredVars) {
    if (!process.env[varName]) {
        console.warn(`⚠️  Warning: ${varName} not set in environment variables. Using default fallback.`);
    }
}

// ═════════════════════════════════════════════════════════════════════
// BREVO EMAIL SERVICE
// ═════════════════════════════════════════════════════════════════════
const BREVO_API_KEY = process.env.BREVO_API_KEY || 'xkeysib-CHANGE_ME';

async function sendEmailViaBrevo(to, subject, htmlContent) {
    try {
        const apiKey = process.env.BREVO_API_KEY;
        
        if (!apiKey) {
            console.error('❌ BREVO_API_KEY is not set');
            return false;
        }

        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'api-key': apiKey
            },
            body: JSON.stringify({
                to: [{ email: to }],
                sender: { 
                    email: 'sarlongkiteron484@gmail.com',
                    name: 'Winter Bumper'
                },
                subject: subject,
                htmlContent: htmlContent
            })
        });

        const data = await response.json();
        
        if (response.ok) {
            console.log(`✅ Email sent to ${to}`);
            return true;
        } else {
            console.error(`❌ Email failed: ${data.message}`);
            return false;
        }
    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        return false;
    }
}

// ═════════════════════════════════════════════════════════════════════
// DATABASE POOL (PostgreSQL)
// ═════════════════════════════════════════════════════════════════════
// DATABASE POOL (PostgreSQL)
// ═════════════════════════════════════════════════════════════════════
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'tambola_game',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
    console.error('❌ Database Error:', err);
});

// Initialize PostgreSQL tables
async function initializeDatabase() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS tickets (
                id SERIAL PRIMARY KEY,
                playerName VARCHAR(255) NOT NULL DEFAULT '#PlayerName',
                playerEmail VARCHAR(255),
                ticket TEXT NOT NULL,
                paymentScreenshot TEXT,
                paymentStatus VARCHAR(50) DEFAULT 'available',
                verifiedBy VARCHAR(255),
                serialNumber INTEGER UNIQUE,
                purchasedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                verifiedAt TIMESTAMP,
                used BOOLEAN DEFAULT false
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS payment_verifications (
                id SERIAL PRIMARY KEY,
                ticketId INTEGER NOT NULL REFERENCES tickets(id),
                playerName VARCHAR(255) NOT NULL,
                playerEmail VARCHAR(255),
                paymentScreenshot TEXT,
                status VARCHAR(50) DEFAULT 'pending',
                submittedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                verifiedAt TIMESTAMP,
                verifiedBy VARCHAR(255),
                notes TEXT
            )
        `);

        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_payment_status ON payment_verifications(status)
        `);

        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_ticket_email ON tickets(playerEmail)
        `);

        // Check if tickets already exist
        const ticketCount = await pool.query('SELECT COUNT(*) as count FROM tickets WHERE paymentStatus = $1', ['available']);
        
        if (ticketCount.rows[0].count === 0) {
            console.log('📝 Generating 80 Tambola tickets...');
            
            // Generate 80 random tickets
            for (let i = 1; i <= 80; i++) {
                const ticket = {
                    numbers: [],
                    structure: []
                };

                // 3x9 grid with 15 numbers, proper column ranges
                for (let col = 0; col < 9; col++) {
                    const columnNumbers = [];
                    const minNum = col * 10 + 1;
                    const maxNum = (col + 1) * 10;

                    // Generate 2 random numbers for this column
                    for (let j = 0; j < 2; j++) {
                        let num = Math.floor(Math.random() * (maxNum - minNum + 1)) + minNum;
                        while (columnNumbers.includes(num)) {
                            num = Math.floor(Math.random() * (maxNum - minNum + 1)) + minNum;
                        }
                        columnNumbers.push(num);
                    }

                    ticket.numbers.push(...columnNumbers);
                }

                ticket.numbers.sort((a, b) => a - b);

                await pool.query(
                    'INSERT INTO tickets (serialNumber, playerName, ticket, paymentStatus) VALUES ($1, $2, $3, $4) ON CONFLICT (serialNumber) DO NOTHING',
                    [i, '#PlayerName', JSON.stringify(ticket), 'available']
                );
            }
            
            console.log('✅ Generated 80 available tickets');
        } else {
            console.log(`✅ PostgreSQL tables initialized (${ticketCount.rows[0].count} tickets available)`);
        }
    } catch (err) {
        console.error('Error initializing database:', err);
        throw err;
    }
}

// ═════════════════════════════════════════════════════════════════════
// DISABLE CLUSTERING FOR RENDER (Single CPU environment)
// ═════════════════════════════════════════════════════════════════════

// Skip clustering in production (Render has only 1 CPU)
if (false && cluster.isPrimary && numCPUs > 1) {
    console.log('\n' + '═'.repeat(70));
    console.log('❄️  WINTER BUMPER - Premium Lottery Platform (LOAD BALANCED)');
    console.log('═'.repeat(70));
    console.log(`🔄 Primary ${process.pid} spawning ${numCPUs} worker processes...`);
    console.log('═'.repeat(70) + '\n');

    // Fork workers
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    // Handle worker exit
    cluster.on('exit', (worker, code, signal) => {
        console.log(`⚠️  Worker ${worker.process.pid} died (${signal || code}). Restarting...`);
        cluster.fork();
    });

} else {
    // ═════════════════════════════════════════════════════════════════════
    // WORKER PROCESS
    // ═════════════════════════════════════════════════════════════════════
    const app = express();
    const server = createServer(app);
    const wss = new WebSocketServer({ server, maxPayload: 100 * 1024 * 1024 });

    // CORS Configuration for Production
    const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:3001',
        'https://tambola-game.vercel.app',
        'https://www.tambola-game.vercel.app',
        process.env.FRONTEND_URL
    ].filter(Boolean);

    app.use((req, res, next) => {
        const origin = req.headers.origin;
        if (allowedOrigins.includes(origin)) {
            res.setHeader('Access-Control-Allow-Origin', origin);
        }
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        
        if (req.method === 'OPTIONS') {
            res.sendStatus(200);
        } else {
            next();
        }
    });

    app.use(express.static(__dirname));
    app.use(express.json({ limit: '50mb' }));

    const games = new Map();
    const gameConnections = new Map();

    // Game class (same as before)
    class WinterBumperGame {
        constructor(gameId) {
            this.gameId = gameId;
            this.players = new Map();
            this.calledNumbers = [];
            this.winners = [];
            this.adminId = null;
            this.marksPerPlayer = new Map();
        }

        addPlayer(playerId, playerName, ticket) {
            if (this.players.size >= 80) {
                return { success: false, message: 'Game is full (max 80 players)' };
            }
            this.players.set(playerId, {
                id: playerId,
                name: playerName,
                ticket: ticket,
                marks: new Set()
            });
            this.marksPerPlayer.set(playerId, new Set());
            return { success: true };
        }

        callNumber(num) {
            if (this.calledNumbers.includes(num)) return false;
            this.calledNumbers.push(num);
            for (const [playerId, player] of this.players.entries()) {
                if (player.ticket.includes(num)) {
                    player.marks.add(num);
                    this.marksPerPlayer.get(playerId).add(num);
                }
            }
            return true;
        }

        checkWin(playerId, winType) {
            const player = this.players.get(playerId);
            if (!player) return false;
            const ticket = player.ticket;
            const marks = player.marks;

            if (winType === 'first_line') {
                for (let row = 0; row < 3; row++) {
                    let rowComplete = true;
                    for (let col = 0; col < 9; col++) {
                        const num = ticket[row][col];
                        if (num !== 0 && !marks.has(num)) {
                            rowComplete = false;
                            break;
                        }
                    }
                    if (rowComplete) return true;
                }
            } else if (winType === 'second_line') {
                let completeRows = 0;
                for (let row = 0; row < 3; row++) {
                    let rowComplete = true;
                    for (let col = 0; col < 9; col++) {
                        const num = ticket[row][col];
                        if (num !== 0 && !marks.has(num)) {
                            rowComplete = false;
                            break;
                        }
                    }
                    if (rowComplete) completeRows++;
                }
                return completeRows >= 2;
            } else if (winType === 'full_house') {
                for (let row = 0; row < 3; row++) {
                    for (let col = 0; col < 9; col++) {
                        const num = ticket[row][col];
                        if (num !== 0 && !marks.has(num)) {
                            return false;
                        }
                    }
                }
                return true;
            }
            return false;
        }

        getPlayersList() {
            return Array.from(this.players.values()).map(p => ({
                id: p.id,
                name: p.name
            }));
        }
    }

    // WebSocket handling
    wss.on('connection', (ws) => {
        let currentGame = null;
        let playerId = null;
        let role = null;

        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());

                if (message.type === 'create_game') {
                    const gameId = message.gameId;
                    if (!games.has(gameId)) {
                        const game = new WinterBumperGame(gameId);
                        game.adminId = message.playerId;
                        games.set(gameId, game);
                        gameConnections.set(gameId, new Set());
                    }
                    currentGame = games.get(gameId);
                    playerId = message.playerId;
                    role = 'admin';
                    gameConnections.get(gameId).add(ws);
                    ws.send(JSON.stringify({ type: 'game_created', gameId: gameId }));
                }
                else if (message.type === 'join_game') {
                    const gameId = message.gameId;
                    if (!games.has(gameId)) {
                        ws.send(JSON.stringify({ type: 'error', message: 'Game not found' }));
                        return;
                    }
                    currentGame = games.get(gameId);
                    playerId = message.playerId;
                    role = 'player';
                    const result = currentGame.addPlayer(message.playerId, message.playerName, message.ticket);
                    if (!result.success) {
                        ws.send(JSON.stringify({ type: 'error', message: result.message }));
                        return;
                    }
                    gameConnections.get(gameId).add(ws);
                    ws.send(JSON.stringify({ type: 'game_joined', gameId: gameId }));
                    broadcastToGame(gameId, { type: 'player_joined', playerId: message.playerId, playerName: message.playerName });
                    broadcastToGame(gameId, { type: 'player_count', players: currentGame.getPlayersList() });
                }
                else if (message.type === 'announce_number' && role === 'admin') {
                    const num = message.number;
                    if (!currentGame.callNumber(num)) {
                        ws.send(JSON.stringify({ type: 'error', message: 'Number already called' }));
                        return;
                    }
                    broadcastToGame(message.gameId, { type: 'number_announced', number: num, calledNumbers: currentGame.calledNumbers });
                }
                else if (message.type === 'claim_win') {
                    const isWin = currentGame.checkWin(message.playerId, message.winType);
                    if (isWin) {
                        const player = currentGame.players.get(message.playerId);
                        const alreadyWon = currentGame.winners.some(w => w.playerId === message.playerId && w.winType === message.winType);
                        if (alreadyWon) {
                            ws.send(JSON.stringify({ type: 'win_rejected', message: 'You already won this prize' }));
                            return;
                        }
                        currentGame.winners.push({
                            playerId: message.playerId,
                            playerName: player.name,
                            winType: message.winType,
                            timestamp: Date.now()
                        });
                        const winnersOfType = currentGame.winners.filter(w => w.winType === message.winType);
                        const tieDetected = winnersOfType.length > 1;
                        broadcastToGame(message.gameId, {
                            type: 'winner_announced',
                            playerId: message.playerId,
                            playerName: player.name,
                            winType: message.winType,
                            tieDetected: tieDetected,
                            tieCount: winnersOfType.length,
                            tieWinners: winnersOfType.map(w => w.playerName)
                        });
                        ws.send(JSON.stringify({
                            type: 'win_verified',
                            message: tieDetected ? `Tie! Prize split equally among ${winnersOfType.length} winners` : 'Congratulations!'
                        }));
                    } else {
                        ws.send(JSON.stringify({ type: 'win_rejected', message: 'Invalid win claim' }));
                    }
                }
            } catch (error) {
                console.error('WebSocket error:', error);
            }
        });

        ws.on('close', () => {
            if (currentGame && gameConnections.has(currentGame.gameId)) {
                gameConnections.get(currentGame.gameId).delete(ws);
            }
        });
    });

    function broadcastToGame(gameId, message) {
        const clients = gameConnections.get(gameId);
        if (clients) {
            clients.forEach(client => {
                if (client.readyState === 1) {
                    client.send(JSON.stringify(message));
                }
            });
        }
    }

    // REST API Routes
    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, 'index.html'));
    });

    app.post('/api/purchase-ticket', async (req, res) => {
        const { playerName, ticket } = req.body;
        if (!playerName || !ticket) {
            return res.status(400).json({ error: 'Missing fields' });
        }
        try {
            const result = await pool.query(
                'INSERT INTO tickets (playerName, ticket) VALUES ($1, $2) RETURNING id',
                [playerName, JSON.stringify(ticket)]
            );
            res.json({ success: true, message: `Ticket purchased for ${playerName}`, ticketId: result.rows[0].id });
        } catch (err) {
            console.error('DB error:', err);
            res.status(500).json({ error: 'Database error' });
        }
    });

    app.get('/api/player-tickets/:playerName', async (req, res) => {
        const { playerName } = req.params;
        try {
            const result = await pool.query(
                'SELECT id, ticket, purchasedAt FROM tickets WHERE playerName = $1 AND used = false ORDER BY purchasedAt DESC',
                [playerName]
            );
            const tickets = result.rows.map(row => ({
                id: row.id,
                ticket: JSON.parse(row.ticket),
                purchasedAt: row.purchasedAt
            }));
            res.json({ playerName, tickets });
        } catch (err) {
            console.error('DB error:', err);
            res.status(500).json({ error: 'Database error' });
        }
    });

    app.post('/api/use-ticket', async (req, res) => {
        const { playerName, ticketId } = req.body;
        if (!playerName || !ticketId) {
            return res.status(400).json({ error: 'Missing fields' });
        }
        try {
            const result = await pool.query(
                'SELECT id, ticket FROM tickets WHERE playerName = $1 AND id = $2',
                [playerName, ticketId]
            );
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Ticket not found' });
            }
            res.json({ success: true, ticket: JSON.parse(result.rows[0].ticket) });
        } catch (err) {
            console.error('DB error:', err);
            res.status(500).json({ error: 'Database error' });
        }
    });

    // Book a pre-generated ticket by assigning player name to it
    app.post('/api/book-ticket', async (req, res) => {
        const { ticketId, playerName, playerEmail } = req.body;
        if (!ticketId || !playerName || !playerEmail) {
            return res.status(400).json({ error: 'Missing fields' });
        }
        
        try {
            // Check if ticket is already booked
            const checkResult = await pool.query(
                'SELECT id, paymentStatus, playerName FROM tickets WHERE id = $1',
                [ticketId]
            );
            
            if (checkResult.rows.length === 0) {
                return res.status(404).json({ error: 'Ticket not found' });
            }
            
            const ticket = checkResult.rows[0];
            const currentPaymentStatus = ticket.paymentstatus || ticket.paymentStatus;
            const currentPlayerName = ticket.playername || ticket.playerName;
            
            // Check if ticket is already booked by someone else
            if (currentPaymentStatus === 'approved' && currentPlayerName.indexOf('Ticket-') === -1) {
                return res.status(409).json({ error: 'This ticket is already booked by another player' });
            }
            
            // Book the ticket
            const result = await pool.query(
                'UPDATE tickets SET playerName = $1, playerEmail = $2, paymentStatus = $3 WHERE id = $4 RETURNING id, serialNumber, ticket',
                [playerName, playerEmail, 'pending', ticketId]
            );
            
            res.json({
                success: true,
                id: result.rows[0].id,
                message: `Ticket #${result.rows[0].serialnumber || result.rows[0].serialNumber} booked successfully`,
                ticket: JSON.parse(result.rows[0].ticket),
                serialNumber: result.rows[0].serialnumber || result.rows[0].serialNumber
            });
        } catch (err) {
            console.error('DB error:', err);
            res.status(500).json({ error: 'Failed to book ticket' });
        }
    });

    app.get('/api/games/:gameId', (req, res) => {
        const game = games.get(req.params.gameId);
        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }
        res.json({
            gameId: game.gameId,
            playersCount: game.players.size,
            calledNumbers: game.calledNumbers,
            winners: game.winners
        });
    });

    app.get('/api/all-tickets', async (req, res) => {
        try {
            const result = await pool.query('SELECT id, playerName, ticket, purchasedAt, used FROM tickets ORDER BY purchasedAt DESC');
            const tickets = result.rows.map(row => ({
                id: row.id,
                playerName: row.playerName,
                ticket: JSON.parse(row.ticket),
                purchasedAt: row.purchasedAt,
                used: row.used
            }));
            res.json({ tickets });
        } catch (err) {
            console.error('DB error:', err);
            res.status(500).json({ error: 'Database error' });
        }
    });

    // Get available tickets for selection (80 pre-generated tickets)
    app.get('/api/available-tickets', async (req, res) => {
        try {
            const result = await pool.query(
                'SELECT id, serialNumber, playerName, ticket, paymentStatus FROM tickets WHERE paymentStatus IN ($1, $2) ORDER BY serialNumber ASC',
                ['available', 'approved']
            );
            const tickets = result.rows.map(row => ({
                id: row.id,
                serialNumber: row.serialnumber || row.serialNumber,
                playerName: row.playername || row.playerName,
                ticket: JSON.parse(row.ticket),
                isBooked: (row.paymentstatus || row.paymentStatus) === 'approved'
            }));
            res.json({ tickets, totalAvailable: tickets.length });
        } catch (err) {
            console.error('DB error:', err);
            res.status(500).json({ error: 'Database error' });
        }
    });

    app.post('/api/submit-payment', async (req, res) => {
        const { playerName, playerEmail, ticketId, screenshotBase64 } = req.body;
        if (!playerName || !playerEmail || !ticketId || !screenshotBase64) {
            return res.status(400).json({ error: 'Missing fields' });
        }
        try {
            const result = await pool.query(
                'INSERT INTO payment_verifications (ticketId, playerName, playerEmail, paymentScreenshot, status) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                [ticketId, playerName, playerEmail, screenshotBase64.substring(0, 1000), 'pending']
            );
            res.json({
                success: true,
                message: 'Payment screenshot submitted for verification. Admin will verify and send email confirmation.',
                verificationId: result.rows[0].id
            });
        } catch (err) {
            console.error('DB error:', err);
            res.status(500).json({ error: 'Failed to submit payment' });
        }
    });

    app.get('/api/pending-payments', async (req, res) => {
        try {
            // Try to get from Redis cache first
            const cached = await redisClient.get('pending_payments');
            if (cached) {
                return res.json({ pendingPayments: JSON.parse(cached) });
            }

            // Query database
            const result = await pool.query(
                'SELECT * FROM payment_verifications WHERE status = $1 ORDER BY submittedAt DESC',
                ['pending']
            );

            // Cache for 5 seconds
            await redisClient.setEx('pending_payments', 5, JSON.stringify(result.rows));

            res.json({ pendingPayments: result.rows });
        } catch (err) {
            console.error('DB error:', err);
            res.status(500).json({ error: 'Database error' });
        }
    });

    app.get('/api/get-ticket-data/:ticketId', async (req, res) => {
        const { ticketId } = req.params;
        try {
            const result = await pool.query(
                'SELECT id, ticket FROM tickets WHERE id = $1',
                [ticketId]
            );
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Ticket not found' });
            }
            res.json({ success: true, ticket: JSON.parse(result.rows[0].ticket) });
        } catch (err) {
            console.error('DB error:', err);
            res.status(500).json({ error: 'Database error' });
        }
    });

    // Generate and send ticket email
    async function generateAndSendTicketEmail(playerEmail, playerName, ticket, serialNumber, ticketId) {
        if (!ticket || !Array.isArray(ticket)) {
            console.log(`❌ Invalid ticket format for ${playerEmail}`);
            return;
        }

        let ticketHtml = '<table style="border-collapse: collapse; margin: 20px auto; background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-radius: 8px; overflow: hidden;">';
        
        for (let row = 0; row < 3; row++) {
            ticketHtml += '<tr>';
            for (let col = 0; col < 9; col++) {
                const num = ticket[row]?.[col] || 0;
                const isNumber = num !== 0;
                const cellStyle = isNumber 
                    ? 'background-color: #e3f2fd; color: #1976d2; font-weight: bold;'
                    : 'background-color: #f5f5f5; color: #ccc;';
                
                ticketHtml += `<td style="border: 1px solid #ddd; padding: 15px 12px; text-align: center; width: 50px; font-size: 16px; ${cellStyle}">
                    ${isNumber ? num : '-'}
                </td>`;
            }
            ticketHtml += '</tr>';
        }
        
        ticketHtml += '</table>';

        const subject = `🎟️ Your Ticket #${serialNumber} - Winter Bumper Lottery`;

        const htmlMessage = `
            <html>
                <body style="font-family: 'Arial', sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; margin: 0;">
                    <div style="background-color: white; padding: 40px; border-radius: 12px; max-width: 700px; margin: 0 auto; box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
                        <div style="text-align: center; border-bottom: 3px solid #667eea; padding-bottom: 20px; margin-bottom: 30px;">
                            <h1 style="color: #667eea; margin: 0 0 10px 0; font-size: 28px;">❄️ Winter Bumper Lottery</h1>
                            <p style="color: #999; margin: 0; font-size: 14px;">Premium Gaming Platform</p>
                        </div>
                        <div style="text-align: center; margin-bottom: 30px;">
                            <div style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; border-radius: 50px; font-weight: bold; font-size: 18px;">
                                🎟️ TICKET #${serialNumber}
                            </div>
                        </div>
                        <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #667eea;">
                            <p style="margin: 8px 0; font-size: 14px;"><strong>Player Name:</strong> ${playerName}</p>
                            <p style="margin: 8px 0; font-size: 14px;"><strong>Email:</strong> ${playerEmail}</p>
                            <p style="margin: 8px 0; font-size: 14px;"><strong>Status:</strong> <span style="color: #27AE60; font-weight: bold;">✅ ACTIVE</span></p>
                        </div>
                        <div style="text-align: center; margin: 30px 0;">
                            <h2 style="color: #333; margin: 0 0 20px 0; font-size: 18px;">Your Ticket Numbers</h2>
                            ${ticketHtml}
                        </div>
                        <div style="background: #fffbea; padding: 15px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #FFC107;">
                            <h3 style="color: #ff9800; margin: 0 0 10px 0; font-size: 14px;">📋 Important Information</h3>
                            <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #555;">
                                <li>Your ticket is now active for the game</li>
                                <li>Keep this email safe for reference</li>
                                <li>Ticket Serial Number: <strong>#${serialNumber}</strong></li>
                                <li>Present your ticket number when claiming prizes</li>
                            </ul>
                        </div>
                        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                            <p style="color: #999; font-size: 12px; margin: 0;">
                                This is an automated message. Please do not reply to this email.
                            </p>
                        </div>
                    </div>
                </body>
            </html>
        `;

        sendEmailViaBrevo(playerEmail, subject, htmlMessage);
        console.log(`📧 Ticket email sent to ${playerEmail} (Ticket #${serialNumber})`);
    }

    // Send confirmation email
    function sendConfirmationEmail(email, approved, notes) {
        const subject = approved ? '✅ Payment Approved - Winter Bumper' : '❌ Payment Rejected - Winter Bumper';
        
        const htmlMessage = approved 
            ? `<html><body style="font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px;"><div style="background-color: white; padding: 30px; border-radius: 10px; max-width: 600px; margin: 0 auto;"><h2 style="color: #27AE60; text-align: center;">✅ Payment Approved!</h2><p style="font-size: 16px; color: #333;">Dear Player,</p><p style="font-size: 14px; color: #555;">Your payment has been verified and approved successfully!</p><div style="background-color: #e8f5e9; padding: 15px; border-left: 4px solid #27AE60; margin: 20px 0;"><p style="margin: 0;"><strong>Game:</strong> Winter Bumper Premium Lottery</p><p style="margin: 5px 0;"><strong>Status:</strong> APPROVED ✅</p><p style="margin: 5px 0;"><strong>Notes:</strong> ${notes || 'Payment verified successfully'}</p></div><p style="font-size: 14px; color: #555;">Your ticket is now active and ready to use. Good luck!</p></div></body></html>`
            : `<html><body style="font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px;"><div style="background-color: white; padding: 30px; border-radius: 10px; max-width: 600px; margin: 0 auto;"><h2 style="color: #E74C3C; text-align: center;">❌ Payment Rejected</h2><p style="font-size: 16px; color: #333;">Dear Player,</p><p style="font-size: 14px; color: #555;">Unfortunately, your payment could not be verified.</p><div style="background-color: #ffebee; padding: 15px; border-left: 4px solid #E74C3C; margin: 20px 0;"><p style="margin: 0;"><strong>Game:</strong> Winter Bumper Premium Lottery</p><p style="margin: 5px 0;"><strong>Status:</strong> REJECTED ❌</p><p style="margin: 5px 0;"><strong>Reason:</strong> ${notes || 'Payment verification failed'}</p></div><p style="font-size: 14px; color: #555;">Please contact our support team for assistance.</p></div></body></html>`;

        sendEmailViaBrevo(email, subject, htmlMessage);
    }

    app.post('/api/verify-payment', async (req, res) => {
        const { verificationId, ticketId, playerEmail, playerName, approved, notes, ticket } = req.body;
        const adminName = 'Admin';

        if (!verificationId || !ticketId || !playerEmail) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const newStatus = approved ? 'approved' : 'rejected';

        try {
            // Update payment verification status
            await pool.query(
                'UPDATE payment_verifications SET status = $1, verifiedAt = CURRENT_TIMESTAMP, verifiedBy = $2, notes = $3 WHERE id = $4',
                [newStatus, adminName, notes || '', verificationId]
            );

            // Clear cache
            await redisClient.del('pending_payments');

            if (approved) {
                // Get next serial number
                const result = await pool.query(
                    'SELECT COALESCE(MAX(serialNumber), 0) as maxSerial FROM tickets WHERE paymentStatus = $1',
                    ['approved']
                );
                const serialNumber = (result.rows[0].maxSerial || 0) + 1;

                // Update ticket
                await pool.query(
                    'UPDATE tickets SET paymentStatus = $1, verifiedBy = $2, verifiedAt = CURRENT_TIMESTAMP, serialNumber = $3 WHERE id = $4',
                    ['approved', adminName, serialNumber, ticketId]
                );

                // Send email
                generateAndSendTicketEmail(playerEmail, playerName, ticket, serialNumber, ticketId);

                res.json({
                    success: true,
                    message: `Payment approved. Ticket #${serialNumber} email sent to ${playerEmail}`
                });
            } else {
                sendConfirmationEmail(playerEmail, false, notes);
                res.json({
                    success: true,
                    message: `Payment rejected. Email sent to ${playerEmail}`
                });
            }
        } catch (err) {
            console.error('DB error:', err);
            res.status(500).json({ error: 'Failed to verify payment' });
        }
    });

    // Initialize database and start server
    try {
        await initializeDatabase();
        console.log('✅ Database initialized successfully');
    } catch (err) {
        console.error('⚠️  Database initialization failed:', err.message);
        console.log('⚠️  Starting server WITHOUT database (read-only mode)');
    }
    
    server.listen(PORT, () => {
        console.log(`✨ Worker ${process.pid} running on port ${PORT}`);
        console.log(`🌐 Access at: http://localhost:${PORT}`);
    });
}
