const router = require('express').Router();
function Authorized(req, res, next) {
    if (req.user) {
        return next();
    }
    res.redirect('/');
}
router.get('/', Authorized, (req, res) => {
    const userInfo = JSON.parse(req.user.user_creds);
    res.render('dashboard', {
        username: userInfo.username,
        userPb: `https://cdn.discordapp.com/avatars/${userInfo.id}/${userInfo.avatar}.webp`,
        DiscordID: userInfo.DiscordID
    });
});

module.exports = router;