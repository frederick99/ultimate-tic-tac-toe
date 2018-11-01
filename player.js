class Player {
    static get playerCount() { return Player.playerCount; }
    static set playerCount(val) {Player.playerCount = val;}

    constructor (name, socket, uid) {
        this.playerCount++;
        this.name = name || 'Player' + this.playerCount;
        this.socket = socket;
        this.game = null;
        this.uid = uid;
        this.recv = false;
        this.wantsToPlayAgain = false;

        this.socket.off('message', this.socket.listeners('message')[0]);
        this.socket.on('message', message => {
            message = JSON.parse(message);
            // console.log(message);
            if (message.intent == 'MOVE') {
                if (this.recv/* && message.sign == this.sign*/) {
                    this.recv = false;
                    let move = message.data;
                    this.game.play(move);
                }
            } else if (message.intent == 'NAME') {
                console.log(`${this.name} changed his name to ${message.data}`);
                this.name = message.data;
                this.game.broadcastPlayerInfo();
            } else if (message.intent == 'AGAIN') {
                // console.log(`${this.name} wants to play again...`);
                this.wantsToPlayAgain = true;
                this.game.restart(this);
            } else if (message.intent == 'CLOSE') {
                this.wantsToPlayAgain = false;
                this.game.abandon(this);
            }
        });
        this.socket.on('close', () => {
            this.wantsToPlayAgain = false;
            this.game.abandon(this);
        });
    }

    play() {
        this.send(JSON.stringify({'intent': 'PLAY'}));
        this.receive();
    }

    send(message) {
        if (typeof message === "object" || message instanceof Object)
            message = JSON.stringify(message);
        if (typeof message === "string" || message instanceof String)
            this.socket.send(message);
        else console.log('Error: i can only send strings :|');
    }

    receive() {
        this.recv = true;
    }
}

module.exports = Player;