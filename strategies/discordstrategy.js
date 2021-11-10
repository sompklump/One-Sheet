const DiscordStrat = require('passport-discord').Strategy;
const passport = require('passport');
const mysql = require('../database/mysql');

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    let user = null;
    await mysql.ExecuteSQL(`SELECT * FROM users WHERE id = '${id}'`).then(async (v) => {
        user = v[0];
    }).catch(async (merr) => {
        console.log(merr);
        done(merr, null);
    });
    if (user)
        done(null, user);
})

passport.use(new DiscordStrat({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.CLIENT_REDIR,
    scope: ['identify']
}, async (accessToken, refreshToken, profile, done) => {
    try {
        let error = null;
        let result = null;

        // Get user data from the db
        await mysql.ExecuteSQL(`SELECT id, username FROM users WHERE id = '${profile.id}'`).then(async (v) => {
            await mysql.ExecuteSQL(`DELETE FROM users WHERE id = '${profile.id}'`);
        }).catch((mErr) => { error = mErr; console.log(error) });

        const username = await mysql.EscapeString(profile.username);
        await mysql.ExecuteSQL(`INSERT INTO users(id, username) VALUES('${profile.id}', ${username})`).catch((mErr) => { error = mErr; console.log(error) });
        result = profile;

        done(error, result);
    }
    catch (err) {
        console.log(err);
        done(err, null);
    }
}));