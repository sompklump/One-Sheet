const { clear } = require('console');
const http = require('http');
const { parse } = require('path');
const app = require('./app');
const db = require('./database/mysql');
const timeExt = require("./time");
const wordExt = require("./word");
const wordList = require('./words.json');

const server = http.createServer(app);
const io = require('socket.io')(server);

var rooms = new Map();

// Wordlist https://raw.githubusercontent.com/scribble-rs/scribble.rs/master/game/words/en_us

const normalizePort = val => {
	const port = parseInt(val, 10)

	if (isNaN(port)) {
		return val;
	}
	if (port >= 0) {
		return port;
	}
	return false;
}
const port = normalizePort(process.env.PORT || '3000');
app.set('port', port);

const errorHandler = error => {
	if (error.syscall !== 'listen') {
		throw error;
	}
	const address = server.address();
	const bind = typeof address === 'string' ? 'pipe ' + address : 'port: ' + port;
	switch (error.code) {
		case 'EACCES':
			console.error(bind + ' requires elevated privileges.');
			process.exit(1);
		case 'EADDRINUSE':
			console.error(bind + ' is already in use.');
			process.exit(1);
		default:
			throw error;
	}
}

server.on('error', errorHandler);
server.on('listening', () => {
	const address = server.address();
	const bind = typeof address === 'string' ? 'pipe ' + address : 'port ' + port;
	console.log('Listening on ' + bind);
});

io.sockets.on('connection', async (socket) => {
	console.log('Client connected: ' + socket.id);

	// Create user entry in database
	await db.ExecuteSQL(`INSERT INTO sockets(id, room, guessTip) VALUES('${socket.id}', null, null)`);

	socket.on('user-ready', async (data) => {
		const uid = await db.EscapeString(data);
		await db.ExecuteSQL(`UPDATE users SET socket = '${socket.id}' WHERE id = ${uid}`);
	});

	// Create room
	socket.on('create-room', async () => {
		let roomId = await GetRoomOfPlayer(socket.id);
		// Player is already in a game - disconnect them from the game
		if (roomId) {
			await DisconnectPlayerFromRoom(socket.id, roomId);
			await CheckRoomPlayerCount(roomId);
			socket.emit('room-update', false);
			return;
		}

		let maxPlys = 5;

		if (rooms.size > 0) {
			await db.ExecuteSQL(`SELECT conf_val FROM configuration WHERE conf_key = 'ROOM_MAX_COUNT'`).then((v) => {
				maxPlys = parseInt(v[0].conf_val);
			});
			await db.ExecuteSQL(`SELECT id FROM rooms WHERE plyCount < ${maxPlys} AND isStarted = false`).then((v) => {
				if (v.length > 0)
					roomId = v[0].id;
			});

			// A room with space was found
			if (roomId) {
				socket.join(roomId);
				await db.ExecuteSQL(`UPDATE sockets SET room = '${roomId}' WHERE id = '${socket.id}'`);
				const players = rooms.get(roomId);
				players.push(socket.id);
				rooms.set(roomId, players);
				await db.ExecuteSQL(`UPDATE rooms SET plyCount = '${rooms.get(roomId).length}' WHERE id = '${roomId}'`);
				socket.emit('room-update', true);

				if (players.length >= maxPlys) {
					await StartNewGame(roomId);
				}
				return;
			}
		}
		else
			// Delete all unnecessary rooms
			await db.ExecuteSQL('DELETE FROM rooms');

		// Room was not found / creating a new room
		let latestRoomNo = 0;
		if (rooms.size > 0) {
			// Loop through until a free room is found
			while (true) {
				// Check if the first room in the list is 0
				if (Array.from(rooms.keys())[0].split('-')[1] == "0")
					latestRoomNo = parseInt(Array.from(rooms.keys())[rooms.size - 1].split('-')[1]) + 1; // Get the latest int and add 1

				if (rooms.has(`room-${latestRoomNo}`)) {
					// A room with the newly created id already exists
					console.log(`Room room-${latestRoomNo} already exists`);
					socket.emit('room-update', false);
					continue;
				}
				break;
			}
		}

		roomId = `room-${latestRoomNo}`;

		rooms.set(roomId, [socket.id]);

		await db.ExecuteSQL(`UPDATE sockets SET room = '${roomId}' WHERE id = '${socket.id}'`);

		await db.ExecuteSQL(`INSERT INTO rooms(id, drawer, word, plyCount, preppingMatchEnd, endTime) VALUES('${roomId}', null, null, '1', null, null)`);
		socket.join(roomId);
		socket.emit('room-update', true);
	});

	socket.on('getDrawer', async () => {
		const room = await GetRoomOfPlayer(socket.id);
		if (!room) {
			// 1 000 000 possible outcomes
			const randInt = await GetRandomInt(62500);
			socket.emit('drawerRly', randInt.toString(16));
			return;
		}
		const drawer = await GetDrawer(room);
		socket.emit('drawerRly', drawer);
	});
	socket.on('mouse', async (data) => {
		const room = await GetRoomOfPlayer(socket.id);
		const drawer = await GetDrawer(room);
		if (socket.id == drawer) {
			if (data.lineWidth > 100)
				data.lineWidth = 100;
			if (data.lineWidth < 1)
				data.lineWidth = 1;
			socket.to(room).emit('mouse', data);
		}
	});
	socket.on('clearScreen', async () => {
		const room = await GetRoomOfPlayer(socket.id);
		const drawer = await GetDrawer(room);
		if (socket.id != drawer)
			return;

		let clears = 3;
		await db.ExecuteSQL(`SELECT clears FROM rooms WHERE id = '${room}'`).then((v) => {
			clears = v[0].clears;
		});
		clears -= 1;
		if (clears < 0)
			return;
		await db.ExecuteSQL(`UPDATE rooms SET clears = '${clears}' WHERE id = '${room}'`);
		io.to(room).emit('clears-left', clears);
		if (socket.id == drawer)
			await ClearRoomSheet(room);
	});
	socket.on('disconnect', async () => {
		let roomId = await GetRoomOfPlayer(socket.id);
		console.log(`Client ${socket.id} has disconnected`);
		await db.ExecuteSQL(`DELETE FROM sockets WHERE id = '${socket.id}'`);
		if (!roomId)
			return;
		await DisconnectPlayerFromRoom(socket.id);
		await CheckRoomPlayerCount(roomId);
	});

	socket.on('wordGuess', async (data) => {
		const roomId = await GetRoomOfPlayer(socket.id);

		await SendGuessTip(socket.id, roomId, data);

		const word = await GetWordOfRoom(roomId);
		if (word.toLowerCase() !== data.toLowerCase())
			return;
		const highestScore = await db.ExecuteSQL(`SELECT conf_val FROM configuration WHERE conf_key = 'HIGHEST_SCORE'`).then((v) => {
			return v.length > 0 ? parseInt(v[0].conf_val) : 350;
		})
		const position = await db.ExecuteSQL(`SELECT round_score FROM sockets WHERE room = '${roomId}'`).then((v) => {
			let len = 1;
			for (let i = 0; i < v.length; i++) {
				if (v[i].round_score)
					len += 1;
			}
			return len;
		});
		const round_score = parseInt(Math.floor(highestScore / position));
		await db.ExecuteSQL(`UPDATE sockets SET round_score = '${round_score}' WHERE id = '${socket.id}'`);

		// Give drawer their round score
		const drawer = await GetDrawer(roomId);
		const drawer_divide = await db.ExecuteSQL(`SELECT conf_val FROM configuration WHERE conf_key = 'DRAWER_REWARD_DIVIDE'`).then((v) => {
			return v.length > 0 ? parseInt(v[0].conf_val) : 4;
		});
		const drawer_round_score = round_score / drawer_divide;
		await db.ExecuteSQL(`UPDATE sockets SET round_score = '${drawer_round_score}' WHERE id = '${drawer}'`);
	});
});

async function StartNewGame(roomId) {
	const date = new Date();
	let roundTime = null;
	await db.ExecuteSQL(`SELECT conf_val FROM configuration WHERE conf_key = 'ROUND_TIME'`).then((v) => {
		roundTime = v[0].conf_val;
	});
	const endTime = await timeExt.AddSeconds(date, parseInt(roundTime));
	const word = await GetNewWord();

	// Get clears
	let clears = 3;
	await db.ExecuteSQL(`SELECT conf_val FROM configuration WHERE conf_key = 'MAX_CLEARS'`).then((v) => {
		clears = parseInt(v[0].conf_val);
	});

	// Update the room
	await db.ExecuteSQL(`UPDATE rooms SET isStarted = true, word = '${word}', endTime = '${endTime}', clears = '${clears}' WHERE id = '${roomId}'`);

	io.to(roomId).emit('start-game', { word: false, clears: clears });
	const drawer = await SetNewDrawer(roomId);

	await SendGuessTip(roomId, roomId, "");
	// Send guess to drawer to make the word spell out
	await SendGuessTip(drawer, roomId, word);

	io.to(drawer).emit('start-game', { word: word, clears: clears });
}

async function GetWordOfRoom(roomId) {
	let word = await db.ExecuteSQL(`SELECT word FROM rooms WHERE id = '${roomId}'`).then((v) => {
		return v.length > 0 ? v[0].word : null;
	});
	return word;
}

async function GetNewWord() {
	const word = await GetRandomInt(wordList.list.length);
	return wordList.list[word];
}

async function SendGuessTip(to, roomId, guess) {
	let guessTip = "";

	if (!rooms.has(roomId)) {
		console.log(`SendGuessTip: Room not exist '${roomId}'`);
		return;
	}
	// "to" variable is not a server, check if it is a socket
	if (!rooms.has(to)) {
		let userExist = false;
		await db.ExecuteSQL(`SELECT id FROM sockets WHERE id = '${to}'`).then((v) => {
			if (v.length > 0)
				userExist = true;
		});
		if (!userExist) {
			console.log(`SendGuessTip: No socket matches '${to}'`);
			return; // Socket does not exist
		}
	}

	const word = await GetWordOfRoom(roomId);

	await db.ExecuteSQL(`SELECT guessTip FROM sockets WHERE id = '${to}'`).then((v) => {
		if (v.length > 0)
			guessTip = v[0].guessTip;
	});
	if (guessTip)
		guessTip = guessTip.toLowerCase();
	guessTip = await wordExt.GetWordTip(guess.toLowerCase(), word.toLowerCase(), guessTip);
	await db.ExecuteSQL(`UPDATE sockets SET guessTip = '${guessTip.stripped}' WHERE id = '${to}'`);
	io.to(to).emit('guessAns', guessTip.guessTip);
}

async function DisconnectPlayerFromRoom(player, roomId = null) {
	// A room was not provided
	if (!roomId)
		roomId = await GetRoomOfPlayer(player);
	// Player is not in a room
	if (!roomId)
		return;
	const room = rooms.get(roomId);
	room.splice(room.indexOf(player), 1);

	let drawer = null;
	await db.ExecuteSQL(`SELECT drawer FROM rooms WHERE id = '${roomId}'`).then((v) => {
		drawer = v[0].drawer;
	});

	if (player == drawer) {
		await ClearRoomSheet(roomId);
		await SetNewDrawer(roomId);
	}

	const socket = io.sockets.sockets.get(player);

	if (!socket)
		return;

	await db.ExecuteSQL(`UPDATE sockets SET room = null WHERE id = '${socket.id}'`);

	socket.leave(roomId);

	await db.ExecuteSQL(`UPDATE rooms SET plyCount = '${room.length}' WHERE id = '${roomId}'`);
	console.log(`${player} left room ${roomId}`);

	io.to(player).emit('clearScreen');
	io.to(player).emit('room-update', false);
}

async function SetNewDrawer(roomId) {
	const players = rooms.get(roomId);
	const drawer = players[await GetRandomInt(players.length)];
	io.to(drawer).emit('drawerRly', drawer);
	await ClearRoomSheet(roomId);
	await db.ExecuteSQL(`UPDATE rooms SET isStarted = true, drawer = '${drawer}', preppingMatchEnd = null WHERE id = '${roomId}'`);
	return drawer;
}

async function CheckRoomPlayerCount(roomId) {
	if (!rooms.has(roomId))
		return;
	const room = rooms.get(roomId);
	if (room.length > 1)
		return;

	for (const player of rooms.get(roomId)) {
		await DisconnectPlayerFromRoom(player, roomId);
	}

	rooms.delete(roomId);
	await db.ExecuteSQL(`DELETE FROM rooms WHERE id = '${roomId}'`);
	io.to(roomId).emit('room-update', false);
	console.log(`Room ${roomId} was destroyed due to not enough players`);
}

async function GetRandomInt(max) {
	return Math.floor(Math.random() * max);
}

async function GetRoomOfPlayer(player) {
	for (const [key, value] of rooms.entries()) {
		if (value.includes(player))
			return key;
	}
}

async function ClearRoomSheet(roomId) {
	io.to(roomId).emit('clearScreen');
}

async function GetDrawer(room) {
	let drawer = null;
	await db.ExecuteSQL(`SELECT drawer FROM rooms WHERE id = '${room}'`).then((v) => {
		if (v.length > 0)
			drawer = v[0].drawer;
	});
	return drawer;
}

async function EndRound(roomId) {
	// Do sum up round scores
	await db.ExecuteSQL(`SELECT id, round_score, score FROM sockets WHERE room = '${roomId}'`).then(async (v) => {
		for (let i = 0; i < v.length; i++) {
			const socket = v[i];
			const score = (socket.round_score ? parseInt(socket.round_score) : 0) + parseInt(socket.score);
			console.log(score);
			await db.ExecuteSQL(`UPDATE sockets SET round_score = null, score = '${score}', guessTip = null WHERE id = '${socket.id}'`);
		}
	});

	io.to(roomId).emit('time-up');
	io.to(roomId).emit('time-update', 0);
	const word = await GetWordOfRoom(roomId);
	io.to(roomId).emit('guessAns', word.toUpperCase());
	let preppingMatchEnd = await timeExt.AddSeconds(new Date(), 8);
	await db.ExecuteSQL(`UPDATE rooms SET drawer = null, endTime = null, preppingMatchEnd = '${preppingMatchEnd}' WHERE id = '${roomId}'`);
}

async function SendTimeToRooms() {
	await db.ExecuteSQL(`SELECT id, word, endTime, preppingMatchEnd FROM rooms WHERE isStarted = true`).then(async (v) => {
		for (let i = 0; i < v.length; i++) {
			const room = v[i];
			if (!rooms.has(room.id))
				return;
			const timeLeft = await timeExt.GetTimeDiff(new Date().getTime(), parseInt(room.endTime));
			if (timeLeft < 0) {
				EndRound(room.id);
				continue;
			}
			io.to(room.id).emit('time-update', timeLeft);
		}
	});
}

async function RoomMaintenance() {
	await db.ExecuteSQL(`SELECT id, word, endTime, preppingMatchEnd FROM rooms WHERE isStarted = true`).then(async (v) => {
		for (let i = 0; i < v.length; i++) {
			const room = v[i];
			if (!rooms.has(room.id))
				return;

			if (!room.preppingMatchEnd) {
				const allGuessed = await db.ExecuteSQL(`SELECT round_score FROM sockets WHERE room = '${room.id}'`).then(async (v) => {
					if (v.length <= 0)
						return false;
					for (let i = 0; i < v.length; i++) {
						if (v[i].round_score == null)
							return false;
					}
					return true;
				});

				if (allGuessed)
					await EndRound(room.id);
				continue;
			}

			const prepTimeDiff = await timeExt.GetTimeDiff(new Date().getTime(), room.preppingMatchEnd);
			if (prepTimeDiff < 0) {
				await db.ExecuteSQL(`UPDATE rooms SET preppingMatchEnd = null WHERE id = '${room.id}'`);
				await StartNewGame(room.id);
			}
		}
	});
}

setInterval(async () => {
	await SendTimeToRooms();
	await RoomMaintenance();
}, 1000);

server.listen(port);