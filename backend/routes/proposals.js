const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../authMiddleware');
// --- FIX 1: Remove node-fetch and require native http/https ---
const http = require('http'); 

// Base URL configuration for the Python ML API running on port 5001
const ML_API_OPTIONS = {
    hostname: '127.0.0.1',
    port: 5001,
    path: '/predict_feasibility',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    }
};

// --- Helper Middleware for Role-Based Access Control (Unchanged) ---

const isStudent = (req, res, next) => {
// ... (rest of isStudent function remains unchanged)
    if (req.user.role === 'student') {
        next();
    } else {
        res.status(403).json({ error: 'Forbidden: Only students can perform this action.' });
    }
};

const isCategoryReviewer = (req, res, next) => {
// ... (rest of isCategoryReviewer function remains unchanged)
    if (req.user.role === 'category_reviewer') {
        next();
    } else {
        res.status(403).json({ error: 'Forbidden: Only category reviewers can perform this action.' });
    }
};

const isBudgetReviewer = (req, res, next) => {
// ... (rest of isBudgetReviewer function remains unchanged)
    if (req.user.role === 'budget_reviewer') {
        next();
    } else {
        res.status(403).json({ error: 'Forbidden: Only budget reviewers can perform this action.' });
    }
};

/**
 * Helper function to call the Python ML API and get the feasibility score using native HTTP.
 */
async function getFeasibilityScore(category, budget, footfall) {
    const postData = JSON.stringify({ 
        category: category, 
        budget: budget, 
        footfall: footfall 
    });

    return new Promise((resolve, reject) => {
        // Update Content-Length header for the request
        ML_API_OPTIONS.headers['Content-Length'] = Buffer.byteLength(postData);

        const req = http.request(ML_API_OPTIONS, (res) => {
            let rawData = '';

            res.on('data', (chunk) => {
                rawData += chunk;
            });

            res.on('end', () => {
                try {
                    if (res.statusCode !== 200) {
                        console.error(`ML API failed with status ${res.statusCode}: ${rawData}`);
                        return resolve(null);
                    }
                    const parsedData = JSON.parse(rawData);
                    resolve(parsedData.score);
                } catch (e) {
                    console.error('Error parsing ML API response:', e.message);
                    reject(e);
                }
            });
        });

        req.on('error', (e) => {
            console.error('Error communicating with ML API (http.request):', e.message);
            resolve(null); // Resolve to null on connection error
        });

        // Write data to request body
        req.write(postData);
        req.end();
    })
    .catch(error => {
        // This catch handles any promise rejection, though resolve(null) above handles connection errors
        console.error('Unhandled error during ML API call:', error.message);
        return null; 
    });
}

// --- 1. POST /api/proposals (Student Only) ---
router.post('/', verifyToken, isStudent, async (req, res) => { // Made async to use await
    const { title, description, category, budget, footfall, event_date, venue } = req.body;
    const student_id = req.user.id; 

    if (!title || !description || !category || !budget || !event_date || !venue) {
        return res.status(400).json({ error: "Missing required fields." });
    }
    
    // --- ML INTEGRATION STEP ---
    const ml_score = await getFeasibilityScore(category, budget, footfall);
    
    // Use a safety check for null score
    const scoreToSave = ml_score !== null ? ml_score : 0.0; 
    
    // This console log will now appear even on failure
    console.log(`[ML Score] Proposal: ${title}, Score: ${scoreToSave}`);

    const sql = `INSERT INTO proposals (
        student_id, title, description, category, budget, footfall, event_date, venue, status, ml_feasibility_score
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending_category', ?)`;

    const params = [student_id, title, description, category, budget, footfall, event_date, venue, scoreToSave];

    db.run(sql, params, function(err) {
        if (err) {
            console.error("Proposal creation error:", err.message);
            return res.status(500).json({ error: "Failed to create proposal." });
        }
        
        // --- FINAL CHECK: Use the complete message if a score was successfully retrieved ---
        const message = ml_score !== null 
            ? "Proposal submitted successfully and ML score generated."
            : "Proposal submitted successfully.";

        res.status(201).json({ 
            message: message,
            proposalId: this.lastID,
            ml_feasibility_score: scoreToSave
        });
    });
});

// --- 2. GET /api/proposals (Role-based filtering) ---
router.get('/', verifyToken, (req, res) => {
// ... (rest of the file remains unchanged)
    const role = req.user.role;
    let sql = 'SELECT * FROM proposals';
    let params = [];
    let queryTitle = 'All Proposals';

    // Apply role-based filtering
    switch (role) {
        case 'student':
            // Students only see their own proposals
            sql += ' WHERE student_id = ?';
            params.push(req.user.id);
            queryTitle = 'My Proposals';
            break;
        case 'category_reviewer':
            // Category reviewers see proposals awaiting category review
            sql += ' WHERE status = ?';
            params.push('pending_category');
            queryTitle = 'Proposals for Category Review';
            break;
        case 'budget_reviewer':
            // Budget reviewers see proposals awaiting budget review
            sql += ' WHERE status = ?';
            params.push('pending_budget');
            queryTitle = 'Proposals for Budget Review';
            break;
        default:
            // Optional: If 'admin' role existed, it would show all. For 'student' default, this is covered above.
            break;
    }
    
    // Sort by creation date (newest first)
    sql += ' ORDER BY created_at DESC';

    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error("Proposal fetch error:", err.message);
            return res.status(500).json({ error: "Failed to fetch proposals." });
        }
        res.json({ title: queryTitle, proposals: rows });
    });
});

// --- 3. GET /api/proposals/:id (Permission Check) ---
router.get('/:id', verifyToken, (req, res) => {
    const proposalId = req.params.id;
    const user = req.user;

    db.get('SELECT * FROM proposals WHERE id = ?', [proposalId], (err, proposal) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!proposal) return res.status(404).json({ error: "Proposal not found." });

        // Check view permission
        const isOwner = proposal.student_id === user.id;
        const isRelevantReviewer = 
            (user.role === 'category_reviewer' && (proposal.status === 'pending_category' || proposal.status !== 'pending_budget')) ||
            (user.role === 'budget_reviewer' && (proposal.status === 'pending_budget' || proposal.status === 'approved' || proposal.status === 'rejected'));

        if (!isOwner && !isRelevantReviewer) {
            return res.status(403).json({ error: "Forbidden: You do not have permission to view this proposal." });
        }

        res.json(proposal);
    });
});

// --- 4. PATCH /api/proposals/:id/category-review (Category Reviewer Only) ---
router.patch('/:id/category-review', verifyToken, isCategoryReviewer, (req, res) => {
    const proposalId = req.params.id;
    const { comments, action } = req.body; // action: 'approve' or 'reject'

    if (!comments || !['approve', 'reject'].includes(action)) {
        return res.status(400).json({ error: "Comments and a valid action ('approve' or 'reject') are required." });
    }

    let newStatus = action === 'approve' ? 'pending_budget' : 'rejected';
    const reviewerComments = comments;

    // Ensure the proposal is in the correct status for review
    db.get('SELECT status FROM proposals WHERE id = ?', [proposalId], (err, proposal) => {
        if (err || !proposal) return res.status(err ? 500 : 404).json({ error: err ? err.message : "Proposal not found." });
        
        if (proposal.status !== 'pending_category') {
            return res.status(400).json({ error: `Cannot review: Proposal status is currently '${proposal.status}'.` });
        }

        const sql = `UPDATE proposals SET 
            status = ?, 
            category_reviewer_comments = ?, 
            updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?`;
        
        db.run(sql, [newStatus, reviewerComments, proposalId], function(err) {
            if (err) return res.status(500).json({ error: "Failed to update category review." });
            
            if (this.changes === 0) {
                 return res.status(404).json({ error: "Proposal not found or no changes made." });
            }

            res.json({ 
                message: `Proposal ${newStatus}. Category review complete.`,
                id: proposalId,
                newStatus: newStatus
            });
        });
    });
});

// --- 5. PATCH /api/proposals/:id/budget-review (Budget Reviewer Only) ---
router.patch('/:id/budget-review', verifyToken, isBudgetReviewer, (req, res) => {
    const proposalId = req.params.id;
    const { comments, action } = req.body; // action: 'approve' or 'reject'

    if (!comments || !['approve', 'reject'].includes(action)) {
        return res.status(400).json({ error: "Comments and a valid action ('approve' or 'reject') are required." });
    }

    let newStatus = action === 'approve' ? 'approved' : 'rejected';
    const reviewerComments = comments;
    
    // Ensure the proposal is in the correct status for review
    db.get('SELECT status FROM proposals WHERE id = ?', [proposalId], (err, proposal) => {
        if (err || !proposal) return res.status(err ? 500 : 404).json({ error: err ? err.message : "Proposal not found." });
        
        if (proposal.status !== 'pending_budget') {
            return res.status(400).json({ error: `Cannot review: Proposal status is currently '${proposal.status}'.` });
        }

        const sql = `UPDATE proposals SET 
            status = ?, 
            budget_reviewer_comments = ?, 
            updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?`;

        db.run(sql, [newStatus, reviewerComments, proposalId], function(err) {
            if (err) return res.status(500).json({ error: "Failed to update budget review." });
            
            if (this.changes === 0) {
                 return res.status(404).json({ error: "Proposal not found or no changes made." });
            }

            res.json({ 
                message: `Proposal ${newStatus}. Budget review complete.`,
                id: proposalId,
                newStatus: newStatus
            });
        });
    });
});

module.exports = router;