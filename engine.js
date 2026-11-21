/* 폰 안에서만 동작하는 영어 선생님. 인터넷 열쇠는 쓰지 않아요. */
(function () {
  "use strict";

  function validEnglish(text) {
    if (!text || typeof text !== "string") return false;
    if (text !== text.trim()) return false;
    if (/[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(text)) return false;
    if (/\b(undefined|null|NaN)\b/.test(text)) return false;
    if (!/^[A-Z]/.test(text)) return false;
    if (!/[.?!]$/.test(text)) return false;
    if (/\s{2,}/.test(text)) return false;
    if (/\ba\s+[aeiou]/i.test(text)) return false;
    if (/\ban\s+[^aeiou]/i.test(text)) return false;
    if (/\bto to\b/i.test(text) || /\bthe the\b/i.test(text)) return false;
    var words = text.replace(/[\"“”]/g, "").replace(/[.?!]/g, "").trim().split(/\s+/);
    if (!words.length || words.length > 16) return false;
    return true;
  }

  function norm(text) {
    return String(text || "")
      .trim()
      .toLowerCase()
      .replace(/[?!？！。．.，,~…"'“”‘’「」『』()[\]{}]/g, "")
      .replace(/\s+/g, "");
  }

  function cap(text) {
    text = String(text || "");
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
  }

  var PHRASES = [];
  var PHRASE_BY_ID = Object.create(null);
  var INDEX = Object.create(null);
  var DUP_KEYS = [];

  function addPhrase(spec) {
    PHRASES.push(spec);
    PHRASE_BY_ID[spec.id] = spec;
    function put(list, via) {
      (list || []).forEach(function (key) {
        var n = norm(key);
        if (!n) return;
        if (INDEX[n] && INDEX[n].phrase.id !== spec.id) DUP_KEYS.push(n);
        else INDEX[n] = { phrase: spec, via: via };
      });
    }
    put(spec.ko, "ko");
    put(spec.en, "en");
    put(spec.konglish, "konglish");
  }

  function lesson(standard, casual, gloss, casualGloss, id) {
    if (!validEnglish(standard) || !validEnglish(casual)) return null;
    return {
      kind: "lesson",
      phraseId: id || null,
      learnLang: "ko",
      leadKo: "이렇게 말해 보세요.",
      glossStandard: gloss,
      glossCasual: casualGloss,
      standard: standard,
      casual: casual,
      coachKo: null,
      soundKo: null,
      slow: false
    };
  }

  addPhrase({
    id: "greet-hello",
    ko: ["안녕하세요", "안녕하십니까"],
    en: ["hello"],
    konglish: ["헬로", "할로", "헬로우", "헐로", "헬로어"],
    standard: "Hello.",
    casual: "Hey.",
    gloss: "만날 때 하는 인사예요.",
    casualGloss: "친구한테는 더 짧게 말해요.",
    sound: "헬로우",
    coach: "‘헬로’만 말하면 끝이 짧아요. ‘헬로우’처럼 입을 둥글게 오므리며 끝내세요."
  });
  addPhrase({
    id: "greet-thanks",
    ko: ["감사합니다", "감사해요", "고마워요", "고맙습니다"],
    en: ["thank you", "thanks"],
    konglish: ["땡큐", "텐큐", "쌩큐", "땡크유"],
    standard: "Thank you.",
    casual: "Thanks.",
    gloss: "고맙다는 말이에요.",
    casualGloss: "짧게 말한 거예요.",
    sound: "땡크 유",
    coach: "thank는 ‘땡크’, you는 ‘유’예요. 붙이면 ‘땡큐’처럼 들려요."
  });
  addPhrase({
    id: "greet-sorry",
    ko: ["죄송해요", "죄송합니다", "미안해요", "미안합니다"],
    en: ["i'm sorry", "sorry"],
    konglish: ["쏘리", "아이엠쏘리", "아임쏘리"],
    standard: "I'm sorry.",
    casual: "Sorry.",
    gloss: "사과하는 말이에요.",
    casualGloss: "짧게 사과해요.",
    sound: "아임 쏘리",
    coach: "sorry는 ‘소’보다 입을 조금 더 벌린 ‘쏘리’예요."
  });
  addPhrase({
    id: "greet-yes",
    ko: ["네", "예"],
    en: ["yes", "yeah"],
    konglish: ["예스", "예쓰"],
    standard: "Yes.",
    casual: "Yeah.",
    gloss: "맞다는 말이에요.",
    casualGloss: "편하게 말한 거예요.",
    sound: "예스",
    coach: "yes는 ‘예스’예요. 끝을 ‘쓰’처럼 짧게 끊으세요."
  });
  addPhrase({
    id: "greet-no",
    ko: ["아니요", "아니오", "아니에요"],
    en: ["no", "nope"],
    konglish: ["노우", "노프"],
    standard: "No.",
    casual: "Nope.",
    gloss: "아니라는 말이에요.",
    casualGloss: "친구끼리 쓰는 말이에요.",
    sound: "노우",
    coach: "no는 ‘노’에서 끝나지 않고 ‘노우’처럼 입을 조금 모아요."
  });
  addPhrase({
    id: "greet-ok",
    ko: ["괜찮아요", "괜찮습니다"],
    en: ["it's okay", "okay", "ok"],
    konglish: ["오케이", "잇츠오케이"],
    standard: "It's okay.",
    casual: "It's all good.",
    gloss: "문제없다는 말이에요.",
    casualGloss: "편하게 괜찮다고 해요.",
    sound: "잇츠 오케이",
    coach: "okay는 ‘오케이’예요. it's는 ‘잇츠’로 붙여 말해요."
  });
  addPhrase({
    id: "daily-wait",
    ko: ["잠깐만요", "잠시만요", "잠시만"],
    en: ["one moment please", "one moment"],
    konglish: ["원모먼트"],
    standard: "One moment, please.",
    casual: "One sec.",
    gloss: "잠시만 기다리라는 말이에요.",
    casualGloss: "아주 짧게 말한 거예요.",
    sound: "원 모먼트 플리즈",
    coach: "moment는 ‘모먼트’예요. ‘모멘트’보다 ‘트’를 살짝 끊어요."
  });
  addPhrase({
    id: "daily-english",
    ko: ["영어를잘못해요", "영어못해요", "영어를못해요"],
    en: ["i don't speak english well"],
    konglish: ["아이돈트스픽잉글리시"],
    standard: "I don't speak English well.",
    casual: "My English isn't great.",
    gloss: "영어가 서툴다는 말이에요.",
    casualGloss: "부담 없이 말하는 법이에요.",
    sound: "아이 돈트 스픽 잉글리시 웰",
    coach: "don't는 ‘돈트’, speak는 ‘스픽’, English는 ‘잉글리시’예요."
  });
  addPhrase({
    id: "daily-again",
    ko: ["다시말해주세요", "다시한번말해주세요", "다시말해줘"],
    en: ["could you say that again", "say that again"],
    konglish: ["세이댓어게인", "어게인"],
    standard: "Could you say that again?",
    casual: "One more time, please?",
    gloss: "한 번 더 말해 달라는 말이에요.",
    casualGloss: "짧게 부탁하는 말이에요.",
    sound: "세이 댓 어게인",
    coach: "again은 ‘어게인’이에요. ‘어개인’이 아니에요."
  });
  addPhrase({
    id: "daily-slow",
    ko: ["천천히말해주세요", "천천히말해줘"],
    en: ["could you speak slowly", "speak slowly"],
    konglish: ["스픽슬로울리", "슬로울리"],
    standard: "Could you speak slowly?",
    casual: "A little slower, please?",
    gloss: "천천히 말해 달라는 말이에요.",
    casualGloss: "짧게 부탁하는 말이에요.",
    sound: "스픽 슬로울리",
    coach: "slowly는 ‘슬로울리’예요. slowly의 ow는 ‘오우’에 가까워요."
  });
  addPhrase({
    id: "daily-help",
    ko: ["도와주세요", "도와줘"],
    en: ["please help me", "can you help me"],
    konglish: ["헬프미", "플리즈헬프미"],
    standard: "Please help me.",
    casual: "Can you help me?",
    gloss: "도움을 부탁해요.",
    casualGloss: "질문처럼 부탁해요.",
    sound: "플리즈 헬프 미",
    coach: "help는 ‘헬프’예요. ‘헬프’에서 p 소리를 살짝 터뜨리세요."
  });
  addPhrase({
    id: "arrive",
    ko: ["도착했어요", "도착했습니다", "다왔어요", "나왔어요"],
    en: ["i've arrived", "i'm here"],
    konglish: ["아임히어", "아이엠히어", "암히어", "아임히얼"],
    standard: "I've arrived.",
    casual: "I'm here.",
    gloss: "도착했다는 말이에요.",
    casualGloss: "왔다는 짧은 말이에요.",
    sound: "아임 히어",
    coach: "I'm은 ‘아임’으로 붙이고, here는 ‘히어’예요. ‘힐’로 끝나면 다른 말이에요."
  });
  addPhrase({
    id: "coming",
    ko: ["갈게요", "지금갈게요", "곧갈게요", "지금가요"],
    en: ["i'll be right there", "i'm coming"],
    konglish: ["아일비라잇데어", "아임커밍"],
    standard: "I'll be right there.",
    casual: "I'm coming.",
    gloss: "곧 간다는 말이에요.",
    casualGloss: "지금 가고 있다는 말이에요.",
    sound: "아일 비 라잇 데어",
    coach: "right는 ‘라잇’이에요. there는 ‘데어’이고 ‘더’가 아니에요."
  });
  addPhrase({
    id: "where-you",
    ko: ["어디세요", "어디계세요", "지금어디세요", "어디에계세요"],
    en: ["where are you"],
    konglish: ["웨어아유", "웨어알유"],
    standard: "Where are you?",
    casual: "Hey, where are you?",
    gloss: "어디 있는지 물어요.",
    casualGloss: "앞에 hey를 붙여요.",
    sound: "웨어 아 유",
    coach: "where는 ‘웨어’, are는 ‘아’, you는 ‘유’예요."
  });
  addPhrase({
    id: "which-floor",
    ko: ["몇층이에요", "몇층이세요", "몇층인가요", "몇층이죠"],
    en: ["which floor is it", "what floor"],
    konglish: ["위치플로어", "왓플로어", "윗치플로어"],
    standard: "Which floor is it?",
    casual: "What floor?",
    gloss: "몇 층인지 물어요.",
    casualGloss: "짧게 물은 거예요.",
    sound: "윗치 플로어",
    coach: "which는 ‘윗치’, floor는 ‘플로어’예요. ‘플로르’로 끝내지 마세요."
  });
  addPhrase({
    id: "doorbell",
    ko: ["초인종눌러주세요", "벨눌러주세요", "초인종좀눌러주세요"],
    en: ["please ring the doorbell", "just ring the bell"],
    konglish: ["플리즈링더도어벨", "링더벨", "도어벨"],
    standard: "Please ring the doorbell.",
    casual: "Just ring the bell.",
    gloss: "초인종을 눌러 달라는 말이에요.",
    casualGloss: "짧게 부탁하는 말이에요.",
    sound: "플리즈 링 더 도어벨",
    coach: "ring은 ‘링’, bell은 ‘벨’이에요. doorbell은 ‘도어벨’로 한 번에 말해요."
  });
  addPhrase({
    id: "elevator-down",
    ko: ["엘리베이터가고장났어요", "엘리베이터고장났어요", "승강기고장났어요", "엘리베이터가안돼요"],
    en: ["the elevator is out of order", "the elevator isn't working"],
    konglish: ["엘리베이터브로큰", "엘리베이터이즈다운"],
    standard: "The elevator is out of order.",
    casual: "The elevator's down.",
    gloss: "엘리베이터가 안 된다는 말이에요.",
    casualGloss: "고장 났다는 편한 말이에요.",
    sound: "디 엘러베이터즈 다운",
    coach: "영어 소리는 ‘엘리베이터’보다 ‘엘러베이터’에 가까워요. down은 ‘다운’이에요."
  });
  addPhrase({
    id: "no-elevator",
    ko: ["엘리베이터가없어요", "엘리베이터없어요", "승강기가없어요"],
    en: ["there is no elevator"],
    konglish: ["데어즈노엘리베이터"],
    standard: "There is no elevator.",
    casual: "There's no elevator.",
    gloss: "엘리베이터가 없다는 말이에요.",
    casualGloss: "없다는 짧은 말이에요.",
    sound: "데어즈 노 엘러베이터",
    coach: "there's는 ‘데어즈’로 붙여 말해요."
  });
  addPhrase({
    id: "building-code",
    ko: ["공동현관비밀번호알려주세요", "공동현관비밀번호"],
    en: ["what's the building door code"],
    konglish: ["빌딩도어코드"],
    standard: "Please give me the building door code.",
    casual: "What's the building door code?",
    gloss: "공동현관 비밀번호를 묻는 말이에요.",
    casualGloss: "질문으로 묻는 말이에요.",
    sound: "빌딩 도어 코드",
    coach: "code는 ‘코드’예요. ‘코우드’처럼 입을 살짝 모아요."
  });
  addPhrase({
    id: "entrance-code",
    ko: ["현관비밀번호알려주세요", "현관비밀번호", "현관문비밀번호알려주세요"],
    en: ["what's the entrance code"],
    konglish: ["엔트런스코드"],
    standard: "Please give me the entrance code.",
    casual: "What's the entrance code?",
    gloss: "현관 비밀번호를 묻는 말이에요.",
    casualGloss: "질문으로 묻는 말이에요.",
    sound: "엔트런스 코드",
    coach: "entrance는 ‘엔트런스’예요. ‘엔트랜스’보다 ‘런’에 힘을 주세요."
  });
  addPhrase({
    id: "password",
    ko: ["비밀번호알려주세요", "비밀번호뭐예요"],
    en: ["what's the password", "please tell me the password"],
    konglish: ["패스워드", "왓츠더패스워드"],
    standard: "Please tell me the password.",
    casual: "What's the password?",
    gloss: "비밀번호를 묻는 말이에요.",
    casualGloss: "질문으로 묻는 말이에요.",
    sound: "패스워드",
    coach: "password는 ‘패스워드’예요. ‘워드’를 빠뜨리지 마세요."
  });
  addPhrase({
    id: "open-door",
    ko: ["문열어주세요", "현관문열어주세요"],
    en: ["please open the door"],
    konglish: ["오픈더도어", "플리즈오픈더도어"],
    standard: "Please open the door.",
    casual: "Can you open the door?",
    gloss: "문을 열어 달라는 말이에요.",
    casualGloss: "질문처럼 부탁해요.",
    sound: "플리즈 오픈 더 도어",
    coach: "open은 ‘오픈’, door는 ‘도어’예요."
  });
  addPhrase({
    id: "come-down",
    ko: ["내려오세요", "내려와주세요", "내려와요"],
    en: ["please come down"],
    konglish: ["플리즈컴다운", "컴다운"],
    standard: "Please come down.",
    casual: "Can you come down?",
    gloss: "내려오라는 말이에요.",
    casualGloss: "부탁처럼 말한 거예요.",
    sound: "플리즈 컴 다운",
    coach: "come은 ‘컴’, down은 ‘다운’이에요. ‘던’으로 끝나면 다른 말이 돼요."
  });
  addPhrase({
    id: "go-up",
    ko: ["올라가주세요", "올라가세요"],
    en: ["please go up"],
    konglish: ["플리즈고업", "고업"],
    standard: "Please go up.",
    casual: "Can you go up?",
    gloss: "올라가라는 말이에요.",
    casualGloss: "부탁처럼 말한 거예요.",
    sound: "플리즈 고 업",
    coach: "go는 ‘고’, up은 ‘업’이에요."
  });
  addPhrase({
    id: "come-up",
    ko: ["올라와주세요", "올라오세요", "올라와요"],
    en: ["please come up"],
    konglish: ["플리즈컴업", "컴업"],
    standard: "Please come up.",
    casual: "Can you come up?",
    gloss: "올라오라는 말이에요.",
    casualGloss: "부탁처럼 말한 거예요.",
    sound: "플리즈 컴 업",
    coach: "come up은 ‘컴 업’이에요. 두 마디로 끊으세요."
  });
  addPhrase({
    id: "will-up",
    ko: ["올라갈게요", "올라갈거예요"],
    en: ["i'll go up"],
    konglish: ["아일고업"],
    standard: "I'll go up.",
    casual: "I'm heading up.",
    gloss: "올라간다는 말이에요.",
    casualGloss: "짧게 말한 거예요.",
    sound: "아일 고 업",
    coach: "I'll은 ‘아일’로 붙여 말해요."
  });
  addPhrase({
    id: "will-down",
    ko: ["내려갈게요", "내려갈거예요"],
    en: ["i'll go down"],
    konglish: ["아일고다운"],
    standard: "I'll go down.",
    casual: "I'm heading down.",
    gloss: "내려간다는 말이에요.",
    casualGloss: "짧게 말한 거예요.",
    sound: "아일 고 다운",
    coach: "down은 ‘다운’이에요."
  });
  addPhrase({
    id: "leave-door",
    ko: ["문앞에둘게요", "문앞에놔둘게요", "문앞에둘께요", "문앞에두고갈게요"],
    en: ["i'll leave it at the door"],
    konglish: ["아일리브잇앳더도어", "리브잇앳더도어", "리브잇도어"],
    standard: "I'll leave it at the door.",
    casual: "I'll just leave it by the door.",
    gloss: "문 앞에 둔다는 말이에요.",
    casualGloss: "두고 간다는 말이에요.",
    sound: "아일 리브 잇 앳 더 도어",
    coach: "leave는 ‘리브’, door는 ‘도어’예요. ‘도’에서 멈추지 말고 ‘어’까지 말해요."
  });
  addPhrase({
    id: "leave-please",
    ko: ["문앞에놔주세요", "문앞에두세요", "문앞에두고가세요"],
    en: ["please leave it at the door"],
    konglish: ["플리즈리브잇앳더도어", "리브잇앳도어"],
    standard: "Please leave it at the door.",
    casual: "Just leave it by the door.",
    gloss: "문 앞에 두라는 말이에요.",
    casualGloss: "짧게 부탁하는 말이에요.",
    sound: "플리즈 리브 잇 앳 더 도어",
    coach: "leave it은 ‘리브 잇’이에요. it을 빠뜨리지 마세요."
  });
  addPhrase({
    id: "lobby-down",
    ko: ["로비로내려오세요", "로비로내려와주세요", "로비로내려와요"],
    en: ["please come down to the lobby"],
    konglish: ["플리즈컴다운투더로비", "컴다운투더로비", "컴다운투로비", "컴다운투더라비"],
    standard: "Please come down to the lobby.",
    casual: "Can you come down to the lobby?",
    gloss: "로비로 내려오라는 말이에요.",
    casualGloss: "부탁처럼 말한 거예요.",
    sound: "플리즈 컴 다운 투 더 라비",
    coach: "lobby의 o는 ‘오’가 아니라 ‘아’에 가까워요. ‘라비’라고 말해요."
  });

  var SETUP_STEPS = [
    { id: "greet-hello", lang: "ko", show: "안녕하세요", hint: "평소 인사처럼 읽어 주세요." },
    { id: "greet-hello", lang: "en", show: "Hello.", hint: "영어는 ‘헬로우’처럼 읽어 주세요." },
    { id: "lobby-down", lang: "ko", show: "로비로 내려오세요", hint: "손님에게 말하듯 읽어 주세요." },
    { id: "arrive", lang: "en", show: "I'm here.", hint: "‘아임 히어’처럼 읽어 주세요." },
    { id: "leave-door", lang: "ko", show: "문 앞에 둘게요", hint: "마지막 문장이에요." }
  ];

  function prepDelivery(text) {
    return text
      .replace(/조금/g, "\u0001")
      .replace(/한번/g, "")
      .replace(/좀/g, "")
      .replace(/\u0001/g, "조금")
      .replace(/와주세요$/, "오세요")
      .replace(/와줘요$/, "오세요")
      .replace(/와줘$/, "오세요")
      .replace(/내려와요$/, "내려오세요")
      .replace(/내려오십시오$/, "내려오세요")
      .replace(/올라와요$/, "올라오세요")
      .replace(/가주세요$/, "가세요")
      .replace(/가줘요$/, "가세요")
      .replace(/가줘$/, "가세요")
      .replace(/갈께요$/, "갈게요")
      .replace(/올께요$/, "올게요")
      .replace(/둘께요$/, "둘게요")
      .replace(/놓아둘게요$/, "놔둘게요")
      .replace(/놓아주세요$/, "놔주세요")
      .replace(/눌러줘요$/, "눌러주세요")
      .replace(/눌러줘$/, "눌러주세요")
      .replace(/누르세요$/, "눌러주세요")
      .replace(/했습니다$/, "했어요")
      .replace(/왔습니다$/, "왔어요");
  }

  var ACTIONS = {
    "내려오세요": "come-down",
    "내려가세요": "go-down",
    "올라오세요": "come-up",
    "올라가세요": "go-up",
    "오세요": "come",
    "가세요": "go",
    "내려올게요": "will-come-down",
    "내려갈게요": "will-go-down",
    "올라올게요": "will-come-up",
    "올라갈게요": "will-go-up",
    "올게요": "will-come",
    "갈게요": "will-go",
    "가요": "going",
    "있어요": "be",
    "없어요": "away",
    "도착했어요": "arrived",
    "왔어요": "arrived",
    "둘게요": "will-leave",
    "놔둘게요": "will-leave",
    "두고갈게요": "will-leave",
    "놔주세요": "leave",
    "두세요": "leave",
    "두고가세요": "leave",
    "열어주세요": "open",
    "고장났어요": "broken",
    "고장이났어요": "broken",
    "안돼요": "broken",
    "멈춰요": "stuck"
  };

  var SPOTS = [
    { ko: "지하주차장", name: "the underground parking lot", at: "in the underground parking lot", to: "to the underground parking lot", by: "in the underground parking lot", casualBe: "I'm in the lot downstairs." },
    { ko: "주차장", name: "the parking lot", at: "in the parking lot", to: "to the parking lot", by: "in the parking lot", casualBe: "I'm in the lot." },
    { ko: "공동현관", name: "the building entrance", at: "at the building entrance", to: "to the building entrance", by: "by the building entrance", door: true },
    { ko: "현관문", name: "the front door", at: "at the front door", to: "to the front door", by: "by the front door", door: true },
    { ko: "엘리베이터", name: "the elevator", at: "at the elevator", to: "to the elevator", by: "by the elevator", elevator: true, casualBe: "I'm by the elevator." },
    { ko: "승강기", name: "the elevator", at: "at the elevator", to: "to the elevator", by: "by the elevator", elevator: true, casualBe: "I'm by the elevator." },
    { ko: "로비", name: "the lobby", at: "in the lobby", to: "to the lobby", by: "in the lobby", casualBe: "I'm down in the lobby." },
    { ko: "문앞", name: "the door", at: "at the door", to: "to the door", by: "by the door", door: true },
    { ko: "현관", name: "the entrance", at: "at the entrance", to: "to the entrance", by: "by the entrance", door: true },
    { ko: "문", name: "the door", at: "at the door", to: "to the door", by: "by the door", door: true, casualBe: "I'm right outside." }
  ];

  var FLOOR_WORDS = { "한": 1, "일": 1, "두": 2, "이": 2, "세": 3, "삼": 3, "네": 4, "사": 4, "다섯": 5, "오": 5, "여섯": 6, "육": 6, "일곱": 7, "칠": 7, "여덟": 8, "팔": 8, "아홉": 9, "구": 9, "열": 10, "십": 10 };
  var ORDINALS = ["", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"];

  function floorSpot(basement, n) {
    if (basement && n === 1) return { ko: "지하", name: "the basement", at: "in the basement", to: "to the basement", by: "in the basement", casualBe: "I'm in the basement." };
    if (basement) return { ko: "지하", name: "basement level " + n, at: "on basement level " + n, to: "to basement level " + n, by: "on basement level " + n, casualBe: "Basement level " + n + "." };
    if (n === 1) return { ko: "1층", name: "the first floor", at: "on the first floor", to: "to the first floor", by: "on the first floor", casualBe: "I'm downstairs." };
    if (ORDINALS[n]) return { ko: n + "층", name: "the " + ORDINALS[n] + " floor", at: "on the " + ORDINALS[n] + " floor", to: "to the " + ORDINALS[n] + " floor", by: "on the " + ORDINALS[n] + " floor", casualBe: cap(ORDINALS[n]) + " floor." };
    return { ko: n + "층", name: "floor " + n, at: "on floor " + n, to: "to floor " + n, by: "on floor " + n, casualBe: "Floor " + n + "." };
  }

  function takeSpot(text) {
    var floor = text.match(/^(지하)?(\d{1,2}|열|십|다섯|여섯|일곱|여덟|아홉|한|일|두|이|세|삼|네|사|오|육|칠|팔|구)층(.*)$/);
    if (floor) {
      var n = FLOOR_WORDS[floor[2]] || Number(floor[2]);
      if (n >= 1 && n <= 60) return { spot: floorSpot(!!floor[1], n), rest: floor[3] };
    }
    for (var i = 0; i < SPOTS.length; i++) {
      if (text.indexOf(SPOTS[i].ko) === 0 && text.length > SPOTS[i].ko.length) {
        return { spot: SPOTS[i], rest: text.slice(SPOTS[i].ko.length) };
      }
    }
    return null;
  }

  function stripParticle(rest) {
    var particles = ["으로", "에서", "까지", "앞에", "에는", "에도", "에", "로", "은", "는", "이", "가", "을", "를"];
    for (var i = 0; i < particles.length; i++) {
      if (rest.indexOf(particles[i]) === 0 && rest.length > particles[i].length) {
        var next = rest.slice(particles[i].length);
        if (ACTIONS[next]) return next;
      }
    }
    return rest;
  }

  function moveLine(kind, spot) {
    var to = spot.to;
    var at = spot.at;
    var by = spot.by || at;
    var where = spot.ko;
    if (kind === "come-down") return lesson("Please come down " + to + ".", "Can you come down " + to + "?", where + "로 내려오라는 말이에요.", "부탁처럼 말한 거예요.");
    if (kind === "go-down") return lesson("Please go down " + to + ".", "Can you go down " + to + "?", where + "로 내려가라는 말이에요.", "부탁처럼 말한 거예요.");
    if (kind === "come-up") return lesson("Please come up " + to + ".", "Can you come up " + to + "?", where + "로 올라오라는 말이에요.", "부탁처럼 말한 거예요.");
    if (kind === "go-up") return lesson("Please go up " + to + ".", "Can you go up " + to + "?", where + "로 올라가라는 말이에요.", "부탁처럼 말한 거예요.");
    if (kind === "come") return lesson("Please come " + to + ".", "Can you come " + to + "?", where + "로 오라는 말이에요.", "부탁처럼 말한 거예요.");
    if (kind === "go") return lesson("Please go " + to + ".", "Can you go " + to + "?", where + "로 가라는 말이에요.", "부탁처럼 말한 거예요.");
    if (kind === "will-come-down") return lesson("I'll come down " + to + ".", "I'm coming down " + to + ".", where + "로 내려온다는 말이에요.", "지금 내려온다는 말이에요.");
    if (kind === "will-go-down") return lesson("I'll go down " + to + ".", "I'm heading down " + to + ".", where + "로 내려간다는 말이에요.", "짧게 말한 거예요.");
    if (kind === "will-come-up") return lesson("I'll come up " + to + ".", "I'm coming up " + to + ".", where + "로 올라온다는 말이에요.", "지금 올라온다는 말이에요.");
    if (kind === "will-go-up") return lesson("I'll go up " + to + ".", "I'm heading up " + to + ".", where + "로 올라간다는 말이에요.", "짧게 말한 거예요.");
    if (kind === "will-come") return lesson("I'll come " + to + ".", "I'm coming " + to + ".", where + "로 온다는 말이에요.", "짧게 말한 거예요.");
    if (kind === "will-go") return lesson("I'll go " + to + ".", "I'm heading " + to + ".", where + "로 간다는 말이에요.", "짧게 말한 거예요.");
    if (kind === "going") return lesson("I'm going " + to + ".", "I'm heading " + to + ".", where + "로 가는 중이에요.", "heading은 간다는 편한 말이에요.");
    if (kind === "be") return lesson("I'm " + at + ".", spot.casualBe || "I'm here.", where + "에 있다는 말이에요.", "짧게 말한 거예요.");
    if (kind === "away" && spot.elevator) return lesson("There is no elevator.", "There's no elevator.", "엘리베이터가 없다는 말이에요.", "없다는 짧은 말이에요.", "no-elevator");
    if (kind === "away") return lesson("I'm not " + at + ".", "I'm not there.", where + "에 없다는 말이에요.", "거기 없다는 짧은 말이에요.");
    if (kind === "arrived") return lesson("I've arrived " + at + ".", "I'm here.", where + "에 도착했다는 말이에요.", "왔다는 짧은 말이에요.");
    if (kind === "will-leave") return lesson("I'll leave it " + at + ".", "I'll just leave it " + by + ".", where + "에 둔다는 말이에요.", "두고 간다는 말이에요.");
    if (kind === "leave") return lesson("Please leave it " + at + ".", "Just leave it " + by + ".", where + "에 두라는 말이에요.", "짧게 부탁하는 말이에요.");
    if (kind === "open" && spot.door) return lesson("Please open " + spot.name + ".", "Can you open " + spot.name + "?", "문을 열어 달라는 말이에요.", "열어 달라는 부탁이에요.");
    if ((kind === "broken" || kind === "stuck") && spot.elevator) return lesson("The elevator is out of order.", "The elevator's down.", "엘리베이터가 안 된다는 말이에요.", "고장 났다는 편한 말이에요.", "elevator-down");
    return null;
  }

  function parseDelivery(text) {
    var found = takeSpot(prepDelivery(text));
    if (!found) return null;
    var action = ACTIONS[stripParticle(found.rest)];
    if (!action) return null;
    return moveLine(action, found.spot);
  }

  function dist(a, b) {
    if (a === b) return 0;
    var prev = [];
    var i;
    var j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      var cur = [i];
      for (j = 1; j <= b.length; j++) {
        var cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
        cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      }
      prev = cur;
    }
    return prev[b.length];
  }

  function fuzzyMatch(key) {
    if (key.length < 5) return null;
    var best = null;
    var bestDist = 99;
    var second = 99;
    Object.keys(INDEX).forEach(function (candidate) {
      if (candidate.length < 5) return;
      var via = INDEX[candidate].via;
      var limit = via === "ko" ? 1 : 2;
      if (Math.abs(candidate.length - key.length) > limit) return;
      var score = dist(key, candidate);
      if (score > limit) return;
      if (score < bestDist) {
        second = bestDist;
        bestDist = score;
        best = INDEX[candidate];
      } else if (score < second) second = score;
    });
    if (!best || bestDist === 0) return null;
    if (second - bestDist < 1) return null;
    return { phrase: best.phrase, via: best.via === "ko" ? "ko" : "konglish" };
  }

  function pack3(standard, casual, gloss) {
    return [standard, casual, gloss];
  }

  var NEXT = {
    "greet-hello": { mode: "chat", answer: pack3("Hello. Nice to meet you.", "Hey. Good to see you.", "안녕하세요. 만나서 반가워요.") },
    "greet-thanks": { mode: "chat", answer: pack3("You're welcome.", "No worries.", "천만에요, 괜찮아요.") },
    "greet-sorry": { mode: "chat", answer: pack3("It's okay.", "No worries.", "괜찮다고 받아 줘요.") },
    "greet-yes": { mode: "chat", answer: pack3("Okay. What do you need?", "Yeah. What's up?", "알겠어요. 뭐가 필요하냐고 물어요.") },
    "greet-no": { mode: "chat", answer: pack3("All right. What should we change?", "Okay. What else?", "알겠어요. 뭘 바꿀지 물어요.") },
    "greet-ok": { mode: "chat", answer: pack3("Good. Let's keep going.", "Cool. What's next?", "좋아요. 다음을 물어요.") },
    "daily-wait": { mode: "chat", answer: pack3("Sure. Take your time.", "No rush.", "천천히 해도 된다고 해요.") },
    "daily-english": { mode: "chat", answer: pack3("That's okay. We'll go slowly.", "No worries. Short sentences are fine.", "괜찮아요. 짧은 문장으로 하자고 해요.") },
    "daily-again": { mode: "say", answer: pack3("Sure. I'll say it again.", "Okay. One more time.", "네, 다시 말할게요."), follow: pack3("Could you say that again?", "One more time, please?", "한 번 더 말해 달라는 말이에요.") },
    "daily-slow": { mode: "say", answer: pack3("Sure. I'll speak slowly.", "Okay. Slower.", "네, 천천히 말할게요."), follow: pack3("Could you speak slowly?", "A little slower, please?", "천천히 말해 달라는 말이에요.") },
    "daily-help": { mode: "chat", answer: pack3("Sure. What do you need?", "Yeah. How can I help?", "네, 뭐가 필요하냐고 물어요.") },
    "arrive": { mode: "chat", answer: pack3("Okay. I'll come down.", "Got it. I'm coming down.", "알겠어요. 내려갈게요.") },
    "coming": { mode: "chat", answer: pack3("Thanks. I'll wait here.", "Okay. I'll be here.", "고마워요. 여기서 기다릴게요.") },
    "where-you": { mode: "chat", answer: pack3("I'm right here.", "I'm outside.", "저 여기 있어요. 밖에 있어요.") },
    "which-floor": { mode: "say", answer: pack3("I'm on the first floor.", "First floor.", "1층이에요."), follow: pack3("Which floor is it?", "What floor?", "몇 층이냐고 묻는 말이에요.") },
    "doorbell": { mode: "say", answer: pack3("Okay. I'll ring the bell.", "Sure. I'll ring it.", "네, 초인종 누를게요."), follow: pack3("Please ring the doorbell.", "Just ring the bell.", "초인종을 눌러 달라는 말이에요.") },
    "elevator-down": { mode: "say", answer: pack3("Okay. I'll take the stairs.", "Got it. I'll use the stairs.", "알겠어요. 계단으로 갈게요."), follow: pack3("Please use the stairs.", "Just take the stairs.", "계단을 이용해 달라는 말이에요.") },
    "no-elevator": { mode: "say", answer: pack3("Okay. I'll take the stairs.", "Got it. I'll use the stairs.", "알겠어요. 계단으로 갈게요."), follow: pack3("There is no elevator.", "There's no elevator.", "엘리베이터가 없다는 말이에요.") },
    "building-code": { mode: "say", answer: pack3("Sorry. I don't have the code.", "I don't know the code.", "비밀번호는 모른다고 해요."), follow: pack3("Please give me the building door code.", "What's the building door code?", "공동현관 비밀번호를 묻는 말이에요.") },
    "entrance-code": { mode: "say", answer: pack3("Sorry. I don't have the code.", "I don't know the code.", "비밀번호는 모른다고 해요."), follow: pack3("Please give me the entrance code.", "What's the entrance code?", "현관 비밀번호를 묻는 말이에요.") },
    "password": { mode: "say", answer: pack3("Sorry. I don't have the code.", "I don't know the code.", "비밀번호는 모른다고 해요."), follow: pack3("Please tell me the password.", "What's the password?", "비밀번호를 묻는 말이에요.") },
    "open-door": { mode: "say", answer: pack3("Sure. I'll open the door.", "Okay. One second.", "네, 문 열게요."), follow: pack3("Please open the door.", "Can you open the door?", "문을 열어 달라는 말이에요.") },
    "come-down": { mode: "say", answer: pack3("Okay. I'm coming down.", "Got it. On my way.", "알겠어요. 내려갈게요."), follow: pack3("Which floor are you on?", "What floor?", "이어서 몇 층이냐고 물어요.") },
    "go-up": { mode: "say", answer: pack3("Okay. I'm coming up.", "Got it. On my way up.", "알겠어요. 올라갈게요."), follow: pack3("What floor is it?", "Which floor?", "몇 층이냐고 물어요.") },
    "come-up": { mode: "say", answer: pack3("Okay. I'm coming up.", "Got it. On my way up.", "알겠어요. 올라갈게요."), follow: pack3("What floor is it?", "Which floor?", "몇 층이냐고 물어요.") },
    "will-up": { mode: "chat", answer: pack3("Thanks. I'll wait.", "Okay. I'll be here.", "고마워요. 기다릴게요.") },
    "will-down": { mode: "chat", answer: pack3("Thanks. I'll meet you down there.", "Okay. See you downstairs.", "고마워요. 아래에서 만나요.") },
    "leave-door": { mode: "say", answer: pack3("Okay. I'll grab it.", "Got it. I'll pick it up.", "알겠어요. 가져갈게요."), follow: pack3("Please take it when you can.", "Grab it when you're free.", "시간 될 때 가져가 달라는 말이에요.") },
    "leave-please": { mode: "say", answer: pack3("Okay. I'll grab it.", "Got it. I'll pick it up.", "알겠어요. 가져갈게요."), follow: pack3("Please leave it at the door.", "Just leave it by the door.", "문 앞에 두라는 말이에요.") },
    "lobby-down": { mode: "say", answer: pack3("Okay. I'm coming down.", "Got it. On my way.", "알겠어요. 내려갈게요."), follow: pack3("Which floor are you on?", "What floor?", "이어서 몇 층이냐고 물어요.") }
  };

  var CHATS = [
    { keys: ["힘들어요", "피곤해요", "지쳤어요", "힘들다"], standard: "That sounds tough. Are you okay?", gloss: "힘들겠네요. 괜찮아요?" },
    { keys: ["배고파요", "배고프다", "밥먹어야해요"], standard: "You must be hungry. Eat when you can.", gloss: "배고프겠네요. 시간 될 때 먹어요." },
    { keys: ["모르겠어요", "모르겠어", "잘모르겠어요"], standard: "That's okay. Let's try a short sentence.", gloss: "괜찮아요. 짧은 문장으로 해 봐요." },
    { keys: ["좋아요", "좋네요", "괜찮아요", "괜찮습니다", "좋습니다"], standard: "I'm glad. What are you doing today?", gloss: "좋군요. 오늘은 뭐 해요?" },
    { keys: ["나빠요", "별로예요", "안좋아요"], standard: "Sorry to hear that. What happened?", gloss: "안타깝네요. 무슨 일이에요?" },
    { keys: ["만나서반갑습니다", "반갑습니다", "반가워요"], standard: "Nice to meet you too.", gloss: "저도 만나서 반가워요." }
  ];

  function linesOk(lines) {
    return lines && validEnglish(lines[0]) && validEnglish(lines[1]);
  }

  function enrich(partial, via) {
    if (!partial) return null;
    var phrase = partial.phraseId ? PHRASE_BY_ID[partial.phraseId] : null;
    if (!phrase && partial.standard) {
      var found = null;
      for (var i = 0; i < PHRASES.length; i++) {
        if (PHRASES[i].standard === partial.standard) { found = PHRASES[i]; break; }
      }
      phrase = found;
      if (phrase) partial.phraseId = phrase.id;
    }
    var next = (phrase && NEXT[phrase.id]) || { mode: "say", answer: pack3("Okay. Tell me a little more.", "Got it. What else?", "조금 더 말해 달라는 말이에요."), follow: pack3("Okay. Thank you.", "Got it. Thanks.", "알겠어요, 고마워요. 라고 받을 수 있어요.") };
    var answer = linesOk(next.answer) ? next.answer : pack3("Okay. Tell me a little more.", "Got it. What else?", "조금 더 말해 달라는 말이에요.");
    var spoken = via === "konglish" || via === "en-fuzzy";
    if (spoken && phrase && validEnglish(phrase.standard)) {
      partial.kind = "coach";
      partial.leadKo = "발음을 고치고, 이어서 대화를 할게요.";
      partial.standard = phrase.standard;
      partial.casual = phrase.casual;
      partial.glossStandard = phrase.gloss;
      partial.glossCasual = phrase.casualGloss;
      partial.coachKo = phrase.coach;
      partial.soundKo = phrase.sound;
      partial.slow = true;
      partial.learnLang = "en";
      partial.replyStandard = answer[0];
      partial.replyCasual = answer[1];
      partial.replyGloss = answer[2];
      return partial;
    }
    return asTalk(answer, phrase ? phrase.id : partial.phraseId);
  }

  function asTalk(answer, phraseId) {
    return {
      kind: "talk",
      phraseId: phraseId || null,
      learnLang: null,
      leadKo: "",
      glossStandard: answer[2],
      glossCasual: null,
      standard: answer[0],
      casual: null,
      coachKo: null,
      soundKo: null,
      replyStandard: null,
      replyCasual: null,
      replyGloss: null,
      slow: false
    };
  }

  function asLesson(phrase) {
    return {
      kind: "lesson",
      phraseId: phrase.id,
      learnLang: "ko",
      leadKo: "이렇게 말하면 돼요.",
      glossStandard: phrase.gloss,
      glossCasual: phrase.casualGloss,
      standard: phrase.standard,
      casual: phrase.casual,
      coachKo: null,
      soundKo: phrase.sound,
      slow: false
    };
  }

  function partnerForLesson(partial) {
    var s = partial.standard || "";
    if (/^Please come down|^Can you come down/.test(s)) return pack3("Okay. I'm coming down.", "Got it. On my way.", "알겠어요. 내려갈게요.");
    if (/^Please come up|^Can you come up/.test(s)) return pack3("Okay. I'm coming up.", "Got it. On my way up.", "알겠어요. 올라갈게요.");
    if (/^Please go down|^Can you go down/.test(s)) return pack3("Okay. I'm going down.", "Got it. Heading down.", "알겠어요. 내려갈게요.");
    if (/^Please go up|^Can you go up/.test(s)) return pack3("Okay. I'm going up.", "Got it. Heading up.", "알겠어요. 올라갈게요.");
    if (/^Please come |^Can you come /.test(s)) return pack3("Okay. I'm on my way.", "Got it. Coming now.", "알겠어요. 지금 갈게요.");
    if (/^Please go |^Can you go /.test(s)) return pack3("Okay. I'm on my way.", "Got it. Going now.", "알겠어요. 지금 갈게요.");
    if (/^I'll leave|^Please leave|^Just leave/.test(s)) return pack3("Okay. I'll grab it.", "Got it. I'll pick it up.", "알겠어요. 가져갈게요.");
    if (/^Please open|^Can you open/.test(s)) return pack3("Sure. I'll open it.", "Okay. One second.", "네, 열게요.");
    if (/^There is no elevator|^There's no elevator|^The elevator/.test(s)) return pack3("Okay. I'll take the stairs.", "Got it. I'll use the stairs.", "알겠어요. 계단으로 갈게요.");
    if (/^I'm |^I've arrived|^I'll /.test(s)) return pack3("Okay. Thank you.", "Got it. Thanks.", "알겠어요. 고마워요.");
    return pack3("Okay. Tell me a little more.", "Got it. What else?", "조금 더 말해 달라는 말이에요.");
  }

  function fromPhrase(phrase, via) {
    if (!phrase || !validEnglish(phrase.standard) || !validEnglish(phrase.casual)) return null;
    return enrich({
      kind: "lesson",
      phraseId: phrase.id,
      learnLang: "ko",
      leadKo: "이렇게 말해 보세요.",
      glossStandard: phrase.gloss,
      glossCasual: phrase.casualGloss,
      standard: phrase.standard,
      casual: phrase.casual,
      coachKo: null,
      soundKo: phrase.sound,
      slow: false
    }, via);
  }

  function matchChat(key) {
    for (var i = 0; i < CHATS.length; i++) {
      if (CHATS[i].keys.indexOf(key) !== -1) return CHATS[i];
    }
    return null;
  }

  function isStudyAsk(key) {
    return /영어로/.test(key) || /어떻게말/.test(key) || /뭐라고/.test(key) || /표현/.test(key);
  }

  function stripStudy(key) {
    return key
      .replace(/영어로는|영어로|영어/g, "")
      .replace(/어떻게말하면|어떻게말하지|어떻게말해요|어떻게말해|어떻게말하나요|어떻게말하죠|어떻게말/g, "")
      .replace(/뭐라고말해요|뭐라고말해|뭐라고해요|뭐라고해|뭐라고/g, "")
      .replace(/알려주세요|알려줘|알려줘요|알려주/g, "")
      .replace(/해주세요|해줘요|해줘/g, "")
      .replace(/뭐예요|뭐에요|뭔가요|뭐야|뭔가/g, "")
      .replace(/표현은|표현/g, "")
      .replace(/라고$/g, "")
      .replace(/은요$|는요$|이요$|요$/g, "");
  }

  function findLoose(key) {
    if (!key) return null;
    if (INDEX[key]) return INDEX[key];
    if (key.length < 4) return null;
    var fuzzy = fuzzyMatch(key);
    if (fuzzy) return { phrase: fuzzy.phrase, via: fuzzy.via };
    var best = null;
    Object.keys(INDEX).forEach(function (candidate) {
      if (candidate.length < 4) return;
      if (candidate.indexOf(key) === 0 || key.indexOf(candidate) === 0) {
        var score = Math.min(candidate.length, key.length);
        if (!best || score > best.score) best = { phrase: INDEX[candidate].phrase, via: INDEX[candidate].via, score: score };
      }
    });
    return best;
  }

  function ask(message, mem) {
    return {
      kind: "ask",
      phraseId: null,
      learnLang: null,
      leadKo: message,
      glossStandard: null,
      glossCasual: null,
      standard: null,
      casual: null,
      coachKo: null,
      soundKo: null,
      slow: false,
      next: { last: mem.last || null }
    };
  }

  function withLast(partial, mem) {
    var spoken = partial.standard || partial.replyStandard;
    var last = spoken ? {
      standard: partial.standard || partial.replyStandard,
      casual: partial.casual || partial.replyCasual,
      glossStandard: partial.glossStandard || partial.replyGloss,
      glossCasual: partial.glossCasual || null,
      replyStandard: partial.replyStandard || null,
      replyCasual: partial.replyCasual || null,
      replyGloss: partial.replyGloss || null,
      coachKo: partial.coachKo || null,
      soundKo: partial.soundKo || null,
      phraseId: partial.phraseId || null
    } : (mem.last || null);
    partial.next = { last: last };
    return partial;
  }

  var REPEAT_KEYS = { "다시": 1, "다시요": 1, "한번더": 1, "다시들려주세요": 1, "again": 1, "onemoretime": 1 };
  var SLOW_KEYS = { "천천히": 1, "천천히요": 1, "더천천히": 1, "좀천천히": 1, "slowly": 1, "slower": 1 };

  function reply(raw, memory) {
    var mem = memory && typeof memory === "object" ? memory : {};
    mem.last = mem.last && mem.last.standard ? mem.last : null;
    var aliases = mem.aliases && typeof mem.aliases === "object" ? mem.aliases : {};
    var text = String(raw || "").trim().replace(/^\s*선생님\s*/, "");
    var key = norm(text);
    if (!key) return ask("한 문장만 다시 말해 주세요.", mem);
    if ((REPEAT_KEYS[key] || SLOW_KEYS[key]) && mem.last) {
      return {
        kind: "repeat",
        phraseId: mem.last.phraseId || null,
        learnLang: null,
        leadKo: "천천히 다시 말할게요.",
        glossStandard: mem.last.glossStandard,
        glossCasual: mem.last.glossCasual,
        standard: mem.last.standard,
        casual: mem.last.casual,
        coachKo: mem.last.coachKo || null,
        soundKo: mem.last.soundKo || null,
        replyStandard: mem.last.replyStandard || null,
        replyCasual: mem.last.replyCasual || null,
        replyGloss: mem.last.replyGloss || null,
        slow: true,
        next: { last: mem.last }
      };
    }
    if (REPEAT_KEYS[key] || SLOW_KEYS[key]) return ask("아직 다시 말할 문장이 없어요. 먼저 하고 싶은 말을 해 주세요.", mem);
    if (isStudyAsk(key)) {
      var target = stripStudy(key);
      if (!target) return ask("어떤 말을 영어로 알고 싶어요? 예를 들면, 로비로 내려오라고 영어로 뭐라고 해요.", mem);
      var studied = findLoose(target);
      if (studied && studied.phrase) return withLast(asLesson(studied.phrase), mem);
      var asked = parseDelivery(target);
      if (asked) {
        asked.leadKo = "이렇게 말하면 돼요.";
        asked.kind = "lesson";
        return withLast(asked, mem);
      }
      return ask("그 말은 아직 없어요. 더 짧게 다시 말해 주세요.", mem);
    }
    var alias = aliases[key];
    if (alias && PHRASE_BY_ID[alias.id || alias]) {
      var phrase = PHRASE_BY_ID[alias.id || alias];
      var via = alias.lang === "en" ? "alias-en" : "ko";
      var aliased = fromPhrase(phrase, via);
      if (aliased) return withLast(aliased, mem);
    }
    if (INDEX[key]) {
      var exact = fromPhrase(INDEX[key].phrase, INDEX[key].via);
      if (exact) return withLast(exact, mem);
    }
    var delivered = parseDelivery(key);
    if (delivered) return withLast(asTalk(partnerForLesson(delivered), delivered.phraseId), mem);
    var chat = matchChat(key);
    if (chat && validEnglish(chat.standard)) {
      return withLast(asTalk(pack3(chat.standard, chat.standard, chat.gloss), null), mem);
    }
    var fuzzy = fuzzyMatch(key);
    if (fuzzy) {
      var guessed = fromPhrase(fuzzy.phrase, fuzzy.via === "ko" ? "ko" : "konglish");
      if (guessed) return withLast(guessed, mem);
    }
    if (mem.last && /[가-힣]/.test(text)) return ask("방금 말에 이어서 해 주세요. 더 짧게 말해도 돼요.", mem);
    if (/[가-힣]/.test(text)) return ask("그 말은 아직 잘 모르겠어요. 더 짧게 다시 말해 주세요.", mem);
    if (/[a-z]/i.test(text)) return ask("그 영어는 아직 연결이 안 돼요. 뜻을 한국어로 한 문장만 말해 주세요.", mem);
    return ask("한 문장만 다시 말해 주세요.", mem);
  }

  function learn(heard, phraseId, lang, memory) {
    var aliases = {};
    var source = memory && memory.aliases ? memory.aliases : {};
    Object.keys(source).forEach(function (key) { aliases[key] = source[key]; });
    var n = norm(heard);
    if (!n || n.length < 2 || !PHRASE_BY_ID[phraseId]) return aliases;
    var existing = INDEX[n];
    if (existing && existing.phrase.id !== phraseId) return aliases;
    aliases[n] = { id: phraseId, lang: lang === "en" ? "en" : "ko" };
    return aliases;
  }

  function audit() {
    var bad = [];
    PHRASES.forEach(function (phrase) {
      if (!validEnglish(phrase.standard)) bad.push(phrase.id + " standard");
      if (!validEnglish(phrase.casual)) bad.push(phrase.id + " casual");
      if (!phrase.coach || !phrase.sound) bad.push(phrase.id + " coach");
      var next = NEXT[phrase.id];
      if (next && next.answer && (!validEnglish(next.answer[0]) || !validEnglish(next.answer[1]))) bad.push(phrase.id + " answer");
      if (next && next.follow && (!validEnglish(next.follow[0]) || !validEnglish(next.follow[1]))) bad.push(phrase.id + " follow");
    });
    return { phrases: PHRASES.length, bad: bad, dups: DUP_KEYS.slice() };
  }

  globalThis.EnglishTeacherEngine = {
    reply: reply,
    learn: learn,
    audit: audit,
    setupSteps: SETUP_STEPS
  };
})();
