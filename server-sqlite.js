import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import sqlite3 from 'sqlite3';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);

// Configure Brevo Email Service
// Using Brevo REST API for transactional emails
const BREVO_API_KEY = process.env.BREVO_API_KEY || 'xkeysib-CHANGE_ME';

// Simple function to send emails via Brevo REST API
async function sendEmailViaBrevo(to, subject, htmlContent) {
    try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'api-key': BREVO_API_KEY
            },
            body: JSON.stringify({
                to: [{ email: to }],
                sender: { 
                    name: 'Winter Bumper Admin', 
                    email: 'noreply@winterbumper.com' 
                },
                subject: subject,
                htmlContent: htmlContent
            })
        });

        const data = await response.json();
        
        if (response.ok) {
            console.log(`✅ Email sent successfully to ${to}`);
            console.log(`   Message ID: ${data.messageId}`);
            return true;
        } else {
            console.log(`❌ Email failed to ${to}: ${data.message || 'Unknown error'}`);
            return false;
        }
    } catch (error) {
        console.log(`❌ Error sending email to ${to}:`, error.message);
        return false;
    }
}

console.log('✅ Email service configured (Brevo REST API)');
const wss = new WebSocketServer({ server, maxPayload: 100 * 1024 * 1024 });

// SQLite Database
const db = new sqlite3.Database(path.join(__dirname, 'tickets.db'));

// Initialize database tables
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS tickets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            playerName TEXT NOT NULL,
            playerEmail TEXT,
            ticket TEXT NOT NULL,
            paymentScreenshot TEXT,
            paymentStatus TEXT DEFAULT 'pending',
            verifiedBy TEXT,
            purchasedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            verifiedAt DATETIME,
            used BOOLEAN DEFAULT 0,
            UNIQUE(playerName, id)
        )
    `, (err) => {
        if (err) console.error('Error creating tickets table:', err);
        else console.log('✅ Tickets table ready');
    });

    db.run(`
        CREATE TABLE IF NOT EXISTS payment_verifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticketId INTEGER NOT NULL,
            playerName TEXT NOT NULL,
            playerEmail TEXT,
            paymentScreenshot TEXT,
            status TEXT DEFAULT 'pending',
            submittedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            verifiedAt DATETIME,
            verifiedBy TEXT,
            notes TEXT,
            FOREIGN KEY(ticketId) REFERENCES tickets(id)
        )
    `, (err) => {
        if (err) console.error('Error creating payment_verifications table:', err);
        else console.log('✅ Payment verifications table ready');
    });
});

app.use(express.static(__dirname));
app.use(express.json({ limit: '50mb' }));

const games = new Map();
const gameConnections = new Map();
const purchasedTickets = new Map(); // Keep in-memory for session

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
        if (this.calledNumbers.includes(num)) {
            return false;
        }

        this.calledNumbers.push(num);

        // Auto-mark for all players
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
            // First line: complete any horizontal row
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
            // Second line: complete any two horizontal rows
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
            // Full house: all 15 numbers marked
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

    detectTiesForWinType(winType) {
        const winnersForType = this.winners.filter(w => w.winType === winType);
        return winnersForType.length;
    }

    getWinnersByType(winType) {
        return this.winners.filter(w => w.winType === winType);
    }

    getPlayersList() {
        return Array.from(this.players.values()).map(p => ({
            id: p.id,
            name: p.name
        }));
    }
}

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

                ws.send(JSON.stringify({
                    type: 'game_created',
                    gameId: gameId
                }));
            }

            else if (message.type === 'join_game') {
                const gameId = message.gameId;

                if (!games.has(gameId)) {
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'Game not found'
                    }));
                    return;
                }

                currentGame = games.get(gameId);
                playerId = message.playerId;
                role = 'player';

                const result = currentGame.addPlayer(
                    message.playerId,
                    message.playerName,
                    message.ticket
                );

                if (!result.success) {
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: result.message
                    }));
                    return;
                }

                gameConnections.get(gameId).add(ws);

                ws.send(JSON.stringify({
                    type: 'game_joined',
                    gameId: gameId
                }));

                broadcastToGame(gameId, {
                    type: 'player_joined',
                    playerId: message.playerId,
                    playerName: message.playerName
                });

                broadcastToGame(gameId, {
                    type: 'player_count',
                    players: currentGame.getPlayersList()
                });
            }

            else if (message.type === 'announce_number' && role === 'admin') {
                const num = message.number;

                if (!currentGame.callNumber(num)) {
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'Number already called'
                    }));
                    return;
                }

                broadcastToGame(message.gameId, {
                    type: 'number_announced',
                    number: num,
                    calledNumbers: currentGame.calledNumbers
                });
            }

            else if (message.type === 'claim_win') {
                const isWin = currentGame.checkWin(message.playerId, message.winType);

                if (isWin) {
                    const player = currentGame.players.get(message.playerId);
                    
                    // Prevent duplicate wins
                    const alreadyWon = currentGame.winners.some(w => w.playerId === message.playerId && w.winType === message.winType);
                    if (alreadyWon) {
                        ws.send(JSON.stringify({
                            type: 'win_rejected',
                            message: 'You already won this prize'
                        }));
                        return;
                    }

                    // Add winner
                    currentGame.winners.push({
                        playerId: message.playerId,
                        playerName: player.name,
                        winType: message.winType,
                        timestamp: Date.now()
                    });

                    // Auto-detect ties for this win type
                    const winnersOfType = currentGame.getWinnersByType(message.winType);
                    const tieCount = winnersOfType.length;
                    const tieDetected = tieCount > 1;

                    // Broadcast winner announcement
                    broadcastToGame(message.gameId, {
                        type: 'winner_announced',
                        playerId: message.playerId,
                        playerName: player.name,
                        winType: message.winType,
                        tieDetected: tieDetected,
                        tieCount: tieCount,
                        tieWinners: winnersOfType.map(w => w.playerName)
                    });

                    ws.send(JSON.stringify({
                        type: 'win_verified',
                        message: tieDetected ? 
                            `Tie! Prize split equally among ${tieCount} winners: ${winnersOfType.map(w => w.playerName).join(', ')}` :
                            'Congratulations! Your win has been verified!'
                    }));
                } else {
                    ws.send(JSON.stringify({
                        type: 'win_rejected',
                        message: 'Invalid win claim - marks do not match'
                    }));
                }
            }
        } catch (error) {
            console.error('Error:', error);
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

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API to purchase ticket
app.post('/api/purchase-ticket', (req, res) => {
    const { playerName, ticket } = req.body;

    if (!playerName || !ticket) {
        return res.status(400).json({ error: 'Player name and ticket required' });
    }

    // Save to database
    db.run(
        `INSERT INTO tickets (playerName, ticket) VALUES (?, ?)`,
        [playerName, JSON.stringify(ticket)],
        function(err) {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Database error' });
            }

            // Also keep in memory for session
            if (!purchasedTickets.has(playerName)) {
                purchasedTickets.set(playerName, []);
            }
            purchasedTickets.get(playerName).push({
                id: this.lastID,
                ticket: ticket,
                purchasedAt: new Date(),
                used: false
            });

            res.json({
                success: true,
                message: `Ticket purchased for ${playerName}`,
                ticketId: this.lastID
            });
        }
    );
});

// API to get tickets for a player
app.get('/api/player-tickets/:playerName', (req, res) => {
    const { playerName } = req.params;

    db.all(
        `SELECT id, ticket, purchasedAt FROM tickets WHERE playerName = ? AND used = 0 ORDER BY purchasedAt DESC`,
        [playerName],
        (err, rows) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Database error' });
            }

            const tickets = (rows || []).map(row => ({
                id: row.id,
                ticket: JSON.parse(row.ticket),
                purchasedAt: row.purchasedAt
            }));

            res.json({
                playerName: playerName,
                tickets: tickets
            });
        }
    );
});

// API to use a ticket for a game
app.post('/api/use-ticket', (req, res) => {
    const { playerName, ticketId } = req.body;

    if (!playerName || !ticketId) {
        return res.status(400).json({ error: 'Player name and ticket ID required' });
    }

    db.get(
        `SELECT id, ticket FROM tickets WHERE playerName = ? AND id = ?`,
        [playerName, ticketId],
        (err, row) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Database error' });
            }

            if (!row) {
                return res.status(404).json({ error: 'Ticket not found' });
            }

            res.json({
                success: true,
                ticket: JSON.parse(row.ticket)
            });
        }
    );
});

// API to get ticket data by ID (for admin payment verification)
app.get('/api/get-ticket-data/:ticketId', (req, res) => {
    const { ticketId } = req.params;

    db.get(
        `SELECT id, ticket FROM tickets WHERE id = ?`,
        [ticketId],
        (err, row) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Database error' });
            }

            if (!row) {
                return res.status(404).json({ error: 'Ticket not found' });
            }

            res.json({
                success: true,
                ticket: JSON.parse(row.ticket)
            });
        }
    );
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

// Get all purchased tickets
app.get('/api/all-tickets', (req, res) => {
    db.all(
        `SELECT id, playerName, ticket, purchasedAt, used FROM tickets ORDER BY purchasedAt DESC`,
        (err, rows) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Database error' });
            }

            const tickets = (rows || []).map(row => ({
                id: row.id,
                playerName: row.playerName,
                ticket: JSON.parse(row.ticket),
                purchasedAt: row.purchasedAt,
                used: row.used
            }));

            res.json({ tickets: tickets });
        }
    );
});

// API to submit payment screenshot for verification
app.post('/api/submit-payment', (req, res) => {
    const { playerName, playerEmail, ticketId, screenshotBase64 } = req.body;

    if (!playerName || !playerEmail || !ticketId || !screenshotBase64) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Save payment verification request
    db.run(
        `INSERT INTO payment_verifications (ticketId, playerName, playerEmail, paymentScreenshot, status) 
         VALUES (?, ?, ?, ?, ?)`,
        [ticketId, playerName, playerEmail, screenshotBase64.substring(0, 1000), 'pending'],
        function(err) {
            if (err) {
                console.error('Error saving payment:', err);
                return res.status(500).json({ error: 'Failed to submit payment' });
            }

            res.json({
                success: true,
                message: 'Payment screenshot submitted for verification. Admin will verify and send email confirmation.',
                verificationId: this.lastID
            });
        }
    );
});

// API to get pending payment verifications (for admin)
app.get('/api/pending-payments', (req, res) => {
    db.all(
        `SELECT * FROM payment_verifications WHERE status = 'pending' ORDER BY submittedAt DESC`,
        (err, rows) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Database error' });
            }

            res.json({ pendingPayments: rows || [] });
        }
    );
});

// API for admin to verify payment and approve ticket
app.post('/api/verify-payment', (req, res) => {
    const { verificationId, ticketId, playerEmail, playerName, approved, notes, ticket } = req.body;
    const adminName = 'Admin';

    if (!verificationId || !ticketId || !playerEmail) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const newStatus = approved ? 'approved' : 'rejected';

    // Update payment verification status
    db.run(
        `UPDATE payment_verifications SET status = ?, verifiedAt = CURRENT_TIMESTAMP, verifiedBy = ?, notes = ?
         WHERE id = ?`,
        [newStatus, adminName, notes || '', verificationId],
        (err) => {
            if (err) {
                console.error('Error updating payment:', err);
                return res.status(500).json({ error: 'Failed to update payment' });
            }

            // If approved, update ticket status and assign serial number
            if (approved) {
                // Get the next serial number (max existing + 1, or 1 if none exist)
                db.get(
                    `SELECT COALESCE(MAX(serialNumber), 0) as maxSerial FROM tickets WHERE paymentStatus = 'approved'`,
                    (err, row) => {
                        const serialNumber = (row?.maxSerial || 0) + 1;

                        db.run(
                            `UPDATE tickets SET paymentStatus = 'approved', verifiedBy = ?, verifiedAt = CURRENT_TIMESTAMP, serialNumber = ?
                             WHERE id = ?`,
                            [adminName, serialNumber, ticketId],
                            (err) => {
                                if (err) {
                                    console.error('Error updating ticket:', err);
                                }

                                // Generate ticket image and send email
                                generateAndSendTicketEmail(playerEmail, playerName, ticket, serialNumber, ticketId);

                                res.json({
                                    success: true,
                                    message: `Payment approved. Ticket #${serialNumber} email sent to ${playerEmail}`
                                });
                            }
                        );
                    }
                );
            } else {
                sendConfirmationEmail(playerEmail, false, notes);
                res.json({
                    success: true,
                    message: `Payment rejected. Email sent to ${playerEmail}`
                });
            }
        }
    );
});

// Function to generate ticket email with ticket display
function generateAndSendTicketEmail(playerEmail, playerName, ticket, serialNumber, ticketId) {
    if (!ticket || !Array.isArray(ticket)) {
        console.log(`❌ Invalid ticket format for ${playerEmail}`);
        return;
    }

    // Create ticket HTML grid (3 rows × 9 columns)
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
                    
                    <!-- Header -->
                    <div style="text-align: center; border-bottom: 3px solid #667eea; padding-bottom: 20px; margin-bottom: 30px;">
                        <h1 style="color: #667eea; margin: 0 0 10px 0; font-size: 28px;">❄️ Winter Bumper Lottery</h1>
                        <p style="color: #999; margin: 0; font-size: 14px;">Premium Gaming Platform</p>
                    </div>

                    <!-- Ticket Number Badge -->
                    <div style="text-align: center; margin-bottom: 30px;">
                        <div style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; border-radius: 50px; font-weight: bold; font-size: 18px;">
                            🎟️ TICKET #${serialNumber}
                        </div>
                    </div>

                    <!-- Player Info -->
                    <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #667eea;">
                        <p style="margin: 8px 0; font-size: 14px;"><strong>Player Name:</strong> ${playerName}</p>
                        <p style="margin: 8px 0; font-size: 14px;"><strong>Email:</strong> ${playerEmail}</p>
                        <p style="margin: 8px 0; font-size: 14px;"><strong>Status:</strong> <span style="color: #27AE60; font-weight: bold;">✅ ACTIVE</span></p>
                    </div>

                    <!-- Ticket Display -->
                    <div style="text-align: center; margin: 30px 0;">
                        <h2 style="color: #333; margin: 0 0 20px 0; font-size: 18px;">Your Ticket Numbers</h2>
                        ${ticketHtml}
                    </div>

                    <!-- Important Info -->
                    <div style="background: #fffbea; padding: 15px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #FFC107;">
                        <h3 style="color: #ff9800; margin: 0 0 10px 0; font-size: 14px;">📋 Important Information</h3>
                        <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #555;">
                            <li>Your ticket is now active for the game</li>
                            <li>Keep this email safe for reference</li>
                            <li>Ticket Serial Number: <strong>#${serialNumber}</strong></li>
                            <li>Present your ticket number when claiming prizes</li>
                        </ul>
                    </div>

                    <!-- Footer -->
                    <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                        <p style="color: #999; font-size: 12px; margin: 0;">
                            This is an automated message. Please do not reply to this email.
                        </p>
                        <p style="color: #ccc; font-size: 11px; margin: 8px 0 0 0;">
                            Winter Bumper Lottery © 2024 | All Rights Reserved
                        </p>
                    </div>
                </div>
            </body>
        </html>
    `;

    sendEmailViaBrevo(playerEmail, subject, htmlMessage);
    console.log(`📧 Ticket email sent to ${playerEmail} (Ticket #${serialNumber})`);
}

// Function to send confirmation email
function sendConfirmationEmail(email, approved, notes) {
    const subject = approved ? '✅ Payment Approved - Winter Bumper' : '❌ Payment Rejected - Winter Bumper';
    
    const htmlMessage = approved 
        ? `
            <html>
                <body style="font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px;">
                    <div style="background-color: white; padding: 30px; border-radius: 10px; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #27AE60; text-align: center;">✅ Payment Approved!</h2>
                        <p style="font-size: 16px; color: #333;">Dear Player,</p>
                        <p style="font-size: 14px; color: #555;">Your payment has been verified and approved successfully!</p>
                        <div style="background-color: #e8f5e9; padding: 15px; border-left: 4px solid #27AE60; margin: 20px 0;">
                            <p style="margin: 0;"><strong>Game:</strong> Winter Bumper Premium Lottery</p>
                            <p style="margin: 5px 0;"><strong>Status:</strong> APPROVED ✅</p>
                            <p style="margin: 5px 0;"><strong>Notes:</strong> ${notes || 'Payment verified successfully'}</p>
                        </div>
                        <p style="font-size: 14px; color: #555;">Your ticket is now active and ready to use. Good luck!</p>
                        <p style="font-size: 12px; color: #999; margin-top: 30px;">This is an automated message. Please do not reply to this email.</p>
                    </div>
                </body>
            </html>
        `
        : `
            <html>
                <body style="font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px;">
                    <div style="background-color: white; padding: 30px; border-radius: 10px; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #E74C3C; text-align: center;">❌ Payment Rejected</h2>
                        <p style="font-size: 16px; color: #333;">Dear Player,</p>
                        <p style="font-size: 14px; color: #555;">Unfortunately, your payment could not be verified.</p>
                        <div style="background-color: #ffebee; padding: 15px; border-left: 4px solid #E74C3C; margin: 20px 0;">
                            <p style="margin: 0;"><strong>Game:</strong> Winter Bumper Premium Lottery</p>
                            <p style="margin: 5px 0;"><strong>Status:</strong> REJECTED ❌</p>
                            <p style="margin: 5px 0;"><strong>Reason:</strong> ${notes || 'Payment verification failed'}</p>
                        </div>
                        <p style="font-size: 14px; color: #555;">Please contact our support team for assistance.</p>
                        <p style="font-size: 12px; color: #999; margin-top: 30px;">This is an automated message. Please do not reply to this email.</p>
                    </div>
                </body>
            </html>
        `;

    // Send email via Brevo REST API
    sendEmailViaBrevo(email, subject, htmlMessage);
}


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`❄️  WINTER BUMPER - Premium Lottery Platform`);
    console.log(`${'═'.repeat(70)}`);
    console.log(`✨ Server Running: http://localhost:${PORT}`);
    console.log(`👥 Max Players: 80 per game`);
    console.log(`🎤 Admin Controls: Manual number entry`);
    console.log(`🔐 Fair & Transparent: Yes`);
    console.log(`❄️  Players See Nothing Until Announced`);
    console.log(`🎟️  Prepaid Ticket System: Enabled`);
    console.log(`${'═'.repeat(70)}\n`);
});
