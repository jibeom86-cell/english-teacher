(function () {
  "use strict";

  var KEY = "ko-en-teacher-v1";
  var WELCOME = {
    leadKo: "안녕하세요. 한국어로 말하면, 제가 짧은 영어 문장을 알려 드릴게요.\n일상에서 쓰는 말이랑, 젊은 사람들이 쓰는 말을 둘 다 들려줘요.",
    bridgeKo: "예를 들어 인사는 이렇게 해요.",
    standard: "Hello.",
    casual: "Hey.",
    glossStandard: "만날 때 하는 인사예요.",
    glossCasual: "친구한테는 더 짧게 말해요."
  };

  var log = document.getElementById("log");
  var form = document.getElementById("form");
  var input = document.getElementById("input");
  var micBtn = document.getElementById("mic");
  var micLabel = document.getElementById("micLabel");
  var statusEl = document.getElementById("status");
  var chips = document.getElementById("chips");
  var clearBtn = document.getElementById("clearBtn");
  var Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  var rec = null;
  var holding = false;
  var speaking = false;
  var speakMode = "lesson";
  var micPrimed = false;
  var micDenied = false;
  var primePromise = null;
  var heardFinal = "";
  var heardInterim = "";
  var restarts = 0;
  var committed = true;
  var suppressClick = false;
  var liveText = "";
  var queue = [];
  var speakGen = 0;
  var chunkId = 0;
  var watchdog = null;
  var resumeTimer = null;
  var listenTimer = null;
  var silenceTimer = null;
  var data = load();

  function emptyData() {
    return { v: 1, rate: 1, taught: [], last: null, turnCount: 0, name: null, turns: [] };
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return emptyData();
      var parsed = JSON.parse(raw);
      if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.turns)) return emptyData();
      parsed.taught = Array.isArray(parsed.taught) ? parsed.taught : [];
      parsed.rate = typeof parsed.rate === "number" ? parsed.rate : 1;
      parsed.turnCount = typeof parsed.turnCount === "number" ? parsed.turnCount : parsed.turns.length;
      return parsed;
    } catch (error) {
      return emptyData();
    }
  }

  function save() {
    var copy = {
      v: 1,
      rate: data.rate,
      taught: data.taught,
      last: data.last,
      turnCount: data.turnCount,
      name: data.name,
      turns: data.turns.slice(-80)
    };
    try {
      localStorage.setItem(KEY, JSON.stringify(copy));
    } catch (error) {
      copy.turns = copy.turns.slice(-40);
      try { localStorage.setItem(KEY, JSON.stringify(copy)); } catch (again) {}
    }
  }

  function setStatus(text) {
    statusEl.textContent = text || "";
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
    var lead = document.createElement("p");
    lead.className = "lead";
    lead.lang = "ko";
    lead.textContent = turn.leadKo || "";
    art.appendChild(who);
    art.appendChild(lead);
    if (turn.standard) {
      art.appendChild(variant("기본", turn.standard, turn.glossStandard));
      art.appendChild(variant("편하게", turn.casual, turn.glossCasual));
    }
    if (turn.leadKo || turn.standard) {
      var replay = document.createElement("button");
      replay.type = "button";
      replay.className = "replay";
      replay.textContent = "다시 듣기";
      replay.addEventListener("click", function () { speakTurn(turn); });
      art.appendChild(replay);
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
    if (!data.turns.length) log.appendChild(renderTeacher(WELCOME));
    data.turns.forEach(function (turn) {
      log.appendChild(turn.role === "learner" ? renderLearner(turn) : renderTeacher(turn));
    });
    if (liveText) {
      var live = document.createElement("p");
      live.className = "live";
      live.textContent = "듣는 중: " + liveText;
      log.appendChild(live);
    }
    log.scrollTop = log.scrollHeight;
  }

  function memory() {
    return {
      rate: data.rate,
      taught: data.taught,
      last: data.last,
      turnCount: data.turnCount,
      name: data.name
    };
  }

  function submitText(text) {
    var clean = String(text || "").trim();
    if (!clean) return;
    if (!window.EnglishTeacherEngine) {
      setStatus("앱 파일을 모두 불러오지 못했어요.");
      return;
    }
    releaseMic();
    input.value = "";
    liveText = "";
    var result;
    try {
      result = window.EnglishTeacherEngine.reply(clean, memory());
    } catch (error) {
      setStatus("잠깐 문제가 생겼어요. 한 번 더 말해 주세요.");
      return;
    }
    data.turns.push({ role: "learner", text: clean });
    data.turns.push({
      role: "teacher",
      leadKo: result.leadKo,
      bridgeKo: result.bridgeKo,
      standard: result.standard,
      casual: result.casual,
      glossStandard: result.glossStandard,
      glossCasual: result.glossCasual
    });
    data.rate = result.next.rate;
    data.taught = result.next.taught;
    data.last = result.next.last;
    data.turnCount = result.next.turnCount;
    data.name = result.next.name;
    if (data.turns.length > 80) data.turns = data.turns.slice(-80);
    save();
    render();
    speakTurn(data.turns[data.turns.length - 1], isRepeatAsk(clean) && result.standard ? "repeat" : "lesson");
  }

  function hearKey(text) {
    return String(text || "").toLowerCase().replace(/[?.!…,~'"“”‘’]/g, "").replace(/\s+/g, "");
  }

  function isRepeatAsk(text) {
    var key = hearKey(text);
    return key === "다시" || key === "다시요" || key === "다시말해줘" || key === "다시말해주세요" || key === "한번더" || key === "못들었어요" || key === "다시들려주세요" || key === "천천히" || key === "천천히요" || key === "더천천히" || key === "천천히말해주세요" || key === "좀천천히";
  }

  function lessonChunks(turn) {
    var chunks = [];
    if (turn.standard) {
      if (turn.glossStandard) chunks.push({ text: turn.glossStandard, lang: "ko-KR" });
      chunks.push({ text: turn.standard, lang: "en-US" });
      if (turn.casual && turn.casual !== turn.standard) chunks.push({ text: turn.casual, lang: "en-US" });
    } else if (turn.leadKo) {
      chunks.push({ text: String(turn.leadKo).replace(/\n+/g, " "), lang: "ko-KR" });
    }
    return chunks;
  }

  function repeatChunks(turn) {
    var chunks = [];
    if (turn.standard) chunks.push({ text: turn.standard, lang: "en-US" });
    if (turn.casual && turn.casual !== turn.standard) chunks.push({ text: turn.casual, lang: "en-US" });
    return chunks;
  }

  function chunksFor(turn) {
    if (speakMode === "repeat") {
      var repeated = repeatChunks(turn);
      if (repeated.length) return repeated;
    }
    return lessonChunks(turn);
  }

  function pickVoice(lang) {
    if (!window.speechSynthesis) return null;
    var voices = window.speechSynthesis.getVoices() || [];
    var exact = voices.filter(function (voice) { return voice.lang && voice.lang.toLowerCase() === lang.toLowerCase(); })[0];
    if (exact) return exact;
    var prefix = lang.slice(0, 2).toLowerCase();
    return voices.filter(function (voice) { return voice.lang && voice.lang.toLowerCase().indexOf(prefix) === 0; })[0] || null;
  }

  function setSpeaking(on) {
    speaking = on;
  }

  function unlockAudio() {
    if (!window.speechSynthesis) return;
    try { window.speechSynthesis.getVoices(); } catch (error) {}
    try { window.speechSynthesis.resume(); } catch (error) {}
  }

  function clearWatchdog() {
    if (watchdog) {
      clearTimeout(watchdog);
      watchdog = null;
    }
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
    clearWatchdog();
    setSpeaking(false);
    if (window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch (error) {}
    }
  }

  function speakNext(gen) {
    if (gen !== speakGen) return;
    clearWatchdog();
    if (!queue.length || !window.speechSynthesis) {
      setSpeaking(false);
      if (!holding) destroyRec();
      return;
    }
    var chunk = queue.shift();
    var id = ++chunkId;
    var utter = new SpeechSynthesisUtterance(chunk.text);
    utter.lang = chunk.lang;
    var english = chunk.lang.indexOf("en") === 0;
    if (speakMode === "repeat") utter.rate = 0.64;
    else if (speakMode === "notice") utter.rate = 0.95;
    else utter.rate = english ? 0.76 : 0.9;
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
    try {
      window.speechSynthesis.speak(utter);
    } catch (error) {
      queue = [];
      setSpeaking(false);
      setStatus("소리를 지금 내지 못했어요. 글은 그대로 볼 수 있어요.");
      return;
    }
    var rate = utter.rate || 1;
    var perChar = chunk.lang.indexOf("ko") === 0 ? 220 : 120;
    var wait = Math.min(25000, Math.max(4000, (chunk.text.length * perChar) / rate + 1200));
    watchdog = setTimeout(function () {
      if (finished || gen !== speakGen || id !== chunkId) return;
      try { window.speechSynthesis.cancel(); } catch (error) {}
      done();
    }, wait);
  }

  function speakTurn(turn, mode) {
    speakMode = mode || "lesson";
    releaseMic();
    unlockAudio();
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      setStatus("이 브라우저는 소리 내기를 지원하지 않아요. 글은 그대로 볼 수 있어요.");
      return;
    }
    var next = chunksFor(turn);
    if (!next.length) return;
    var synth = window.speechSynthesis;
    var busy = speaking;
    try { busy = busy || !!(synth.speaking || synth.pending); } catch (error) {}
    speakGen += 1;
    var gen = speakGen;
    queue = next;
    clearWatchdog();
    if (busy) {
      try { synth.cancel(); } catch (error) {}
    }
    setSpeaking(true);
    try { synth.resume(); } catch (error) {}
    ensureResumeLoop();
    speakNext(gen);
  }

  function clearListenTimer() {
    if (listenTimer) {
      clearTimeout(listenTimer);
      listenTimer = null;
    }
  }

  function focusInput() {
    try { input.focus({ preventScroll: false }); } catch (error) {
      try { input.focus(); } catch (again) {}
    }
  }

  function speakNotice(text) {
    if (!text) return;
    speakTurn({ leadKo: text }, "notice");
  }

  function showTyping(message) {
    form.hidden = false;
    if (message) setStatus(message);
    focusInput();
  }

  function currentHeard() {
    return (heardFinal + " " + heardInterim).replace(/\s+/g, " ").trim();
  }

  function destroyRec() {
    if (!rec) return;
    var old = rec;
    rec = null;
    try {
      old.onstart = null;
      old.onresult = null;
      old.onerror = null;
      old.onend = null;
    } catch (error) {}
    try { old.abort(); } catch (error) {}
  }

  function clearSilence() {
    if (silenceTimer) {
      clearTimeout(silenceTimer);
      silenceTimer = null;
    }
  }

  function setMicUi(on) {
    micBtn.setAttribute("aria-pressed", on ? "true" : "false");
    micBtn.setAttribute("aria-label", on ? "듣는 중. 다시 누르면 보내요" : "말하기. 한 번 누르면 듣고, 다시 누르거나 말을 멈추면 보내요");
    if (micLabel) micLabel.textContent = on ? "듣는 중" : "말하기";
  }

  function releaseMic() {
    holding = false;
    committed = true;
    restartPending = false;
    clearListenTimer();
    clearSilence();
    liveText = "";
    setMicUi(false);
    destroyRec();
  }

  function giveUp(message, openKeyboard) {
    releaseMic();
    render();
    setStatus(message);
    if (openKeyboard) showTyping(message);
    speakNotice(message);
  }

  function primeMic() {
    if (micPrimed) return Promise.resolve(true);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return Promise.resolve(false);
    if (primePromise) return primePromise;
    primePromise = navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      stream.getTracks().forEach(function (track) {
        try { track.stop(); } catch (error) {}
      });
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

  var restartPending = false;

  function scheduleRestart() {
    if (!holding || committed || restartPending) return;
    if (restarts >= 4) {
      giveUp("받아쓰기가 끊겼어요. 버튼을 한 번 더 누르고 말해 주세요.", false);
      return;
    }
    restartPending = true;
    var wait = [300, 1000, 2000, 3500][restarts] || 3500;
    restarts += 1;
    setStatus("다시 연결하고 있어요. 계속 말해 주세요.");
    clearListenTimer();
    listenTimer = setTimeout(function () {
      restartPending = false;
      if (!holding || committed) return;
      try {
        if (!rec) rec = buildRec();
        rec.start();
      } catch (error) {
        destroyRec();
        try {
          rec = buildRec();
          rec.start();
        } catch (again) {
          scheduleRestart();
        }
      }
    }, wait);
  }

  function buildRec() {
    var recognition = new Rec();
    recognition.lang = "ko-KR";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;
    recognition.onstart = function () {
      if (holding) setStatus("듣는 중… 말을 멈추거나 버튼을 다시 누르면 보내요.");
    };
    recognition.onresult = function (event) {
      if (committed) return;
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
      render();
      if (currentHeard()) armSilence(1100);
    };
    recognition.onerror = function (event) {
      var code = event && event.error;
      if (!code || code === "aborted" || code === "no-speech") return;
      if (code === "not-allowed" || code === "service-not-allowed") {
        if (!micPrimed) micDenied = true;
        giveUp(micPrimed
          ? "받아쓰기를 지금 시작하지 못했어요. 버튼을 다시 한 번 눌러 주세요."
          : "마이크 권한이 필요해요. 설정에서 Safari 마이크를 허용한 뒤, 버튼을 다시 누르세요.", false);
        return;
      }
      if (holding) scheduleRestart();
      else giveUp("말로 바꾸려면 인터넷이 필요할 수 있어요. 버튼을 다시 누르거나 아래 칸에 쓸 수 있어요.", true);
    };
    recognition.onend = function () {
      if (committed) return;
      if (holding && currentHeard()) {
        armSilence(500);
        return;
      }
      if (holding) {
        scheduleRestart();
        return;
      }
      armCommit();
    };
    return recognition;
  }

  function beginRecognition() {
    if (!holding || committed) return;
    destroyRec();
    rec = buildRec();
    try {
      rec.start();
    } catch (error) {
      scheduleRestart();
    }
  }

  function commitHeard() {
    if (committed) return;
    committed = true;
    clearListenTimer();
    clearSilence();
    var text = currentHeard();
    holding = false;
    setMicUi(false);
    liveText = "";
    if (text) submitText(text);
    else {
      render();
      setStatus("말이 안 들렸어요. 버튼을 한 번 더 누르고 말해 주세요.");
      speakNotice("말이 안 들렸어요. 버튼을 다시 누르고 말해 주세요.");
    }
  }

  function armSilence(wait) {
    if (committed || !holding || !currentHeard()) return;
    clearSilence();
    silenceTimer = setTimeout(function () {
      silenceTimer = null;
      if (!holding || committed || !currentHeard()) return;
      finishTalk();
    }, wait);
  }

  function armCommit() {
    if (committed || holding) return;
    clearListenTimer();
    listenTimer = setTimeout(commitHeard, 700);
  }

  function finishTalk() {
    if (committed) return;
    holding = false;
    clearSilence();
    if (rec) {
      try { rec.stop(); } catch (error) {}
    }
    if (currentHeard()) commitHeard();
    else armCommit();
  }

  function startHold() {
    if (holding) return;
    unlockAudio();
    stopSpeaking();
    if (!Rec) {
      var missing = "이 사파리는 말로 받아쓰기를 지원하지 않아요. 아래 칸에 한글로 써 주세요.";
      showTyping(missing);
      speakNotice(missing);
      return;
    }
    if (!window.isSecureContext) {
      var insecure = "마이크는 https 주소에서만 열려요. 아래 칸에 한글로 쓸 수 있어요.";
      showTyping(insecure);
      speakNotice(insecure);
      return;
    }
    if (micDenied) {
      micDenied = false;
      micPrimed = false;
      primePromise = null;
    }
    committed = false;
    restarts = 0;
    restartPending = false;
    heardFinal = "";
    heardInterim = "";
    liveText = "";
    holding = true;
    setMicUi(true);
    setStatus("듣는 중… 말을 멈추거나 버튼을 다시 누르면 보내요.");
    if (!micPrimed) primeMic();
    beginRecognition();
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    submitText(input.value);
  });

  micBtn.addEventListener("contextmenu", function (event) { event.preventDefault(); });
  micBtn.addEventListener("click", function () {
    if (holding) finishTalk();
    else startHold();
  });

  clearBtn.addEventListener("click", function () {
    if (!window.confirm("대화를 지울까요? 이 폰에 저장된 대화가 사라져요.")) return;
    stopSpeaking();
    releaseMic();
    data = emptyData();
    save();
    setStatus("");
    render();
  });

  function syncViewport() {
    var view = window.visualViewport;
    var height = view ? view.height : window.innerHeight;
    var top = view ? view.offsetTop : 0;
    document.documentElement.style.setProperty("--app-height", Math.round(height) + "px");
    document.documentElement.style.setProperty("--vv-top", Math.round(top) + "px");
  }

  document.addEventListener("pointerdown", function () {
    unlockAudio();
  }, { passive: true });

  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = function () {
      try { window.speechSynthesis.getVoices(); } catch (error) {}
    };
    try { window.speechSynthesis.getVoices(); } catch (error) {}
  }

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState !== "visible") releaseMic();
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }

  window.addEventListener("offline", function () {
    if (!statusEl.textContent) {
      setStatus("화면은 이 폰에 저장돼요. 말로 바꾸기는 인터넷이 필요할 수 있어요.");
    }
  });

  syncViewport();
  window.addEventListener("resize", syncViewport);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", syncViewport);
    window.visualViewport.addEventListener("scroll", syncViewport);
  }

  render();
})();
