const WebSocketServer = require('ws').Server;
const http = require('http');
const os = require('os');
// const url = require('url');
// const fs = require('fs');
// const path = require('path');

const Game = require('./game');
const Player = require('./player');

const ip = require('./ip');
const IP = ip.addrs[0] || '127.0.0.1';

// const http_port = process.argv[2] || 8000;
const PORT = 27016;


class WSServer {
    constructor (ip, port) {
        this.ip = ip;
        this.port = port;
    }

    init() {
        this.PASSCODE = this.generatePasscode();
        
        this.noOfConnections = 0;
        this.clients = [];
    }
    
    start () {
        log('Starting...');
        this.init();

        var wServer = http.createServer((req, res) => {});
        // wServer.listen(this.port, () => log(`Listening on port ${this.port}`));
        wServer.listen(this.port);

        this.wsServer = new WebSocketServer({
            server: wServer
        });

        let that = this;
        this.wsServer.on('connection', function(self, request) {

            // log(that.noOfConnections);
            if (that.noOfConnections < 2) {
                let uid = that.generateUID();
                that.clients.push([uid, self, 'Player 1']); //?
                that.noOfConnections++;
                self.playerNo = that.noOfConnections;

                if (that.noOfConnections == 1) {
                    log('Player 1 joined.');
                    self.on('message', function (message) {
                        message = that.parse(message); // unnecessary?
                        // log(`Player ${self.playerNo}: ${JSON.stringify(message)}`);
                        
                        if (message === 'NEW') {
                            self.send(JSON.stringify({'intent': 'PASS', 'data': that.PASSCODE, 'uid': uid}));
                        } else if (message.intent === 'NAME') {
                            that.clients[0][2] = message.data;
                            log(`Player 1 changed his name to ${message.data}.`);
                            // start game
                            if (that.clients.length == 2 && that.clients[1].length == 3)
                                that.startGame();
                        }
                    });

                    self.on('close', function() {
                        // leader left
                        try {
                            log(`${that.clients[0][2]} left.`)
                            that.init();
                            that.clients[1][1].send(JSON.stringify({'intent': 'FAIL', 'data': 'Game does not exist.'}));
                            that.clients[1][1].close();  // that too -_- ("that" XD)
                            // that.noOfConnections--;
                        } catch (e) {}
                    });
                } else {
                    log('Player 2 joining...');
                    that.clients[1][2] = 'Player 2';
                    self.on('message', function(message) {
                        message = that.parse(message);
                        // log(`Player ${self.playerNo}: ${JSON.stringify(message)}`);
                        
                        if (message === 'NEW') {  // *yes* possible
                            self.send(JSON.stringify({'intent': 'FAIL', 'data': 'Game already created (try joining maybe?)'}));
                            that.clients.pop();
                            that.noOfConnections--;
                            self.close();
                        } else if (message.intent === 'PASS') {
                            if (message.data === that.PASSCODE) {
                                log('Player 2 joined');
                                self.send(JSON.stringify({'intent': 'AUTH', 'uid': uid}));
                            } else {
                                log('Wrong passcode');
                                self.send(JSON.stringify({'intent': 'FAIL', 'data': 'Wrong passcode'}));
                                log('Player 2 left.');
                                self.close();
                                that.noOfConnections--;
                                that.clients.pop();
                            }
                        } else if (message.intent === 'NAME') {
                            that.clients[1][2] = message.data;
                            log(`Player 2 changed his name to ${message.data}.`);
                            // start game
                            if (that.clients[0].length == 3)
                                that.startGame();
                        }
                    });

                    self.on('close', function() {
                        // player left
                        // do nothing
                        try {
                            that.noOfConnections--;
                            log(`${that.clients[1][2]} left.`);
                            that.clients.pop();
                            // that.clients[0][1].send('Disconnected: Your opponent left.'); // srsly?
                            // that.clients[0][1].close();
                            // that.init();
                        } catch(e) {}
                    });
                }
            } else {
                self.send(JSON.stringify({'intent': 'FAIL', 'data': 'Server full.'}));
                self.close();
                /*self.on('message', message => log("viewer said " + message));
                self.on('close', () => log("viewer disconnected"));*/
            }
        });
        log('Waiting for players...');
    }

    parse(str) {
        try {
            return JSON.parse(str);
        } catch (e) {
            return str;
        }
    }

    generatePasscode() {
        return this.encodeIP(this.ip) + this.generateUID(4);
    }

    encodeIP(ip) {
        const hex = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'];
        const bytes = ip.split('.').map(x => parseInt(x));
        let res = '';
        bytes.forEach(n => {
            res += hex[n >> 4] + hex[n % 16];
        });
        return res;
    }

    generateUID(length) {
        const n = typeof(length) === "undefined" ? 32 : length;
        const chars = "qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM1234567890_";

        let res = "";
        for (let i = 0; i < n; i++)
            res += chars[(63 * Math.random()) << 0];
        return res;
    }

    startGame() {
        let players = [];
        this.clients.forEach(client => {
            client[1].send(JSON.stringify({'intent': 'START'}));
            players.push(new Player(client[2], client[1], client[0]));
        })
        let game = new Game(this, players);
        log('Starting game...');
        game.start();
    }
}


function log(...l) {
    l.forEach(x => console.log(x));
}


let wsServer = new WSServer(IP, PORT);
wsServer.start();

// open game
const cmd = {
    'darwin': 'open',
    'linux': 'xdg-open',
    'win32': 'start'
}[os.platform()];
if (cmd) {
    const {exec} = require('child_process');
    exec(`${cmd} .\\static\\index.html`, (err, stdout, stderr) => {
        if (err) {
            log(err);
            log(stderr);
            return
        }
        log(stdout);
    });
}

/*
http.createServer(function (req, res) {
    req.url = `/static${req.url}`;
    console.log(`${req.method} ${req.url}`);
  
    // parse URL
    const parsedUrl = url.parse(req.url);
    // extract URL path
    let pathname = `.${parsedUrl.pathname}`;
    // based on the URL path, extract the file extention. e.g. .js, .doc, ...
    let ext = path.parse(pathname).ext;
    // maps file extention to MIME typere
    const map = {
        '.ico': 'image/x-icon',
        '.htm': 'text/html',
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.json': 'application/json',
        '.css': 'text/css',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.wav': 'audio/wav',
        '.mp3': 'audio/mpeg',
        '.svg': 'image/svg+xml',
        '.pdf': 'application/pdf',
        '.doc': 'application/msword'
    };
  
    fs.exists(pathname, function (exist) {
        if(!exist) {
            // if the file is not found, return 404
            res.statusCode = 404;
            res.end(`File ${pathname} not found!`);
            return;
        }
  
        // if is a directory search for index file matching the extention
        if (fs.statSync(pathname).isDirectory()) {
            pathname += '/start.html'// + ext;
            ext = '.html'
        }
  
        // read file from file system
        fs.readFile(pathname, function(err, data){
            if(err){
                res.statusCode = 500;
                res.end(`Error getting the file: ${err}.`);
            } else {
                // if the file is found, set Content-type and send data
                res.setHeader('Content-type', map[ext] || 'text/plain' );
                res.end(data);
            }
        });
    });
}).listen(parseInt(http_port));
  
console.log(`Server listening on port ${http_port}`);
*/