/* 栀书心驿 · 背景乐声（Day 11 追加需求）
 *
 * 不用任何外部音频文件（无后端、也避免版权问题）：用 Web Audio API
 * 现场合成一段舒缓的五声音阶钢琴式循环——慢速、多留白、长余音、
 * 轻回声，气质向《寻一个你》前奏那种"安静地靠近"靠拢。
 *
 * 浏览器自动播放策略不允许页面一打开就出声（所有网站的硬限制），
 * 因此：进站时乐声"待命"，用户第一次轻点页面任意处即淡入；
 * 右上角常驻一个开关键，随时静音，偏好记在 localStorage，
 * 关掉过的人，下次进站不会自动响起。
 */

(function () {
  // 用户之前是否主动关过乐声（默认开启）
  var PREF_KEY = 'zhishu_music';
  var userWantsMusic = localStorage.getItem(PREF_KEY) !== 'off';

  var ctx = null;          // AudioContext（必须等用户手势后才能创建/出声）
  var master = null;       // 总音量（做淡入用）
  var playing = false;
  var loopTimer = null;
  var started = false;     // 本次进站是否已经尝试启动过

  // ---------- 界面：右上角开关键 ----------
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'music-btn';
  btn.id = 'music-btn';
  btn.textContent = '♪'; // 图标固定，状态用颜色/斜线区分（见 css .music-btn）
  // 之前主动关过的人，进站直接显示"关"，不再用"待命"误导
  setBtnState(userWantsMusic ? 'waiting' : 'off');
  document.body.appendChild(btn);

  // 待命时的轻声引导（只对没关过乐声的人出现，最多等 9 秒）
  var hint = null;
  if (userWantsMusic) {
    hint = document.createElement('p');
    hint.className = 'music-hint';
    hint.textContent = '轻触页面任意处，乐声轻轻响起';
    document.body.appendChild(hint);
    setTimeout(hideHint, 9000);
  }
  function hideHint() { if (hint) hint.classList.add('fade'); }

  function setBtnState(state) {
    btn.dataset.state = state;
    var label = state === 'on' ? '乐声：开' : (state === 'off' ? '乐声：关' : '乐声：待命');
    btn.setAttribute('aria-label', label);
    btn.setAttribute('aria-pressed', state === 'on' ? 'true' : 'false');
    btn.title = label;
  }

  // ---------- 音色：一颗"钢琴式"的柔音 ----------
  function playNote(freq, when, dur, vel) {
    // 两个轻微失谐的振荡器叠出温度，长释放当余音
    var osc1 = ctx.createOscillator();
    var osc2 = ctx.createOscillator();
    osc1.type = 'triangle';
    osc2.type = 'sine';
    osc2.detune.value = 4; // 轻微失谐，让声音"暖"

    var g = ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(vel, when + 0.04);        // 轻轻落下
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);  // 慢慢散去

    osc1.frequency.value = freq;
    osc2.frequency.value = freq;
    osc1.connect(g); osc2.connect(g);
    g.connect(master);
    osc1.start(when); osc2.start(when);
    osc1.stop(when + dur + 0.1); osc2.stop(when + dur + 0.1);
  }

  // ---------- 曲子：五声音阶慢速循环（宫调式，多留白） ----------
  // 频率表（C 宫五声，跨三个八度）
  var N = {
    A3: 220.00, C4: 261.63, D4: 293.66, E4: 329.63, G4: 392.00,
    A4: 440.00, C5: 523.25, D5: 587.33, E5: 659.26, G5: 783.99
  };
  // 一"步"约 1.35 秒（约 44 BPM），null 是留白——安静也是曲子的一部分
  var PHRASES = [
    [N.E4, null, N.G4, null, N.A4, null, N.G4, null],
    [N.D4, null, N.E4, null, N.G4, null, N.E4, null],
    [N.C5, null, N.A4, null, N.G4, null, N.E4, null],
    [N.D4, null, N.E4, null, N.D4, null, N.C4, null],
    [N.A3, null, N.C4, null, N.D4, null, N.E4, null],
    [N.G4, null, N.E4, null, N.D4, null, N.C4, null]
  ];
  var STEP = 1.35;

  function scheduleLoop() {
    var stepDur = STEP;
    var lookahead = ctx.currentTime + 0.1;
    if (!loopTimer) {
      // 先排一遍整曲（约 65 秒），循环靠每步的滚动补排
      var t = lookahead;
      for (var p = 0; p < PHRASES.length; p++) {
        for (var s = 0; s < PHRASES[p].length; s++) {
          var f = PHRASES[p][s];
          if (f) playNote(f, t, 4.5, 0.10 + (s === 0 ? 0.04 : 0)); // 句首稍亮一点
          t += stepDur;
        }
      }
      var total = PHRASES.length * 8 * stepDur * 1000;
      loopTimer = setInterval(function () {
        // 每循环一轮重排一次（时间往前推，保持无缝）
        var t2 = ctx.currentTime + 0.1;
        for (var p2 = 0; p2 < PHRASES.length; p2++) {
          for (var s2 = 0; s2 < PHRASES[p2].length; s2++) {
            var f2 = PHRASES[p2][s2];
            if (f2) playNote(f2, t2, 4.5, 0.10 + (s2 === 0 ? 0.04 : 0));
            t2 += stepDur;
          }
        }
      }, total - 500);
    }
  }

  // ---------- 启动 / 停止 ----------
  function startMusic() {
    if (playing || !userWantsMusic) return;
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0; // 从无声淡入

      // 轻回声：给声音一点"空房间"的纵深，不做重混响
      var delay = ctx.createDelay(1.5);
      delay.delayTime.value = 0.48;
      var fb = ctx.createGain(); fb.gain.value = 0.34;
      var wet = ctx.createGain(); wet.gain.value = 0.22;
      delay.connect(fb); fb.connect(delay);
      master.connect(delay); delay.connect(wet);
      wet.connect(ctx.destination); master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    // 4 秒缓缓淡入，像乐声自己走进来
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0.85, ctx.currentTime + 4);
    playing = true;
    setBtnState('on');
    scheduleLoop();
    hideHint();
  }

  function stopMusic() {
    if (!ctx || !playing) { setBtnState('off'); return; }
    // 1.2 秒缓缓淡出，不戛然而止
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.2);
    playing = false;
    setBtnState('off');
    // 已排进时间线的音符让它自然散去，只停掉循环补排
    if (loopTimer) { clearInterval(loopTimer); loopTimer = null; }
  }

  // ---------- 事件 ----------
  // 进站待命：第一次轻点/按键（任意位置）即响起（绕过自动播放限制的正路）
  function firstGesture(e) {
    if (started) return;
    // 点在开关键上的不算"第一次轻点"（那一下的语义交给开关键自己处理），
    // 否则 pointerdown 先开乐声、click 又把它关掉，第一次点开关反而静音
    if (e && e.target && e.target.closest && e.target.closest('#music-btn')) return;
    started = true;
    if (userWantsMusic) startMusic();
    hideHint();
    document.removeEventListener('pointerdown', firstGesture);
    document.removeEventListener('keydown', firstGesture);
  }
  document.addEventListener('pointerdown', firstGesture);
  document.addEventListener('keydown', function (e) { firstGesture(e); });

  // 开关键：点一下开/关，并记住偏好
  btn.addEventListener('click', function (e) {
    e.stopPropagation(); // 不让它顺手触发"第一次轻点"的语义混乱
    started = true;
    if (playing) {
      userWantsMusic = false;
      localStorage.setItem(PREF_KEY, 'off');
      stopMusic();
    } else {
      userWantsMusic = true;
      localStorage.setItem(PREF_KEY, 'on');
      startMusic();
    }
    hideHint();
  });
})();
