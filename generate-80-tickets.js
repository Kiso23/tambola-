import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'tambola_game',
});

function generateTambolaTicket() {
    const ticket = [];
    const used = new Set();
    
    // 9 columns, each with a range of 10 numbers
    const ranges = [
        { min: 1, max: 10 },    // Column 0
        { min: 11, max: 20 },   // Column 1
        { min: 21, max: 30 },   // Column 2
        { min: 31, max: 40 },   // Column 3
        { min: 41, max: 50 },   // Column 4
        { min: 51, max: 60 },   // Column 5
        { min: 61, max: 70 },   // Column 6
        { min: 71, max: 80 },   // Column 7
        { min: 81, max: 90 }    // Column 8
    ];
    
    // 3 rows
    for (let row = 0; row < 3; row++) {
        const rowData = [];
        const colsWithNumbers = new Set();
        
        // Each row has 5 numbers (spread across 9 columns)
        while (colsWithNumbers.size < 5) {
            colsWithNumbers.add(Math.floor(Math.random() * 9));
        }
        
        // Fill the row
        for (let col = 0; col < 9; col++) {
            if (colsWithNumbers.has(col)) {
                // This column gets a number
                const range = ranges[col];
                let num;
                do {
                    num = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
                } while (used.has(num));
                used.add(num);
                rowData.push(num);
            } else {
                // Empty cell
                rowData.push(0);
            }
        }
        ticket.push(rowData);
    }
    
    return ticket;
}

async function generateTickets() {
    try {
        console.log('🎫 Generating 80 Tambola tickets with random numbers...\n');
        
        // Clear existing tickets and payment verifications
        await pool.query('DELETE FROM payment_verifications');
        await pool.query('DELETE FROM tickets');
        console.log('✅ Cleared old data\n');
        
        for (let i = 1; i <= 80; i++) {
            const ticket = generateTambolaTicket();
            const serialCode = 'A' + String(i).padStart(2, '0'); // A01, A02, A03...
            
            await pool.query(
                'INSERT INTO tickets (serialNumber, playerName, ticket, paymentStatus) VALUES ($1, $2, $3, $4)',
                [i, `#PlayerName`, JSON.stringify(ticket), 'available']
            );
            
            if (i % 10 === 0) {
                console.log(`✅ Generated ${i} tickets`);
            }
        }
        
        console.log('\n✅ All 80 tickets generated successfully!');
        console.log('🎫 Tickets are ready for players to book');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

generateTickets();
