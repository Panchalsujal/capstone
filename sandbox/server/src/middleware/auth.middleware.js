import {verifyToken} from '../utiles.js'

export function authMiddleware(req,res,next) {

    const token = req.cookies.token 

    if (!token) {
        return res.status(401).json({
            message:"Authentication token is missing"
        })
    }

    const decoded = verifyToken(token)

    if (!decoded) {
         return res.status(401).json({
            message:"Invalid or expired token"
        })
    }

    req.user = decoded

    next()
    
}