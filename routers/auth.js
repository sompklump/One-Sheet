const router = require('express').Router();
const passport = require('passport');

router.get('/', passport.authenticate('discord'));
router.get('/redir', passport.authenticate('discord', {
    failureRedirect: '/',
    successRedirect: '/'
}));

router.get('/logout', (req, res) => {
    if (req.user) {
        req.logOut();
        res.redirect('/')
        return;
    }
    res.redirect('/');
});

module.exports = router;