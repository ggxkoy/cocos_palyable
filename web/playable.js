(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const state = {
    mode: 'running',
    coins: 3,
    health: 5,
    elapsed: 0,
    spawnTimer: 0,
    nextEnemyId: 1,
    enemies: [],
    projectiles: [],
    slots: [
      { id: 1, x: 110, y: 586, occupied: false, cooldown: 0 },
      { id: 2, x: 196, y: 500, occupied: false, cooldown: 0 },
      { id: 3, x: 282, y: 586, occupied: false, cooldown: 0 },
    ],
  };

  const path = [
    { x: 196, y: 132 },
    { x: 196, y: 300 },
    { x: 96, y: 402 },
    { x: 196, y: 500 },
    { x: 294, y: 610 },
    { x: 196, y: 724 },
  ];

  function pointOnPath(progress) {
    const scaled = Math.min(progress, 0.999) * (path.length - 1);
    const index = Math.floor(scaled);
    const local = scaled - index;
    const from = path[index];
    const to = path[index + 1];
    return {
      x: from.x + (to.x - from.x) * local,
      y: from.y + (to.y - from.y) * local,
    };
  }

  function spawnEnemy() {
    state.enemies.push({
      id: state.nextEnemyId,
      progress: 0,
      health: 3,
      maxHealth: 3,
      speed: 0.075 + Math.min(state.elapsed * 0.002, 0.08),
    });
    state.nextEnemyId += 1;
  }

  function update(dt) {
    if (state.mode !== 'running') {
      return;
    }

    state.elapsed += dt;
    state.spawnTimer -= dt;

    if (state.spawnTimer <= 0 && state.elapsed < 20) {
      state.spawnTimer = Math.max(0.8, 2.2 - state.elapsed * 0.05);
      spawnEnemy();
    }

    state.enemies.forEach(enemy => {
      enemy.progress += enemy.speed * dt;
    });

    const escaped = state.enemies.filter(enemy => enemy.progress >= 1).length;
    if (escaped > 0) {
      state.health = Math.max(0, state.health - escaped);
    }

    removeEnemies(enemy => enemy.progress >= 1);

    state.slots.filter(slot => slot.occupied).forEach(slot => {
      slot.cooldown = Math.max(0, slot.cooldown - dt);
      if (slot.cooldown > 0) {
        return;
      }

      const target = state.enemies
        .filter(enemy => enemy.progress > 0.08 && enemy.progress < 0.95)
        .sort((a, b) => b.progress - a.progress)[0];

      if (!target) {
        return;
      }

      slot.cooldown = 0.55;
      target.health -= 1;
      state.projectiles.push({
        x: slot.x,
        y: slot.y,
        tx: pointOnPath(target.progress).x,
        ty: pointOnPath(target.progress).y,
        life: 0.22,
      });

      if (target.health <= 0) {
        state.coins += 1;
      }
    });

    removeEnemies(enemy => enemy.health <= 0);

    state.projectiles.forEach(projectile => {
      projectile.life -= dt;
    });
    for (let index = state.projectiles.length - 1; index >= 0; index -= 1) {
      if (state.projectiles[index].life <= 0) {
        state.projectiles.splice(index, 1);
      }
    }

    if (state.health <= 0) {
      state.mode = 'failed';
    }

    if (state.elapsed >= 24 && state.enemies.length === 0) {
      state.mode = 'won';
    }
  }

  function removeEnemies(predicate) {
    for (let index = state.enemies.length - 1; index >= 0; index -= 1) {
      if (predicate(state.enemies[index])) {
        state.enemies.splice(index, 1);
      }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();
    drawPath();
    drawSlots();
    drawEnemies();
    drawProjectiles();
    drawHud();
    if (state.mode !== 'running') {
      drawEndcard();
    }
  }

  function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#182327');
    gradient.addColorStop(0.55, '#22312c');
    gradient.addColorStop(1, '#151916');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#243635';
    for (let y = 112; y < 820; y += 76) {
      ctx.fillRect(26, y, 338, 2);
    }
  }

  function drawPath() {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#59624c';
    ctx.lineWidth = 58;
    ctx.beginPath();
    path.forEach((point, index) => {
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.stroke();

    ctx.strokeStyle = '#89966f';
    ctx.lineWidth = 34;
    ctx.stroke();
  }

  function drawSlots() {
    state.slots.forEach(slot => {
      ctx.fillStyle = slot.occupied ? '#4aa35b' : '#2b3434';
      ctx.strokeStyle = slot.occupied ? '#d7f0a4' : '#7e8b78';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(slot.x, slot.y, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (slot.occupied) {
        ctx.fillStyle = '#cbe86b';
        ctx.fillRect(slot.x - 8, slot.y - 28, 16, 46);
        ctx.fillStyle = '#293529';
        ctx.beginPath();
        ctx.arc(slot.x, slot.y - 30, 15, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#c9d3bb';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('+', slot.x, slot.y + 8);
      }
    });
  }

  function drawEnemies() {
    state.enemies.forEach(enemy => {
      const point = pointOnPath(enemy.progress);
      ctx.fillStyle = '#b84c44';
      ctx.beginPath();
      ctx.arc(point.x, point.y, 18, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#292c2a';
      ctx.fillRect(point.x - 22, point.y - 32, 44, 5);
      ctx.fillStyle = '#e9da66';
      ctx.fillRect(point.x - 22, point.y - 32, 44 * Math.max(enemy.health / enemy.maxHealth, 0), 5);
    });
  }

  function drawProjectiles() {
    state.projectiles.forEach(projectile => {
      ctx.strokeStyle = '#f4cf66';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(projectile.x, projectile.y);
      ctx.lineTo(projectile.tx, projectile.ty);
      ctx.stroke();
    });
  }

  function drawHud() {
    ctx.fillStyle = 'rgba(13, 18, 18, 0.78)';
    ctx.fillRect(16, 18, 358, 76);
    ctx.fillStyle = '#f5f0dc';
    ctx.font = '700 20px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Coins ${state.coins}`, 34, 48);
    ctx.fillText(`Base ${state.health}`, 34, 76);
    ctx.textAlign = 'right';
    ctx.fillText('Build Towers', 356, 62);
  }

  function drawEndcard() {
    ctx.fillStyle = 'rgba(7, 10, 10, 0.82)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f5f0dc';
    ctx.textAlign = 'center';
    ctx.font = '700 38px Arial';
    ctx.fillText(state.mode === 'won' ? 'Victory' : 'Try Again', 195, 332);
    ctx.font = '22px Arial';
    ctx.fillText('Upgrade your defense', 195, 374);
    ctx.fillStyle = '#d9b84f';
    ctx.fillRect(88, 430, 214, 58);
    ctx.fillStyle = '#171b16';
    ctx.font = '700 22px Arial';
    ctx.fillText('Play Now', 195, 466);
  }

  function handleTap(event) {
    if (state.mode !== 'running') {
      reset();
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (canvas.width / rect.width);
    const y = (event.clientY - rect.top) * (canvas.height / rect.height);
    const slot = state.slots.find(item => Math.hypot(item.x - x, item.y - y) < 38);
    if (!slot || slot.occupied || state.coins <= 0) {
      return;
    }

    slot.occupied = true;
    state.coins -= 1;
  }

  function reset() {
    state.mode = 'running';
    state.coins = 3;
    state.health = 5;
    state.elapsed = 0;
    state.spawnTimer = 0;
    state.nextEnemyId = 1;
    state.enemies.length = 0;
    state.projectiles.length = 0;
    state.slots.forEach(slot => {
      slot.occupied = false;
      slot.cooldown = 0;
    });
  }

  let lastTime = performance.now();
  function frame(time) {
    const dt = Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  canvas.addEventListener('pointerup', handleTap);
  requestAnimationFrame(frame);
})();
