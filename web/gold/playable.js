(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;

  const Phase = {
    COLLECT: 'collect',
    UPGRADE: 'upgrade',
    BATTLE: 'battle',
    END: 'end',
  };

  const state = {
    phase: Phase.COLLECT,
    time: 0,
    gold: 0,
    upgradeLevel: 0,
    battleProgress: 0,
    message: 'Tap the shining crates',
    crates: [
      { id: 1, x: 108, y: 430, r: 36, alive: true, pulse: 0.1 },
      { id: 2, x: 205, y: 392, r: 41, alive: true, pulse: 0.7 },
      { id: 3, x: 292, y: 438, r: 34, alive: true, pulse: 1.2 },
    ],
    coins: [],
    sparks: [],
    soldiers: [
      { x: 142, y: 600, lane: -1, fire: 0 },
      { x: 195, y: 615, lane: 0, fire: 0.25 },
      { x: 248, y: 600, lane: 1, fire: 0.5 },
    ],
    enemies: [
      { x: 410, y: 482, offset: 0 },
      { x: 450, y: 522, offset: 0.25 },
      { x: 490, y: 562, offset: 0.5 },
    ],
  };

  const upgradeButton = { x: 70, y: 704, w: 250, h: 68 };
  const ctaButton = { x: 64, y: 700, w: 262, h: 70 };
  let lastTime = performance.now();

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function roundRect(x, y, w, h, r) {
    const radius = Math.min(r, w * 0.5, h * 0.5);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    const pointer = event.changedTouches ? event.changedTouches[0] : event;
    return {
      x: (pointer.clientX - rect.left) * (width / rect.width),
      y: (pointer.clientY - rect.top) * (height / rect.height),
    };
  }

  function hitRect(point, rect) {
    return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
  }

  function addSpark(x, y, count) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 130;
      state.sparks.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.45 + Math.random() * 0.25,
        maxLife: 0.7,
      });
    }
  }

  function addCoinBurst(x, y) {
    for (let i = 0; i < 8; i += 1) {
      state.coins.push({
        x: x + Math.random() * 18 - 9,
        y: y + Math.random() * 18 - 9,
        delay: i * 0.045,
        life: 0,
        duration: 0.65,
      });
    }
    addSpark(x, y, 18);
  }

  function collectCrate(crate) {
    if (!crate.alive || state.phase !== Phase.COLLECT) {
      return;
    }
    crate.alive = false;
    state.gold += 25;
    addCoinBurst(crate.x, crate.y);

    if (state.crates.every(item => !item.alive)) {
      state.phase = Phase.UPGRADE;
      state.message = 'Upgrade the command base';
    }
  }

  function upgradeBase() {
    if (state.phase !== Phase.UPGRADE || state.gold < 75) {
      return;
    }
    state.gold -= 75;
    state.upgradeLevel = 1;
    state.phase = Phase.BATTLE;
    state.message = 'Reinforcements deployed';
    addSpark(195, 534, 34);
  }

  function openStore() {
    window.open('https://lastwar.onelink.me/PXmq/playable', '_blank');
  }

  function handlePointer(event) {
    event.preventDefault();
    const point = pointerPosition(event);

    if (state.phase === Phase.COLLECT) {
      const target = state.crates.find(crate => crate.alive && Math.hypot(point.x - crate.x, point.y - crate.y) <= crate.r + 20);
      if (target) {
        collectCrate(target);
      }
      return;
    }

    if (state.phase === Phase.UPGRADE && hitRect(point, upgradeButton)) {
      upgradeBase();
      return;
    }

    if (state.phase === Phase.END && hitRect(point, ctaButton)) {
      openStore();
    }
  }

  function update(delta) {
    state.time += delta;

    for (const spark of state.sparks) {
      spark.life -= delta;
      spark.x += spark.vx * delta;
      spark.y += spark.vy * delta;
      spark.vy += 260 * delta;
    }
    state.sparks = state.sparks.filter(spark => spark.life > 0);

    for (const coin of state.coins) {
      if (coin.delay > 0) {
        coin.delay -= delta;
        continue;
      }
      coin.life += delta;
      const t = clamp(coin.life / coin.duration, 0, 1);
      coin.x = lerp(coin.x, 72, t * 0.18);
      coin.y = lerp(coin.y, 82, t * 0.18);
    }
    state.coins = state.coins.filter(coin => coin.life < coin.duration);

    if (state.phase === Phase.BATTLE) {
      state.battleProgress = clamp(state.battleProgress + delta * 0.28, 0, 1);
      for (const soldier of state.soldiers) {
        soldier.x = lerp(soldier.x, 250 + soldier.lane * 18, delta * 1.3);
        soldier.fire = (soldier.fire + delta * 5) % 1;
      }
      for (const enemy of state.enemies) {
        enemy.x = lerp(enemy.x, 250 + enemy.offset * 18, delta * 0.75);
      }
      if (state.battleProgress >= 1) {
        state.phase = Phase.END;
        state.message = 'Victory unlocked';
        addSpark(195, 338, 42);
      }
    }

    document.body.dataset.phase = state.phase;
    document.body.dataset.gold = String(state.gold);
    document.body.dataset.cratesAlive = String(state.crates.filter(crate => crate.alive).length);
  }

  function fillText(text, x, y, size, color, align = 'center', weight = '700') {
    ctx.font = `${weight} ${size}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#1d2a34');
    sky.addColorStop(0.48, '#273327');
    sky.addColorStop(1, '#151719');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#263b34';
    ctx.beginPath();
    ctx.moveTo(0, 572);
    ctx.lineTo(width, 495);
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(235, 213, 146, 0.18)';
    ctx.lineWidth = 24;
    ctx.beginPath();
    ctx.moveTo(20, 650);
    ctx.bezierCurveTo(126, 568, 236, 565, 390, 460);
    ctx.stroke();
  }

  function drawHud() {
    roundRect(22, 24, 150, 46, 8);
    ctx.fillStyle = 'rgba(12, 17, 18, 0.72)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 219, 110, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#ffd85f';
    ctx.beginPath();
    ctx.arc(48, 47, 12, 0, Math.PI * 2);
    ctx.fill();
    fillText(String(state.gold), 80, 48, 22, '#fff5c4', 'left');

    roundRect(218, 24, 150, 46, 8);
    ctx.fillStyle = 'rgba(12, 17, 18, 0.62)';
    ctx.fill();
    fillText(`Base Lv.${state.upgradeLevel + 1}`, 293, 48, 18, '#d8efe7');
    fillText(state.message, width * 0.5, 116, 22, '#ffffff');
  }

  function drawBase() {
    const levelLift = state.upgradeLevel * 16;
    ctx.save();
    ctx.translate(0, -levelLift);
    ctx.fillStyle = '#26323a';
    roundRect(124, 508, 142, 86, 10);
    ctx.fill();
    ctx.strokeStyle = '#86a7ad';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = state.upgradeLevel ? '#d6b560' : '#798c91';
    roundRect(152, 468, 86, 54, 8);
    ctx.fill();
    ctx.fillStyle = '#172228';
    roundRect(166, 486, 58, 22, 4);
    ctx.fill();
    if (state.upgradeLevel > 0) {
      ctx.fillStyle = '#f4cb42';
      ctx.beginPath();
      ctx.moveTo(194, 436);
      ctx.lineTo(216, 470);
      ctx.lineTo(172, 470);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawCrate(crate) {
    if (!crate.alive) {
      return;
    }
    const pulse = 1 + Math.sin(state.time * 4 + crate.pulse) * 0.08;
    const glow = ctx.createRadialGradient(crate.x, crate.y, 5, crate.x, crate.y, crate.r * 1.9);
    glow.addColorStop(0, 'rgba(255, 229, 99, 0.95)');
    glow.addColorStop(0.45, 'rgba(255, 188, 42, 0.32)');
    glow.addColorStop(1, 'rgba(255, 188, 42, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(crate.x, crate.y, crate.r * 1.9 * pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(crate.x, crate.y);
    ctx.scale(pulse, pulse);
    roundRect(-crate.r, -crate.r * 0.72, crate.r * 2, crate.r * 1.44, 8);
    ctx.fillStyle = '#b66d2f';
    ctx.fill();
    ctx.strokeStyle = '#ffdc72';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = '#ffd65c';
    ctx.fillRect(-8, -crate.r * 0.72, 16, crate.r * 1.44);
    ctx.fillRect(-crate.r, -6, crate.r * 2, 12);
    ctx.restore();
  }

  function drawSoldiersAndEnemies() {
    for (const enemy of state.enemies) {
      const defeated = state.battleProgress > 0.55 + enemy.offset * 0.3;
      ctx.globalAlpha = defeated ? 1 - clamp((state.battleProgress - 0.55 - enemy.offset * 0.3) * 4, 0, 1) : 1;
      ctx.fillStyle = '#5c6c5c';
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#273126';
      roundRect(enemy.x - 12, enemy.y + 13, 24, 18, 5);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (state.phase !== Phase.BATTLE && state.phase !== Phase.END) {
      return;
    }

    for (const soldier of state.soldiers) {
      ctx.fillStyle = '#3d5d7a';
      roundRect(soldier.x - 13, soldier.y - 18, 26, 36, 6);
      ctx.fill();
      ctx.fillStyle = '#d9b080';
      ctx.beginPath();
      ctx.arc(soldier.x, soldier.y - 28, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#171b1f';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(soldier.x + 8, soldier.y - 12);
      ctx.lineTo(soldier.x + 34, soldier.y - 20);
      ctx.stroke();
      if (soldier.fire < 0.18) {
        ctx.fillStyle = '#ffd66b';
        ctx.beginPath();
        ctx.arc(soldier.x + 38, soldier.y - 22, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawCoinsAndSparks() {
    for (const coin of state.coins) {
      if (coin.delay > 0) {
        continue;
      }
      ctx.fillStyle = '#ffd85f';
      ctx.beginPath();
      ctx.arc(coin.x, coin.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff1a8';
      ctx.stroke();
    }

    for (const spark of state.sparks) {
      const alpha = clamp(spark.life / spark.maxLife, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ffd85f';
      ctx.beginPath();
      ctx.arc(spark.x, spark.y, 3 + alpha * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawHandHint() {
    let x = 205;
    let y = 424;
    if (state.phase === Phase.COLLECT) {
      const target = state.crates.find(crate => crate.alive);
      if (target) {
        x = target.x + 24;
        y = target.y + 42;
      }
    } else if (state.phase === Phase.UPGRADE) {
      x = upgradeButton.x + upgradeButton.w * 0.72;
      y = upgradeButton.y + 46;
    } else {
      return;
    }

    const bob = Math.sin(state.time * 6) * 8;
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.rotate(-0.35);
    ctx.fillStyle = '#f2d2b2';
    roundRect(-8, -30, 20, 50, 9);
    ctx.fill();
    ctx.fillStyle = '#fff3df';
    ctx.beginPath();
    ctx.arc(4, 26, 19, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7c4b32';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }

  function drawUpgradeButton() {
    if (state.phase !== Phase.UPGRADE) {
      return;
    }
    const pulse = 1 + Math.sin(state.time * 5) * 0.04;
    ctx.save();
    ctx.translate(upgradeButton.x + upgradeButton.w * 0.5, upgradeButton.y + upgradeButton.h * 0.5);
    ctx.scale(pulse, pulse);
    roundRect(-upgradeButton.w * 0.5, -upgradeButton.h * 0.5, upgradeButton.w, upgradeButton.h, 12);
    ctx.fillStyle = '#e9b93f';
    ctx.fill();
    ctx.strokeStyle = '#fff2a8';
    ctx.lineWidth = 3;
    ctx.stroke();
    fillText('UPGRADE', 0, -7, 24, '#221a09');
    fillText('Spend 75 gold', 0, 18, 15, '#46340d', 'center', '700');
    ctx.restore();
  }

  function drawBattleProgress() {
    if (state.phase !== Phase.BATTLE) {
      return;
    }
    roundRect(58, 686, 274, 22, 8);
    ctx.fillStyle = 'rgba(12, 17, 18, 0.72)';
    ctx.fill();
    roundRect(62, 690, 266 * state.battleProgress, 14, 6);
    ctx.fillStyle = '#ffcf45';
    ctx.fill();
  }

  function drawEndCard() {
    if (state.phase !== Phase.END) {
      return;
    }
    ctx.fillStyle = 'rgba(5, 7, 8, 0.58)';
    ctx.fillRect(0, 0, width, height);
    roundRect(44, 168, 302, 446, 14);
    ctx.fillStyle = '#202830';
    ctx.fill();
    ctx.strokeStyle = '#f3c84d';
    ctx.lineWidth = 3;
    ctx.stroke();

    fillText('VICTORY', width * 0.5, 230, 38, '#fff2a3');
    fillText('Gold secured. Base upgraded.', width * 0.5, 282, 19, '#e7ecec');

    ctx.fillStyle = '#ffd85f';
    ctx.beginPath();
    ctx.arc(195, 398, 76, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2d3840';
    roundRect(142, 368, 106, 82, 10);
    ctx.fill();
    ctx.fillStyle = '#edf5f7';
    roundRect(162, 344, 66, 44, 8);
    ctx.fill();

    roundRect(ctaButton.x, ctaButton.y, ctaButton.w, ctaButton.h, 14);
    ctx.fillStyle = '#f1bd32';
    ctx.fill();
    ctx.strokeStyle = '#fff4af';
    ctx.lineWidth = 3;
    ctx.stroke();
    fillText('PLAY NOW', width * 0.5, ctaButton.y + 36, 26, '#201804');
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    drawBackground();
    drawBase();
    state.crates.forEach(drawCrate);
    drawSoldiersAndEnemies();
    drawCoinsAndSparks();
    drawHud();
    drawUpgradeButton();
    drawBattleProgress();
    drawHandHint();
    drawEndCard();
  }

  function tick(now) {
    const delta = Math.min((now - lastTime) / 1000, 0.033);
    lastTime = now;
    update(delta);
    draw();
    requestAnimationFrame(tick);
  }

  canvas.addEventListener('pointerdown', handlePointer, { passive: false });
  if (!window.PointerEvent) {
    canvas.addEventListener('touchstart', handlePointer, { passive: false });
  }
  window.goldPlayableDebug = {
    getState() {
      return {
        phase: state.phase,
        gold: state.gold,
        upgradeLevel: state.upgradeLevel,
        battleProgress: state.battleProgress,
        cratesAlive: state.crates.filter(crate => crate.alive).length,
      };
    },
  };
  requestAnimationFrame(tick);
})();
