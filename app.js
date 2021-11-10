require('dotenv').config();
// Needs to be declared even if not used
const express = require('express');
const discordStrategy = require('./strategies/discordstrategy');
const app = express();
const COOKIE_SECRET = process.env.COOKIE_SECRET;
const session = require('express-session');
const passport = require('passport');
const path = require('path');

// Routers
const authRouter = require('./routers/auth');
const dashboardRouter = require('./routers/dashboard');
const landingRouter = require('./routers/landing');

// Make Cookies for session, Remember User Feature.
app.use(session({
    secret: COOKIE_SECRET,
    cookie: {
        maxAge: 60000 * 60 * 24
    },
    saveUninitialized: false,
    name: 'discord.oauth2'
}));

// Set render engine as EJS and give users access to static public directory.
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Passport
app.use(passport.initialize());
app.use(passport.session());

// Get Routers.
app.use('/auth', authRouter);
app.use('/dashboard', dashboardRouter);
app.use('/', landingRouter);

app.use(express.static('public'))

module.exports = app