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
    
    for (let row = 0; row < 3; row++) {
        const rowData = [];
        for (let col = 0; col < 9; col++) {
            const min = col * 10 + 1;
            const max = col * 10 + 10;
            let num;
            do {
                num = Math.floor(Math.random() * (max - min + 1)) + min;
            } while (used.has(num));
            used.add(num);
            rowData.push(num);
        }
        ticket.push(rowData);
    }
    return ticket;
}

async function generateTickets() {
    try {
        console.log('🎫 Generating 80 Tambola tickets...');
        
        for (let i = 1; i <= 80; i++) {
            const ticket = generateTambolaTicket();
            
            await pool.query(
                'INSERT INTO tickets (serialNumber, playerName, ticket, paymentStatus) VALUES ($1, $2, $3, $4)',
                [i, `Ticket-${i}`, JSON.stringify(ticket), 'available']
            );
            
            if (i % 10 === 0) console.log(`✅ Generated ${i} tickets`);
        }
        
        console.log('✅ All 80 tickets generated successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

generateTickets();
