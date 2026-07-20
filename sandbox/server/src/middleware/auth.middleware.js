import {verifyToken} from '../utiles.js'

export function authMiddleware(req, res, next) {

    // Accept token from cookie (browser) OR Authorization header (Postman/API clients)
    const token = req.cookies.token 
        || (req.headers.authorization?.startsWith('Bearer ')
            ? req.headers.authorization.split(' ')[1]
            : null)

    console.log('token:', token);

    if (!token) {
        return res.status(401).json({
            message: "Authentication token is missing"
        })
    }

    const decoded = verifyToken(token)

    if (!decoded) {
        return res.status(401).json({
            message: "Invalid or expired token"
        })
    }

    req.user = decoded

    next()
    
}