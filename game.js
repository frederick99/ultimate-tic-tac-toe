const Player = require('./player');

class Game {
    constructor(server, players) {
        this.board = null;
        this.miniBoard = null;
        this.players = players;
        this.players.forEach(player => {
            player.game = this;
        });
        this.server = server;

        this.init();
        this.broadcastPlayerInfo();
    }

    init() {
        this.board = this.newBoard(9);
        this.miniBoard = this.newBoard(3);
        this.turn = Math.floor(2 * Math.random());
        this.lastMove = null;
        this.isOver = false;
        this.players.forEach(player => {
            player.wantsToPlayAgain = false;
        })
    }

    get player() {
        return this.players[this.turn];
    }

    get opponent() {
        return this.players[1 - this.turn];
    }

    start() {
        console.log('Game started.');
        this.player.send(JSON.stringify({'intent':'MARK', 'data':'O'}));
        this.opponent.send(JSON.stringify({'intent': 'WAIT'}));
        this.step();
    }

    step() {
        // console.log(`${this.player.name}'s turn...`)
        this.player.play();
    }

    play(move) {
        // console.log(`${this.player.name} moved ${move}.`)
        let oldMove = move;
        move = this.demux(move);
        const i = move[0]*3 + move[2],
            j = move[1]*3 + move[3];
        if (this.isValid(move, i, j)) {
            this.board[i][j] = this.turn;
            this.lastMove = move;
        } else {
            this.player.send(JSON.stringify({'intent':'INVALID'}));
            this.player.play();
            return;
        }
        this.players.forEach(player => {
            player.send({'intent': 'MOVE', 'data': oldMove, 'uid': this.player.uid, 'miniBoard': this.miniBoard});
        });
        
        if (!this.won9_9()) {
            // check for a draw
            if (this.isDraw()) {
                console.log('Game over. It\'s a draw.');
                this.players.forEach(p => p.send({'intent': 'DRAW'}));
                this.server.init();
                return;
            }
            this.turn = 1 - this.turn;
            this.step();
        } else {
            this.over();
        }
    }

    won9_9() {
        // inefficient - don't check all 9 boxes; only the one affected by the last move
        for (let i = 0; i < 3; i++)
            for (let j = 0; j < 3; j++)
                if (this.won3_3(3*i, 3*j, this.board))
                    this.miniBoard[i][j] = this.turn;
                else
                    this.miniBoard[i][j] = -1;
        this.players.forEach(p => p.send({'intent': 'MINIB', 'data': this.miniBoard}));
        return this.won3_3(0, 0, this.miniBoard);
    }

    won3_3(i, j, board) {
        return (
            (board[i+0][j+0] == this.turn && board[i+1][j+0] == this.turn && board[i+2][j+0] == this.turn) ||
            (board[i+0][j+1] == this.turn && board[i+1][j+1] == this.turn && board[i+2][j+1] == this.turn) ||
            (board[i+0][j+2] == this.turn && board[i+1][j+2] == this.turn && board[i+2][j+2] == this.turn) ||

            (board[i+0][j+0] == this.turn && board[i+0][j+1] == this.turn && board[i+0][j+2] == this.turn) ||
            (board[i+1][j+0] == this.turn && board[i+1][j+1] == this.turn && board[i+1][j+2] == this.turn) ||
            (board[i+2][j+0] == this.turn && board[i+2][j+1] == this.turn && board[i+2][j+2] == this.turn) ||

            (board[i+0][j+0] == this.turn && board[i+1][j+1] == this.turn && board[i+2][j+2] == this.turn) ||
            (board[i+0][j+2] == this.turn && board[i+1][j+1] == this.turn && board[i+2][j+0] == this.turn)
        );
    }

    isDraw() {
        // can be done efficiently - maybe
        for (let i = 0; i < 3; i++)
            for (let j = 0; j < 3; j++)
                if (this.miniBoard[i][j] == -1)
                    return false;
        return true;
    }

    over() {
        this.isOver = true;
        console.log(`Game over. ${this.player.name} won.`);
        this.players.forEach(player => {
            player.send(JSON.stringify({'intent': 'OVER', 'winner': this.player.uid}));
        });
        // reset server for another game
        // this.server.init();
    }

    restart(player) {
        console.log(`${player.name} wants to play again.`);

        let p1, p2;
        if (player.uid == this.players[0].uid) {
            [p1, p2] = this.players;
        } else {
            [p2, p1] = this.players;
        }
        if (p1.wantsToPlayAgain && p2.wantsToPlayAgain) {
            this.players.forEach(p => p.send({'intent': 'ACCEPT'}));
            this.init();
            this.start();
        } else p2.send({'intent': 'AGAIN'});
    }

    abandon(player) {
        let p1, p2;
        if (player.uid == this.players[0].uid) {
            [p1, p2] = this.players;
        } else {
            [p2, p1] = this.players;
        }
        console.log(`${p1.name} left.`);
        // p1.socket.close();  // use socket.onclose
        // console.log(`Closing connection to ${p2.name}`);
        try {
            p2.send(JSON.stringify({'intent': 'CLOSE', 'data': 'Your opponent left.'}));
        } catch (e) {}
        // p2.socket.close();

        // reset server for another game
        this.server.init();
    }

    isValid(move, i, j) {
        if (!this.lastMove) return true;
        return move[0] == this.lastMove[2] && move[1] == this.lastMove[3] && this.board[i][j] == -1;
    }

    newBoard(n) {
        var board = [];
        for (let i = 0; i < n; i++) {
            let row = [];
            for (let j = 0; j < n; j++)
                row.push(-1);
            board.push(row);
        }
        return board;
    }

    demux(move) {
        let res = [];
        for (let i = 0; i < 4; i++) {
            res.push(move % 4);
            move >>= 2;
        }
        return res.reverse();
    }

    mux(move) {
        return move.reduce((a, b) => (a << 2) + b, 0);
    }

    printBoard(board) {
        board.forEach(row => console.log(row.join(' ')));
    }

    broadcastPlayerInfo() {
        this.players.forEach(player => {
            player.send({
                'intent': 'NAME',
                'data': [
                    {
                        'uid': this.players[0].uid,
                        'name': this.players[0].name
                    },
                    {
                        'uid': this.players[1].uid,
                        'name': this.players[1].name
                    }
                ]
            });
        });
    }
}

module.exports = Game;