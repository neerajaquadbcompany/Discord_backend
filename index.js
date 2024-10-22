require('dotenv').config();
const express = require('express');
const cors = require('cors');
const passport = require('passport');
const session = require('express-session');
const DiscordStrategy = require('passport-discord').Strategy;
const axios = require('axios');

const app = express();


const corsOption = {
    origin: 'http://localhost:3000', 
    credentials: true
};
app.use(cors(corsOption));
app.use(express.json());


app.use(session({
    secret: process.env.DISCORD_CLIENT_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } 
}));


passport.use(new DiscordStrategy({
    clientID: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL: process.env.DISCORD_CALLBACK_URL,
    scope: ['identify', 'email']
}, (accessToken, refreshToken, profile, done) => {
    return done(null, profile);
}));

passport.serializeUser((user, done) => {
    done(null, user.id); // Only store the user ID in the session
});

passport.deserializeUser((id, done) => {
    User.findById(id, (err, user) => {
        done(err, user); // Fetch the user from the database using the ID
    });
});
app.use(passport.initialize());
app.use(passport.session());

app.get('/api/discord', passport.authenticate('discord'));

app.get('/api/login/redirect', async (req, res) => {
    try {
        const { code } = req.query;

        
        if (!code) {
            return res.status(400).send('Authorization code is missing.');
        }

        const params = new URLSearchParams();
        params.append('client_id', process.env.DISCORD_CLIENT_ID);
        params.append('client_secret', process.env.DISCORD_CLIENT_SECRET);
        params.append('grant_type', 'authorization_code');
        params.append('code', code);
        params.append('redirect_uri', process.env.DISCORD_CALLBACK_URL); // Use your redirect URI from .env

        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', params, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        const accessToken = tokenResponse.data.access_token;

        
        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });
        
        req.session.user = userResponse.data; 
        
        res.redirect('http://localhost:3000/dashboard');
    } catch (error) {
        console.error('Error during Discord callback:', error);
        res.redirect('http://localhost:3000');
    }
});
app.get('/api/status', (req, res) => {
        res.json({ loggedIn: true, user: req.session.user }); 
});

// Logout route
app.get('/api/logout', (req, res) => {
    req.logout(() => {
        res.redirect('http://localhost:3000');
    });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
