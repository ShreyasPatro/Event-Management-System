const jwt = require('jsonwebtoken');

// Ensure this matches the key used in auth.js and set in .env
const JWT_SECRET = process.env.JWT_SECRET || 'your_fallback_secret_key'; 

/**
 * Middleware function to verify JWT token from Authorization header.
 * Attaches decoded user information (id, email, role) to req.user for subsequent route handlers.
 * * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next middleware function
 */
const verifyToken = (req, res, next) => {
    // 1. Check for Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ error: 'Authorization header missing' });
    }

    // 2. Check for "Bearer <token>" format
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return res.status(401).json({ error: 'Token format is "Bearer <token>"' });
    }

    const token = parts[1];

    try {
        // 3. Verify the JWT token
        // This will throw an error if the token is invalid or expired
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // 4. Attach decoded user info to req.user
        // Decoded object contains { id, role, email }
        req.user = decoded; 
        
        // Proceed to the next middleware or route handler
        next();
    } catch (error) {
        // Handle verification errors (e.g., invalid signature, expired token)
        if (error.name === 'TokenExpiredError') {
            // 5. Returns 403 error if token is expired (often 401 is used for expired, but 403 explicitly says Forbidden/Expired)
            return res.status(403).json({ error: 'Token expired' });
        }
        
        // Handle other JWT errors (e.g., invalid signature, malformed token)
        return res.status(401).json({ error: 'Invalid token' });
    }
};

module.exports = { verifyToken };

