async function GetWordTip(guess, word, guessTip) {
    let guessTipSplit = [];
    if (guessTip)
    guessTipSplit = guessTip.split('');
    guessTip = "";
    let stripped = "";
    const guessSplit = guess.split('');
    const wordSplit = word.split('');
    for (let i = 0; i < wordSplit.length; i++) {
        // Tip already has the character
        if (guessTipSplit.length > 0) {
            if (guessTipSplit[i] != '_') {
                if(!guessTipSplit[i])
                    continue;
                guessTip += `${guessTipSplit[i].toUpperCase()}&nbsp;`;
                stripped += guessTipSplit[i].toUpperCase();
                continue;
            }
        }
        if (i <= guessSplit.length) {
            if (guessSplit[i] == wordSplit[i]) {
                if(!guessSplit[i])
                    continue;
                guessTip += `${guessSplit[i].toUpperCase()}&nbsp;`;
                stripped += guessSplit[i].toUpperCase();
                continue;
            }
        }
        if (wordSplit[i] == ' ') {
            guessTip += " &nbsp;&nbsp; ";
            stripped += " ";
            continue;
        }
        guessTip += "_&nbsp;";
        stripped += "_";
    }
    return { guessTip: guessTip, stripped: stripped };
}

module.exports = { GetWordTip };