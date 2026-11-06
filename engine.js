/* On-device Korean to natural English. No network and no API key. */
(function () {
  "use strict";

  var BRIDGE = "편하게는 이렇게도 해요.";
  var LEADS = [
    "오, 좋아요. 이렇게 말해 보세요.",
    "그 말이요? 이렇게 하면 자연스러워요.",
    "네. 짧고 쉬운 말로 갈게요.",
    "실제로 사람들은 이렇게 말해요."
  ];

  var PARTICLES = ["에서", "으로", "에게", "한테", "이랑", "하고", "은", "는", "이", "가", "을", "를", "도", "에", "의", "와", "과", "로"];
  var NOUNS = Object.create(null);
  var PHRASES = [];
  var PHRASE_BY_KEY = Object.create(null);
  var PHRASE_BY_ID = Object.create(null);
  var DUP_KEYS = [];

  function noun(ko, spec) {
    NOUNS[ko] = Object.assign({ ko: ko, count: "count", kind: "thing" }, spec);
  }

  function place(ko, en, spec) {
    noun(ko, Object.assign({
      en: en,
      kind: "place",
      definite: spec.definite || ("the " + en),
      placePhrase: spec.placePhrase,
      toPhrase: spec.toPhrase
    }, spec));
  }

  function addPhrase(id, situation, ko, standard, casual, g1, g2, extra) {
    extra = extra || {};
    PHRASES.push({
      id: id,
      situation: situation,
      ko: ko,
      keys: extra.keys || [],
      standard: standard,
      casual: casual,
      glossStandard: g1,
      glossCasual: g2,
      related: extra.related || null,
      chat: extra.chat || null,
      noWhen: !!extra.noWhen
    });
  }

  function indexPhrases() {
    PHRASES.forEach(function (phrase) {
      PHRASE_BY_ID[phrase.id] = phrase;
      [phrase.ko].concat(phrase.keys).forEach(function (key) {
        var norm = normKey(key);
        if (!norm) return;
        if (PHRASE_BY_KEY[norm] && PHRASE_BY_KEY[norm].id !== phrase.id) DUP_KEYS.push(norm + " :: " + phrase.id);
        else PHRASE_BY_KEY[norm] = phrase;
      });
    });
  }

  function normalize(text) {
    return String(text || "")
      .trim()
      .replace(/[?!？！。．.，,~…"'“”‘’「」『』()[\]{}]/g, "")
      .replace(/\s+/g, "")
      .toLowerCase();
  }

  function canon(text) {
    return String(text || "")
      .replace(/싶습니다$/, "싶어요")
      .replace(/싶은데요$/, "싶어요")
      .replace(/싶어$/, "싶어요")
      .replace(/갈거에요$/, "갈거예요")
      .replace(/입니다$/, "이에요")
      .replace(/어디에요$/, "어디예요")
      .replace(/어디야$/, "어디예요")
      .replace(/어디에있어요$/, "어디예요")
      .replace(/어디있어요$/, "어디예요")
      .replace(/(?<!이)에요$/, "예요")
      .replace(/해줘요$/, "해주세요")
      .replace(/해줄래요$/, "해주세요")
      .replace(/해줘$/, "해주세요")
      .replace(/안있어요$/, "없어요")
      .replace(/없습니다$/, "없어요")
      .replace(/있습니다$/, "있어요");
  }

  function normKey(text) {
    return canon(normalize(text));
  }

  function cap(text) {
    text = String(text || "");
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
  }

  function eun(ko) {
    var code = ko.charCodeAt(ko.length - 1);
    if (code < 0xac00 || code > 0xd7a3) return "는";
    return (code - 0xac00) % 28 === 0 ? "는" : "은";
  }

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
    if (/\bto home\b/i.test(text)) return false;
    if (/\bto to\b/i.test(text)) return false;
    if (/\bthe the\b/i.test(text)) return false;
    if (/There is a lot of people/i.test(text)) return false;
    if (/There is a people/i.test(text)) return false;
    if (/There are a person\b/i.test(text)) return false;
    if (/\b(a|an|the)\s+[.?!]/i.test(text)) return false;
    var words = text.replace(/[\"“”]/g, "").replace(/[.?!]/g, "").trim().split(/\s+/);
    if (!words.length || words.length > 16) return false;
    return true;
  }

  function indefinite(word) {
    return (/^[aeiou]/i.test(word) ? "an " : "a ") + word;
  }

  function pluralOf(item) {
    if (item.plural) return item.plural;
    if (item.count === "mass" || item.count === "plural") return item.en;
    var en = item.en;
    if (/[^aeiou]y$/i.test(en)) return en.slice(0, -1) + "ies";
    if (/(s|x|ch|sh)$/i.test(en)) return en + "es";
    return en + "s";
  }

  function classifyToken(token) {
    if (!token) return null;
    if (NOUNS[token]) return { noun: NOUNS[token] };
    for (var i = 0; i < PARTICLES.length; i++) {
      var particle = PARTICLES[i];
      if (token.length > particle.length && token.endsWith(particle)) {
        var stem = token.slice(0, -particle.length);
        var pluralMarked = false;
        if (stem.endsWith("들") && stem.length > 1 && NOUNS[stem.slice(0, -1)]) {
          stem = stem.slice(0, -1);
          pluralMarked = true;
        }
        if (NOUNS[stem]) return { noun: NOUNS[stem], particle: particle, pluralMarked: pluralMarked };
        if (stem === "차") return { ambiguous: "car-tea" };
        if (stem === "눈") return { ambiguous: "eye-snow" };
      }
    }
    if (token === "차") return { ambiguous: "car-tea" };
    if (token === "눈") return { ambiguous: "eye-snow" };
    return null;
  }

  function resolveNoun(token, verb) {
    var info = classifyToken(token);
    if (!info) return { noun: null };
    if (info.noun) return info;
    if (info.ambiguous === "car-tea") {
      if (verb === "drink" || verb === "eat") return { noun: TEA };
      if (verb === "ride" || verb === "buy") return { noun: CAR };
      return { ambiguous: "car-tea" };
    }
    return { ambiguous: info.ambiguous };
  }

  var TEA = {
    ko: "차",
    en: "tea",
    count: "mass",
    kind: "drink",
    definite: "the tea",
    drinkObject: "tea",
    likeBare: "tea",
    into: "tea",
    counters: ["잔"]
  };
  var CAR = {
    ko: "차",
    en: "car",
    plural: "cars",
    count: "count",
    kind: "vehicle",
    definite: "the car",
    placePhrase: "in the car"
  };

  function clarifyText(kind) {
    if (kind === "car-tea") {
      return "「차」가 두 가지라서, 아직 영어를 정하지 않을게요. 마시는 거면 「차 마시고 싶어요」, 타는 거면 「자동차가 있어요」라고 말해 주세요.";
    }
    return "「눈」이 두 가지라서, 아직 영어를 정하지 않을게요. 하늘에서 오면 「눈이 와요」, 아프면 「눈이 아파요」라고 말해 주세요.";
  }

  place("거리", "street", { placePhrase: "on the street", toPhrase: "to the street", packed: "The street is packed.", packedGloss: "거리가 사람으로 꽉 찼어요." });
  place("길", "road", { placePhrase: "on the road", toPhrase: "to the road", definite: "the road" });
  place("공원", "park", { placePhrase: "in the park", toPhrase: "to the park", packed: "The park is packed.", packedGloss: "공원에 사람이 꽉 찼어요." });
  place("집", "house", { placePhrase: "at home", toPhrase: "home", definite: "the house" });
  place("학교", "school", { placePhrase: "at school", toPhrase: "to school", definite: "the school" });
  place("회사", "office", { placePhrase: "at work", toPhrase: "to work", definite: "the office", en: "office" });
  place("식당", "restaurant", { placePhrase: "at the restaurant", toPhrase: "to the restaurant", packed: "The restaurant is packed.", packedGloss: "식당에 사람이 꽉 찼어요." });
  place("카페", "cafe", { placePhrase: "at the cafe", toPhrase: "to the cafe" });
  place("병원", "hospital", { placePhrase: "at the hospital", toPhrase: "to the hospital" });
  place("약국", "pharmacy", { placePhrase: "at the pharmacy", toPhrase: "to the pharmacy" });
  place("호텔", "hotel", { placePhrase: "at the hotel", toPhrase: "to the hotel" });
  place("공항", "airport", { placePhrase: "at the airport", toPhrase: "to the airport" });
  place("역", "station", { placePhrase: "at the station", toPhrase: "to the station" });
  place("지하철역", "subway station", { placePhrase: "at the subway station", toPhrase: "to the subway station", definite: "the subway station" });
  place("버스정류장", "bus stop", { placePhrase: "at the bus stop", toPhrase: "to the bus stop", definite: "the bus stop" });
  place("화장실", "bathroom", { placePhrase: "in the bathroom", toPhrase: "to the bathroom" });
  place("가게", "store", { placePhrase: "at the store", toPhrase: "to the store", packed: "The store is packed.", packedGloss: "가게에 사람이 꽉 찼어요." });
  place("마트", "supermarket", { placePhrase: "at the supermarket", toPhrase: "to the supermarket" });
  place("도서관", "library", { placePhrase: "at the library", toPhrase: "to the library" });
  place("은행", "bank", { placePhrase: "at the bank", toPhrase: "to the bank" });
  place("바다", "ocean", { placePhrase: "at the ocean", toPhrase: "to the ocean" });
  place("산", "mountain", { placePhrase: "on the mountain", toPhrase: "to the mountain" });
  place("한국", "Korea", { placePhrase: "in Korea", toPhrase: "to Korea", definite: "Korea" });
  place("서울", "Seoul", { placePhrase: "in Seoul", toPhrase: "to Seoul", definite: "Seoul" });
  place("영화관", "movie theater", { placePhrase: "at the movie theater", toPhrase: "to the movie theater", definite: "the movie theater" });
  place("경찰서", "police station", { placePhrase: "at the police station", toPhrase: "to the police station", definite: "the police station" });
  place("로비", "lobby", { placePhrase: "in the lobby", toPhrase: "to the lobby" });
  place("엘리베이터", "elevator", { placePhrase: "at the elevator", toPhrase: "to the elevator" });
  place("승강기", "elevator", { placePhrase: "at the elevator", toPhrase: "to the elevator" });
  place("주차장", "parking lot", { placePhrase: "in the parking lot", toPhrase: "to the parking lot", definite: "the parking lot" });
  place("현관", "entrance", { placePhrase: "at the entrance", toPhrase: "to the entrance" });
  place("문", "door", { placePhrase: "at the door", toPhrase: "to the door" });

  noun("버스", { en: "bus", plural: "buses", kind: "vehicle", definite: "the bus", placePhrase: "on the bus", toPhrase: "to the bus", packed: "The bus is packed.", packedGloss: "버스에 사람이 꽉 찼어요.", counters: ["대"] });
  noun("지하철", { en: "subway", count: "mass", kind: "vehicle", definite: "the subway", placePhrase: "on the subway", toPhrase: "to the subway" });
  noun("택시", { en: "taxi", plural: "taxis", kind: "vehicle", definite: "the taxi" });
  noun("기차", { en: "train", kind: "vehicle", definite: "the train", placePhrase: "on the train", toPhrase: "to the train" });
  noun("비행기", { en: "plane", kind: "vehicle", definite: "the plane" });
  noun("자전거", { en: "bicycle", kind: "vehicle", definite: "the bicycle", casualEn: "bike" });
  noun("자동차", { en: "car", plural: "cars", kind: "vehicle", definite: "the car", placePhrase: "in the car" });

  noun("피자", { en: "pizza", count: "mass", kind: "food", likeBare: "pizza", into: "pizza" });
  noun("치킨", { en: "fried chicken", count: "mass", kind: "food", likeBare: "fried chicken", into: "fried chicken" });
  noun("햄버거", { en: "hamburger", kind: "food", likeBare: "hamburgers", into: "burgers", counters: ["개"] });
  noun("라면", { en: "ramen", count: "mass", kind: "food", likeBare: "ramen", into: "ramen" });
  noun("국수", { en: "noodles", count: "plural", kind: "food", likeBare: "noodles", into: "noodles" });
  noun("고기", { en: "meat", count: "mass", kind: "food", likeBare: "meat", into: "meat" });
  noun("생선", { en: "fish", count: "mass", kind: "food", likeBare: "fish", into: "fish" });
  noun("밥", { en: "meal", count: "mass", kind: "food", likeBare: "rice", into: "rice" });
  noun("빵", { en: "bread", count: "mass", kind: "food", likeBare: "bread", into: "bread" });
  noun("김치", { en: "kimchi", count: "mass", kind: "food", likeBare: "kimchi", into: "kimchi" });
  noun("사과", { en: "apple", kind: "food", likeBare: "apples", counters: ["개"] });
  noun("바나나", { en: "banana", kind: "food", likeBare: "bananas", counters: ["개"] });
  noun("케이크", { en: "cake", count: "mass", kind: "food", likeBare: "cake", into: "cake" });
  noun("과자", { en: "snacks", count: "plural", kind: "food", likeBare: "snacks", into: "snacks" });
  noun("아이스크림", { en: "ice cream", count: "mass", kind: "food", likeBare: "ice cream", into: "ice cream" });
  noun("샐러드", { en: "salad", count: "mass", kind: "food", likeBare: "salad", into: "salad" });
  noun("김밥", { en: "gimbap", count: "mass", kind: "food", likeBare: "gimbap", into: "gimbap" });
  noun("아침", { en: "breakfast", count: "mass", kind: "food" });
  noun("점심", { en: "lunch", count: "mass", kind: "food" });
  noun("저녁", { en: "dinner", count: "mass", kind: "food" });

  noun("물", { en: "water", count: "mass", kind: "drink", definite: "the water", likeBare: "water", into: "water", counters: ["잔", "병"] });
  noun("커피", { en: "coffee", count: "mass", kind: "drink", definite: "the coffee", likeBare: "coffee", into: "coffee", counters: ["잔"] });
  noun("주스", { en: "juice", count: "mass", kind: "drink", likeBare: "juice", into: "juice", counters: ["잔"] });
  noun("맥주", { en: "beer", count: "mass", kind: "drink", likeBare: "beer", into: "beer", counters: ["잔", "병"] });
  noun("소주", { en: "soju", count: "mass", kind: "drink", likeBare: "soju", into: "soju", counters: ["잔", "병"] });
  noun("우유", { en: "milk", count: "mass", kind: "drink", likeBare: "milk", into: "milk", counters: ["잔"] });
  noun("콜라", { en: "cola", count: "mass", kind: "drink", likeBare: "cola", into: "cola", counters: ["잔", "병"] });
  noun("녹차", { en: "green tea", count: "mass", kind: "drink", likeBare: "green tea", into: "green tea", counters: ["잔"] });

  noun("사람", { en: "person", plural: "people", kind: "person", definite: "the person", likeBare: "people" });
  noun("친구", { en: "friend", kind: "person", definite: "the friend", likeBare: "my friends" });
  noun("선생님", { en: "teacher", kind: "person", definite: "the teacher", likeBare: "the teacher" });
  noun("학생", { en: "student", kind: "person", definite: "the student", likeBare: "students" });
  noun("의사", { en: "doctor", kind: "person", definite: "the doctor", likeBare: "the doctor" });
  noun("간호사", { en: "nurse", kind: "person", definite: "the nurse", likeBare: "the nurse" });
  noun("아이", { en: "child", plural: "children", kind: "person", definite: "the child", likeBare: "children" });
  noun("아기", { en: "baby", plural: "babies", kind: "person", definite: "the baby" });

  noun("가방", { en: "bag", kind: "thing", definite: "the bag", counters: ["개"] });
  noun("책", { en: "book", kind: "thing", definite: "the book", seeAs: "read", seeObject: "a book", counters: ["권"] });
  noun("핸드폰", { en: "phone", kind: "thing", definite: "the phone", counters: ["개"] });
  noun("휴대폰", { en: "phone", kind: "thing", definite: "the phone", counters: ["개"] });
  noun("돈", { en: "money", count: "mass", kind: "thing", definite: "the money" });
  noun("표", { en: "ticket", kind: "thing", definite: "the ticket", counters: ["장"] });
  noun("옷", { en: "clothes", count: "plural", kind: "thing", definite: "the clothes", likeBare: "clothes" });
  noun("신발", { en: "shoes", count: "plural", kind: "thing", definite: "the shoes", likeBare: "shoes" });
  noun("선물", { en: "gift", kind: "thing", definite: "the gift", counters: ["개"] });
  noun("사진", { en: "photo", kind: "thing", definite: "the photo" });
  noun("메뉴", { en: "menu", count: "mass", kind: "thing", definite: "the menu" });
  noun("영수증", { en: "receipt", kind: "thing", definite: "the receipt" });
  noun("영화", { en: "movie", kind: "thing", definite: "the movie", seeAs: "watch", seeObject: "a movie", likeBare: "movies", into: "movies" });
  noun("음악", { en: "music", count: "mass", kind: "thing", likeBare: "music", into: "music" });
  noun("숙제", { en: "homework", count: "mass", kind: "thing", doObject: "my homework" });
  noun("신문", { en: "newspaper", kind: "thing", seeAs: "read", seeObject: "a newspaper" });
  noun("텔레비전", { en: "TV", kind: "thing", definite: "the TV", seeAs: "watch", seeObject: "TV" });
  noun("문제", { en: "problem", kind: "thing", definite: "the problem" });
  noun("와이파이", { en: "Wi-Fi", count: "mass", kind: "thing", definite: "the Wi-Fi" });
  noun("비밀번호", { en: "password", count: "mass", kind: "thing", definite: "the password" });

  function helloChat(mem) {
    if (mem.name && mem.turnCount > 0) return mem.name + " 님, 또 왔네요. 인사는 이렇게 해요.";
    if (mem.name) return mem.name + " 님, 안녕하세요. 인사는 이렇게 해요.";
    if (mem.turnCount > 0) return "또 만났네요. 인사는 이렇게 해요.";
    return "안녕하세요. 인사는 이렇게 해요.";
  }

  addPhrase("greet-hello", "greetings", "안녕하세요", "Hello.", "Hey.", "만날 때 하는 인사예요.", "친구한테는 더 짧게 말해요.", { keys: ["안녕하십니까"], chat: helloChat, related: ["greet-thanks", "greet-how"], noWhen: true });
  addPhrase("greet-hi", "greetings", "안녕", "Hi.", "Hey.", "편한 인사예요.", "친구끼리 쓰는 인사예요.", { noWhen: true });
  addPhrase("greet-morning", "greetings", "좋은 아침이에요", "Good morning.", "Morning.", "아침 인사예요.", "짧게 줄인 말이에요.", { keys: ["좋은 아침입니다"] });
  addPhrase("greet-evening", "greetings", "좋은 저녁이에요", "Good evening.", "Hey, good evening.", "저녁 인사예요.", "앞에 hey를 붙여요.");
  addPhrase("greet-night", "greetings", "잘 자요", "Good night.", "Night.", "잠자리 인사예요.", "짧게 줄인 말이에요.", { keys: ["안녕히 주무세요", "잘자요"] });
  addPhrase("greet-meet", "greetings", "만나서 반가워요", "Nice to meet you.", "Good to meet you.", "처음 만날 때 해요.", "편하게 말한 거예요.", { keys: ["만나서 반갑습니다", "반갑습니다"] });
  addPhrase("greet-how", "greetings", "잘 지내요", "How are you?", "How's it going?", "안부를 물어요.", "친구끼리 자주 써요.", { keys: ["어떻게 지내요"] });
  addPhrase("greet-how-today", "greetings", "오늘 잘 지내요", "How are you today?", "How's it going today?", "오늘 안부를 물어요.", "친구끼리 하는 말이에요.", { noWhen: true });
  addPhrase("greet-fine", "greetings", "저는 잘 지내요", "I'm doing well.", "I'm good.", "괜찮다는 대답이에요.", "짧게 대답하는 말이에요.", { keys: ["나 잘 지내요", "잘 지내고 있어요"] });
  addPhrase("greet-okay", "feelings", "그냥 그래요", "I'm okay.", "I'm just okay.", "아주 좋지도 나쁘지도 않아요.", "그저 그렇다는 말이에요.");
  addPhrase("greet-long", "greetings", "오랜만이에요", "It's been a long time.", "Long time no see.", "한참만이라는 뜻이에요.", "친구들이 쓰는 말이에요.");
  addPhrase("greet-thanks", "greetings", "감사합니다", "Thank you.", "Thanks.", "고맙다는 말이에요.", "짧게 말한 거예요.", { keys: ["감사해요", "고마워요", "고맙습니다"], chat: function (mem) { return mem.turnCount > 0 ? "별말씀을요. 또 물어봐도 돼요." : "별말씀을요."; } });
  addPhrase("greet-thanks-lot", "greetings", "정말 감사합니다", "Thank you so much.", "Thanks a lot.", "아주 고맙다는 말이에요.", "강하게 고맙다고 해요.", { keys: ["정말 고마워요"] });
  addPhrase("greet-welcome", "greetings", "천만에요", "You're welcome.", "No worries.", "고맙다는 말에 답해요.", "걱정 말라는 편한 말이에요.", { keys: ["별말씀을요"] });
  addPhrase("greet-sorry", "greetings", "죄송해요", "I'm sorry.", "Sorry.", "사과하는 말이에요.", "짧게 사과해요.", { keys: ["죄송합니다", "미안해요", "미안합니다"], chat: function () { return "괜찮아요. 사과는 이렇게 해요."; } });
  addPhrase("greet-its-ok", "greetings", "괜찮아요", "It's okay.", "It's all good.", "문제없다는 말이에요.", "편하게 괜찮다고 해요.");
  addPhrase("greet-excuse", "greetings", "실례합니다", "Excuse me.", "Sorry, excuse me.", "말을 걸 때 써요.", "죄송한 마음을 조금 넣어요.", { keys: ["저기요"] });
  addPhrase("greet-bye", "greetings", "안녕히 가세요", "Goodbye.", "Bye.", "헤어질 때 해요.", "짧게 줄인 말이에요.", { keys: ["안녕히 계세요"] });
  addPhrase("greet-seeyou", "greetings", "잘 가요", "Take care.", "See you.", "헤어질 때 해요.", "또 보자는 말이에요.");
  addPhrase("greet-later", "greetings", "또 봐요", "See you later.", "Catch you later.", "나중에 보자는 말이에요.", "친구들이 자주 써요.", { keys: ["다음에 봐요"] });
  addPhrase("greet-tomorrow", "time", "내일 봐요", "I'll see you tomorrow.", "See you tomorrow.", "내일 보자는 말이에요.", "짧게 말한 거예요.", { keys: ["내일 만나요"], noWhen: true });
  addPhrase("daily-english", "daily", "영어를 잘 못해요", "I don't speak English well.", "My English isn't great.", "영어가 서툴다는 말이에요.", "부담 없이 말하는 법이에요.", { keys: ["영어 못해요", "영어를 못해요"] });
  addPhrase("daily-help", "daily", "도와주세요", "Please help me.", "Can you help me?", "도움을 부탁해요.", "질문처럼 부탁해요.", { keys: ["도와줘"] });
  addPhrase("daily-again", "daily", "다시 말해 주세요", "Could you say that again?", "One more time, please?", "한 번 더 말해 달라는 말이에요.", "짧게 부탁하는 말이에요.", { keys: ["다시 말해주세요", "다시 한번 말해 주세요"] });
  addPhrase("daily-slow", "daily", "천천히 말해 주세요", "Could you speak slowly?", "A little slower, please?", "천천히 말해 달라는 말이에요.", "짧게 부탁하는 말이에요.", { keys: ["천천히 말해주세요"] });
  addPhrase("daily-understand", "daily", "이해가 안 돼요", "I don't understand.", "I'm not following.", "모르겠다는 말이에요.", "대화가 안 따라온다는 말이에요.", { keys: ["이해 안 돼요"] });
  addPhrase("daily-love", "feelings", "사랑해요", "I love you.", "Love you.", "사랑한다는 말이에요.", "짧게 말한 거예요.", { keys: ["사랑해"] });
  addPhrase("daily-miss", "feelings", "보고 싶어요", "I miss you.", "Miss you.", "그립다는 말이에요.", "짧게 말한 거예요.", { noWhen: true });
  addPhrase("daily-birthday", "greetings", "생일 축하해요", "Happy birthday.", "Happy birthday!", "생일 축하예요.", "기분 좋게 말해요.", { keys: ["생일 축하합니다"] });
  addPhrase("daily-congrats", "greetings", "축하합니다", "Congratulations.", "Congrats.", "축하하는 말이에요.", "짧게 줄인 말이에요.", { keys: ["축하해요"] });
  addPhrase("daily-luck", "greetings", "행운을 빌어요", "Good luck.", "Best of luck.", "잘되라고 하는 말이에요.", "조금 더 정중해요.", { keys: ["행운을 빌게요"] });
  addPhrase("daily-careful", "daily", "조심하세요", "Please be careful.", "Be careful.", "조심하라는 말이에요.", "짧게 말한 거예요.", { keys: ["조심해요"] });
  addPhrase("daily-welcome-in", "greetings", "환영합니다", "Welcome.", "Come on in.", "환영하는 말이에요.", "들어오라는 말이에요.", { keys: ["어서 오세요"] });
  addPhrase("daily-ok", "daily", "오케이", "Okay.", "OK.", "알겠어요, 좋아요라는 말이에요.", "더 짧은 말이에요.", { keys: ["okay", "ok"] });
  addPhrase("daily-no", "daily", "아니요", "No.", "Nope.", "아니라는 말이에요.", "친구끼리 쓰는 말이에요.", { keys: ["아니에요"] });

  addPhrase("feel-hungry", "feelings", "배고파요", "I'm hungry.", "I'm starving.", "배가 고파요.", "매우 고프다는 말이에요.", { keys: ["배가 고파요", "배고픕니다"], related: ["food-what", "food-menu"] });
  addPhrase("feel-full", "feelings", "배불러요", "I'm full.", "I'm stuffed.", "배가 불러요.", "더 못 먹는다는 말이에요.", { keys: ["배가 불러요"] });
  addPhrase("feel-tired", "feelings", "피곤해요", "I'm tired.", "I'm wiped.", "피곤하다는 말이에요.", "힘이 다 빠졌다는 말이에요.");
  addPhrase("feel-sleepy", "feelings", "졸려요", "I'm sleepy.", "I'm really sleepy.", "잠이 와요.", "아주 졸리다는 말이에요.");
  addPhrase("feel-happy", "feelings", "행복해요", "I'm happy.", "I'm really happy.", "행복하다는 말이에요.", "더 강하게 말해요.");
  addPhrase("feel-sad", "feelings", "슬퍼요", "I'm sad.", "I'm feeling down.", "슬프다는 말이에요.", "기분이 가라앉았다는 말이에요.");
  addPhrase("feel-angry", "feelings", "화나요", "I'm angry.", "I'm mad.", "화가 났어요.", "화났다는 편한 말이에요.", { keys: ["화가 나요"] });
  addPhrase("feel-bored", "feelings", "심심해요", "I'm bored.", "I'm so bored.", "심심해요.", "아주 심심하다는 말이에요.");
  addPhrase("feel-lonely", "feelings", "외로워요", "I'm lonely.", "I feel lonely.", "외로워요.", "외롭다는 말이에요.");
  addPhrase("feel-worried", "feelings", "걱정돼요", "I'm worried.", "I'm kind of worried.", "걱정돼요.", "조금 걱정된다는 말이에요.", { keys: ["걱정이에요"] });
  addPhrase("feel-scared", "feelings", "무서워요", "I'm scared.", "I'm really scared.", "무서워요.", "아주 무섭다는 말이에요.");
  addPhrase("feel-excited", "feelings", "신나요", "I'm excited.", "I'm so excited.", "신나요.", "아주 신난다는 말이에요.");
  addPhrase("feel-sick", "feelings", "아파요", "I don't feel well.", "I feel sick.", "몸이 안 좋아요.", "아프다는 말이에요.", { keys: ["몸이 안 좋아요"] });
  addPhrase("feel-head", "feelings", "머리가 아파요", "My head hurts.", "I have a headache.", "머리가 아파요.", "두통이 있다는 말이에요.");
  addPhrase("feel-stomach", "feelings", "배가 아파요", "My stomach hurts.", "My stomach really hurts.", "배가 아파요.", "더 아프다는 말이에요.");
  addPhrase("feel-throat", "feelings", "목이 아파요", "My throat hurts.", "My throat really hurts.", "목이 아파요.", "더 아프다는 말이에요.");
  addPhrase("feel-tooth", "feelings", "이가 아파요", "My tooth hurts.", "I have a toothache.", "이가 아파요.", "치통이 있다는 말이에요.");
  addPhrase("feel-leg", "feelings", "다리가 아파요", "My leg hurts.", "My leg really hurts.", "다리가 아파요.", "더 아프다는 말이에요.");
  addPhrase("feel-arm", "feelings", "팔이 아파요", "My arm hurts.", "My arm really hurts.", "팔이 아파요.", "더 아프다는 말이에요.");
  addPhrase("feel-back", "feelings", "허리가 아파요", "My back hurts.", "My back really hurts.", "허리가 아파요.", "더 아프다는 말이에요.");
  addPhrase("feel-eye", "feelings", "눈이 아파요", "My eye hurts.", "My eye really hurts.", "눈이 아파요.", "더 아프다는 말이에요.");
  addPhrase("feel-cold", "feelings", "추워요", "It's cold.", "I'm freezing.", "춥다는 말이에요.", "너무 춥다는 말이에요.");
  addPhrase("feel-hot", "feelings", "더워요", "It's hot.", "It's so hot.", "덥다는 말이에요.", "아주 덥다는 말이에요.");
  addPhrase("feel-good", "feelings", "좋아요", "That's good.", "Nice.", "좋다는 말이에요.", "짧게 좋다고 해요.");
  addPhrase("feel-dislike", "feelings", "싫어요", "I don't like it.", "No thanks.", "싫다는 말이에요.", "사양할 때도 써요.");
  addPhrase("feel-fun", "feelings", "재미있어요", "It's fun.", "This is fun.", "재미있어요.", "지금 이게 재미있다는 말이에요.");
  addPhrase("feel-boring", "feelings", "재미없어요", "It's boring.", "This is boring.", "재미없어요.", "지금 이게 재미없다는 말이에요.");
  addPhrase("feel-hard", "feelings", "어려워요", "It's difficult.", "This is tough.", "어렵다는 말이에요.", "힘들다는 편한 말이에요.");
  addPhrase("feel-easy", "feelings", "쉬워요", "It's easy.", "This is super easy.", "쉽다는 말이에요.", "아주 쉽다는 말이에요.");
  addPhrase("feel-dontknow", "daily", "모르겠어요", "I don't know.", "No idea.", "모른다는 말이에요.", "전혀 모른다는 말이에요.");
  addPhrase("feel-know", "daily", "알아요", "I know.", "Yeah, I know.", "안다는 말이에요.", "알고 있다는 말이에요.");
  addPhrase("feel-gotit", "daily", "알겠어요", "I understand.", "Got it.", "이해했다는 말이에요.", "짧게 알겠다는 말이에요.");
  addPhrase("feel-cold-sick", "feelings", "감기예요", "I have a cold.", "I caught a cold.", "감기에 걸렸어요.", "감기가 시작됐다는 말이에요.", { keys: ["감기 걸렸어요"] });

  addPhrase("weather-nice", "weather", "날씨가 좋아요", "The weather is nice.", "It's nice out.", "날씨가 좋아요.", "밖에 나가기 좋다는 말이에요.", { keys: ["날씨 좋아요"], related: ["weather-rain", "weather-sunny"] });
  addPhrase("weather-nice-today", "weather", "오늘 날씨가 좋아요", "The weather is nice today.", "It's nice out today.", "오늘 날씨가 좋아요.", "오늘 밖이 좋다는 말이에요.", { keys: ["오늘 날씨 좋아요"], noWhen: true });
  addPhrase("weather-bad", "weather", "날씨가 안 좋아요", "The weather isn't good.", "The weather's not great.", "날씨가 안 좋아요.", "별로라는 편한 말이에요.", { keys: ["날씨가 나빠요"] });
  addPhrase("weather-rain", "weather", "비가 와요", "It's raining.", "It's raining out.", "비가 내려요.", "밖에 비가 온다는 말이에요.", { keys: ["비 와요"], related: ["weather-rain-hard", "weather-nice"] });
  addPhrase("weather-rain-hard", "weather", "비가 많이 와요", "It's raining hard.", "It's pouring.", "비가 많이 와요.", "비가 쏟아진다는 말이에요.", { keys: ["비 많이 와요"] });
  addPhrase("weather-snow", "weather", "눈이 와요", "It's snowing.", "It's snowing out.", "눈이 내려요.", "밖에 눈이 온다는 말이에요.", { keys: ["눈 와요"] });
  addPhrase("weather-snow-hard", "weather", "눈이 많이 와요", "It's snowing hard.", "It's snowing a lot.", "눈이 많이 와요.", "눈이 많이 내린다는 말이에요.");
  addPhrase("weather-wind", "weather", "바람이 불어요", "It's windy.", "It's really windy.", "바람이 불어요.", "바람이 세다는 말이에요.");
  addPhrase("weather-sunny", "weather", "맑아요", "It's sunny.", "It's sunny out.", "하늘이 맑아요.", "밖에 해가 났다는 말이에요.", { keys: ["날씨가 맑아요"] });
  addPhrase("weather-cloudy", "weather", "흐려요", "It's cloudy.", "It's cloudy out.", "구름이 많아요.", "밖이 흐리다는 말이에요.", { keys: ["날씨가 흐려요"] });
  addPhrase("weather-ask", "weather", "오늘 날씨 어때요", "How's the weather today?", "What's it like out?", "오늘 날씨를 물어요.", "밖이 어때 보이냐고 물어요.", { keys: ["날씨 어때요"], noWhen: true });
  addPhrase("weather-humid", "weather", "습해요", "It's humid.", "It's really humid.", "습기가 많아요.", "아주 습하다는 말이에요.");
  addPhrase("weather-fog", "weather", "안개가 껴요", "It's foggy.", "It's really foggy.", "안개가 있어요.", "안개가 자욱하다는 말이에요.", { keys: ["안개 꼈어요"] });

  addPhrase("food-what", "food", "뭐 먹을까요", "What should we eat?", "What do you wanna eat?", "먹을 것을 같이 정해요.", "want to를 wanna로 줄여요.");
  addPhrase("food-drink-what", "food", "뭐 마실까요", "What should we drink?", "What do you wanna drink?", "마실 것을 같이 정해요.", "want to를 wanna로 줄여요.");
  addPhrase("food-tasty", "food", "맛있어요", "It's delicious.", "This is so good.", "맛이 좋아요.", "정말 맛있다는 말이에요.", { keys: ["진짜 맛있어요"] });
  addPhrase("food-bad", "food", "맛없어요", "It doesn't taste good.", "This isn't very good.", "맛이 없어요.", "별로라는 말이에요.");
  addPhrase("food-spicy", "food", "맵아요", "It's spicy.", "This is spicy.", "매운맛이 나요.", "지금 음식이 맵다는 말이에요.", { keys: ["매워요"] });
  addPhrase("food-sweet", "food", "달아요", "It's sweet.", "This is sweet.", "단맛이 나요.", "지금 음식이 달다는 말이에요.");
  addPhrase("food-salty", "food", "짜요", "It's salty.", "This is pretty salty.", "짠맛이 나요.", "꽤 짜다는 말이에요.");
  addPhrase("food-bland", "food", "싱거워요", "It's bland.", "This is a little bland.", "간이 약해요.", "조금 싱겁다는 말이에요.");
  addPhrase("food-menu", "food", "메뉴 주세요", "Can I see the menu?", "Menu, please.", "메뉴를 보여 달라는 말이에요.", "짧게 부탁해요.", { keys: ["메뉴판 주세요"] });
  addPhrase("food-check", "food", "계산해 주세요", "Check, please.", "Can I get the check?", "계산을 부탁해요.", "계산서를 달라는 말이에요.", { keys: ["계산이요"] });
  addPhrase("food-togo", "food", "포장해 주세요", "To go, please.", "Can I get this to go?", "가져가겠다는 말이에요.", "포장을 부탁해요.");
  addPhrase("food-here", "food", "여기서 먹을게요", "For here, please.", "I'll eat here.", "여기서 먹는다는 말이에요.", "자리에 있겠다는 말이에요.");
  addPhrase("food-order", "food", "주문할게요", "I'd like to order.", "I'm ready to order.", "주문하겠다는 말이에요.", "이제 주문해도 된다는 말이에요.");
  addPhrase("food-rec", "food", "추천해 주세요", "What do you recommend?", "What's good here?", "추천을 부탁해요.", "뭐가 맛있냐고 물어요.");
  addPhrase("food-before", "food", "잘 먹겠습니다", "Thank you for the meal.", "Thanks for the food.", "먹기 전에 하는 인사예요.", "음식에 고맙다는 말이에요.");
  addPhrase("food-after", "food", "잘 먹었습니다", "That was great.", "Thanks, that was great.", "잘 먹었다는 인사예요.", "맛있었고 고맙다는 말이에요.");
  addPhrase("food-enjoy", "food", "맛있게 드세요", "Enjoy your meal.", "Enjoy.", "맛있게 먹으라는 말이에요.", "짧게 말한 거예요.");
  addPhrase("food-more-water", "food", "물 더 주세요", "More water, please.", "Can I get more water?", "물을 더 달라는 말이에요.", "더 달라는 부탁이에요.");
  addPhrase("food-mild", "food", "덜 맵게 해 주세요", "Not too spicy, please.", "Can you make it mild?", "맵지 않게 해 달라는 말이에요.", "순하게 해 달라는 말이에요.");
  addPhrase("food-reserve", "food", "예약했어요", "I have a reservation.", "I've got a reservation.", "예약했다는 말이에요.", "예약이 있다는 말이에요.");
  addPhrase("food-bathroom", "daily", "화장실 가고 싶어요", "I want to go to the bathroom.", "I need to use the bathroom.", "화장실에 가고 싶어요.", "실제로 자주 이렇게 말해요.", { noWhen: true });

  addPhrase("go-bus-where", "transport", "이 버스 어디 가요", "Where does this bus go?", "Where's this bus going?", "이 버스의 방향을 물어요.", "어디로 가냐고 물어요.", { keys: ["이 버스 어디로 가요"] });
  addPhrase("go-stop", "transport", "여기 세워 주세요", "Please stop here.", "Can you stop here?", "여기서 내리겠다는 말이에요.", "세워 달라는 말이에요.");
  addPhrase("go-long", "transport", "얼마나 걸려요", "How long does it take?", "How long is it?", "시간이 얼마나 걸리는지 물어요.", "짧게 물은 거예요.");
  addPhrase("go-fare", "transport", "요금이 얼마예요", "How much is the fare?", "How much is it?", "타는 값을 물어요.", "값을 짧게 물어요.", { keys: ["요금 얼마예요"] });
  addPhrase("go-airport", "transport", "공항 어떻게 가요", "How do I get to the airport?", "What's the best way to the airport?", "공항 가는 길을 물어요.", "제일 좋은 길을 물어요.");
  addPhrase("go-station", "transport", "역 어떻게 가요", "How do I get to the station?", "What's the best way to the station?", "역으로 가는 길을 물어요.", "제일 좋은 길을 물어요.");
  addPhrase("go-transfer", "transport", "갈아타요", "I need to transfer.", "I have to transfer.", "갈아타야 해요.", "바꿔 타야 한다는 말이에요.");
  addPhrase("go-missed", "transport", "놓쳤어요", "I missed it.", "I just missed it.", "못 타고 놓쳤어요.", "방금 놓쳤다는 말이에요.");
  addPhrase("go-might-late", "time", "늦을 것 같아요", "I think I'll be late.", "I might be late.", "늦을 것 같아요.", "늦을 수도 있다는 말이에요.");
  addPhrase("go-subway-where", "transport", "지하철역이 어디예요", "Where is the subway station?", "Where's the subway?", "지하철역 위치를 물어요.", "subway라고 짧게 말해요.", { keys: ["지하철역 어디예요"] });

  addPhrase("street-crowd", "street", "거리에 사람이 많이 다녀요", "There are a lot of people on the street.", "The street is packed.", "거리에 사람이 많아요.", "거리가 사람으로 꽉 찼어요.", { keys: ["거리에 사람이 많아요", "거리 사람이 많이 다녀요"], related: ["street-lost", "street-traffic"] });
  addPhrase("street-traffic", "street", "길이 막혀요", "Traffic is heavy.", "Traffic is crazy.", "차가 많이 막혀요.", "차가 엄청 막혔다는 말이에요.", { keys: ["차가 막혀요"], related: ["street-crowd", "street-lost"] });
  addPhrase("street-lost", "street", "길을 잃었어요", "I'm lost.", "I think I'm lost.", "길을 몰라요.", "길을 잃은 것 같다는 말이에요.", { keys: ["길 잃었어요"], related: ["street-crowd", "street-traffic"] });
  addPhrase("street-near", "street", "여기서 가까워요", "Is it near here?", "Is it close?", "여기서 가까운지 물어요.", "가까운지 짧게 물어요.");
  addPhrase("street-far", "street", "여기서 멀어요", "Is it far from here?", "Is it far?", "여기서 먼지 물어요.", "먼지만 짧게 물어요.");
  addPhrase("street-photo-ok", "street", "사진 찍어도 돼요", "Can I take a photo?", "Mind if I take a photo?", "사진을 찍어도 되는지 물어요.", "Do you mind를 줄인 말이에요.");
  addPhrase("street-left", "street", "왼쪽이에요", "It's on the left.", "It's on your left.", "왼쪽이라는 말이에요.", "상대 기준으로 왼쪽이에요.");
  addPhrase("street-right", "street", "오른쪽이에요", "It's on the right.", "It's on your right.", "오른쪽이라는 말이에요.", "상대 기준으로 오른쪽이에요.");
  addPhrase("street-straight", "street", "직진이에요", "Go straight.", "Just go straight.", "앞으로 쭉 가라는 말이에요.", "그냥 직진하라는 말이에요.", { keys: ["쭉 가세요"] });
  addPhrase("street-thisway", "street", "이쪽으로 가세요", "Please go this way.", "Come this way.", "이 방향으로 가라는 말이에요.", "이쪽으로 오라는 말이에요.");
  addPhrase("street-photo", "daily", "사진 찍어 주세요", "Could you take a photo?", "Can you take a photo?", "사진을 찍어 달라는 말이에요.", "찍어 달라는 부탁이에요.");

  addPhrase("time-what", "time", "지금 몇 시예요", "What time is it?", "Do you have the time?", "시각을 물어요.", "시간 좀 봐 달라는 말이에요.", { keys: ["몇 시예요"], noWhen: true });
  addPhrase("time-busy-today", "time", "오늘 바빠요", "I'm busy today.", "I'm really busy today.", "오늘 바빠요.", "오늘 아주 바쁘다는 말이에요.", { noWhen: true });
  addPhrase("time-busy", "time", "바빠요", "I'm busy.", "I'm really busy.", "바쁘다는 말이에요.", "아주 바쁘다는 말이에요.");
  addPhrase("time-have", "time", "시간 있어요", "Do you have time?", "Are you free?", "시간이 있는지 물어요.", "한가한지 물어요.");
  addPhrase("time-none", "time", "시간이 없어요", "I don't have time.", "I'm short on time.", "시간이 없어요.", "시간이 촉박하다는 말이에요.");
  addPhrase("time-late", "time", "늦었어요", "I'm late.", "I'm running late.", "늦었다는 말이에요.", "늦어지고 있다는 말이에요.");
  addPhrase("time-moment", "time", "잠깐만요", "One moment, please.", "One sec.", "잠시만 기다리라는 말이에요.", "잠깐의 아주 짧은 말이에요.", { keys: ["잠시만요"] });
  addPhrase("time-free-today", "time", "오늘 시간 돼요", "Are you free today?", "Are you around today?", "오늘 시간이 되는지 물어요.", "오늘 볼 수 있는지 물어요.", { keys: ["오늘 시간 있어요"], noWhen: true });
  addPhrase("time-meet", "time", "몇 시에 만날까요", "What time should we meet?", "What time works?", "만날 시각을 물어요.", "되는 시간을 물어요.");
  addPhrase("time-leave", "time", "지금 갈게요", "I'm leaving now.", "I'm heading out.", "지금 출발해요.", "지금 나간다는 말이에요.", { keys: ["지금 가요"], noWhen: true });
  addPhrase("time-wait", "time", "조금만 기다려 주세요", "Please wait a moment.", "Give me a second.", "잠시 기다려 달라는 말이에요.", "아주 잠깐 달라는 말이에요.");

  addPhrase("shop-this", "shopping", "이거 얼마예요", "How much is this?", "How much?", "이 물건 값을 물어요.", "값만 짧게 물어요.", { related: ["shop-expensive", "shop-card"] });
  addPhrase("shop-howmuch", "shopping", "얼마예요", "How much is it?", "How much?", "값을 물어요.", "값만 짧게 물어요.");
  addPhrase("shop-expensive", "shopping", "너무 비싸요", "It's too expensive.", "That's too much.", "너무 비싸요.", "값이 너무 세다는 말이에요.", { related: ["shop-this", "shop-cut"] });
  addPhrase("shop-cut", "shopping", "좀 깎아 주세요", "Could you lower the price?", "Can you go any lower?", "값을 낮춰 달라는 말이에요.", "더 낮출 수 있는지 물어요.", { keys: ["깎아 주세요"] });
  addPhrase("shop-card", "shopping", "카드 돼요", "Do you take cards?", "Can I pay by card?", "카드 결제가 되는지 물어요.", "카드로 내도 되냐고 물어요.", { keys: ["카드 되나요"] });
  addPhrase("shop-cash", "shopping", "현금만 돼요", "Is it cash only?", "Cash only?", "현금만 받는지 물어요.", "현금만인지 짧게 물어요.");
  addPhrase("shop-bag", "shopping", "봉투 주세요", "A bag, please.", "Can I get a bag?", "봉투를 달라는 말이에요.", "봉투를 부탁해요.");
  addPhrase("shop-color", "shopping", "다른 색깔 있어요", "Do you have another color?", "Do you have this in another color?", "다른 색이 있는지 물어요.", "이 물건의 다른 색을 물어요.", { keys: ["다른 색 있어요"] });
  addPhrase("shop-size", "shopping", "다른 사이즈 있어요", "Do you have another size?", "Do you have this in another size?", "다른 크기가 있는지 물어요.", "이 물건의 다른 크기를 물어요.");
  addPhrase("shop-fit", "shopping", "사이즈가 안 맞아요", "It doesn't fit.", "This doesn't fit.", "크기가 안 맞아요.", "이 옷이 안 맞는다는 말이에요.", { keys: ["사이즈 안 맞아요"] });
  addPhrase("shop-try", "shopping", "입어 봐도 돼요", "Can I try it on?", "Can I try this on?", "입어 봐도 되는지 물어요.", "이걸 입어 봐도 되냐고 물어요.");
  addPhrase("shop-look", "shopping", "그냥 볼게요", "I'm just looking.", "Just looking, thanks.", "아직 안 산다는 말이에요.", "둘러만 본다는 말이에요.");
  addPhrase("shop-take", "shopping", "이걸로 할게요", "I'll take this one.", "I'll go with this.", "이 물건을 사겠다는 말이에요.", "이걸로 정했다는 말이에요.");
  addPhrase("shop-receipt", "shopping", "영수증 주세요", "A receipt, please.", "Can I get a receipt?", "영수증을 달라는 말이에요.", "영수증을 부탁해요.");
  addPhrase("shop-refund", "shopping", "환불하고 싶어요", "I'd like a refund.", "Can I get a refund?", "돈을 돌려 받고 싶어요.", "환불을 부탁해요.");
  addPhrase("shop-sale", "shopping", "세일해요", "This is on sale.", "It's on sale.", "값이 내려가 있어요.", "세일 중이라는 말이에요.");

  addPhrase("daily-wifi", "daily", "와이파이 있어요", "Do you have Wi-Fi?", "Is there Wi-Fi?", "와이파이가 있는지 물어요.", "와이파이를 쓸 수 있는지 물어요.", { keys: ["와이파이 되나요"] });
  addPhrase("daily-password", "daily", "비밀번호가 뭐예요", "What's the password?", "Can I get the password?", "비밀번호를 물어요.", "비밀번호를 알려 달라는 말이에요.", { keys: ["비밀번호 뭐예요"] });
  addPhrase("daily-name-ask", "greetings", "이름이 뭐예요", "What's your name?", "Hey, what's your name?", "이름을 물어요.", "이름을 편하게 물어요.", { keys: ["이름은 뭐예요", "이름 뭐예요"] });

  indexPhrases();

  var WRAP_SUFFIXES = [
    "를영어로어떻게말해요",
    "을영어로어떻게말해요",
    "는영어로어떻게말해요",
    "은영어로어떻게말해요",
    "이영어로어떻게말해요",
    "가영어로어떻게말해요",
    "도영어로어떻게말해요",
    "영어로어떻게말해요",
    "영어로어떻게말하나요",
    "영어로어떻게말하죠",
    "를영어로뭐라고해요",
    "을영어로뭐라고해요",
    "영어로뭐라고해요",
    "영어로뭐라고말해요",
    "영어로는어떻게말해요",
    "영어로는뭐예요",
    "를영어로알려주세요",
    "을영어로알려주세요",
    "영어로알려주세요",
    "영어로어떻게써요",
    "는영어로어떻게돼요",
    "영어로어떻게돼요",
    "를영어로",
    "을영어로",
    "는영어로",
    "영어로"
  ];

  function unwrap(text) {
    var s = text.replace(/^(선생님|저기요|저기|질문인데요)/, "");
    var asked = false;
    for (var i = 0; i < WRAP_SUFFIXES.length; i++) {
      var suffix = WRAP_SUFFIXES[i];
      if (s === suffix) return { core: "", askedHow: true };
      if (s.endsWith(suffix) && s.length > suffix.length) {
        s = s.slice(0, -suffix.length);
        asked = true;
        break;
      }
    }
    if (s.indexOf("영어로어떻게말해요") === 0) {
      s = s.slice("영어로어떻게말해요".length);
      asked = true;
    } else if (s.indexOf("영어로는") === 0) {
      s = s.slice("영어로는".length);
      asked = true;
    } else if (s.indexOf("영어로") === 0) {
      s = s.slice("영어로".length);
      asked = true;
    }
    return { core: s, askedHow: asked };
  }

  function keySet(list) {
    var out = Object.create(null);
    list.forEach(function (item) { out[normKey(item)] = true; });
    return out;
  }

  var REPEAT_KEYS = keySet(["다시", "다시 말해 줘", "다시 말해 주세요", "한 번 더", "한번 더", "못 들었어요", "다시 들려 주세요"]);
  var SLOW_KEYS = keySet(["천천히", "더 천천히", "천천히 말해 주세요", "좀 천천히"]);
  var NORMAL_KEYS = keySet(["보통 속도", "원래 속도", "정상 속도", "다시 빠르게"]);
  var EXPLAIN_KEYS = keySet(["이해가 안 돼요", "이해 안 돼요", "무슨 뜻이에요", "무슨 말이에요"]);
  var ANOTHER_KEYS = keySet(["다른 표현", "다른 표현 있어요", "다른 말", "다른 말 있어요", "다르게 말하면", "다른 영어로"]);
  var YES_KEYS = keySet(["네", "응", "네네", "웅", "오케이", "okay", "ok"]);

  function memoryOf(input) {
    var mem = input && typeof input === "object" ? input : {};
    return {
      rate: typeof mem.rate === "number" ? mem.rate : 1,
      taught: Array.isArray(mem.taught) ? mem.taught.slice() : [],
      last: mem.last && mem.last.standard ? Object.assign({}, mem.last) : null,
      turnCount: typeof mem.turnCount === "number" ? mem.turnCount : 0,
      name: typeof mem.name === "string" && mem.name ? mem.name : null
    };
  }

  function finish(partial, mem, patch) {
    patch = patch || {};
    if ((partial.standard || partial.casual) && (!validEnglish(partial.standard) || !validEnglish(partial.casual))) {
      if (typeof console !== "undefined" && console.warn) console.warn("Blocked English:", partial.standard, "|", partial.casual);
      return koreanOnly(mem, "그 문장은 아직 안전하게 못 바꾸겠어요. 더 짧은 문장으로 다시 말해 주세요.");
    }
    var taught = patch.taught ? patch.taught.slice() : mem.taught.slice();
    var last = Object.prototype.hasOwnProperty.call(patch, "last") ? patch.last : mem.last;
    return {
      leadKo: partial.leadKo,
      bridgeKo: partial.bridgeKo || null,
      standard: partial.standard || null,
      casual: partial.casual || null,
      glossStandard: partial.glossStandard || null,
      glossCasual: partial.glossCasual || null,
      situation: partial.situation || null,
      sourceKo: partial.sourceKo || null,
      teachId: partial.teachId || null,
      next: {
        rate: patch.rate != null ? patch.rate : mem.rate,
        taught: taught,
        last: last,
        name: patch.name != null ? patch.name : mem.name,
        turnCount: mem.turnCount + 1
      }
    };
  }

  function koreanOnly(mem, lead) {
    return finish({
      leadKo: lead,
      bridgeKo: null,
      standard: null,
      casual: null,
      glossStandard: null,
      glossCasual: null
    }, mem, { last: mem.last });
  }

  function lessonLast(partial) {
    return {
      teachId: partial.teachId || null,
      situation: partial.situation || null,
      sourceKo: partial.sourceKo || null,
      standard: partial.standard,
      casual: partial.casual,
      glossStandard: partial.glossStandard,
      glossCasual: partial.glossCasual,
      bridgeKo: partial.bridgeKo || BRIDGE,
      leadKo: partial.leadKo
    };
  }

  function acceptLesson(partial, mem, patch) {
    var taught = mem.taught.slice();
    if (partial.teachId && taught.indexOf(partial.teachId) === -1) taught.push(partial.teachId);
    patch = Object.assign({ taught: taught, last: lessonLast(partial) }, patch || {});
    return finish(partial, mem, patch);
  }

  function leadFor(phrase, mem, askedHow) {
    if (askedHow) return "이렇게 말하면 돼요.";
    if (typeof phrase.chat === "function") return phrase.chat(mem);
    if (phrase.chat) return phrase.chat;
    if (mem.last && mem.last.situation && mem.last.situation === phrase.situation && mem.last.teachId !== phrase.id) {
      return "아까랑 같은 상황이에요. 이렇게 말해 보세요.";
    }
    return LEADS[mem.turnCount % LEADS.length];
  }

  function patternLead(mem, askedHow, situation) {
    if (askedHow) return "이렇게 말하면 돼요.";
    if (mem.last && situation && mem.last.situation === situation) return "아까랑 같은 상황이에요. 이렇게 말해 보세요.";
    return LEADS[mem.turnCount % LEADS.length];
  }

  function matchPhrase(text) {
    if (!text) return null;
    return PHRASE_BY_KEY[text] || null;
  }

  function addWhen(sentence, when) {
    if (!sentence || /[?]/.test(sentence)) return null;
    if (sentence.toLowerCase().indexOf(when) !== -1) return sentence;
    if (!/[.]$/.test(sentence)) return null;
    if (sentence.split(/\s+/).length < 2) return null;
    var next = sentence.replace(/\.$/, " " + when + ".");
    return validEnglish(next) ? next : null;
  }

  function matchTimed(core) {
    var prefs = [["나중에", "later"], ["오늘", "today"], ["내일", "tomorrow"], ["지금", "now"]];
    for (var i = 0; i < prefs.length; i++) {
      if (core.indexOf(prefs[i][0]) === 0 && core.length > prefs[i][0].length) {
        var phrase = matchPhrase(core.slice(prefs[i][0].length));
        if (!phrase || phrase.situation === "greetings" || phrase.noWhen) continue;
        var standard = addWhen(phrase.standard, prefs[i][1]);
        var casual = addWhen(phrase.casual, prefs[i][1]);
        if (!standard || !casual) continue;
        return Object.assign({}, phrase, { standard: standard, casual: casual });
      }
    }
    return null;
  }

  function fromPhrase(phrase, mem, askedHow, leadOverride) {
    return acceptLesson({
      leadKo: leadOverride || leadFor(phrase, mem, askedHow),
      bridgeKo: BRIDGE,
      standard: phrase.standard,
      casual: phrase.casual,
      glossStandard: phrase.glossStandard,
      glossCasual: phrase.glossCasual,
      situation: phrase.situation,
      sourceKo: phrase.ko,
      teachId: phrase.id
    }, mem, {});
  }

  function repeatLast(mem, lead, rate) {
    var last = mem.last;
    return finish({
      leadKo: lead,
      bridgeKo: last.bridgeKo || BRIDGE,
      standard: last.standard,
      casual: last.casual,
      glossStandard: last.glossStandard,
      glossCasual: last.glossCasual,
      situation: last.situation,
      sourceKo: last.sourceKo,
      teachId: last.teachId
    }, mem, { rate: rate, last: mem.last });
  }

  function nothingYet(mem) {
    return koreanOnly(mem, "아직 같이 말한 문장이 없어요. 한국어 문장을 먼저 말해 주세요.");
  }

  function tryControl(core, mem) {
    if (REPEAT_KEYS[core]) {
      if (mem.last && mem.last.standard) return repeatLast(mem, "네, 다시 말할게요.", mem.rate);
      if (PHRASE_BY_KEY[core]) return null;
      return nothingYet(mem);
    }
    if (SLOW_KEYS[core]) {
      if (mem.last && mem.last.standard) return repeatLast(mem, "이번엔 천천히 말할게요.", 0.78);
      if (PHRASE_BY_KEY[core]) return null;
      return nothingYet(mem);
    }
    if (NORMAL_KEYS[core]) {
      if (mem.last && mem.last.standard) return repeatLast(mem, "다시 보통 속도로 말할게요.", 1);
      return koreanOnly(mem, "말 속도는 보통으로 해 둘게요.");
    }
    if (EXPLAIN_KEYS[core]) {
      if (mem.last && mem.last.standard) return repeatLast(mem, "괜찮아요. 뜻만 짧게 다시 말하면 이거예요. 영어는 그대로 따라 해 보세요.", mem.rate);
      if (PHRASE_BY_KEY[core]) return null;
      return nothingYet(mem);
    }
    if (ANOTHER_KEYS[core]) return another(mem);
    if (YES_KEYS[core]) {
      if (mem.last && mem.last.standard) return repeatLast(mem, "좋아요. 이제 그 문장을 한 번 따라 해 보세요.", mem.rate);
      if (PHRASE_BY_KEY[core]) return null;
      return koreanOnly(mem, "네. 한국어 문장을 말해 주면 영어로 같이 말해요.");
    }
    return null;
  }

  function another(mem) {
    if (!mem.last || !mem.last.standard) return nothingYet(mem);
    var phrase = mem.last.teachId ? PHRASE_BY_ID[mem.last.teachId] : null;
    var related = phrase && phrase.related ? phrase.related : [];
    for (var i = 0; i < related.length; i++) {
      var next = PHRASE_BY_ID[related[i]];
      if (next && mem.taught.indexOf(next.id) === -1) {
        return fromPhrase(next, mem, false, "같은 상황이라면 이것도 써 보세요. 「" + next.ko + "」");
      }
    }
    return repeatLast(mem, "이 문장은 이 두 말이 가장 자연스러워요.", mem.rate);
  }

  function stripSpeaker(text) {
    return text.replace(/^(제가|내가|저는|나는|저도|나도)/, "");
  }

  function isMostlyEnglish(raw) {
    var text = String(raw || "").trim();
    if (!text || /[가-힣]/.test(text)) return false;
    return /[A-Za-z]/.test(text);
  }

  var HOUR_WORD = {
    "한": 1, "하나": 1, "1": 1,
    "두": 2, "둘": 2, "2": 2,
    "세": 3, "셋": 3, "3": 3,
    "네": 4, "넷": 4, "4": 4,
    "다섯": 5, "5": 5,
    "여섯": 6, "6": 6,
    "일곱": 7, "7": 7,
    "여덟": 8, "8": 8,
    "아홉": 9, "9": 9,
    "열": 10, "10": 10,
    "열한": 11, "11": 11,
    "열두": 12, "12": 12
  };
  var ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
  var TENS = ["", "", "twenty", "thirty", "forty", "fifty"];
  var HOUR_NAMES = [null, "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];

  function minuteWord(n) {
    if (n < 20) return ONES[n];
    var ten = Math.floor(n / 10);
    var one = n % 10;
    return one ? TENS[ten] + "-" + ONES[one] : TENS[ten];
  }

  function parseNumberToken(token) {
    if (!token) return null;
    if (/^\d+$/.test(token)) {
      var num = Number(token);
      return num >= 0 && num <= 59 ? num : null;
    }
    var native = { "하나": 1, "한": 1, "둘": 2, "두": 2, "셋": 3, "세": 3, "넷": 4, "네": 4, "다섯": 5, "여섯": 6, "일곱": 7, "여덟": 8, "아홉": 9, "열": 10 };
    if (Object.prototype.hasOwnProperty.call(native, token)) return native[token];
    var digit = { "영": 0, "공": 0, "일": 1, "이": 2, "삼": 3, "사": 4, "오": 5, "육": 6, "칠": 7, "팔": 8, "구": 9 };
    if (token === "십") return 10;
    var matched = token.match(/^(영|공|일|이|삼|사|오|육|칠|팔|구)?십(영|공|일|이|삼|사|오|육|칠|팔|구)?$/);
    if (matched) {
      if (matched[1] === "영" || matched[1] === "공") return null;
      var tens = matched[1] ? digit[matched[1]] : 1;
      var ones = matched[2] ? digit[matched[2]] : 0;
      return tens * 10 + ones;
    }
    if (Object.prototype.hasOwnProperty.call(digit, token)) return digit[token];
    return null;
  }

  function parseTime(text) {
    if (/얼마|어디|싶어요|주세요|타요|먹어요|마셔요/.test(text)) return null;
    var rest = text;
    if (rest.indexOf("지금") === 0) rest = rest.slice(2);
    var ampm = null;
    if (rest.indexOf("오전") === 0) { ampm = "am"; rest = rest.slice(2); }
    else if (rest.indexOf("오후") === 0) { ampm = "pm"; rest = rest.slice(2); }
    var matched = rest.match(/^(열한|열두|다섯|여섯|일곱|여덟|아홉|하나|둘|셋|넷|열|한|두|세|네|\d{1,2})시(.*)$/);
    if (!matched || !Object.prototype.hasOwnProperty.call(HOUR_WORD, matched[1])) return null;
    var hour = HOUR_WORD[matched[1]];
    if (hour < 1 || hour > 12) return null;
    var tail = matched[2].replace(/(예요|이에요|야)$/, "");
    var minute = 0;
    if (tail === "" || tail === "정각") minute = 0;
    else if (tail === "반") minute = 30;
    else if (tail.endsWith("분")) {
      minute = parseNumberToken(tail.slice(0, -1));
      if (minute == null) return null;
    } else return null;
    if (minute < 0 || minute > 59) return null;
    var standard;
    var casual;
    if (minute === 0 && !ampm) {
      standard = "It's " + HOUR_NAMES[hour] + " o'clock.";
      casual = "It's " + HOUR_NAMES[hour] + ".";
    } else if (minute === 0 && ampm === "am" && hour === 12) {
      standard = "It's 12 a.m.";
      casual = "It's midnight.";
    } else if (minute === 0 && ampm === "pm" && hour === 12) {
      standard = "It's 12 p.m.";
      casual = "It's noon.";
    } else if (minute === 0 && ampm) {
      standard = "It's " + hour + (ampm === "am" ? " a.m." : " p.m.");
      casual = "It's " + HOUR_NAMES[hour] + (ampm === "am" ? " in the morning." : (hour < 6 ? " in the afternoon." : " in the evening."));
    } else if (!ampm) {
      standard = "It's " + hour + ":" + String(minute).padStart(2, "0") + ".";
      casual = minute < 10 ? "It's " + HOUR_NAMES[hour] + " oh " + ONES[minute] + "." : "It's " + HOUR_NAMES[hour] + " " + minuteWord(minute) + ".";
    } else {
      standard = "It's " + hour + ":" + String(minute).padStart(2, "0") + (ampm === "am" ? " a.m." : " p.m.");
      casual = minute < 10 ? "It's " + HOUR_NAMES[hour] + " oh " + ONES[minute] + "." : "It's " + HOUR_NAMES[hour] + " " + minuteWord(minute) + ".";
    }
    var gloss = (ampm === "am" ? "오전 " : ampm === "pm" ? "오후 " : "") + hour + "시" + (minute ? " " + minute + "분이에요." : "예요.");
    return {
      situation: "time",
      standard: standard,
      casual: casual,
      glossStandard: gloss,
      glossCasual: minute === 0 && !ampm ? "정각을 짧게 말해요." : "짧게 말한 시각이에요."
    };
  }

  function splitPlaceNoun(body) {
    var at = body.lastIndexOf("에");
    if (at > 0) {
      var placeToken = body.slice(0, at);
      var nounToken = body.slice(at + 1);
      if (body.charAt(at + 1) === "서") nounToken = body.slice(at + 2);
      var placeInfo = classifyToken(placeToken);
      var nounInfo = classifyToken(nounToken);
      if (placeInfo && placeInfo.ambiguous) return placeInfo;
      if (nounInfo && nounInfo.ambiguous) return nounInfo;
      if (placeInfo && placeInfo.noun && nounInfo && nounInfo.noun) {
        if (!placeInfo.noun.placePhrase) return null;
        return { place: placeInfo.noun, noun: nounInfo.noun, pluralMarked: !!nounInfo.pluralMarked };
      }
    }
    var info = classifyToken(body);
    if (!info) return null;
    if (info.ambiguous) return info;
    return { place: null, noun: info.noun, pluralMarked: !!info.pluralMarked };
  }

  function existGloss(noun, place, kind) {
    var where = place ? place.ko + "에 " : "";
    var code = noun.ko.charCodeAt(noun.ko.length - 1);
    var particle = (code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 === 0) ? "가" : "이";
    if (kind === "many") return where + noun.ko + particle + " 많아요.";
    if (kind === "none") return where + noun.ko + particle + " 없어요.";
    if (kind === "pass") return where + noun.ko + particle + " 다녀요.";
    return where + noun.ko + particle + " 있어요.";
  }

  function parseExistence(text) {
    var tails = [
      ["많이다녀요", { many: true, pass: true }],
      ["많이있어요", { many: true }],
      ["많이없어요", { many: true, neg: true }],
      ["다녀요", { pass: true }],
      ["없어요", { neg: true }],
      ["있어요", {}],
      ["많아요", { many: true }]
    ];
    var flags = null;
    var body = "";
    for (var i = 0; i < tails.length; i++) {
      if (text.endsWith(tails[i][0]) && text.length > tails[i][0].length) {
        flags = tails[i][1];
        body = text.slice(0, -tails[i][0].length);
        break;
      }
    }
    if (!flags) return null;
    var parts = splitPlaceNoun(body);
    if (!parts) return null;
    if (parts.ambiguous) return { clarify: clarifyText(parts.ambiguous) };
    var item = parts.noun;
    var place = parts.place;
    if (flags.pass && item.kind !== "person" && item.kind !== "vehicle") return null;
    var loc = place ? " " + place.placePhrase : "";
    var plural = pluralOf(item);
    var standard = "";
    var casual = "";
    var g1 = "";
    var g2 = "";
    if (flags.pass && flags.many && item.ko === "사람" && place && place.packed) {
      standard = "There are a lot of people " + place.placePhrase + ".";
      casual = place.packed;
      g1 = place.ko + "에 사람이 많아요.";
      g2 = place.packedGloss;
    } else if (flags.pass && flags.many) {
      var crowd = item.ko === "사람" ? "people" : plural;
      standard = "There are a lot of " + crowd + loc + ".";
      casual = "There are tons of " + crowd + loc + ".";
      g1 = existGloss(item, place, "many");
      g2 = "정말 많다는 말이에요.";
    } else if (flags.pass) {
      var who = item.ko === "사람" ? "People" : cap(plural);
      standard = who + " come and go" + loc + ".";
      casual = who + " keep coming and going" + loc + ".";
      g1 = existGloss(item, place, "pass");
      g2 = "계속 지나다닌다는 말이에요.";
    } else if (flags.neg && flags.many) {
      if (item.count === "mass") {
        standard = "There isn't much " + item.en + loc + ".";
        casual = "There isn't a lot of " + item.en + loc + ".";
      } else {
        standard = "There aren't many " + plural + loc + ".";
        casual = "There aren't a lot of " + plural + loc + ".";
      }
      g1 = existGloss(item, place, "none");
      g2 = "많지는 않다는 말이에요.";
    } else if (flags.neg) {
      if (item.ko === "사람") {
        standard = "There aren't any people" + loc + ".";
        casual = "There's nobody" + loc + ".";
      } else if (item.count === "plural") {
        standard = "There aren't any " + item.en + loc + ".";
        casual = "There are no " + item.en + loc + ".";
      } else if (item.count === "mass") {
        standard = "There isn't any " + item.en + loc + ".";
        casual = "There's no " + item.en + loc + ".";
      } else {
        standard = "There isn't " + indefinite(item.en) + loc + ".";
        casual = "There's no " + item.en + loc + ".";
      }
      g1 = existGloss(item, place, "none");
      g2 = "없다는 말이에요.";
    } else if (flags.many || parts.pluralMarked && flags.many) {
      if (item.count === "mass") {
        standard = "There is a lot of " + item.en + loc + ".";
        casual = "There's a ton of " + item.en + loc + ".";
        g2 = "정말 많다는 말이에요.";
      } else if (item.ko === "사람" && place && place.packed) {
        standard = "There are a lot of people " + place.placePhrase + ".";
        casual = place.packed;
        g2 = place.packedGloss;
      } else {
        standard = "There are a lot of " + plural + loc + ".";
        casual = "There are tons of " + plural + loc + ".";
        g2 = "정말 많다는 말이에요.";
      }
      g1 = existGloss(item, place, "many");
    } else if (parts.pluralMarked) {
      standard = "There are " + plural + loc + ".";
      casual = "There are some " + plural + loc + ".";
      g1 = existGloss(item, place, "exist");
      g2 = "여럿이 있다는 말이에요.";
    } else if (item.count === "plural") {
      standard = "There are " + item.en + loc + ".";
      casual = "There are some " + item.en + loc + ".";
      g1 = existGloss(item, place, "exist");
      g2 = "있다는 편한 말이에요.";
    } else if (item.count === "mass") {
      standard = "There is " + item.en + loc + ".";
      casual = "There's " + item.en + loc + ".";
      g1 = existGloss(item, place, "exist");
      g2 = "There's는 There is를 줄인 말이에요.";
    } else if (item.ko === "사람") {
      standard = "There is a person" + loc + ".";
      casual = "There's someone" + loc + ".";
      g1 = existGloss(item, place, "exist");
      g2 = "누군가 있다는 말이에요.";
    } else {
      standard = "There is " + indefinite(item.en) + loc + ".";
      casual = "There's " + indefinite(item.en) + loc + ".";
      g1 = existGloss(item, place, "exist");
      g2 = "There's는 There is를 줄인 말이에요.";
    }
    var situation = "daily";
    if (place && (place.ko === "거리" || place.ko === "길" || place.ko === "공원")) situation = "street";
    else if (item.kind === "food" || item.kind === "drink") situation = "food";
    else if (item.kind === "vehicle") situation = "transport";
    return { situation: situation, standard: standard, casual: casual, glossStandard: g1, glossCasual: g2 };
  }

  function takeWhen(text) {
    var prefs = [["나중에", " later"], ["오늘", " today"], ["내일", " tomorrow"], ["지금", " now"]];
    for (var i = 0; i < prefs.length; i++) {
      if (text.indexOf(prefs[i][0]) === 0 && text.length > prefs[i][0].length) {
        return { rest: text.slice(prefs[i][0].length), en: prefs[i][1] };
      }
    }
    return { rest: text, en: "" };
  }

  function wantObject(item, verb, poss) {
    if (verb === "go") {
      if (item.kind !== "place" || !item.toPhrase) return null;
      return "go " + item.toPhrase;
    }
    if (verb === "eat") {
      if (item.ko === "밥") return "eat";
      if (item.kind !== "food") return null;
      if (poss) return "eat my " + item.en;
      if (item.count === "mass" || item.count === "plural") return "eat " + item.en;
      return "eat " + indefinite(item.en);
    }
    if (verb === "drink") {
      if (item.kind !== "drink") return null;
      return "drink " + (item.drinkObject || item.en);
    }
    if (verb === "buy") {
      if (item.ko === "돈" || item.kind === "person" || item.kind === "place") return null;
      if (item.count === "plural" || item.count === "mass") return "buy " + (item.count === "mass" ? "some " + item.en : item.en);
      return "buy " + indefinite(item.en);
    }
    if (verb === "read" || (verb === "see" && item.seeAs === "read")) {
      if (item.ko !== "책" && item.ko !== "신문") return null;
      return "read " + (item.seeObject || indefinite(item.en));
    }
    if (verb === "see" && item.seeAs === "watch") return "watch " + (item.seeObject || indefinite(item.en));
    if (verb === "see") {
      if (item.kind === "place") return null;
      if (poss && item.ko !== "사람") return "see " + poss + " " + item.en;
      if (item.ko === "사람" && poss) return null;
      if (item.count === "mass" || item.count === "plural") return "see " + item.en;
      return "see " + indefinite(item.en);
    }
    if (verb === "ride") {
      if (item.ko === "자전거" || item.en === "bicycle") return "ride a bicycle";
      if (item.ko === "버스") return "take the bus";
      if (item.ko === "지하철") return "take the subway";
      if (item.ko === "택시") return "take a taxi";
      if (item.ko === "기차") return "take the train";
      if (item.ko === "비행기") return "take a plane";
      if (item.ko === "자동차" || item.ko === "차") return "take a car";
      return null;
    }
    if (verb === "do") {
      if (!item.doObject) return null;
      return "do " + item.doObject;
    }
    return null;
  }

  function wantGloss(ko, verb, neg) {
    var table = {
      eat: "먹고 싶어요.",
      drink: "마시고 싶어요.",
      see: "보고 싶어요.",
      buy: "사고 싶어요.",
      ride: "타고 싶어요.",
      read: "읽고 싶어요.",
      do: "하고 싶어요."
    };
    if (verb === "go") return ko + (neg ? "에 안 가고 싶어요." : "에 가고 싶어요.");
    if (neg) return ko + " 안 " + table[verb];
    return ko + " " + table[verb];
  }

  function parseWant(text) {
    var timed = takeWhen(text);
    var rest = timed.rest.replace(/^우리집/, "집").replace(/^내집/, "집").replace(/^제집/, "집");
    var tails = [
      ["먹고싶어요", "eat"],
      ["마시고싶어요", "drink"],
      ["가고싶어요", "go"],
      ["보고싶어요", "see"],
      ["사고싶어요", "buy"],
      ["타고싶어요", "ride"],
      ["읽고싶어요", "read"],
      ["하고싶어요", "do"]
    ];
    var verb = "";
    var body = "";
    var neg = false;
    for (var i = 0; i < tails.length; i++) {
      var negTail = "안" + tails[i][0];
      if (rest.endsWith(negTail) && rest.length > negTail.length) {
        neg = true;
        verb = tails[i][1];
        body = rest.slice(0, -negTail.length);
        break;
      }
      if (rest.endsWith(tails[i][0]) && rest.length > tails[i][0].length) {
        verb = tails[i][1];
        body = rest.slice(0, -tails[i][0].length);
        break;
      }
    }
    if (!verb) return null;
    body = body.replace(/좀/g, "");
    var poss = null;
    if (body.indexOf("우리") === 0) { poss = "our"; body = body.slice(2); }
    else if (body.indexOf("내") === 0 || body.indexOf("제") === 0) { poss = "my"; body = body.slice(1); }
    var resolved = resolveNoun(body, verb);
    if (!resolved || resolved.ambiguous) return resolved && resolved.ambiguous ? { clarify: clarifyText(resolved.ambiguous) } : null;
    if (!resolved.noun) return null;
    var action = wantObject(resolved.noun, verb, poss);
    if (!action) return null;
    if (verb === "ride" && resolved.noun.ko === "자전거") {
      var bikeStd = (neg ? "I don't want to ride a bicycle" : "I want to ride a bicycle") + timed.en + ".";
      var bikeCas = (neg ? "I don't wanna ride a bike" : "I wanna ride a bike") + timed.en + ".";
      return {
        situation: "transport",
        standard: bikeStd,
        casual: bikeCas,
        glossStandard: "자전거를 타고 싶어요.",
        glossCasual: "want to를 wanna로, bicycle을 bike로 줄여요."
      };
    }
    var standard = (neg ? "I don't want to " : "I want to ") + action + timed.en + ".";
    var casual = (neg ? "I don't wanna " : "I wanna ") + action + timed.en + ".";
    if (verb === "ride" && resolved.noun.ko === "자전거") {
      casual = casual.replace("a bicycle", "a bike");
    }
    var situation = "daily";
    if (verb === "go") situation = "street";
    else if (verb === "ride") situation = "transport";
    else if (verb === "eat" || verb === "drink") situation = "food";
    else if (verb === "buy") situation = "shopping";
    return {
      situation: situation,
      standard: standard,
      casual: casual,
      glossStandard: wantGloss(resolved.noun.ko, verb, neg),
      glossCasual: neg ? "하기 싫다는 말이에요. wanna는 want to예요." : "want to를 wanna로 줄여요."
    };
  }

  function rideLines(ko, future) {
    var table = {
      "버스": future ? ["I'll take the bus.", "I'll grab the bus."] : ["I'm taking the bus.", "I'll grab the bus."],
      "지하철": future ? ["I'll take the subway.", "I'll grab the subway."] : ["I'm taking the subway.", "I'll grab the subway."],
      "택시": future ? ["I'll take a taxi.", "I'll grab a cab."] : ["I'm taking a taxi.", "I'll grab a cab."],
      "기차": future ? ["I'll take the train.", "I'll grab the train."] : ["I'm taking the train.", "I'll grab the train."],
      "비행기": future ? ["I'll take a plane.", "I'm gonna take a plane."] : ["I'm taking a plane.", "I'm catching a plane."],
      "자전거": future ? ["I'll ride a bicycle.", "I'll ride a bike."] : ["I'm riding a bicycle.", "I'm riding a bike."],
      "자동차": future ? ["I'll go by car.", "I'm gonna go by car."] : ["I'm going by car.", "I'll go by car."],
      "차": future ? ["I'll go by car.", "I'm gonna go by car."] : ["I'm going by car.", "I'll go by car."]
    };
    return table[ko] || null;
  }

  function parseRide(text) {
    var timed = takeWhen(text);
    var rest = timed.rest;
    var tails = [["탈거예요", true], ["탈게요", true], ["탑니다", false], ["타요", false]];
    var future = false;
    var body = "";
    var found = false;
    for (var i = 0; i < tails.length; i++) {
      if (rest.endsWith(tails[i][0]) && rest.length > tails[i][0].length) {
        future = tails[i][1];
        body = rest.slice(0, -tails[i][0].length);
        found = true;
        break;
      }
    }
    if (!found) return null;
    body = body.replace(/(을|를)$/, "");
    var resolved = resolveNoun(body, "ride");
    if (!resolved || !resolved.noun && !resolved.ambiguous) return null;
    if (resolved.ambiguous) return { clarify: clarifyText(resolved.ambiguous) };
    var lines = rideLines(resolved.noun.ko, future);
    if (!lines) return null;
    var standard = lines[0].replace(/\.$/, timed.en + ".");
    var casual = lines[1].replace(/\.$/, timed.en + ".");
    var glossCasual = resolved.noun.ko === "택시" ? "cab은 taxi의 편한 말이에요." : (resolved.noun.ko === "자전거" ? "bike는 bicycle의 편한 말이에요." : "탄다는 편한 말이에요.");
    return {
      situation: "transport",
      standard: standard,
      casual: casual,
      glossStandard: resolved.noun.ko + "를 타요.",
      glossCasual: glossCasual
    };
  }

  function parseConsume(text) {
    var tails = [["먹고있어요", "eat"], ["마시고있어요", "drink"], ["먹어요", "eat"], ["마셔요", "drink"]];
    var verb = "";
    var body = "";
    for (var i = 0; i < tails.length; i++) {
      if (text.endsWith(tails[i][0]) && text.length > tails[i][0].length) {
        verb = tails[i][1];
        body = text.slice(0, -tails[i][0].length);
        break;
      }
    }
    if (!verb) return null;
    body = body.replace(/(을|를|좀)$/g, "");
    var resolved = resolveNoun(body, verb);
    if (!resolved || resolved.ambiguous) return resolved && resolved.ambiguous ? { clarify: clarifyText(resolved.ambiguous) } : null;
    var item = resolved.noun;
    if (!item) return null;
    if (verb === "eat" && item.ko === "밥") {
      return { situation: "food", standard: "I'm eating.", casual: "I'm having a meal.", glossStandard: "밥을 먹고 있어요.", glossCasual: "식사 중이라는 말이에요." };
    }
    if (verb === "eat") {
      if (item.kind !== "food") return null;
      var food = item.count === "mass" || item.count === "plural" ? item.en : indefinite(item.en);
      return { situation: "food", standard: "I'm eating " + food + ".", casual: "I'm having " + food + ".", glossStandard: item.ko + "를 먹고 있어요.", glossCasual: "먹는 중이라는 편한 말이에요." };
    }
    if (item.kind !== "drink") return null;
    return { situation: "food", standard: "I'm drinking " + item.en + ".", casual: "I'm having some " + item.en + ".", glossStandard: item.ko + "를 마시고 있어요.", glossCasual: "마시는 중이라는 말이에요." };
  }

  function parseGo(text) {
    var timed = takeWhen(text);
    var rest = timed.rest.replace(/^우리집/, "집").replace(/^내집/, "집").replace(/^제집/, "집");
    var tails = [["갈거예요", "future"], ["갈게요", "future"], ["안가요", "neg"], ["가요", "present"]];
    var kind = "";
    var body = "";
    for (var i = 0; i < tails.length; i++) {
      if (rest.endsWith(tails[i][0]) && rest.length > tails[i][0].length) {
        kind = tails[i][1];
        body = rest.slice(0, -tails[i][0].length);
        break;
      }
    }
    if (!kind) return null;
    var info = classifyToken(body);
    if (!info || !info.noun || info.noun.kind !== "place" || !info.noun.toPhrase) return null;
    var to = info.noun.toPhrase;
    var standard = "";
    var casual = "";
    var g2 = "";
    if (kind === "present") {
      standard = "I'm going " + to + timed.en + ".";
      casual = "I'm heading " + to + timed.en + ".";
      g2 = "heading은 간다는 편한 말이에요.";
    } else if (kind === "future") {
      standard = "I'll go " + to + timed.en + ".";
      casual = "I'm gonna go " + to + timed.en + ".";
      g2 = "going to를 gonna로 줄여요.";
    } else {
      standard = "I'm not going " + to + timed.en + ".";
      casual = "I'm not heading " + to + timed.en + ".";
      g2 = "안 간다는 말이에요.";
    }
    return { situation: "street", standard: standard, casual: casual, glossStandard: info.noun.ko + (kind === "neg" ? "에 안 가요." : "에 가는 말이에요."), glossCasual: g2 };
  }

  var ADJECTIVES = [
    { tail: "너무비싸요", line: "too expensive", casual: "way too expensive", shop: true },
    { tail: "너무커요", line: "too big", casual: "way too big" },
    { tail: "너무작아요", line: "too small", casual: "way too small" },
    { tail: "안비싸요", missing: "expensive" },
    { tail: "맛있어요", line: "delicious", casual: "so good", food: true },
    { tail: "맛없어요", line: "not very good", casual: "not good", food: true },
    { tail: "매워요", line: "spicy", casual: "really spicy", food: true },
    { tail: "맵아요", line: "spicy", casual: "really spicy", food: true },
    { tail: "달아요", line: "sweet", casual: "really sweet", food: true },
    { tail: "비싸요", line: "expensive", casual: "pretty expensive", shop: true },
    { tail: "싸요", line: "cheap", casual: "pretty cheap", shop: true },
    { tail: "커요", line: "big", casual: "huge" },
    { tail: "작아요", line: "small", casual: "tiny" },
    { tail: "예뻐요", line: "pretty", casual: "really pretty" },
    { tail: "멋있어요", line: "cool", casual: "really cool" },
    { tail: "시끄러워요", line: "loud", casual: "so loud" },
    { tail: "조용해요", line: "quiet", casual: "really quiet" },
    { tail: "깨끗해요", line: "clean", casual: "really clean" },
    { tail: "더러워요", line: "dirty", casual: "really dirty" },
    { tail: "따뜻해요", line: "warm", casual: "nice and warm" },
    { tail: "뜨거워요", line: "hot", casual: "really hot" },
    { tail: "차가워요", line: "cold", casual: "ice cold" },
    { tail: "가까워요", line: "close", casual: "super close" },
    { tail: "멀어요", line: "far", casual: "pretty far" },
    { tail: "좋아요", line: "good", casual: "really good" },
    { tail: "나빠요", line: "bad", casual: "not very good" }
  ];

  function adjSubject(item) {
    if (item.kind === "food" || item.kind === "drink") return "This " + item.en;
    if (item.definite) return cap(item.definite);
    return "The " + item.en;
  }

  function parseAdjective(text) {
    for (var i = 0; i < ADJECTIVES.length; i++) {
      var adj = ADJECTIVES[i];
      if (text.endsWith(adj.tail) && text.length > adj.tail.length) {
        var info = classifyToken(text.slice(0, -adj.tail.length).replace(/(정말|진짜|아주|너무|완전)$/, ""));
        if (!info || !info.noun) continue;
        if (adj.food && info.noun.kind !== "food" && info.noun.kind !== "drink") return null;
        var subject = adjSubject(info.noun);
        var standard = adj.missing ? subject + " isn't " + adj.missing + "." : subject + " is " + adj.line + ".";
        var casual = adj.missing ? subject + " isn't that " + adj.missing + "." : subject + " is " + adj.casual + ".";
        var situation = adj.shop ? "shopping" : (info.noun.kind === "food" || info.noun.kind === "drink" ? "food" : "daily");
        return {
          situation: situation,
          standard: standard,
          casual: casual,
          glossStandard: info.noun.ko + " 상태를 말해요.",
          glossCasual: "좀 더 세게 말한 거예요."
        };
      }
    }
    return null;
  }

  function likeSurface(item, poss) {
    if (poss && item.ko === "사람") return null;
    if (poss) return poss + " " + (item.count === "plural" ? pluralOf(item) : item.en);
    if (item.likeBare) return item.likeBare;
    if (item.count === "mass" || item.count === "plural") return item.en;
    if (item.kind === "place") return item.definite;
    return pluralOf(item);
  }

  function parseLike(text) {
    var tails = [["안좋아해요", true], ["싫어해요", true], ["싫어요", true], ["좋아해요", false]];
    var neg = false;
    var body = "";
    var found = false;
    for (var i = 0; i < tails.length; i++) {
      if (text.endsWith(tails[i][0]) && text.length > tails[i][0].length) {
        neg = tails[i][1];
        body = text.slice(0, -tails[i][0].length);
        found = true;
        break;
      }
    }
    if (!found) return null;
    var poss = null;
    if (body.indexOf("우리") === 0) { poss = "our"; body = body.slice(2); }
    else if (body.indexOf("내") === 0 || body.indexOf("제") === 0) { poss = "my"; body = body.slice(1); }
    var info = classifyToken(body);
    if (!info || !info.noun) return null;
    var bare = likeSurface(info.noun, poss);
    if (!bare) return null;
    var standard = (neg ? "I don't like " : "I like ") + bare + ".";
    var casual;
    if (neg && (info.noun.kind === "food" || info.noun.kind === "drink")) casual = "I'm not into " + (info.noun.into || bare) + ".";
    else if (!neg && (info.noun.kind === "food" || info.noun.kind === "drink" || info.noun.ko === "음악" || info.noun.ko === "영화")) casual = "I'm into " + (info.noun.into || bare) + ".";
    else casual = (neg ? "I don't really like " : "I really like ") + bare + ".";
    return {
      situation: info.noun.kind === "food" || info.noun.kind === "drink" ? "food" : "daily",
      standard: standard,
      casual: casual,
      glossStandard: info.noun.ko + (neg ? " 안 좋아해요." : " 좋아해요."),
      glossCasual: neg ? "안 좋아한다는 말이에요." : "좋아한다는 편한 말이에요."
    };
  }

  function whereTarget(item, poss) {
    if (poss && item.ko === "사람") return null;
    if (poss) return poss + " " + item.en;
    return item.definite || null;
  }

  function parseWhere(text) {
    if (!/어디예요$/.test(text)) return null;
    var body = text.slice(0, -4);
    if (body === "" ) {
      return { situation: "street", standard: "Where is it?", casual: "Where?", glossStandard: "어디 있는지 물어요.", glossCasual: "짧게 어디냐고 물어요." };
    }
    var demo = body;
    ["이", "가", "은", "는"].forEach(function (particle) {
      if (demo.endsWith(particle)) {
        var stem = demo.slice(0, -particle.length);
        if (stem === "여기" || stem === "거기" || stem === "이거" || stem === "그거" || stem === "저거") demo = stem;
      }
    });
    if (demo === "여기") return { situation: "street", standard: "Where are we?", casual: "Where is this place?", glossStandard: "여기가 어디냐고 물어요.", glossCasual: "이 장소가 어디냐고 물어요." };
    if (demo === "거기") return { situation: "street", standard: "Where is that place?", casual: "Where's that?", glossStandard: "거기가 어디냐고 물어요.", glossCasual: "짧게 물은 거예요." };
    if (demo === "이거" || demo === "이것") return { situation: "daily", standard: "Where is this?", casual: "Where's this?", glossStandard: "이것이 어디냐고 물어요.", glossCasual: "Where is를 Where's로 줄여요." };
    if (demo === "그거" || demo === "그것" || demo === "저거") return { situation: "daily", standard: "Where is that?", casual: "Where's that?", glossStandard: "그것이 어디냐고 물어요.", glossCasual: "Where is를 Where's로 줄여요." };
    var poss = null;
    if (body.indexOf("우리") === 0) { poss = "our"; body = body.slice(2); }
    else if (body.indexOf("내") === 0 || body.indexOf("제") === 0) { poss = "my"; body = body.slice(1); }
    var info = classifyToken(body);
    if (!info || !info.noun) return null;
    var target = whereTarget(info.noun, poss);
    if (!target) return null;
    var situation = "street";
    if (info.noun.kind === "vehicle" || info.noun.ko === "역" || info.noun.ko === "지하철역" || info.noun.ko === "버스정류장" || info.noun.ko === "공항") situation = "transport";
    else if (info.noun.kind !== "place") situation = "daily";
    return {
      situation: situation,
      standard: "Where is " + target + "?",
      casual: "Where's " + target + "?",
      glossStandard: "어디 있는지 묻는 말이에요.",
      glossCasual: "Where is를 Where's로 줄여요."
    };
  }

  function priceTarget(item, demo) {
    if (demo) return demo + " " + item.en;
    return item.definite || ("the " + item.en);
  }

  function parsePrice(text) {
    var body = text.replace(/얼마예요$/, "");
    if (body === text) return null;
    if (body === "" || body === "그것") {
      return { situation: "shopping", standard: "How much is it?", casual: "How much?", glossStandard: "값을 물어요.", glossCasual: "값만 짧게 물어요." };
    }
    if (body === "이거" || body === "이것") {
      return { situation: "shopping", standard: "How much is this?", casual: "How much?", glossStandard: "이것의 값을 물어요.", glossCasual: "값만 짧게 물어요." };
    }
    if (body === "그거" || body === "저거") {
      return { situation: "shopping", standard: "How much is that?", casual: "What's the price of that?", glossStandard: "저것의 값을 물어요.", glossCasual: "값을 묻는 말이에요." };
    }
    var direct = classifyToken(body.replace(/(은|는|이|가)$/, ""));
    if (direct && direct.noun && direct.noun.kind !== "person" && direct.noun.kind !== "place") {
      var target = priceTarget(direct.noun);
      return { situation: "shopping", standard: "How much is " + target + "?", casual: "How much for " + target + "?", glossStandard: "값을 묻는 말이에요.", glossCasual: "값을 짧게 묻는 말이에요." };
    }
    var demo = body.indexOf("이") === 0 ? "this" : (body.indexOf("그") === 0 || body.indexOf("저") === 0 ? "that" : "");
    if (!demo) return null;
    var demoInfo = classifyToken(body.slice(1).replace(/(은|는|이|가)$/, ""));
    if (!demoInfo || !demoInfo.noun || demoInfo.noun.kind === "person" || demoInfo.noun.kind === "place") return null;
    var demoTarget = priceTarget(demoInfo.noun, demo);
    return { situation: "shopping", standard: "How much is " + demoTarget + "?", casual: "How much for " + demoTarget + "?", glossStandard: "값을 묻는 말이에요.", glossCasual: "값을 짧게 묻는 말이에요." };
  }

  function orderNumber(kind) {
    return { "한": 1, "하나": 1, "두": 2, "둘": 2, "세": 3, "한개": 1, "두개": 2 }[kind] || 0;
  }

  function drinkOrder(item, num, counter) {
    var word = ["", "One", "Two", "Three"];
    if (item.ko === "커피") {
      if (counter && counter !== "잔") return null;
      if (num === 1) return ["A coffee, please.", "Can I get a coffee?"];
      return [word[num] + " coffees, please.", "Can I get " + word[num].toLowerCase() + " coffees?"];
    }
    if (item.ko === "맥주") {
      if (counter && counter !== "잔" && counter !== "병") return null;
      if (counter === "병") {
        if (num === 1) return ["A bottle of beer, please.", "Can I get a bottle of beer?"];
        return [word[num] + " bottles of beer, please.", "Can I get " + word[num].toLowerCase() + " bottles of beer?"];
      }
      if (num === 1) return ["A beer, please.", "Can I get a beer?"];
      return [word[num] + " beers, please.", "Can I get " + word[num].toLowerCase() + " beers?"];
    }
    if (item.ko === "콜라") {
      if (num === 1) return ["A cola, please.", "Can I get a cola?"];
      return [word[num] + " colas, please.", "Can I get " + word[num].toLowerCase() + " colas?"];
    }
    if (item.ko === "소주") {
      if (num === 1) return ["Soju, please.", "Can I get a soju?"];
      return [word[num] + " bottles of soju, please.", "Can I get " + word[num].toLowerCase() + " bottles of soju?"];
    }
    if (item.ko === "주스" || item.ko === "녹차") {
      var drink = item.en;
      if (counter === "병") return null;
      if (num === 1) return ["A glass of " + drink + ", please.", "Can I get a " + drink + "?"];
      return [word[num] + " glasses of " + drink + ", please.", "Can I get " + word[num].toLowerCase() + " glasses of " + drink + "?"];
    }
    if (item.ko === "물" || item.ko === "우유") {
      var mass = item.en;
      if (!counter) {
        if (num !== 1) return null;
        return [cap(mass) + ", please.", "Can I get some " + mass + "?"];
      }
      var unit = counter === "병" ? "bottle" : "glass";
      var units = counter === "병" ? "bottles" : "glasses";
      if (num === 1) return ["A " + unit + " of " + mass + ", please.", "Can I get a " + unit + " of " + mass + "?"];
      return [word[num] + " " + units + " of " + mass + ", please.", "Can I get " + word[num].toLowerCase() + " " + units + " of " + mass + "?"];
    }
    if (item.ko === "차") {
      if (num === 1) return ["Tea, please.", "Can I get some tea?"];
      return null;
    }
    return null;
  }

  function genericOrder(item, num) {
    var word = ["", "One", "Two", "Three"];
    if (item.kind === "person" || item.kind === "place" || item.kind === "vehicle") return null;
    if (item.ko === "햄버거") {
      if (num === 1) return ["A hamburger, please.", "Can I get a burger?"];
      return [word[num] + " hamburgers, please.", "Can I get " + word[num].toLowerCase() + " burgers?"];
    }
    if (item.count === "mass") {
      if (num !== 1) return null;
      return ["Some " + item.en + ", please.", "Can I get some " + item.en + "?"];
    }
    if (item.count === "plural") {
      if (num !== 1) return null;
      return [cap(item.en) + ", please.", "Can I get some " + item.en + "?"];
    }
    if (num === 1) return [cap(indefinite(item.en)) + ", please.", "Can I get " + indefinite(item.en) + "?"];
    return [word[num] + " " + pluralOf(item) + ", please.", "Can I get " + word[num].toLowerCase() + " " + pluralOf(item) + "?"];
  }

  function parseOrder(text) {
    if (!text.endsWith("주세요") || text.length <= 3) return null;
    var body = text.slice(0, -3).replace(/좀/g, "");
    if (body === "이거" || body === "이것") {
      return { situation: "shopping", standard: "This one, please.", casual: "I'll take this.", glossStandard: "이걸로 달라는 말이에요.", glossCasual: "이걸로 하겠다고 해요." };
    }
    if (body === "그거" || body === "그것" || body === "저거") {
      return { situation: "shopping", standard: "That one, please.", casual: "I'll take that.", glossStandard: "그걸로 달라는 말이에요.", glossCasual: "그걸로 하겠다고 해요." };
    }
    var num = 1;
    var counter = "";
    var token = body;
    var counted = body.match(/^(.*?)(한|두|세|하나|둘)(잔|개|장|병|권)$/);
    if (counted && counted[1]) {
      token = counted[1];
      num = orderNumber(counted[2]);
      counter = counted[3];
    } else {
      var plain = body.match(/^(.*?)(두개|한개|하나|둘)$/);
      if (plain && plain[1]) {
        token = plain[1];
        num = orderNumber(plain[2]);
      }
    }
    if (!num) return null;
    var resolved = resolveNoun(token, "drink");
    if (!resolved || resolved.ambiguous || !resolved.noun) {
      resolved = resolveNoun(token, "buy");
    }
    if (!resolved || resolved.ambiguous || !resolved.noun) return null;
    var item = resolved.noun;
    if (counter && item.counters && item.counters.indexOf(counter) === -1 && !(item.kind === "drink" && (counter === "잔" || counter === "병"))) return null;
    if (counter && !item.counters && item.kind !== "drink") return null;
    var lines = null;
    if (item.kind === "drink" || item.ko === "차") lines = drinkOrder(item, num, counter);
    else lines = genericOrder(item, num);
    if (!lines) return null;
    return {
      situation: item.kind === "food" || item.kind === "drink" ? "food" : "shopping",
      standard: lines[0],
      casual: lines[1],
      glossStandard: "달라고 하는 말이에요.",
      glossCasual: "가게에서 편하게 부탁하는 말이에요."
    };
  }

  var IDENTITIES = {
    "학생": ["I'm a student.", "Yeah, I'm a student.", "학생이에요.", "맞다는 말을 앞에 붙여요."],
    "선생님": ["I'm a teacher.", "I teach.", "선생님이에요.", "가르친다는 말이에요."],
    "회사원": ["I work in an office.", "I've got an office job.", "회사에서 일해요.", "직장인이라는 말이에요."],
    "의사": ["I'm a doctor.", "Yeah, I'm a doctor.", "의사예요.", "맞다는 짧은 말이에요."],
    "간호사": ["I'm a nurse.", "Yeah, I'm a nurse.", "간호사예요.", "맞다는 짧은 말이에요."],
    "대학생": ["I'm a college student.", "I'm in college.", "대학생이에요.", "대학에 다닌다는 말이에요."]
  };

  var SURNAME = { "김": "Kim", "이": "Lee", "박": "Park", "최": "Choi", "정": "Jeong" };
  var CHO = ["g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s", "ss", "", "j", "jj", "ch", "k", "t", "p", "h"];
  var JUNG = ["a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i"];
  var JONG = ["", "k", "k", "k", "n", "n", "n", "t", "l", "k", "m", "p", "l", "l", "p", "l", "m", "p", "p", "t", "t", "ng", "t", "t", "k", "t", "p", "t"];

  function romanize(hangul) {
    var out = "";
    for (var i = 0; i < hangul.length; i++) {
      var code = hangul.charCodeAt(i);
      if (code < 0xac00 || code > 0xd7a3) return null;
      var syllable = code - 0xac00;
      var jong = syllable % 28;
      var jung = Math.floor(syllable / 28) % 21;
      var cho = Math.floor(syllable / 588);
      out += CHO[cho] + JUNG[jung] + JONG[jong];
    }
    return out || null;
  }

  function romanizeName(hangul) {
    if (SURNAME[hangul]) return SURNAME[hangul];
    if (hangul.length >= 3 && SURNAME[hangul.charAt(0)]) {
      var rest = romanize(hangul.slice(1));
      if (!rest) return null;
      return SURNAME[hangul.charAt(0)] + " " + cap(rest);
    }
    var all = romanize(hangul);
    return all ? cap(all) : null;
  }

  function parseName(text) {
    var matched = text.match(/^(제이름은|내이름은|저는|나는|제가|내가)(.+?)(이에요|예요)$/);
    if (!matched) return null;
    var token = matched[2];
    if (IDENTITIES[token]) {
      return {
        situation: "greetings",
        standard: IDENTITIES[token][0],
        casual: IDENTITIES[token][1],
        glossStandard: IDENTITIES[token][2],
        glossCasual: IDENTITIES[token][3]
      };
    }
    if (NOUNS[token] || token === "차" || token === "눈") return null;
    var nameEn = null;
    if (/^[가-힣]{1,6}$/.test(token)) nameEn = romanizeName(token);
    else if (/^[a-z]{2,20}$/.test(token)) nameEn = cap(token);
    if (!nameEn) return null;
    return {
      situation: "greetings",
      standard: "My name is " + nameEn + ".",
      casual: "I'm " + nameEn + ".",
      glossStandard: "제 이름이에요.",
      glossCasual: "소개할 때 짧게 말해요. 철자는 다를 수 있어요.",
      name: nameEn,
      helloLead: "반가워요. 이름은 이렇게 말해요."
    };
  }

  function wordExample(item) {
    if (item.kind === "place") {
      var where = item.definite;
      return ["Where is " + where + "?", "Where's " + where + "?", "어디 있는지 묻는 예문이에요.", "Where is를 Where's로 줄여요."];
    }
    if (item.count === "plural") return ["These are " + item.en + ".", "They're " + item.en + ".", item.ko + "예요.", "짧게 말한 예문이에요."];
    if (item.count === "mass") return ["This is " + item.en + ".", "It's " + item.en + ".", item.ko + "예요.", "짧게 말한 예문이에요."];
    var one = indefinite(item.en);
    return ["This is " + one + ".", "It's " + one + ".", item.ko + "예요.", "짧게 말한 예문이에요."];
  }

  function tryWord(core, mem, askedHow) {
    var info = classifyToken(core);
    if (!info || !info.noun) return null;
    if (!info.particle && core !== info.noun.ko) return null;
    if (info.particle && core !== info.noun.ko && !core.endsWith(info.particle)) return null;
    var example = wordExample(info.noun);
    var lead = askedHow ? "이렇게 말하면 돼요." : "「" + info.noun.ko + "」" + eun(info.noun.ko) + " 영어로 " + info.noun.en + "이에요. 예문을 따라 해 보세요.";
    return acceptLesson({
      leadKo: lead,
      bridgeKo: BRIDGE,
      standard: example[0],
      casual: example[1],
      glossStandard: example[2],
      glossCasual: example[3],
      situation: info.noun.kind === "place" ? "street" : "daily",
      sourceKo: info.noun.ko,
      teachId: "word-" + info.noun.ko
    }, mem, {});
  }

  function emitParsed(parsed, mem, askedHow) {
    if (!parsed) return null;
    if (parsed.clarify) return koreanOnly(mem, parsed.clarify);
    var lead = askedHow ? "이렇게 말하면 돼요." : (parsed.helloLead || patternLead(mem, askedHow, parsed.situation));
    return acceptLesson({
      leadKo: lead,
      bridgeKo: BRIDGE,
      standard: parsed.standard,
      casual: parsed.casual,
      glossStandard: parsed.glossStandard,
      glossCasual: parsed.glossCasual,
      situation: parsed.situation,
      sourceKo: parsed.sourceKo || null,
      teachId: null
    }, mem, parsed.name ? { name: parsed.name } : {});
  }

  function deliveryResult(standard, casual, g1, g2) {
    if (!validEnglish(standard) || !validEnglish(casual)) return null;
    return { situation: "street", standard: standard, casual: casual, glossStandard: g1, glossCasual: g2 };
  }

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
      .replace(/올라오십시오$/, "올라오세요")
      .replace(/가주세요$/, "가세요")
      .replace(/가줘요$/, "가세요")
      .replace(/가줘$/, "가세요")
      .replace(/가십시오$/, "가세요")
      .replace(/오십시오$/, "오세요")
      .replace(/갈께요$/, "갈게요")
      .replace(/올께요$/, "올게요")
      .replace(/둘께요$/, "둘게요")
      .replace(/놓아둘게요$/, "놔둘게요")
      .replace(/놓아주세요$/, "놔주세요")
      .replace(/놔둬주세요$/, "놔주세요")
      .replace(/둬주세요$/, "두세요")
      .replace(/두고가주세요$/, "두고가세요")
      .replace(/열어줘요$/, "열어주세요")
      .replace(/열어줘$/, "열어주세요")
      .replace(/여세요$/, "열어주세요")
      .replace(/눌러줘요$/, "눌러주세요")
      .replace(/눌러줘$/, "눌러주세요")
      .replace(/누르세요$/, "눌러주세요")
      .replace(/했습니다$/, "했어요")
      .replace(/왔습니다$/, "왔어요");
  }

  var DELIVERY_ACTIONS = {
    "내려오세요": "come-down",
    "내려가세요": "go-down",
    "올라오세요": "come-up",
    "올라가세요": "go-up",
    "오세요": "come",
    "가세요": "go",
    "내려올게요": "will-come-down",
    "내려갈게요": "will-go-down",
    "내려갈거예요": "will-go-down",
    "올라올게요": "will-come-up",
    "올라갈게요": "will-go-up",
    "올라갈거예요": "will-go-up",
    "올게요": "will-come",
    "갈게요": "will-go",
    "갈거예요": "will-go",
    "가요": "going",
    "안가요": "not-going",
    "있어요": "be",
    "없어요": "away",
    "도착했어요": "arrived",
    "왔어요": "arrived",
    "다왔어요": "arrived",
    "둘게요": "will-leave",
    "놔둘게요": "will-leave",
    "두고갈게요": "will-leave",
    "놔주세요": "leave",
    "두세요": "leave",
    "두고가세요": "leave",
    "놔두세요": "leave",
    "열어주세요": "open",
    "열게요": "will-open",
    "고장났어요": "broken",
    "고장이났어요": "broken",
    "고장이에요": "broken",
    "안돼요": "dead",
    "멈춰요": "stuck",
    "멈췄어요": "stuck"
  };

  var DELIVERY_SPOTS = [
    { ko: "지하주차장", name: "the underground parking lot", at: "in the underground parking lot", to: "to the underground parking lot", by: "in the underground parking lot" },
    { ko: "주차장", name: "the parking lot", at: "in the parking lot", to: "to the parking lot", by: "in the parking lot", casualBe: "I'm in the lot." },
    { ko: "공동현관", name: "the building entrance", at: "at the building entrance", to: "to the building entrance", by: "by the building entrance", door: true },
    { ko: "현관문", name: "the front door", at: "at the front door", to: "to the front door", by: "by the front door", door: true },
    { ko: "엘리베이터", name: "the elevator", at: "at the elevator", to: "to the elevator", by: "by the elevator", elevator: true },
    { ko: "승강기", name: "the elevator", at: "at the elevator", to: "to the elevator", by: "by the elevator", elevator: true },
    { ko: "로비", name: "the lobby", at: "in the lobby", to: "to the lobby", by: "in the lobby", casualBe: "I'm down in the lobby." },
    { ko: "문앞", name: "the door", at: "at the door", to: "to the door", by: "by the door", door: true },
    { ko: "현관", name: "the entrance", at: "at the entrance", to: "to the entrance", by: "by the entrance", door: true },
    { ko: "문", name: "the door", at: "at the door", to: "to the door", by: "by the door", door: true, casualBe: "I'm right outside." }
  ];

  var FLOOR_WORDS = { "한": 1, "일": 1, "두": 2, "이": 2, "세": 3, "삼": 3, "네": 4, "사": 4, "다섯": 5, "오": 5, "여섯": 6, "육": 6, "일곱": 7, "칠": 7, "여덟": 8, "팔": 8, "아홉": 9, "구": 9, "열": 10, "십": 10 };
  var ORDINALS = ["", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"];

  function floorSpot(basement, n) {
    if (basement && n === 1) {
      return { ko: "지하", name: "the basement", at: "in the basement", to: "to the basement", by: "in the basement", casualBe: "I'm in the basement." };
    }
    if (basement) {
      return { ko: "지하", name: "basement level " + n, at: "on basement level " + n, to: "to basement level " + n, by: "on basement level " + n, casualBe: "Basement level " + n + "." };
    }
    if (n === 1) {
      return { ko: "1층", name: "the first floor", at: "on the first floor", to: "to the first floor", by: "on the first floor", casualBe: "I'm downstairs." };
    }
    if (ORDINALS[n]) {
      return { ko: n + "층", name: "the " + ORDINALS[n] + " floor", at: "on the " + ORDINALS[n] + " floor", to: "to the " + ORDINALS[n] + " floor", by: "on the " + ORDINALS[n] + " floor", casualBe: cap(ORDINALS[n]) + " floor." };
    }
    return { ko: n + "층", name: "floor " + n, at: "on floor " + n, to: "to floor " + n, by: "on floor " + n, casualBe: "Floor " + n + "." };
  }

  function takeDeliverySpot(text) {
    var floor = text.match(/^(지하)?(\d{1,2}|열|십|다섯|여섯|일곱|여덟|아홉|한|일|두|이|세|삼|네|사|오|육|칠|팔|구)층(.*)$/);
    if (floor) {
      var n = FLOOR_WORDS[floor[2]] || Number(floor[2]);
      if (n >= 1 && n <= 60) return { spot: floorSpot(!!floor[1], n), rest: floor[3] };
    }
    for (var i = 0; i < DELIVERY_SPOTS.length; i++) {
      var spot = DELIVERY_SPOTS[i];
      if (text.indexOf(spot.ko) === 0 && text.length > spot.ko.length) return { spot: spot, rest: text.slice(spot.ko.length) };
    }
    return null;
  }

  function stripDeliveryParticle(rest) {
    var particles = ["으로", "에서", "까지", "앞에", "에게", "한테", "에는", "에도", "에", "로", "은", "는", "이", "가", "을", "를"];
    for (var i = 0; i < particles.length; i++) {
      var particle = particles[i];
      if (rest.indexOf(particle) === 0 && rest.length > particle.length) {
        var next = rest.slice(particle.length);
        if (DELIVERY_ACTIONS[next]) return next;
      }
    }
    return rest;
  }

  function deliveryMove(kind, spot) {
    var to = spot.to;
    var at = spot.at;
    var by = spot.by || at;
    var where = spot.ko;
    if (kind === "come-down") return deliveryResult("Please come down " + to + ".", "Can you come down " + to + "?", where + "로 내려오라는 말이에요.", "부탁처럼 말한 거예요.");
    if (kind === "go-down") return deliveryResult("Please go down " + to + ".", "Can you go down " + to + "?", where + "로 내려가라는 말이에요.", "부탁처럼 말한 거예요.");
    if (kind === "come-up") return deliveryResult("Please come up " + to + ".", "Can you come up " + to + "?", where + "로 올라오라는 말이에요.", "부탁처럼 말한 거예요.");
    if (kind === "go-up") return deliveryResult("Please go up " + to + ".", "Can you go up " + to + "?", where + "로 올라가라는 말이에요.", "부탁처럼 말한 거예요.");
    if (kind === "come") return deliveryResult("Please come " + to + ".", "Can you come " + to + "?", where + "로 오라는 말이에요.", "부탁처럼 말한 거예요.");
    if (kind === "go") return deliveryResult("Please go " + to + ".", "Can you go " + to + "?", where + "로 가라는 말이에요.", "부탁처럼 말한 거예요.");
    if (kind === "will-come-down") return deliveryResult("I'll come down " + to + ".", "I'm coming down " + to + ".", where + "로 내려온다는 말이에요.", "지금 내려온다는 말이에요.");
    if (kind === "will-go-down") return deliveryResult("I'll go down " + to + ".", "I'm heading down " + to + ".", where + "로 내려간다는 말이에요.", "짧게 말한 거예요.");
    if (kind === "will-come-up") return deliveryResult("I'll come up " + to + ".", "I'm coming up " + to + ".", where + "로 올라온다는 말이에요.", "지금 올라온다는 말이에요.");
    if (kind === "will-go-up") return deliveryResult("I'll go up " + to + ".", "I'm heading up " + to + ".", where + "로 올라간다는 말이에요.", "짧게 말한 거예요.");
    if (kind === "will-come") return deliveryResult("I'll come " + to + ".", "I'm coming " + to + ".", where + "로 온다는 말이에요.", "짧게 말한 거예요.");
    if (kind === "will-go") return deliveryResult("I'll go " + to + ".", "I'm heading " + to + ".", where + "로 간다는 말이에요.", "짧게 말한 거예요.");
    if (kind === "going") return deliveryResult("I'm going " + to + ".", "I'm heading " + to + ".", where + "로 가는 중이에요.", "heading은 간다는 편한 말이에요.");
    if (kind === "not-going") return deliveryResult("I'm not going " + to + ".", "I'm not heading " + to + ".", where + "로 안 간다는 말이에요.", "안 간다는 짧은 말이에요.");
    if (kind === "be") return deliveryResult("I'm " + at + ".", spot.casualBe || ("I'm here, " + at + "."), where + "에 있다는 말이에요.", "짧게 말한 거예요.");
    if (kind === "away" && spot.elevator) return deliveryResult("There is no elevator.", "There's no elevator.", "엘리베이터가 없다는 말이에요.", "없다는 짧은 말이에요.");
    if (kind === "away") return deliveryResult("I'm not " + at + ".", "I'm not there.", where + "에 없다는 말이에요.", "거기 없다는 짧은 말이에요.");
    if (kind === "arrived") return deliveryResult("I've arrived " + at + ".", "I'm here.", where + "에 도착했다는 말이에요.", "왔다는 짧은 말이에요.");
    if (kind === "will-leave") return deliveryResult("I'll leave it " + at + ".", "I'll just leave it " + by + ".", where + "에 둔다는 말이에요.", "두고 간다는 말이에요.");
    if (kind === "leave") return deliveryResult("Please leave it " + at + ".", "Just leave it " + by + ".", where + "에 두라는 말이에요.", "짧게 부탁하는 말이에요.");
    if (kind === "open" && spot.door) return deliveryResult("Please open " + spot.name + ".", "Can you open " + spot.name + "?", "문을 열어 달라는 말이에요.", "열어 달라는 부탁이에요.");
    if (kind === "will-open" && spot.door) return deliveryResult("I'll open " + spot.name + ".", "I'm opening " + spot.name + ".", "문을 연다는 말이에요.", "지금 연다는 말이에요.");
    if (kind === "broken" && spot.elevator) return deliveryResult("The elevator is out of order.", "The elevator's down.", "엘리베이터가 고장 났다는 말이에요.", "안 된다는 편한 말이에요.");
    if (kind === "dead" && spot.elevator) return deliveryResult("The elevator isn't working.", "The elevator's down.", "엘리베이터가 안 된다는 말이에요.", "안 된다는 편한 말이에요.");
    if (kind === "stuck" && spot.elevator) return deliveryResult("The elevator is stuck.", "The elevator's stuck.", "엘리베이터가 멈췄다는 말이에요.", "멈췄다는 짧은 말이에요.");
    return null;
  }

  function parseDelivery(text) {
    var s = prepDelivery(text);
    if (s === "몇층이에요" || s === "몇층이세요" || s === "몇층인가요" || s === "몇층이죠" || s === "몇층이야" || s === "몇층입니까" || s === "몇층요") {
      return deliveryResult("Which floor is it?", "What floor?", "몇 층인지 물어요.", "짧게 물은 거예요.");
    }
    if (s === "어디세요" || s === "어디계세요" || s === "지금어디세요" || s === "지금어디예요" || s === "어디에계세요") {
      return deliveryResult("Where are you?", "Hey, where are you?", "어디 있는지 물어요.", "앞에 hey를 붙여요.");
    }
    if (s === "도착했어요" || s === "도착했습니다" || s === "다왔어요" || s === "나왔어요" || s === "저왔어요" || s === "저도착했어요") {
      return deliveryResult("I've arrived.", "I'm here.", "도착했다는 말이에요.", "왔다는 짧은 말이에요.");
    }
    if (s === "왔어요") return deliveryResult("I'm here.", "I just got here.", "왔다는 말이에요.", "방금 왔다는 말이에요.");
    if (s === "초인종눌러주세요" || s === "벨눌러주세요" || s === "초인종눌러요") {
      return deliveryResult("Please ring the doorbell.", "Just ring the bell.", "초인종을 눌러 달라는 말이에요.", "짧게 부탁하는 말이에요.");
    }
    if (s === "초인종누를게요" || s === "벨누를게요") {
      return deliveryResult("I'll ring the doorbell.", "I'll ring the bell.", "초인종을 누른다는 말이에요.", "짧게 말한 거예요.");
    }
    if (s === "공동현관비밀번호알려주세요" || s === "공동현관비밀번호말해주세요" || s === "공동현관비밀번호뭐예요" || s === "공동현관비밀번호") {
      return deliveryResult("Please give me the building door code.", "What's the building door code?", "공동현관 비밀번호를 묻는 말이에요.", "질문으로 묻는 말이에요.");
    }
    if (s === "현관비밀번호알려주세요" || s === "현관비밀번호말해주세요" || s === "현관문비밀번호알려주세요" || s === "현관비밀번호뭐예요" || s === "현관비밀번호") {
      return deliveryResult("Please give me the entrance code.", "What's the entrance code?", "현관 비밀번호를 묻는 말이에요.", "질문으로 묻는 말이에요.");
    }
    if (s === "비밀번호알려주세요" || s === "비밀번호말해주세요" || s === "비밀번호뭐예요") {
      return deliveryResult("Please tell me the password.", "What's the password?", "비밀번호를 묻는 말이에요.", "질문으로 묻는 말이에요.");
    }
    var bare = {
      "내려오세요": ["Please come down.", "Can you come down?", "내려오라는 말이에요.", "부탁처럼 말한 거예요."],
      "내려가세요": ["Please go down.", "Can you go down?", "내려가라는 말이에요.", "부탁처럼 말한 거예요."],
      "올라오세요": ["Please come up.", "Can you come up?", "올라오라는 말이에요.", "부탁처럼 말한 거예요."],
      "올라가세요": ["Please go up.", "Can you go up?", "올라가라는 말이에요.", "부탁처럼 말한 거예요."],
      "내려올게요": ["I'll come down.", "I'm coming down.", "내려온다는 말이에요.", "지금 내려온다는 말이에요."],
      "내려갈게요": ["I'll go down.", "I'm heading down.", "내려간다는 말이에요.", "짧게 말한 거예요."],
      "올라올게요": ["I'll come up.", "I'm coming up.", "올라온다는 말이에요.", "지금 올라온다는 말이에요."],
      "올라갈게요": ["I'll go up.", "I'm heading up.", "올라간다는 말이에요.", "짧게 말한 거예요."],
      "올라갈거예요": ["I'll go up.", "I'm heading up.", "올라간다는 말이에요.", "짧게 말한 거예요."]
    };
    if (bare[s]) return deliveryResult(bare[s][0], bare[s][1], bare[s][2], bare[s][3]);
    var found = takeDeliverySpot(s);
    if (!found) return null;
    var action = DELIVERY_ACTIONS[stripDeliveryParticle(found.rest)];
    if (!action) return null;
    return deliveryMove(action, found.spot);
  }

  function parseCore(core) {
    return parseDelivery(core) || parseTime(core) || parseWhere(core) || parsePrice(core) || parseOrder(core) || parseWant(core) || parseRide(core) || parseConsume(core) || parseGo(core) || parseAdjective(core) || parseLike(core) || parseExistence(core) || parseName(core);
  }

  function reply(raw, memory) {
    var mem = memoryOf(memory);
    var original = String(raw || "").trim();
    if (!original) return koreanOnly(mem, "한국어 문장을 말해 주세요.");
    if (isMostlyEnglish(original)) return koreanOnly(mem, "그 말은 이미 영어처럼 들려요. 한국어 문장으로 물어봐 주세요.");
    var wrapped = unwrap(canon(normalize(original)));
    var core = canon(wrapped.core);
    if (wrapped.askedHow && !core) return koreanOnly(mem, "어떤 말을 영어로 알고 싶어요? 한국어 문장을 먼저 말해 주세요.");
    if (!wrapped.askedHow) {
      var control = tryControl(core, mem);
      if (control) return control;
    }
    var phrase = matchPhrase(core) || matchPhrase(stripSpeaker(core)) || matchTimed(core);
    if (phrase) return fromPhrase(phrase, mem, wrapped.askedHow);
    var parsed = parseCore(core) || parseCore(stripSpeaker(core));
    if (parsed) return emitParsed(parsed, mem, wrapped.askedHow);
    var word = tryWord(core, mem, wrapped.askedHow) || tryWord(stripSpeaker(core), mem, wrapped.askedHow);
    if (word) return word;
    return koreanOnly(mem, "그 문장은 아직 안전하게 못 바꾸겠어요. 틀릴 수 있는 영어는 만들지 않을게요.\n이렇게 물어보면 잘 알아들어요.\n「커피 마시고 싶어요」를 영어로 어떻게 말해요?");
  }

  function audit() {
    var bad = [];
    var missing = [];
    PHRASES.forEach(function (phrase) {
      if (!validEnglish(phrase.standard)) bad.push(phrase.id + " standard: " + phrase.standard);
      if (!validEnglish(phrase.casual)) bad.push(phrase.id + " casual: " + phrase.casual);
      if (/\b(wanna|gonna|gotta)\b/i.test(phrase.standard)) bad.push(phrase.id + " slang in standard");
      (phrase.related || []).forEach(function (id) {
        if (!PHRASE_BY_ID[id]) missing.push(phrase.id + " -> " + id);
      });
    });
    var counts = {};
    PHRASES.forEach(function (phrase) { counts[phrase.situation] = (counts[phrase.situation] || 0) + 1; });
    return {
      phrases: PHRASES.map(function (phrase) {
        return { id: phrase.id, ko: phrase.ko, standard: phrase.standard, casual: phrase.casual, situation: phrase.situation };
      }),
      bad: bad,
      dups: DUP_KEYS.slice(),
      missing: missing,
      counts: counts
    };
  }

  globalThis.EnglishTeacherEngine = { reply: reply, audit: audit };
})();
