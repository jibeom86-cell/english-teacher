(function () {
  "use strict";

  var KEY = "ko-en-teacher-v2";
  var engine = window.EnglishTeacherEngine;
  var log = document.getElementById("log");
  var form = document.getElementById("form");
  var input = document.getElementById("input");
  var micBtn = document.getElementById("mic");
  var micLabel = document.getElementById("micLabel");
  var statusEl = document.getElementById("status");
  var clearBtn = document.getElementById("clearBtn");
  var setupEl = document.getElementById("setup");
  var setupCount = document.getElementById("setupCount");
  var setupLine = document.getElementById("setupLine");
  var setupHint = document.getElementById("setupHint");
  var setupSkip = document.getElementById("setupSkip");
  var apiKey = document.getElementById("apiKey");
  var redoVoice = document.getElementById("redoVoice");
  var Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  var rec = null;
  var mode = "off";
  var speaking = false;
  var armed = false;
  var micPrimed = false;
  var micDenied = false;
  var primePromise = null;
  var heardFinal = "";
  var heardInterim = "";
  var restarts = 0;
  var restartPending = false;
  var liveText = "";
  var queue = [];
  var speakGen = 0;
  var chunkId = 0;
  var watchdog = null;
  var resumeTimer = null;
  var silenceTimer = null;
  var afterSpeak = null;
  var setupIndex = 0;
  var setupMiss = 0;
  var data = load();

  function emptyData() {
    return { v: 2, aliases: {}, profile: { done: false, samples: [] }, last: null, turns: [], apiKey: "" };
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return emptyData();
      var parsed = JSON.parse(raw);
      if (!parsed || parsed.v !== 2) return emptyData();
      parsed.aliases = parsed.aliases && typeof parsed.aliases === "object" ? parsed.aliases : {};
      parsed.profile = parsed.profile && typeof parsed.profile === "object" ? parsed.profile : { done: false, samples: [] };
      parsed.profile.samples = Array.isArray(parsed.profile.samples) ? parsed.profile.samples : [];
      parsed.turns = Array.isArray(parsed.turns) ? parsed.turns : [];
      parsed.apiKey = typeof parsed.apiKey === "string" ? parsed.apiKey : "";
      return parsed;
    } catch (error) {
      return emptyData();
    }
  }

  function save() {
    var copy = {
      v: 2,
      aliases: data.aliases,
      profile: data.profile,
      last: data.last,
      turns: data.turns.slice(-80),
      apiKey: data.apiKey || ""
    };
    try { localStorage.setItem(KEY, JSON.stringify(copy)); } catch (error) {}
  }

  function setStatus(text) {
    statusEl.textContent = text || "";
  }

  function setMicUi(on) {
    micBtn.setAttribute("aria-pressed", on ? "true" : "false");
    micBtn.setAttribute("aria-label", on ? "듣는 중. 다시 누르면 보내요" : "말하기. 한 번 누르면 듣고, 다시 누르거나 말을 멈추면 보내요");
    if (micLabel) micLabel.textContent = on ? "듣는 중" : "말하기";
  }

  function variant(tag, en, gloss) {
    var box = document.createElement("div");
    box.className = "variant";
    var label = document.createElement("p");
    label.className = "tag";
    label.textContent = tag;
    var line = document.createElement("p");
    line.className = "en";
    line.lang = "en";
    line.textContent = en || "";
    box.appendChild(label);
    box.appendChild(line);
    if (gloss) {
      var note = document.createElement("p");
      note.className = "gloss";
      note.lang = "ko";
      note.textContent = gloss;
      box.appendChild(note);
    }
    return box;
  }

  function renderTeacher(turn) {
    var art = document.createElement("article");
    art.className = "bubble teacher";
    var who = document.createElement("p");
    who.className = "who";
    who.textContent = "선생님";
    art.appendChild(who);
    if (turn.leadKo) {
      var lead = document.createElement("p");
      lead.className = "lead";
      lead.lang = "ko";
      lead.textContent = turn.leadKo;
      art.appendChild(lead);
    }
    if (turn.coachKo) {
      var coach = document.createElement("p");
      coach.className = "coach";
      coach.lang = "ko";
      coach.textContent = turn.coachKo;
      art.appendChild(coach);
    }
    if (turn.standard) {
      art.appendChild(variant("기본", turn.standard, turn.glossStandard));
      if (turn.casual && turn.casual !== turn.standard) art.appendChild(variant("편하게", turn.casual, turn.glossCasual));
    }
    return art;
  }

  function renderLearner(turn) {
    var art = document.createElement("article");
    art.className = "bubble learner";
    var who = document.createElement("p");
    who.className = "who";
    who.textContent = "나";
    var text = document.createElement("p");
    text.className = "ko";
    text.lang = "ko";
    text.textContent = turn.text || "";
    art.appendChild(who);
    art.appendChild(text);
    return art;
  }

  function render() {
    log.replaceChildren();
    data.turns.forEach(function (turn) {
      log.appendChild(turn.role === "learner" ? renderLearner(turn) : renderTeacher(turn));
    });
    if (!data.turns.length && data.profile.done) {
      var hello = document.createElement("article");
      hello.className = "bubble teacher";
      hello.innerHTML = "<p class='who'>선생님</p><p class='lead'>한국어로 말해 보세요. 영어를 읽어 보면 발음도 고쳐 줘요.</p>";
      log.appendChild(hello);
    }
    if (liveText && mode !== "wake") {
      var live = document.createElement("p");
      live.className = "live";
      live.textContent = "듣는 중: " + liveText;
      log.appendChild(live);
    }
    log.scrollTop = log.scrollHeight;
  }

  function inSetup() {
    return !data.profile.done;
  }

  function showSetup() {
    var steps = engine.setupSteps;
    setupEl.hidden = false;
    log.hidden = true;
    var step = steps[setupIndex];
    setupCount.textContent = (setupIndex + 1) + " / " + steps.length;
    setupLine.textContent = step.show;
    setupHint.textContent = step.hint;
    setStatus("마이크를 한 번 누르고, 화면의 문장을 읽어 주세요.");
  }

  function hideSetup() {
    setupEl.hidden = true;
    log.hidden = false;
  }

  function finishSetup() {
    data.profile.done = true;
    save();
    hideSetup();
    render();
    speakChunks([{ text: "이제 말만 하면 돼요. 화면이 켜져 있을 때 선생님이라고 불러도 돼요.", lang: "ko-KR", rate: 0.95 }]);
  }

  function captureSetup(text) {
    var steps = engine.setupSteps;
    var step = steps[setupIndex];
    if (!text) {
      setupMiss += 1;
      if (setupMiss >= 2) {
        setupMiss = 0;
        setupIndex += 1;
        if (setupIndex >= steps.length) finishSetup();
        else showSetup();
        return;
      }
      setStatus("한 번 더 읽어 주세요.");
      speakChunks([{ text: "잘 안 들렸어요. 같은 문장을 한 번 더 읽어 주세요.", lang: "ko-KR", rate: 0.95 }]);
      return;
    }
    data.aliases = engine.learn(text, step.id, step.lang, { aliases: data.aliases });
    data.profile.samples.push({ id: step.id, lang: step.lang, show: step.show, heard: text });
    save();
    setupIndex += 1;
    setupMiss = 0;
    if (setupIndex >= steps.length) finishSetup();
    else {
      showSetup();
      speakChunks([{ text: "들었어요. 다음이에요.", lang: "ko-KR", rate: 0.95 }]);
    }
  }

  function memory() {
    return { aliases: data.aliases, last: data.last };
  }

  function submitText(text) {
    var clean = String(text || "").replace(/^\s*선생님\s*/, "").trim();
    if (!clean) {
      setStatus("말이 안 들렸어요. 버튼을 한 번 더 눌러 주세요.");
      speakChunks([{ text: "말이 안 들렸어요. 버튼을 한 번 더 눌러 주세요.", lang: "ko-KR", rate: 0.95 }]);
      return;
    }
    if (!engine) {
      setStatus("선생님 파일을 불러오지 못했어요.");
      return;
    }
    input.value = "";
    liveText = "";
    var result;
    try { result = engine.reply(clean, memory()); } catch (error) {
      setStatus("잠깐 문제가 생겼어요. 한 번 더 말해 주세요.");
      speakChunks([{ text: "잠깐 문제가 생겼어요. 한 번 더 말해 주세요.", lang: "ko-KR", rate: 0.95 }]);
      return;
    }
    if (result.kind === "coach" && result.phraseId) {
      data.aliases = engine.learn(clean, result.phraseId, "en", { aliases: data.aliases });
    }
    if (result.next && result.next.last) data.last = result.next.last;
    data.turns.push({ role: "learner", text: clean });
    data.turns.push({
      role: "teacher",
      kind: result.kind,
      leadKo: result.leadKo,
      coachKo: result.coachKo,
      glossStandard: result.glossStandard,
      glossCasual: result.glossCasual,
      standard: result.standard,
      casual: result.casual
    });
    if (data.turns.length > 80) data.turns = data.turns.slice(-80);
    save();
    render();
    speakChunks(chunksFor(result));
  }

  function chunksFor(turn) {
    if (turn.kind === "ask") return [{ text: turn.leadKo, lang: "ko-KR", rate: 0.95 }];
    if (turn.kind === "repeat") {
      var slow = [{ text: "천천히 다시 말할게요.", lang: "ko-KR", rate: 0.95 }];
      if (turn.standard) slow.push({ text: turn.standard, lang: "en-US", rate: 0.6 });
      if (turn.casual && turn.casual !== turn.standard) slow.push({ text: turn.casual, lang: "en-US", rate: 0.62 });
      return slow;
    }
    if (turn.kind === "coach") {
      var coach = [];
      if (turn.coachKo) coach.push({ text: turn.coachKo, lang: "ko-KR", rate: 0.9 });
      if (turn.soundKo) coach.push({ text: "소리는 " + turn.soundKo + " 예요.", lang: "ko-KR", rate: 0.86 });
      if (turn.standard) coach.push({ text: turn.standard, lang: "en-US", rate: 0.6 });
      if (turn.casual && turn.casual !== turn.standard) coach.push({ text: turn.casual, lang: "en-US", rate: 0.66 });
      return coach;
    }
    var chunks = [];
    if (turn.glossStandard) chunks.push({ text: turn.glossStandard, lang: "ko-KR", rate: 0.92 });
    if (turn.standard) chunks.push({ text: turn.standard, lang: "en-US", rate: 0.78 });
    if (turn.casual && turn.casual !== turn.standard) chunks.push({ text: turn.casual, lang: "en-US", rate: 0.82 });
    if (!chunks.length && turn.leadKo) chunks.push({ text: turn.leadKo, lang: "ko-KR", rate: 0.95 });
    return chunks;
  }

  function pickVoice(lang) {
    if (!window.speechSynthesis) return null;
    var voices = window.speechSynthesis.getVoices() || [];
    var exact = voices.filter(function (voice) { return voice.lang && voice.lang.toLowerCase() === lang.toLowerCase(); })[0];
    if (exact) return exact;
    var prefix = lang.slice(0, 2).toLowerCase();
    return voices.filter(function (voice) { return voice.lang && voice.lang.toLowerCase().indexOf(prefix) === 0; })[0] || null;
  }

  function unlockAudio() {
    if (!window.speechSynthesis) return;
    try { window.speechSynthesis.getVoices(); } catch (error) {}
    try { window.speechSynthesis.resume(); } catch (error) {}
  }

  function clearWatchdog() {
    if (watchdog) { clearTimeout(watchdog); watchdog = null; }
  }

  function ensureResumeLoop() {
    if (resumeTimer) return;
    resumeTimer = setInterval(function () {
      if (!speaking || !window.speechSynthesis) return;
      if (window.speechSynthesis.paused) {
        try { window.speechSynthesis.resume(); } catch (error) {}
      }
    }, 1000);
  }

  function stopSpeaking() {
    speakGen += 1;
    queue = [];
    afterSpeak = null;
    clearWatchdog();
    speaking = false;
    if (window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch (error) {}
    }
  }

  function speakNext(gen) {
    if (gen !== speakGen) return;
    clearWatchdog();
    if (!queue.length || !window.speechSynthesis) {
      speaking = false;
      var next = afterSpeak;
      afterSpeak = null;
      if (next) next();
      else startWake();
      return;
    }
    var chunk = queue.shift();
    var id = ++chunkId;
    var utter = new SpeechSynthesisUtterance(chunk.text);
    utter.lang = chunk.lang;
    utter.rate = chunk.rate || 0.9;
    var voice = pickVoice(chunk.lang);
    if (voice) utter.voice = voice;
    var finished = false;
    function done() {
      if (finished || gen !== speakGen || id !== chunkId) return;
      finished = true;
      speakNext(gen);
    }
    utter.onend = done;
    utter.onerror = done;
    try { window.speechSynthesis.speak(utter); } catch (error) {
      queue = [];
      speaking = false;
      setStatus("소리를 지금 내지 못했어요.");
      startWake();
      return;
    }
    var wait = Math.min(25000, Math.max(3500, (chunk.text.length * 180) / (utter.rate || 1) + 1200));
    watchdog = setTimeout(function () {
      if (finished || gen !== speakGen || id !== chunkId) return;
      try { window.speechSynthesis.cancel(); } catch (error) {}
      done();
    }, wait);
  }

  function speakChunks(chunks, then) {
    destroyRec();
    mode = "off";
    setMicUi(false);
    unlockAudio();
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance || !chunks || !chunks.length) {
      if (then) then();
      else startWake();
      return;
    }
    afterSpeak = then || null;
    var synth = window.speechSynthesis;
    var busy = speaking;
    try { busy = busy || !!(synth.speaking || synth.pending); } catch (error) {}
    speakGen += 1;
    queue = chunks.slice();
    clearWatchdog();
    if (busy) {
      try { synth.cancel(); } catch (error) {}
    }
    speaking = true;
    try { synth.resume(); } catch (error) {}
    ensureResumeLoop();
    speakNext(speakGen);
  }

  function clearSilence() {
    if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null; }
  }

  function currentHeard() {
    return (heardFinal + " " + heardInterim).replace(/\s+/g, " ").trim();
  }

  function destroyRec() {
    clearSilence();
    restartPending = false;
    if (!rec) return;
    var old = rec;
    rec = null;
    try { old.onstart = null; old.onresult = null; old.onerror = null; old.onend = null; } catch (error) {}
    try { old.abort(); } catch (error) {}
  }

  function primeMic() {
    if (micPrimed) return Promise.resolve(true);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return Promise.resolve(false);
    if (primePromise) return primePromise;
    primePromise = navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      stream.getTracks().forEach(function (track) { try { track.stop(); } catch (error) {} });
      micPrimed = true;
      primePromise = null;
      return true;
    }).catch(function (error) {
      primePromise = null;
      var name = error && error.name;
      if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") micDenied = true;
      return false;
    });
    return primePromise;
  }

  function handleHeard(text) {
    var heardMode = mode;
    mode = "off";
    setMicUi(false);
    liveText = "";
    destroyRec();
    if (heardMode === "setup" || inSetup()) captureSetup(text);
    else if (heardMode === "wake") takeWake(text);
    else submitText(text);
  }

  function takeWake(text) {
    if (text.indexOf("선생님") === -1) {
      startWake();
      return;
    }
    var rest = text.replace(/^[\s\S]*선생님/, "").trim();
    if (!rest) {
      speakChunks([{ text: "네, 말씀하세요.", lang: "ko-KR", rate: 0.95 }], function () { startTalk(); });
      return;
    }
    submitText(rest);
  }

  function armSilence(wait, wake) {
    clearSilence();
    silenceTimer = setTimeout(function () {
      silenceTimer = null;
      if (mode !== "talk" && mode !== "setup" && mode !== "wake") return;
      var text = currentHeard();
      if (wake) {
        if (text.indexOf("선생님") === -1) return;
        handleHeard(text);
        return;
      }
      if (!text) return;
      handleHeard(text);
    }, wait);
  }

  function buildRec(kind) {
    var recognition = new Rec();
    recognition.lang = "ko-KR";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;
    recognition.onstart = function () {
      if (kind === "talk" || kind === "setup") setStatus("듣는 중… 말을 멈추거나 버튼을 다시 누르면 보내요.");
      else if (kind === "wake") setStatus("화면이 켜져 있는 동안 ‘선생님’을 들어요.");
    };
    recognition.onresult = function (event) {
      if (mode !== kind) return;
      var finalText = "";
      var interim = "";
      for (var i = 0; i < event.results.length; i++) {
        var piece = event.results[i][0] ? event.results[i][0].transcript : "";
        if (event.results[i].isFinal) finalText += piece;
        else interim += piece;
      }
      heardFinal = finalText.trim();
      heardInterim = interim.trim();
      liveText = currentHeard();
      if (kind !== "wake") render();
      if (!liveText) return;
      if (kind === "wake") {
        if (liveText.indexOf("선생님") !== -1) armSilence(700, true);
        return;
      }
      armSilence(1100, false);
    };
    recognition.onerror = function (event) {
      var code = event && event.error;
      if (!code || code === "aborted" || code === "no-speech") return;
      if (code === "not-allowed" || code === "service-not-allowed") {
        if (!micPrimed) micDenied = true;
        mode = "off";
        setMicUi(false);
        setStatus("마이크 권한이 필요해요. 설정에서 Safari 마이크를 허용해 주세요.");
        speakChunks([{ text: "마이크 권한이 필요해요. 설정에서 사파리 마이크를 허용해 주세요.", lang: "ko-KR", rate: 0.95 }]);
        return;
      }
      if (mode === kind) scheduleRestart(kind);
    };
    recognition.onend = function () {
      if (mode !== kind) return;
      if ((kind === "talk" || kind === "setup") && currentHeard()) {
        armSilence(400, false);
        return;
      }
      if (kind === "wake" && currentHeard().indexOf("선생님") !== -1) {
        armSilence(300, true);
        return;
      }
      scheduleRestart(kind);
    };
    return recognition;
  }

  function scheduleRestart(kind) {
    if (mode !== kind || restartPending) return;
    if (restarts >= 6) {
      mode = "off";
      setMicUi(false);
      if (kind === "wake") {
        setStatus("‘선생님’ 듣기가 끊겼어요. 화면을 한 번 누르면 다시 들어요.");
        return;
      }
      setStatus("받아쓰기가 끊겼어요. 버튼을 한 번 더 눌러 주세요.");
      return;
    }
    restartPending = true;
    var wait = [250, 600, 1200, 2000, 3000, 3000][restarts] || 3000;
    restarts += 1;
    clearSilence();
    silenceTimer = setTimeout(function () {
      restartPending = false;
      silenceTimer = null;
      if (mode !== kind) return;
      try {
        if (!rec) rec = buildRec(kind);
        rec.start();
      } catch (error) {
        destroyRec();
        mode = kind;
        try { rec = buildRec(kind); rec.start(); } catch (again) { scheduleRestart(kind); }
      }
    }, wait);
  }

  function beginRec(kind) {
    if (!Rec) {
      setStatus("이 사파리는 받아쓰기를 지원하지 않아요. 아래 칸에 쓸 수 있어요.");
      speakChunks([{ text: "이 사파리는 말로 받아쓰기를 지원하지 않아요. 아래 칸에 써 주세요.", lang: "ko-KR", rate: 0.95 }]);
      return;
    }
    if (!window.isSecureContext) {
      setStatus("마이크는 https 주소에서만 열려요.");
      return;
    }
    destroyRec();
    heardFinal = "";
    heardInterim = "";
    liveText = "";
    restarts = 0;
    mode = kind;
    if (kind !== "wake") setMicUi(true);
    rec = buildRec(kind);
    try { rec.start(); } catch (error) { scheduleRestart(kind); }
  }

  function startTalk() {
    stopSpeaking();
    if (!micPrimed) primeMic();
    beginRec(inSetup() ? "setup" : "talk");
  }

  function startWake() {
    if (!armed || speaking || inSetup() || mode === "talk" || mode === "setup") return;
    if (document.visibilityState !== "visible") return;
    if (mode === "wake" && rec) return;
    beginRec("wake");
  }

  function finishListen() {
    if (mode !== "talk" && mode !== "setup") return;
    var text = currentHeard();
    handleHeard(text);
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (inSetup()) return;
    stopSpeaking();
    destroyRec();
    mode = "off";
    setMicUi(false);
    submitText(input.value);
  });

  micBtn.addEventListener("click", function () {
    armed = true;
    unlockAudio();
    if (mode === "talk" || mode === "setup") finishListen();
    else startTalk();
  });

  micBtn.addEventListener("contextmenu", function (event) { event.preventDefault(); });

  setupSkip.addEventListener("click", function () {
    armed = true;
    setupMiss = 0;
    setupIndex += 1;
    destroyRec();
    mode = "off";
    setMicUi(false);
    if (setupIndex >= engine.setupSteps.length) finishSetup();
    else showSetup();
  });

  redoVoice.addEventListener("click", function () {
    armed = true;
    stopSpeaking();
    destroyRec();
    mode = "off";
    data.profile.done = false;
    setupIndex = 0;
    setupMiss = 0;
    save();
    showSetup();
  });

  apiKey.addEventListener("input", function () {
    data.apiKey = apiKey.value;
    save();
  });

  clearBtn.addEventListener("click", function () {
    if (!window.confirm("대화를 지울까요? 목소리 맞추기는 남겨 둘게요.")) return;
    stopSpeaking();
    destroyRec();
    mode = "off";
    data.turns = [];
    data.last = null;
    save();
    setStatus("");
    render();
    startWake();
  });

  document.addEventListener("pointerdown", function () {
    armed = true;
    unlockAudio();
    if (mode === "off" && !speaking) startWake();
  }, { passive: true });

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState !== "visible") {
      if (mode === "wake") {
        destroyRec();
        mode = "off";
      }
      return;
    }
    if (mode === "off" && !speaking) startWake();
  });

  function syncViewport() {
    var view = window.visualViewport;
    var height = view ? view.height : window.innerHeight;
    var top = view ? view.offsetTop : 0;
    document.documentElement.style.setProperty("--app-height", Math.round(height) + "px");
    document.documentElement.style.setProperty("--vv-top", Math.round(top) + "px");
  }

  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = function () {
      try { window.speechSynthesis.getVoices(); } catch (error) {}
    };
  }

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(function () {});

  apiKey.value = "";
  syncViewport();
  window.addEventListener("resize", syncViewport);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", syncViewport);
    window.visualViewport.addEventListener("scroll", syncViewport);
  }

  if (inSetup()) showSetup();
  else {
    hideSetup();
    render();
    setStatus("화면을 한 번 누르면, 켜져 있는 동안 ‘선생님’을 들어요.");
  }
})();
