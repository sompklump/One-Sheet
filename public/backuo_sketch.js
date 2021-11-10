let color = '#000'
let strokeWidth
let cv
let cd

const uname = "klump"

// Start the socket connection
const socket = io.connect('http://127.0.0.1:3000')

function setup() {
	container = document.getElementById('container');
	width = container.offsetWidth;
	cv = createCanvas(width, 450);
	console.log(cv);
	cv.parent("container");
	// Creating canvas

	// Callback function
	socket.on('mouse', data => {
		stroke(data.color)
		strokeWeight(data.strokeWidth)
		line(data.x, data.y, data.px, data.py)
	})
	socket.on('drawerRly', data => {
		cd = data
	})
}

function mouseDragged() {
	if (uname != cd)
		return
	// Draw
	stroke(color)
	if (strokeWidth > 100)
		strokeWidth = 100
	if (strokeWidth < 1)
		strokeWidth = 1
	strokeWeight(strokeWidth)
	line(mouseX, mouseY, pmouseX, pmouseY)

	// Send the mouse coordinates
	sendMouse(mouseX, mouseY, pmouseX, pmouseY)
}

// Sending data to the socket
function sendMouse(x, y, pX, pY) {

	const data = {
		username: uname,
		user: socket.id,
		x: x,
		y: y,
		px: pX,
		py: pY,
		color: color,
		strokeWidth: strokeWidth,
	}
	socket.emit('mouse', data)
}

function dataChange(data) {
	switch (data.id) {
		case "color-picker":
			color = data.value
			break
		case "stroke-width-picker":
			strokeWidth = parseInt(data.value)
			break
		default:
			break
	}
}
const frameRate = 30;
setInterval(() => {
	socket.emit('getDrawer');
}, 3500 / frameRate);

function windowResized() {
	resizeCanvas(windowWidth, windowHeight);
}
