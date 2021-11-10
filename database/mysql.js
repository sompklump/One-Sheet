const mysql = require('mysql');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    database: process.env.MYSQL_DB,
    user: process.env.MYSQL_USER,
    port: process.env.MYSQL_PORT,
    password: process.env.MYSQL_PW
});

async function ExecuteSQL(sql) {
    return new Promise(async (OK, ERR) => {
        pool.query(sql, async (err, result) => {
            if (err) {
                ERR(err);
                return;
            }
            OK(result);
        });
    });
}

async function EscapeString(string) {
    return mysql.escape(string);
}

module.exports = { ExecuteSQL, EscapeString };