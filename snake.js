const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
document.body.appendChild(canvas);
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const SNAKE_SIZE = 5;
const NUM_APPLES = 200;
const SPEED = 20; // lower is faster

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function paintSnake(snake) {
    ctx.fillStyle = '#00FF00';
    snake.forEach(function(position) {
        ctx.fillRect(position.x, position.y, SNAKE_SIZE, SNAKE_SIZE);
    });
    // Eye for head
    ctx.fillStyle = '#0000FF';
    var head = snake[snake.length - 1];
    ctx.fillRect(head.x + 2, head.y + 2, 2, 2);
}

function paintApples(apples) {
    ctx.fillStyle = '#FF0000';
    apples.forEach(function(position) {
        ctx.fillRect(position.x, position.y, SNAKE_SIZE, SNAKE_SIZE);
    });
}

function paintBackground() {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function isOutOfField(obj) {
    return obj.x > canvas.width || obj.x < 0 || obj.y > canvas.height || obj.y < 0
}

function gameOver(snake) {
    var head = snake[snake.length - 1];
    if (head && isOutOfField(head)) {
        return true;
    }
    if (snake.length < 3) {
        return false;
    }
    var body = snake.slice(0, snake.length - 1);
    return body.some(function(bodyPart) {
        if (collision(head, bodyPart)) {
            return true;
        }
        return false;
    });
}

function collision(target1, target2) {
    return (target1.x > target2.x - SNAKE_SIZE && target1.x < target2.x + SNAKE_SIZE) &&
        (target1.y > target2.y - SNAKE_SIZE && target1.y < target2.y + SNAKE_SIZE);
}

function getRandomPosition() {
    return {
        x: getRandomInt(0, canvas.width),
        y: getRandomInt(0, canvas.height)
    };
}

function paintScore(score) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('Score: ' + score, 40, 43);
}

function renderGameOver() {
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('GAME OVER!', 100, 100);
}

function renderScene(actors) {
    paintBackground();
    paintSnake(actors.snake);
    paintApples(actors.apples);
    paintScore(actors.score);
}

function createInitialApples() {
    var apples = [];
    for (var i = 1; i <= NUM_APPLES; i++) {
        apples.push(getRandomPosition());
    }
    return apples;
}

const KEYMAP = {
    left: 37,
    up: 38,
    right: 39,
    down: 40
};

const ticker$ = Rx.Observable
    .interval(SPEED, Rx.Scheduler.requestAnimationFrame)
    .map(() => ({
        time: Date.now(),
        deltaTime: null
    }))
    .scan(
        (previous, current) => ({
            time: current.time,
            deltaTime: (current.time - previous.time) / 1000
        })
    );


const input$ = Rx.Observable.fromEvent(document, 'keydown').scan(function(lastDir, event) {
    let nextMove = lastDir;
    switch (event.keyCode) {
        case KEYMAP.left:
            nextMove = {
                x: -SNAKE_SIZE + lastDir.x,
                y: 0
            };
            break;
        case KEYMAP.right:
            nextMove = {
                x: SNAKE_SIZE + lastDir.x,
                y: 0
            };
            break;
        case KEYMAP.up:
            nextMove = {
                x: 0,
                y: -SNAKE_SIZE + lastDir.y
            };
            break;
        case KEYMAP.down:
            nextMove = {
                x: 0,
                y: SNAKE_SIZE + lastDir.y
            };
            break;
    }
    if (nextMove.x == 0 && nextMove.y == 0) {
        // Avoid dieing by rapid turn from left to right or top to bottom etc
        return lastDir;
    } else {
        return nextMove;
    }
}, {
    x: SNAKE_SIZE,
    y: 0
}).distinctUntilChanged();

const head$ = ticker$
    .withLatestFrom(input$)
    .scan(function(pos, [ticker, keypress]) {

        let nextX = pos.x + keypress.x;
        let nextY = pos.y + keypress.y;
        return {
            x: nextX,
            y: nextY
        };
    }, {
        x: 10,
        y: 10
    });

const apples$ = head$.scan(function(apples, snakePos) {
    apples.forEach(
        function(apple, index, object) {
            if (collision(apple, snakePos)) {
                object.splice(index, 1);
                object.push(getRandomPosition());
            }
        }
    );
    return apples;
}, createInitialApples()).distinctUntilChanged(
    function(apples) {
        return apples.reduce(function(sum, apple) {
            return sum += apple.x + apple.y
        }, 0);
    });

const length$ = apples$.scan(function(prevLength, apple) {
    return prevLength + 1;
}, 1);

const score$ = length$.map(function(length) {
    return (length - 2) * 10;
});

const finalSnake$ = head$.withLatestFrom(length$)
    .scan(function(snake, [head, length]) {
        snake.push(head);
        if (snake.length > length) {
            snake = snake.splice(snake.length - length);
        }
        return snake;
    }, [{
        x: 0,
        y: 0
    }]);

const game$ = Rx.Observable.combineLatest(
        finalSnake$, apples$, score$,
        function(snake, apples, score) {
            return {
                snake: snake,
                apples: apples,
                score: score
            };
        })
    .sample(SPEED);

function renderError(error) {
throw(error);
   alert("There was an error: " + error);
}

game$.takeWhile(function(actors) {
    return gameOver(actors.snake) === false;
}).subscribe(renderScene, renderError, renderGameOver);
