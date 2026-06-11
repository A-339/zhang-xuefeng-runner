(function () {
  "use strict";

  var canvas = document.getElementById("game");
  var ctx = canvas.getContext("2d");
  var scoreEl = document.getElementById("score");
  var bestEl = document.getElementById("best");
  var overlay = document.getElementById("overlay");
  var overlayText = document.getElementById("overlayText");
  var startButton = document.getElementById("startButton");
  var jumpBtn = document.getElementById("jumpBtn");
  var duckBtn = document.getElementById("duckBtn");

  var W = canvas.width;
  var H = canvas.height;
  var groundY = 284;
  var gravity = 2350;
  var jumpVelocity = -820;
  var jumpHoldForce = -1450;
  var maxJumpHold = 0.18;
  var fastDropGravity = 3900;
  var bestScore = Number(localStorage.getItem("zhang-runner-best") || 0);
  var lastTime = 0;
  var spawnTimer = 0;
  var state = "ready";
  var input = {
    jumpHeld: false,
    duckHeld: false
  };
  var bgm = new Audio("assets/bgm.mp3");
  bgm.loop = true;
  bgm.volume = 0.5;
  var deathSound = new Audio("assets/death.mp3");
  deathSound.volume = 0.9;

  var assets = {
    runner: "assets/generated/zhang-runner.png",
    duck: "assets/generated/zhang-duck.png",
    qiaolezi: "assets/generated/qiaolezi.png",
    qiaoleziAlt: "assets/generated/qiaolezi-alt.png",
    spriteBottle: "assets/generated/sprite-bottle.png"
  };

  var images = {};
  var loadedCount = 0;
  var assetKeys = Object.keys(assets);

  var player = {
    x: 106,
    y: groundY - 132,
    standW: 98,
    standH: 132,
    duckW: 104,
    duckH: 91,
    w: 98,
    h: 132,
    vy: 0,
    grounded: true,
    ducking: false,
    jumpHold: 0
  };

  var game = {
    speed: 410,
    distance: 0,
    score: 0,
    obstacles: [],
    dust: []
  };

  function loadAssets() {
    assetKeys.forEach(function (key) {
      var img = new Image();
      img.onload = function () {
        loadedCount += 1;
        if (loadedCount === assetKeys.length) {
          configurePlayerSprites();
          updatePlayerShape();
          drawFrame(0);
        }
      };
      img.onerror = function () {
        console.error("Failed to load asset: " + assets[key]);
      };
      img.src = assets[key];
      images[key] = img;
    });
  }

  function configurePlayerSprites() {
    player.standH = 132;
    player.standW = Math.round(player.standH * images.runner.naturalWidth / images.runner.naturalHeight);
    player.duckH = 91;
    player.duckW = Math.round(player.duckH * images.duck.naturalWidth / images.duck.naturalHeight);
  }

  function resetGame() {
    input.jumpHeld = false;
    input.duckHeld = false;
    player.w = player.standW;
    player.h = player.standH;
    player.y = groundY - player.h;
    player.vy = 0;
    player.grounded = true;
    player.ducking = false;
    player.jumpHold = 0;
    game.speed = 410;
    game.distance = 0;
    game.score = 0;
    game.obstacles = [];
    game.dust = [];
    spawnTimer = 0.65;
    lastTime = performance.now();
  }

  function startGame() {
    if (loadedCount !== assetKeys.length) {
      overlayText.textContent = "素材还在加载，马上就能跑。";
      return;
    }

    playBgm();
    resetGame();
    state = "playing";
    overlay.classList.add("hidden");
    requestAnimationFrame(loop);
  }

  function playBgm() {
    if (!bgm.paused) {
      return;
    }

    bgm.play().catch(function () {
      // Browsers only allow audio after a user gesture; the next key/tap retries.
    });
  }

  function jump() {
    if (state === "ready" || state === "gameover") {
      startGame();
      return;
    }

    if (player.grounded) {
      input.duckHeld = false;
      player.ducking = false;
      player.vy = jumpVelocity;
      player.grounded = false;
      player.jumpHold = maxJumpHold;
      makeDust(player.x + 34, groundY - 8);
    }
  }

  function setDuck(ducking) {
    input.duckHeld = ducking;

    if (state !== "playing") {
      return;
    }

    if (!player.grounded && ducking && player.vy < 900) {
      player.vy += 420;
    }
  }

  function endGame() {
    if (state === "gameover") {
      return;
    }

    state = "gameover";
    playDeathSound();
    bestScore = Math.max(bestScore, game.score);
    localStorage.setItem("zhang-runner-best", String(bestScore));
    updateScore();
    overlayText.textContent = "你跑不过我你信吗！按空格 / \u2191 / 点击再跑一把。";
    startButton.textContent = "重来";
    overlay.classList.remove("hidden");
  }

  function playDeathSound() {
    deathSound.currentTime = 0;
    deathSound.play().catch(function () {
      // If the browser blocks audio, the game can still end normally.
    });
  }

  function makeDust(x, y) {
    for (var i = 0; i < 6; i += 1) {
      game.dust.push({
        x: x - Math.random() * 18,
        y: y + Math.random() * 10,
        r: 2 + Math.random() * 4,
        vx: -80 - Math.random() * 120,
        life: 0.35 + Math.random() * 0.22
      });
    }
  }

  function spawnObstacle() {
    var flying = game.score > 220 && Math.random() < 0.35;
    var useAlt = Math.random() < 0.5;
    var obstacle;

    if (flying) {
      var heightRoll = Math.random();
      var lane;
      var speedMultiplier;

      if (heightRoll < 0.45) {
        lane = "duck";
      } else if (heightRoll < 0.78) {
        lane = "jump";
      } else {
        lane = "high";
      }

      if (lane === "duck") {
        speedMultiplier = 1.04 + Math.random() * 0.28;
      } else if (lane === "jump") {
        speedMultiplier = 0.94 + Math.random() * 0.22;
      } else {
        speedMultiplier = 1.12 + Math.random() * 0.38;
      }

      obstacle = {
        type: "spriteBottle",
        img: images.spriteBottle,
        x: W + 30,
        y: getFlyingY(lane),
        w: 134,
        h: 76,
        hitPad: 13,
        lane: lane,
        speedMultiplier: speedMultiplier
      };
    } else {
      obstacle = {
        type: useAlt ? "qiaoleziAlt" : "qiaolezi",
        img: useAlt ? images.qiaoleziAlt : images.qiaolezi,
        x: W + 30,
        y: groundY - (useAlt ? 112 : 118),
        w: useAlt ? 66 : 72,
        h: useAlt ? 134 : 144,
        hitPad: 9,
        speedMultiplier: 1
      };
    }

    game.obstacles.push(obstacle);
    spawnTimer = 0.92 + Math.random() * 0.78 - Math.min(game.score / 3200, 0.32);
  }

  function getFlyingY(lane) {
    if (lane === "duck") {
      return groundY - 166 - Math.random() * 12;
    }

    if (lane === "jump") {
      return groundY - 96 - Math.random() * 16;
    }

    return groundY - 222 - Math.random() * 26;
  }

  function update(dt) {
    updatePlayerShape();

    if (input.jumpHeld && player.jumpHold > 0 && player.vy < 0 && !input.duckHeld) {
      player.vy += jumpHoldForce * dt;
      player.jumpHold -= dt;
    } else {
      player.jumpHold = 0;
    }

    player.vy += (input.duckHeld && !player.grounded ? fastDropGravity : gravity) * dt;
    player.y += player.vy * dt;

    if (player.y >= groundY - player.h) {
      player.y = groundY - player.h;
      player.vy = 0;
      player.grounded = true;
      player.jumpHold = 0;
      updatePlayerShape();
    }

    game.speed = Math.min(720, game.speed + 7.5 * dt);
    game.distance += game.speed * dt;
    game.score = Math.floor(game.distance / 10);
    spawnTimer -= dt;

    if (spawnTimer <= 0) {
      spawnObstacle();
    }

    game.obstacles.forEach(function (obstacle) {
      obstacle.x -= game.speed * (obstacle.speedMultiplier || 1) * dt;
    });
    game.obstacles = game.obstacles.filter(function (obstacle) {
      return obstacle.x + obstacle.w > -40;
    });

    game.dust.forEach(function (dot) {
      dot.x += dot.vx * dt;
      dot.life -= dt;
    });
    game.dust = game.dust.filter(function (dot) {
      return dot.life > 0;
    });

    if (game.obstacles.some(collides)) {
      endGame();
    }
  }

  function updatePlayerShape() {
    var wasH = player.h;
    player.ducking = input.duckHeld && player.grounded;
    player.w = player.ducking ? player.duckW : player.standW;
    player.h = player.ducking ? player.duckH : player.standH;

    if (player.grounded || player.h !== wasH) {
      player.y = groundY - player.h;
    }
  }

  function collides(obstacle) {
    var playerBox = getPlayerHitBox();
    var obstacleBox = {
      x: obstacle.x + obstacle.hitPad,
      y: obstacle.y + obstacle.hitPad,
      w: obstacle.w - obstacle.hitPad * 2,
      h: obstacle.h - obstacle.hitPad * 2
    };

    return playerBox.x < obstacleBox.x + obstacleBox.w &&
      playerBox.x + playerBox.w > obstacleBox.x &&
      playerBox.y < obstacleBox.y + obstacleBox.h &&
      playerBox.y + playerBox.h > obstacleBox.y;
  }

  function getPlayerHitBox() {
    if (player.ducking) {
      return {
        x: player.x + 10,
        y: player.y + 15,
        w: player.w - 18,
        h: player.h - 30
      };
    }

    return {
      x: player.x + 11,
      y: player.y + 8,
      w: player.w - 20,
      h: player.h - 12
    };
  }

  function drawBackground() {
    ctx.fillStyle = "#f7fbff";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#e8f3ec";
    for (var i = 0; i < 5; i += 1) {
      var cloudX = (W - ((game.distance * 0.12 + i * 245) % (W + 160))) + 24;
      var cloudY = 44 + (i % 3) * 28;
      ctx.beginPath();
      ctx.ellipse(cloudX, cloudY, 42, 13, 0, 0, Math.PI * 2);
      ctx.ellipse(cloudX + 34, cloudY - 4, 24, 10, 0, 0, Math.PI * 2);
      ctx.ellipse(cloudX - 34, cloudY + 3, 23, 9, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    drawTreadmill();
  }

  function drawTreadmill() {
    var beltTop = groundY;
    var beltHeight = 34;
    var deckTop = beltTop + beltHeight;
    var stripeOffset = (game.distance * 1.1) % 46;

    ctx.fillStyle = "#dde7e1";
    ctx.fillRect(0, deckTop + 24, W, H - deckTop - 24);

    ctx.fillStyle = "#233129";
    roundedRect(26, beltTop - 6, W - 52, beltHeight + 16, 9);
    ctx.fill();

    ctx.fillStyle = "#3f4d44";
    roundedRect(42, beltTop + 2, W - 84, beltHeight, 7);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    roundedRect(42, beltTop + 2, W - 84, beltHeight, 7);
    ctx.clip();

    ctx.fillStyle = "#526158";
    for (var x = 42 - stripeOffset; x < W - 38; x += 46) {
      ctx.beginPath();
      ctx.moveTo(x, beltTop + 2);
      ctx.lineTo(x + 16, beltTop + 2);
      ctx.lineTo(x - 8, beltTop + beltHeight + 2);
      ctx.lineTo(x - 24, beltTop + beltHeight + 2);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
    ctx.fillRect(42, beltTop + 5, W - 84, 5);
    ctx.restore();

    ctx.fillStyle = "#19231e";
    ctx.fillRect(0, beltTop - 2, W, 3);

    drawRoller(48, deckTop + 8, 22);
    drawRoller(W - 48, deckTop + 8, 22);

    ctx.fillStyle = "#8c9890";
    roundedRect(74, deckTop + 6, W - 148, 16, 5);
    ctx.fill();

    ctx.fillStyle = "#657067";
    ctx.fillRect(104, deckTop + 22, 18, 24);
    ctx.fillRect(W - 122, deckTop + 22, 18, 24);
  }

  function drawRoller(x, y, radius) {
    ctx.fillStyle = "#151f1a";
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#77847b";
    ctx.beginPath();
    ctx.arc(x, y, radius - 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#26332c";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, radius - 13, 0, Math.PI * 2);
    ctx.stroke();
  }

  function roundedRect(x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  function drawPlayer() {
    var bob = player.grounded ? Math.sin(game.distance / 18) * 2 : 0;
    var img = player.ducking ? images.duck : images.runner;
    ctx.drawImage(img, player.x, player.y + bob, player.w, player.h);
  }

  function drawObstacles() {
    game.obstacles.forEach(function (obstacle) {
      ctx.drawImage(obstacle.img, obstacle.x, obstacle.y, obstacle.w, obstacle.h);
    });
  }

  function drawDust(dt) {
    ctx.fillStyle = "rgba(93, 104, 91, 0.35)";
    game.dust.forEach(function (dot) {
      ctx.globalAlpha = Math.max(0, dot.life / 0.55);
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, dot.r + dt, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function drawFrame(dt) {
    drawBackground();
    drawDust(dt);
    drawObstacles();
    drawPlayer();
    updateScore();
  }

  function updateScore() {
    scoreEl.textContent = padScore(game.score || 0);
    bestEl.textContent = "HI " + padScore(bestScore);
  }

  function padScore(value) {
    return String(value).padStart(5, "0");
  }

  function loop(now) {
    if (state !== "playing") {
      return;
    }

    var dt = Math.min((now - lastTime) / 1000, 0.033);
    lastTime = now;
    update(dt);
    drawFrame(dt);

    if (state === "playing") {
      requestAnimationFrame(loop);
    }
  }

  window.addEventListener("keydown", function (event) {
    if (event.code === "Space" || event.code === "ArrowUp") {
      event.preventDefault();
      playBgm();
      input.jumpHeld = true;
      jump();
    } else if (event.code === "ArrowDown") {
      event.preventDefault();
      playBgm();
      setDuck(true);
    }
  });

  window.addEventListener("keyup", function (event) {
    if (event.code === "Space" || event.code === "ArrowUp") {
      event.preventDefault();
      input.jumpHeld = false;
      player.jumpHold = 0;
    } else if (event.code === "ArrowDown") {
      event.preventDefault();
      setDuck(false);
    }
  });

  canvas.addEventListener("pointerdown", function () {
    playBgm();
    input.jumpHeld = true;
    jump();
  });
  canvas.addEventListener("pointerup", function () {
    input.jumpHeld = false;
    player.jumpHold = 0;
  });
  canvas.addEventListener("pointercancel", function () {
    input.jumpHeld = false;
    player.jumpHold = 0;
  });
  startButton.addEventListener("click", function () {
    playBgm();
    startGame();
  });

  // Mobile button controls
  if (jumpBtn) {
    jumpBtn.addEventListener("touchstart", function (e) {
      e.preventDefault();
      playBgm();
      input.jumpHeld = true;
      jump();
    }, { passive: false });
    jumpBtn.addEventListener("touchend", function (e) {
      e.preventDefault();
      input.jumpHeld = false;
      player.jumpHold = 0;
    }, { passive: false });
    jumpBtn.addEventListener("touchcancel", function (e) {
      e.preventDefault();
      input.jumpHeld = false;
      player.jumpHold = 0;
    }, { passive: false });
    jumpBtn.addEventListener("mousedown", function (e) {
      e.preventDefault();
      playBgm();
      input.jumpHeld = true;
      jump();
    });
    jumpBtn.addEventListener("mouseup", function (e) {
      e.preventDefault();
      input.jumpHeld = false;
      player.jumpHold = 0;
    });
  }

  if (duckBtn) {
    duckBtn.addEventListener("touchstart", function (e) {
      e.preventDefault();
      playBgm();
      setDuck(true);
    }, { passive: false });
    duckBtn.addEventListener("touchend", function (e) {
      e.preventDefault();
      setDuck(false);
    }, { passive: false });
    duckBtn.addEventListener("touchcancel", function (e) {
      e.preventDefault();
      setDuck(false);
    }, { passive: false });
    duckBtn.addEventListener("mousedown", function (e) {
      e.preventDefault();
      playBgm();
      setDuck(true);
    });
    duckBtn.addEventListener("mouseup", function (e) {
      e.preventDefault();
      setDuck(false);
    });
  }

  updateScore();
  loadAssets();
}());
