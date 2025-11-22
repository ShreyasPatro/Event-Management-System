const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const cors = require('cors'); // 1. Import cors

// Load environment variables from .env file (for JWT_SECRET and PORT)
dotenv.config();

// Initialize Express app
const app = express();
// Use the PORT from .env (5000), or default to 3000
const PORT = process.env.PORT || 3000;

// Database connection check & Initialization
// This ensures the database file is connected and tables are created/seeded before routes are mounted
require('./db'); 

// --- Middleware Setup ---
// 2. Enable CORS for all routes
app.use(cors()); 
// For parsing application/json (body-parser is included in Express now, but keeping for compatibility)
app.use(bodyParser.json());
app.use(express.json()); 

// --- Import Routes ---
const authRoutes = require('./routes/auth');
const proposalRoutes = require('./routes/proposals');

// --- Mount Routes ---
// 3. Authentication routes: POST /api/auth/register, /api/auth/login, etc.
app.use('/api/auth', authRoutes); 
// 4. Proposal routes: POST/GET/PATCH /api/proposals, protected by JWT
app.use('/api/proposals', proposalRoutes); 


// Basic welcome route
app.get('/', (req, res) => {
    res.send('Event Management System Backend is running.');
});


// --- 6. Global Error Handling Middleware ---
// This middleware catches errors passed via next(err) from any route
app.use((err, req, res, next) => {
    console.error(err.stack); // Log the error stack for debugging
    res.status(err.status || 500).json({
        error: {
            message: err.message || 'An unexpected server error occurred.',
            status: err.status || 500
        }
    });
});


// 5. Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT}`);
});