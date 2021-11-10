var drawing = false;
var context;
let currDraw;
let ig;

const socket = io.connect('http://127.0.0.1:3000', { origins: 'localhost:* http://127.0.0.1:* http://www.127.0.0.1:*' });

const canvasName = "drawingCanvas";

window.onload = function () {
    const disIdElement = document.getElementById('dsid');
    const uid = disIdElement.innerHTML;
    disIdElement.parentNode.removeChild(disIdElement);

    socket.emit('user-ready', uid);

    //Size Canvas
    context = document.getElementById(canvasName).getContext("2d");
    context.canvas.width = window.innerWidth;
    context.canvas.height = window.innerHeight - 60;

    //Mouse movement
    document.onmousemove = HandleMouseMove;
    document.onmousedown = HandleDown;
    document.onmouseup = HandleUp;

    //Style line
    ResetContext();

    socket.on('start-game', (data) => {
        ResetContext();
        if (data.word)
            document.getElementById('word').innerHTML = `Draw: ${data.word}`;
        else document.getElementById('word').innerHTML = null;
        document.getElementById('btnClear').innerHTML = `Clear (${data.clears})`;
    });

    socket.on('room-update', (data) => {
        ig = data;
        if (ig) {
            document.getElementById('btnJoinRoom').innerText = "Leave Game";
            return;
        }
        document.getElementById('btnJoinRoom').innerText = "Join Game";
        document.getElementById('wordTp').innerHTML = null;
        ResetContext();
    });

    socket.on('clears-left', (data) => {
        document.getElementById('btnClear').innerHTML = `Clear (${data})`;
    });

    // Callback function
    socket.on('mouse', data => {
        context.lineWidth = document.getElementById('lineWidth').value = data.lineWidth;
        context.lineJoin = "round";
        context.strokeStyle = document.getElementById('colorChange').value = data.strokeStyle;
        if (data.drawing) {
            context.lineTo(data.x, data.y);
            context.stroke();
            context.moveTo(data.x, data.y);
            context.closePath();
        }
        else {
            context.moveTo(data.x, data.y);
            context.beginPath();
        }
    });
    socket.on('drawerRly', data => {
        const oldDraw = currDraw;
        currDraw = data;
        if (currDraw != socket.id) {
            document.getElementById('btnClear').enabled = false;
            document.getElementById('lineWidth').disabled = true;
            document.getElementById('colorChange').disabled = true;
            return;
        }
        if (oldDraw != currDraw)
            ResetContext();
        document.getElementById('btnClear').enabled = true;
        document.getElementById('lineWidth').disabled = false;
        document.getElementById('colorChange').disabled = false;
    });
    socket.on('clearScreen', () => {
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    });
    socket.on('time-update', (data) => {
        document.getElementById('timeLeft').innerHTML = `Time: ${data}`;
    });
    socket.on('guessAns', (data) => {
        console.log(data);
        document.getElementById('wordTp').innerHTML = data;
    });

    // Clear Button
    document.getElementById('btnClear').addEventListener('click', function () {
        if (socket.id != currDraw)
            return;
        socket.emit('clearScreen', socket.id);
    }, false);

    // Back Button
    document.getElementById('btnBack').addEventListener('click', function () {
        document.getElementById(canvasName).style.display = "block";
        document.getElementById('saveArea').style.display = "none";
        document.getElementById('tools').style.display = "block";
    }, false);

    // Width Scale
    document.getElementById('lineWidth').addEventListener('change', function () {
        context.lineWidth = document.getElementById('lineWidth').value;
    }, false);

    // Color
    document.getElementById('colorChange').addEventListener('change', function () {
        context.strokeStyle = document.getElementById('colorChange').value;
    }, false);

    // Save
    document.getElementById('btnSave').addEventListener('click', function () {
        document.getElementById(canvasName).style.display = "none";
        document.getElementById('saveArea').style.display = "block";
        document.getElementById('tools').style.display = "none";

        var dataURL = document.getElementById(canvasName).toDataURL();
        document.getElementById('canvasImg').src = dataURL;
    }, false);

    // Join Room
    document.getElementById('btnJoinRoom').addEventListener('click', function () {
        socket.emit('create-room');
    }, false);

    document.getElementById('guessInput').addEventListener('keydown', function (e) {
        if (e.keyCode != 13)
            return;
        socket.emit('wordGuess', document.getElementById('guessInput').value);
        document.getElementById('guessInput').value = null;
    });

    // Hide Save Area
    document.getElementById('saveArea').style.display = "none";
}

function SendMouse(x, y) {
    const data = {
        lineWidth: context.lineWidth,
        strokeStyle: context.strokeStyle,
        x: x,
        y: y,
        cw: window.innerWidth,
        ch: window.innerHeight,
        drawing: drawing
    }
    socket.emit('mouse', data);
}

function HandleMouseMove(e) {
    //const pos = getTransformedPoint(e.clientX, e.clientY);
    if (socket.id != currDraw)
        return;
    drawing = (e.target.id != canvasName) ? false : drawing;
    if (drawing) {
        context.lineTo(e.clientX, e.clientY);
        context.stroke();
        context.moveTo(e.clientX, e.clientY);
        context.closePath();
    } else {
        context.moveTo(e.clientX, e.clientY);
    }
    SendMouse(e.clientX, e.clientY);
}

function HandleDown(e) {
    if (e.buttons != 1 || socket.id != currDraw)
        return;
    drawing = true;
    context.moveTo(e.clientX, e.clientY);
    context.beginPath();
}

function HandleUp() {
    drawing = false;
}

function GetTransformedPoint(x, y) {
    const transform = context.getTransform();
    const invertedScaleX = 1 / transform.a;
    const invertedScaleY = 1 / transform.d;
    const transformedX = invertedScaleX * x - invertedScaleX * transform.e;
    const transformedY = invertedScaleY * y - invertedScaleY * transform.f;
    return { x: transformedX, y: transformedY };
}

function ScreenResized() {
    const oldStyle = context.strokeStyle;
    const oldLine = context.lineWidth;
    context.canvas.width = window.innerWidth;
    context.canvas.height = window.innerHeight - 60;
    context.strokeStyle = oldStyle;
    context.lineWidth = oldLine;
}

function ResetContext() {
    document.getElementById('word').innerHTML = null;
    document.getElementById('timeLeft').innerHTML = null;
    context.strokeStyle = document.getElementById('colorChange').value = "#000";
    context.lineJoin = "round";
    context.lineWidth = document.getElementById('lineWidth').value = 5;
}

addEventListener("resize", ScreenResized, false);

setInterval(() => {
    if (socket.id)
        socket.emit('getDrawer', socket.id);
}, 1050);