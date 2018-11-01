(function() {

  window.WebSocket = window.WebSocket || window.MozWebSocket;

  $('.button.play').click(function () {
    $('section.start').removeClass('visible');
    $('section.play').addClass('visible');
  });
  $('.button.about').click(function () {
    $('section.start').removeClass('visible');
    $('section.about').addClass('visible');
  });
  $('.button.rules').click(function () {
    $('section.visible').removeClass('visible');
    $('section.rules').addClass('visible');
  });
  $('.button.back').click(function () {
    // $('section.visible').removeClass('visible');
    // $('section.start').addClass('visible');
    backToHome();
  })
  $('.button.exit').click(function () {
    $('section.start').removeClass('visible');
    $('section.exit').addClass('visible');
    $('.button.really-exit').click(function () {
      close();
    });
  });

  const PORT = 27016;
  var ip;
  var server;
  var uid;
  var mark = 'X', markClass = 'ex';
  var info = {
    'self': {
      'uid': '',
      'name': 'Player'
    },
    'other': {
      'uid': '',
      'name': 'Player'
    }
  };
  var popUpID, serverCheckerID;
  const modalWrapper = $('.modal-wrapper');
  const modals = $('.modal');
  const menuButton = $('.menu-button');
  // new game
  $('.button.newgame').click(function () {
    let promise = new Promise(function(resolve, reject) {
      // ask local server to create game
      ip = `ws://127.0.0.1:${PORT}`;
      server = new WebSocket(ip);

      server.onmessage = function (message) {
        message = parse(message.data);
        // log(message);
        if (message.intent == 'PASS') {
          $('.newgame .passcode').text(message.data);
          uid = message.uid;
          sendName();
          $('.waiting').text('waiting...');
        } else if (message.intent == 'FAIL') {
          showError(message.data);
          $('.newgame .button.back').text('Back');
        } else if (message.intent == 'START' && uid) {
          startGame();
        }
      };

      server.onopen = function() {
        log('Connected.');
        server.send('NEW');
      };
    });
    serverCheckerID = setTimeout(function () {
      if (server.readyState == 3) showError('Cannot connect to game server.');
    }, 5000);
    $('section.visible').removeClass('visible');
    $('section.newgame').addClass('visible');
  });
  $('section.newgame .button.back').click(function () {
    let promise = new Promise(function(resolve, reject) {
      // ask local server to destroy created game
      try {
        server.send(JSON.stringify({'intent': 'CLOSE'}));
      } catch (e) {}
    });
    $('section.visible').removeClass('visible');
    $('section.play').addClass('visible');
  });

  // join game
  $('.button.joingame').click(function () {
    $('section.visible').removeClass('visible');
    $('section.joingame').addClass('visible');
  });
  $('section.joingame input#pw').on('change paste keyup', function () {
    $('section.joingame .button.join').text('Join');
  });
  $('section.joingame .button.back').click(function () {
    $('section.visible').removeClass('visible');
    $('section.play').addClass('visible');
  });

  $('section.joingame .button.join').click(function () {
    let promise = new Promise(function(resolve, reject) {
      // join  game server
      let passcode = $('#pw').val();
      [ip, pw] = extract(passcode);

      server = new WebSocket(`ws://${ip}:${PORT}`);
      server.onmessage = function(message) {
        message = parse(message.data);
        // log(message);
        if (message.intent == 'AUTH') {
          uid = message.uid;
          sendName();
        } else if (message.intent == 'FAIL') {
          showError(message.data);
          $(this).text('Join');
        } else if (message.intent == 'START' && uid) {
          startGame();
        }
      };
      server.onopen = function() {
        log('connected.');
        server.send(JSON.stringify({intent: 'PASS', data: passcode}));
      };
    });
    serverCheckerID = setTimeout(function () {
      if (server.readyState == 3) showError('Server not responding.');
    }, 5000);

    $(this).text('Joining...').addClass('joining');
  });

  function sendName() {
    // ask for name here
    showModal('get-name');
    $('.modal.get-name .button').click(function () {
      var name = $('.modal.get-name input#get-name').val();
      if (!name) {
        popUp('Your name can\'t be .');
      } else {
        server.send(JSON.stringify({intent: 'NAME', data: name}));
        $('.modal.get-name').removeClass('visible');
        modalWrapper.removeClass('visible');
      }
    });
  }

  function startGame() {

    // $('.game').css('height', Math.min(window.innerHeight, window.innerWidth))
    $('section.visible').removeClass('visible');
    $('section.game').addClass('visible');

    let canMove = false;
    let lastMove = -1;
    let prevMove = null;
    // let lastHaloPos = null;
    let gameOver = false;

    server.onmessage = function(message) {
      message = parse(message.data);
      // log(message);

      if (message.intent == 'MOVE') {
        let move = message.data;
        if (uid != message.uid){
          // update board
          move = demux(move);
          prevMove = move;
          let i = 27*move[0] + 9*move[2] + 3*move[1] + move[3];
          $('.cell').eq(i).find('span').addClass(markToClass('other'));
          // log(`${i}th cell is marked ${markToClass('other')}`);
        } else {
          if (lastMove > 0 && move != lastMove) { // verify last move?
            // smth's up
            log('Something\'s not right. (msg.intent: MOVE)');
            lastMove = -1;
          }
        }
      } else if (message.intent == 'PLAY') {
        // get move from board
        popUp('It\'s your turn.');
        canMove = true;
        $('.board').addClass(markClass);
        showHalo(prevMove, true);
        $('.cell').off('click');
        $('.cell:not(.ex):not(.oh)').on('click', function () {
          if (canMove) {
            canMove = false;
            $('.board').removeClass(markClass);
            let i = $(this).index()-1;
            let big_row = (i/27) << 0;
            let big_col = ((i%9)/3) << 0;
            let small_row = ((i-27*big_row)/9) << 0;
            let small_col = (i-27*big_row-9*small_row) % 3;
            let currMove = [big_row, big_col, small_row, small_col];
            if (prevMove == null || currMove[0] == prevMove[2] && currMove[1] == prevMove[3]) {
              // hideHalo();
              showHalo(currMove, false);
              $('.cell').eq(i).find('span').addClass(markToClass('self'));
              // log(`${i}th cell is marked ${markToClass('self')}`);
              let move = mux(currMove);
              server.send(JSON.stringify({'intent': 'MOVE', 'data': move}));
              prevMove = currMove;
              lastMove = move;
            } else {
              popUp('That\'s not a valid move.');
              canMove = true;
              $('.board').addClass(markClass);
            }
          }
        });
      } else if (message.intent == 'MARK') {
        if (message.data == 'O') {
          mark = 'O';
          markClass = 'oh';
          $('.game .board').removeClass('ex').addClass('oh');
        }
      } else if (message.intent == 'WAIT') {
        // opponent's turn
        showHalo(prevMove, false);
        popUp(`${info.other.name}'s turn.`);
      } else if (message.intent == 'NAME') {
        var players = message.data;
        players.forEach(player => {
          if (player.uid == uid) info.self = player;
          else info.other = player;
        });
      } else if (message.intent == 'MINIB') {
        let mb = message.data;
        for (let i = 0; i < 3; i++)
          for (let j = 0; j < 3; j++) {
            let n = 3*i + j;
            let c = ['oh', 'ex'][mb[i][j]];
            $('.box-results .box').eq(n).addClass(c);
          }
      }else if (message.intent == 'INVALID') {
        // undo prev move
        let i = 27*move[0] + 9*move[2] + 3*move[1] + move[3];
        $('.cell').eq(i).find('span').removeClass(markToClass('self'));
        popUp('That\'s not a valid move.');
      } else if (message.intent == 'FAIL') {
        showError(message.data);
      } else if (message.intent == 'OVER') {
        gameOver = true;
        hideHalo();
        if (uid == message.winner) {
          showModal('results.won');
        } else {
          showModal('results.lost');
        }
      } else if (message.intent == 'DRAW') {
        gameOver = true;
        showModal('results.draw');
      } else if (message.intent == 'AGAIN') {
        popUp(`${info.other.name} wants to play again.`, -1);
        $('.modal.results .button.play-again').addClass('glow');
      } else if (message.intent == 'ACCEPT') {
        resetGame();
        startGame();
      } else if (message.intent == 'CLOSE') {
        if (!gameOver) {
          log(message.data);
          showModal('results.abandoned');
          server.onmessage = undefined;
        } else {
          // disable play again
          popUp(`${info.other.name} left`);
          $('.modal.results .button.play-again').addClass('disabled');
        }
      }
    };
  }

  function resetGame() {
    $('.popUp').removeClass('show');
    hideModal();
    clearBoard();
    // reset this page vars
    clearTimeout(popUpID);
    clearTimeout(serverCheckerID);
    mark = 'X';
    markClass = 'ex';
    popUpID = undefined;
    serverCheckerID = undefined;

    // other stuff
    $('.modal.results .button.play-again').text('Play again').removeClass('glow disabled');
    $('section.joingame .button.join').text('Join').removeClass('joining');
    $('.waiting').text('connecting...');
  }

  function backToHome() {
    try {
      server.onmessage = undefined;
      server.send(JSON.stringify({'intent':'CLOSE'}));
    } catch (e) {}
    resetGame();
    ip = undefined;
    server = undefined;
    uid = undefined;
    info = {'self': {'uid': '', 'name': 'Player'}, 'other': {'uid': '', 'name': 'Player'}};
    $('section.visible').removeClass('visible');
    $('section.start').addClass('visible');
  }

  $('.modal.results .button.back-to-main').click(function () {
    backToHome();
  });

  $('.modal.results .button.play-again').click(function () {
    // play again duh
    const thisButton = $(this);
    thisButton.text('waiting...').addClass('glow');
    server.send(JSON.stringify({'intent':'AGAIN'}));
  });

  menuButton.click(function () {
    if (!menuButton.hasClass('checked')) {
      modalWrapper.addClass('visible');
      $('.modal.pause-menu').addClass('visible');
      menuButton.addClass('checked');
    } else {
      $('.modal.pause-menu .button.resume').click();
    }
  });

  $('.modal.pause-menu .button.resume').click(function () {
    menuButton.removeClass('checked');
    $('.modal.pause-menu').removeClass('visible');
    modalWrapper.removeClass('visible');
  });

  $('.modal.pause-menu .button.exit').click(function () {
    menuButton.removeClass('checked');
    backToHome();
  });

  $('.modal.error .button.ok').click(function () {
    backToHome();
  });

  function log(...l) {
      l.forEach(x => console.log(x));
  }

  function parse(str) {
      try {
          return JSON.parse(str);
      } catch (e) {
          return str;
      }
  }

  function extract(passcode) {
    const dec = {'0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
          '8': 8, '9': 9, 'A': 10, 'B': 11, 'C': 12, 'D': 13, 'E': 14, 'F': 15};
    let ip = [];
    ip.push(dec[passcode[0]] * 16 + dec[passcode[1]]);
    ip.push(dec[passcode[2]] * 16 + dec[passcode[3]]);
    ip.push(dec[passcode[4]] * 16 + dec[passcode[5]]);
    ip.push(dec[passcode[6]] * 16 + dec[passcode[7]]);
    return [ip.join('.'), passcode.substring(8)];
  }

  function mux(move) {
    return move.reduce((a, b) => (a << 2) + b, 0);
  }

  function demux(move) {
    let res = [];
    for (let i = 0; i < 4; i++) {
      res.push(move % 4);
      move >>= 2;
    }
    return res.reverse();
  }

  function markToClass(player) {
    if (player == 'self')
      return mark == 'X' ? 'ex' : 'oh';
    if (player == 'other')
      return mark == 'X' ? 'oh' : 'ex';
    return '';
  }

  function popUp(message, timeout) {
    if (typeof timeout === "undefined") timeout = 3000;
    clearTimeout(popUpID);
    $('.popUp').html(message).addClass('show');
    if (timeout > 0)
      popUpID = setTimeout(() => $('.popUp').removeClass('show'), timeout);
    console.log(message);
  }

  function showModal(modalName) {
    modals.removeClass('visible');
    modalWrapper.addClass('visible');
    return $(`.modal.${modalName}`).addClass('visible');
  }

  function hideModal() {
    modalWrapper.removeClass('visible');
    modals.removeClass('visible');
  }

  function showError(message) {
    $('.modal.error p.body').text(message);
    showModal('error');
  }

  function showHalo(prevMove, myTurn) {
    let haloElement = $('.game .board .grid .halo')
    let className = prevMove == null? '' : `c-${prevMove[2]}-${prevMove[3]}`;
    if (!myTurn) haloElement.addClass('red');
    else haloElement.removeClass('red');
    haloElement.addClass('show').removeClass(haloElement.attr('last-class')).addClass(className);
    haloElement.attr('last-class', className);
  }

  function hideHalo() {
    $('.game .board .grid .halo').removeClass('show').removeClass($(this).attr('last-class'));
  }

  function clearBoard() {
    $('.cell span').removeClass('ex').removeClass('oh');
    $('.box-results .box').removeClass('ex').removeClass('oh');
    $('.game .board').removeClass(markClass);
  }

})();
