import sqlite3 from 'sqlite3';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// SQLite connection
const sqliteDb = new sqlite3.Database(path.join(__dirname, 'tickets.db'));

// PostgreSQL connection
const pgPool = new Pool({
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'tambola_game',
});

async function migrateData() {
    try {
        console.log('╔════════════════════════════════════════════════════════════════╗');
        console.log('║    Migrating Data from SQLite to PostgreSQL                   ║');
        console.log('╚════════════════════════════════════════════════════════════════╝');
        console.log('');

        // Get all tickets from SQLite
        console.log('📥 Reading tickets from SQLite...');
        const tickets = await new Promise((resolve, reject) => {
            sqliteDb.all('SELECT * FROM tickets', (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        console.log(`✓ Found ${tickets.length} tickets`);

        // Insert tickets into PostgreSQL
        for (const ticket of tickets) {
            try {
                await pgPool.query(
                    `INSERT INTO tickets (id, playerName, playerEmail, ticket, paymentScreenshot, paymentStatus, verifiedBy, serialNumber, purchasedAt, verifiedAt, used)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                     ON CONFLICT (id) DO NOTHING`,
                    [
                        ticket.id,
                        ticket.playerName,
                        ticket.playerEmail,
                        ticket.ticket,
                        ticket.paymentScreenshot,
                        ticket.paymentStatus,
                        ticket.verifiedBy,
                        ticket.serialNumber,
                        ticket.purchasedAt,
                        ticket.verifiedAt,
                        ticket.used
                    ]
                );
            } catch (err) {
                console.error(`❌ Error inserting ticket ${ticket.id}:`, err.message);
            }
        }

        console.log(`✓ Migrated ${tickets.length} tickets`);
        console.log('');

        // Get all payment verifications from SQLite
        console.log('📥 Reading payment verifications from SQLite...');
        const payments = await new Promise((resolve, reject) => {
            sqliteDb.all('SELECT * FROM payment_verifications', (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        console.log(`✓ Found ${payments.length} payment verifications`);

        // Insert payment verifications into PostgreSQL
        for (const payment of payments) {
            try {
                await pgPool.query(
                    `INSERT INTO payment_verifications (id, ticketId, playerName, playerEmail, paymentScreenshot, status, submittedAt, verifiedAt, verifiedBy, notes)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                     ON CONFLICT (id) DO NOTHING`,
                    [
                        payment.id,
                        payment.ticketId,
                        payment.playerName,
                        payment.playerEmail,
                        payment.paymentScreenshot,
                        payment.status,
                        payment.submittedAt,
                        payment.verifiedAt,
                        payment.verifiedBy,
                        payment.notes
                    ]
                );
            } catch (err) {
                console.error(`❌ Error inserting payment ${payment.id}:`, err.message);
            }
        }

        console.log(`✓ Migrated ${payments.length} payment verifications`);
        console.log('');

        console.log('╔════════════════════════════════════════════════════════════════╗');
        console.log('║          ✅ Migration Complete!                               ║');
        console.log('╚════════════════════════════════════════════════════════════════╝');
        console.log('');
        console.log(`Total Tickets: ${tickets.length}`);
        console.log(`Total Payments: ${payments.length}`);
        console.log('');
        console.log('Your data has been successfully migrated to PostgreSQL!');

        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
}

migrateData();
