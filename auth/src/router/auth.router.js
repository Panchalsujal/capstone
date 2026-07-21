import { Router } from "express";
import passport from "passport";
import { googleAuthController, meController } from "../controller/auth.controller.js"
const router = Router();


router.get('/google', passport.authenticate('google', {
    session: false,
    scope: ['profile', 'email']
}));

router.get('/google/callback', passport.authenticate('google', {
    session: false,
    failureRedirect: '/'
}), googleAuthController);

router.get('/me', meController);

export default router;