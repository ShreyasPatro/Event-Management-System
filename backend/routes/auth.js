const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db'); // Importing from parent directory
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your_fallback_secret_key'; // Ensure this is in your .env file

// 1. REGISTER ROUTE
router.post('/register', async (req, res) => {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
        return res.status(400).json({ error: "All fields are required" });
    }

    try {
        // Hash password
        const saltRounds = 10;
        const password_hash = await bcrypt.hash(password, saltRounds);

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Set OTP expiry (10 minutes from now)
        const otp_expiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();

        // For development: Log OTP to console
        console.log(`[DEV] OTP for ${email}: ${otp}`);

        const sql = `INSERT INTO users (email, password_hash, name, role, otp, otp_expiry, is_verified) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        const params = [email, password_hash, name, 'student', otp, otp_expiry, 0];

        db.run(sql, params, function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ error: "Email already registered" });
                }
                return res.status(500).json({ error: err.message });
            }
            res.status(201).json({ 
                message: "Registration successful. Check server console for OTP.", 
                userId: this.lastID,
                email: email 
            });
        });

    } catch (error) {
        res.status(500).json({ error: "Server error during registration" });
    }
});

// 2. VERIFY OTP ROUTE
router.post('/verify-otp', (req, res) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
        return res.status(400).json({ error: "Email and OTP are required" });
    }

    db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(404).json({ error: "User not found" });

        // Check if verified
        if (user.is_verified === 1) {
            return res.status(400).json({ message: "User already verified" });
        }

        // Check OTP match
        if (user.otp !== otp) {
            return res.status(400).json({ error: "Invalid OTP" });
        }

        // Check OTP Expiry
        const now = new Date();
        const expiryDate = new Date(user.otp_expiry);

        if (now > expiryDate) {
            return res.status(400).json({ error: "OTP has expired" });
        }

        // Update user to verified
        db.run(`UPDATE users SET is_verified = 1, otp = NULL, otp_expiry = NULL WHERE id = ?`, [user.id], (err) => {
            if (err) return res.status(500).json({ error: "Failed to verify user" });
            res.json({ message: "Email verified successfully. You can now login." });
        });
    });
});

// 3. LOGIN ROUTE
router.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "Email and password required" });
    }

    db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(401).json({ error: "Invalid credentials" });

        // Verify Password
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        // Check Verification
        if (user.is_verified !== 1) {
            return res.status(403).json({ error: "Account not verified. Please verify your OTP." });
        }

        // Generate Token
        const token = jwt.sign(
            { id: user.id, role: user.role, email: user.email },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: "Login successful",
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            }
        });
    });
});

module.exports = router;