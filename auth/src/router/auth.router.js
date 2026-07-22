import { Router } from "express";
import passport from "passport";
import { googleAuthController, meController } from "../controller/auth.controller.js"
const router = Router();

router.get("/_status/healthz", (req, res) => {
    res.status(200).json({ status: 'ok' });
});

router.get("/_status/readyz", (req, res) => {
    res.status(200).json({ status: 'ready' });
});

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