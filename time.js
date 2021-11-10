async function AddSeconds(date, seconds) {
    return new Date(date.getTime() + seconds * 1000).getTime();
}

async function GetTimeDiff(now, end) {
    return Math.floor((end - now) / 1000);
}

module.exports = { AddSeconds, GetTimeDiff };