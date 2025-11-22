const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

// Connect to SQLite database (creates file if it doesn't exist)
const dbPath = path.resolve(__dirname, 'events.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
    }
});

const SALT_ROUNDS = 10;

db.serialize(() => {
    // Enable Foreign Key constraints
    db.run("PRAGMA foreign_keys = ON");

    // 1. Create Users Table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT,
        role TEXT CHECK(role IN ('student', 'category_reviewer', 'budget_reviewer', 'admin')) NOT NULL,
        otp TEXT,
        otp_expiry DATETIME,
        is_verified INTEGER DEFAULT 0, -- 0 for false, 1 for true
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) console.error("Error creating users table:", err.message);
        else console.log("Users table synced.");
    });

    // 2. Create Proposals Table
    db.run(`CREATE TABLE IF NOT EXISTS proposals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        category TEXT,
        budget REAL,
        footfall INTEGER,
        event_date DATETIME,
        venue TEXT,
        status TEXT DEFAULT 'pending',
        category_reviewer_comments TEXT,
        budget_reviewer_comments TEXT,
        ai_summary TEXT,
        ai_suggestions TEXT,
        ml_feasibility_score REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
    )`, (err) => {
        if (err) console.error("Error creating proposals table:", err.message);
        else console.log("Proposals table synced.");
    });

    // 3. Seed Reviewer Accounts
    seedReviewers();
});

function seedReviewers() {
    const password = "reviewer123";
    const reviewers = [
        {
            email: "category@reviewer.com",
            name: "Category Reviewer",
            role: "category_reviewer"
        },
        {
            email: "budget@reviewer.com",
            name: "Budget Reviewer",
            role: "budget_reviewer"
        }
    ];

    // Generate Hash synchronously for seeding
    const hash = bcrypt.hashSync(password, SALT_ROUNDS);

    const insertStmt = db.prepare(`
        INSERT OR IGNORE INTO users (email, password_hash, name, role, is_verified) 
        VALUES (?, ?, ?, ?, 1)
    `);

    reviewers.forEach((reviewer) => {
        insertStmt.run(reviewer.email, hash, reviewer.name, reviewer.role, (err) => {
            if (err) {
                console.error(`Error seeding ${reviewer.role}:`, err.message);
            }
        });
    });

    insertStmt.finalize(() => {
        console.log("Seeding process completed (duplicates ignored).");
    });
}

module.exports = db;