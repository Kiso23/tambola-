// 🔐 Secure Configuration Management
// Load from environment variables - NEVER hardcode!

import dotenv from 'dotenv';

// Load .env file
dotenv.config();

// Validate required environment variables
const requiredVars = [
    'DB_USER',
    'DB_PASSWORD',
    'BREVO_API_KEY',
    'ADMIN_USERNAME',
    'ADMIN_PASSWORD'
];

const missingVars = requiredVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
    console.error('❌ Missing environment variables:');
    missingVars.forEach(v => console.error(`   - ${v}`));
    console.error('\n📝 Create .env file with required variables');
    console.error('   Copy from .env.example and fill in your values');
    process.exit(1);
}

export const config = {
    // Database
    database: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'tambola_game',
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
        ssl: process.env.NODE_ENV === 'production' ? true : false
    },

    // Redis
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        socket: {
            reconnectStrategy: (retries) => Math.min(retries * 50, 500)
        }
    },

    // Email Service
    brevo: {
        apiKey: process.env.BREVO_API_KEY,
        apiUrl: 'https://api.brevo.com/v3/smtp/email',
        sender: {
            name: 'Winter Bumper Admin',
            email: 'noreply@winterbumper.com'
        }
    },

    // Admin Credentials
    admin: {
        username: process.env.ADMIN_USERNAME,
        password: process.env.ADMIN_PASSWORD
    },

    // Server
    server: {
        port: process.env.PORT || 3000,
        nodeEnv: process.env.NODE_ENV || 'development',
        sessionSecret: process.env.SESSION_SECRET || 'change-this-secret'
    },

    // Security
    security: {
        enforceHttps: process.env.NODE_ENV === 'production',
        cookieSecure: process.env.NODE_ENV === 'production',
        rateLimitWindow: 15 * 60 * 1000, // 15 minutes
        rateLimitMax: 100,
        loginAttempts: 5,
        lockoutDuration: 15 * 60 * 1000 // 15 minutes
    }
};

// Validation functions
export function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

export function validatePassword(password) {
    // Min 8 chars, at least one uppercase, one lowercase, one number
    const re = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    return re.test(password);
}

export function validateUsername(username) {
    // Alphanumeric and underscore only, 3-20 chars
    const re = /^[a-zA-Z0-9_]{3,20}$/;
    return re.test(username);
}

// Export for use
export default config;
