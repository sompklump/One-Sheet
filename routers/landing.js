const router = require('express').Router();

router.get('/', (req, res) => {
    if(!req.user){
        res.redirect('/auth');
        return;
    }
    res.render('draw', {discordId: req.user.id});
});

module.exports = router;