import express from 'express';
import morgan from 'morgan';
import passport from 'passport';
import { Strategy as GoogleStrategy } from "passport-google-oauth20"
import cookies from 'cookie-parser'
import {config} from "./config/config.js "
import authRoutes from './router/auth.router.js';
const app = express();

app.use(morgan('dev'));
app.use(cookies());
app.use(passport.initialize());

passport.use(new GoogleStrategy({
    clientID: config.GOOGLE_CLIENT_ID,
    clientSecret: config.GOOGLE_CLIENT_SECRET,
    callbackURL: "/api/auth/google/callback"
}, (accessToken, refreshToken, profile, done) => {
    // Here you would typically find or create a user in your database
    // For this example, we'll just return the profile
    return done(null, profile);
}));

app.set('trust proxy', 1);


// Top-level health endpoints — must be registered BEFORE /api/auth
// so K8s probes hitting /_status/healthz on port 3000 get a 200 directly
app.get('/_status/healthz', (_req, res) => res.status(200).json({ status: 'ok' }));
app.get('/_status/readyz',  (_req, res) => res.status(200).json({ status: 'ready' }));

app.use('/api/auth', authRoutes);


export default app;