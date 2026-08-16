// إعدادات اتصال Firebase (تم ضبطها لتناسب المشروع)
const firebaseConfig = {
    databaseURL: "https://loveduel-default-rtdb.firebaseio.com/"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

let boomRoomId = "";
let boomPlayerRole = ""; // 'p1' أو 'p2'
let boomMyName = "";
let boomOpponentName = "";
let boomRoomRef = null;

let mySecretWord = "";
let myChosenHearts = []; // الأزرار الـ 3 اللي أنا اخترتهم لنفسي
let opponentSecretHearts = []; // أسرار الخصم اللي أنا هكتشفها
let myRevealedHeartsCount = 0; // كم قلب كشفته للخصم
let opponentRevealedHeartsCount = 0; // كم قلب الخصم كشفه لي

let isMyTurn = false;
let gameEnded = false;

// التنقل بين الشاشات
function boomShowScreen(screenId) {
    document.querySelectorAll('.boom-screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

// 1. إنشاء غرفة جديدة
function boomCreateRoom() {
    boomMyName = document.getElementById('boom-create-name').value.trim() || "اللاعب 1";
    boomPlayerRole = "p1";
    boomRoomId = Math.floor(1000 + Math.random() * 9000).toString();

    boomRoomRef = db.ref('boom_rooms/' + boomRoomId);

    boomRoomRef.set({
        p1: { name: boomMyName, ready: false },
        p2: { name: "", ready: false },
        status: "waiting", // waiting, setup, playing, finished
        turn: "p1"
    });

    document.getElementById('boom-code-display').innerText = boomRoomId;
    boomShowScreen('boom-screen-waiting');

    // الاستماع لدخول الطرف الثاني
    boomRoomRef.on('value', (snapshot) => {
        let data = snapshot.val();
        if (!data) return;

        if (data.p2 && data.p2.name && document.getElementById('boom-screen-waiting').classList.contains('active')) {
            boomOpponentName = data.p2.name;
            initSetupPhase();
        }
    });
}

// 2. الانضمام لغرفة
function boomJoinRoom() {
    boomMyName = document.getElementById('boom-join-name').value.trim() || "اللاعب 2";
    boomRoomId = document.getElementById('boom-join-code').value.trim();

    if (!boomRoomId) {
        document.getElementById('boom-join-error').innerText = "❌ الرجاء إدخال كود الغرفة!";
        return;
    }

    boomRoomRef = db.ref('boom_rooms/' + boomRoomId);

    boomRoomRef.once('value', (snapshot) => {
        let data = snapshot.val();
        if (!data) {
            document.getElementById('boom-join-error').innerText = "❌ الغرفة غير موجودة أو انتهت!";
            return;
        }

        boomOpponentName = data.p1.name;
        boomPlayerRole = "p2";

        boomRoomRef.update({
            p2: { name: boomMyName, ready: false }
        });

        initSetupPhase();
    });
}

// بدء مرحلة التجهيز (اختيار القلوب والكلمة السرية)
function initSetupPhase() {
    boomShowScreen('boom-screen-setup');
    let grid = document.getElementById('boom-setup-grid');
    grid.innerHTML = "";
    myChosenHearts = [];

    for (let i = 0; i < 9; i++) {
        let btn = document.createElement('button');
        btn.className = 'cell-btn';
        btn.innerText = '🤍';
        btn.dataset.index = i;
        btn.onclick = () => toggleSecretHeart(i, btn);
        grid.appendChild(btn);
    }
}

function toggleSecretHeart(index, btn) {
    if (myChosenHearts.includes(index)) {
        myChosenHearts = myChosenHearts.filter(item => item !== index);
        btn.classList.remove('selected-secret');
        btn.innerText = '🤍';
    } else {
        if (myChosenHearts.length >= 3) {
            alert("⚠️ مسموح لك اختيار 3 قلوب سرية فقط!");
            return;
        }
        myChosenHearts.push(index);
        btn.classList.add('selected-secret');
        btn.innerText = '❤️';
    }
}

function boomLockSetup() {
    mySecretWord = document.getElementById('boom-secret-word').value.trim();
    if (!mySecretWord) {
        alert("⚠️ يرجى كتابة الكلمة السرية أولاً!");
        return;
    }
    if (myChosenHearts.length !== 3) {
        alert("⚠️ يرجى اختيار 3 قلوب تماماً!");
        return;
    }

    // حفظ أسرار اللاعب في قاعدة البيانات
    let updateData = {};
    updateData[`${boomPlayerRole}_secretHearts`] = myChosenHearts;
    updateData[`${boomPlayerRole}_secretWord`] = mySecretWord;
    updateData[`${boomPlayerRole}_ready`] = true;

    boomRoomRef.update(updateData);

    // الانتظار حتى يصبح الطرفان جاهزين
    document.querySelector('#boom-screen-setup .hero-card').innerHTML = `
        <h2>⏳ في انتظار الطرف الآخر...</h2>
        <p class="subtitle">تم قفل اختيارك بنجاح ❤️</p>
    `;

    boomRoomRef.on('value', (snapshot) => {
        let data = snapshot.val();
        if (data && data.p1 && data.p2 && data.p1.ready && data.p2.ready) {
            startGamePlay(data);
        }
    });
}

// بدء اللعب الفعلي
function startGamePlay(data) {
    boomShowScreen('boom-screen-game');

    // حفظ أسرار الخصم
    opponentSecretHearts = (boomPlayerRole === 'p1') ? data.p2_secretHearts : data.p1_secretHearts;

    buildOpponentBoard();
    updateGameTurn(data.turn);

    // الاستماع لتحديثات اللعبة المستمرة
    boomRoomRef.on('value', (snapshot) => {
        let updatedData = snapshot.val();
        if (!updatedData) return;

        updateGameTurn(updatedData.turn);

        // التحقق من حالة الفوز
        if (updatedData.status === 'finished') {
            triggerWinScreen(updatedData.winner);
        }
    });
}

function buildOpponentBoard() {
    let board = document.getElementById('boom-opponent-board');
    board.innerHTML = "";

    for (let i = 0; i < 9; i++) {
        let btn = document.createElement('button');
        btn.className = 'cell-btn';
        btn.innerText = '❓';
        btn.dataset.index = i;
        btn.onclick = () => makeGuess(i, btn);
        board.appendChild(btn);
    }
}

function updateGameTurn(turn) {
    isMyTurn = (turn === boomPlayerRole);
    let indicator = document.getElementById('boom-turn-indicator');
    if (isMyTurn) {
        indicator.innerText = "🎯 دورك في الهجوم";
        indicator.style.background = "#ff2a85";
    } else {
        indicator.innerText = "🛡️ دور الخصم";
        indicator.style.background = "#b041ff";
    }
}

// تخمين قلب عند الخصم
function makeGuess(index, btn) {
    if (!isMyTurn || gameEnded) return;
    if (btn.disabled) return;

    btn.disabled = true;

    let isBoom = opponentSecretHearts.includes(index);

    if (isBoom) {
        btn.innerText = '💥';
        btn.style.background = 'rgba(239, 68, 68, 0.3)';
        btn.style.borderColor = '#ef4444';
        myRevealedHeartsCount++;
        document.getElementById('boom-score-counter').innerText = `${myRevealedHeartsCount} / 3`;

        showEffectOverlay("💥 BOOM!", "لقد كشف قلباً سرياً للخصم!");

        if (myRevealedHeartsCount >= 3) {
            // الفوز!
            boomRoomRef.update({
                status: 'finished',
                winner: boomPlayerRole
            });
            return;
        }
    } else {
        btn.innerText = '❌';
        btn.style.background = 'rgba(255, 255, 255, 0.02)';
        showEffectOverlay("💨 هواء!", "لم تقم باصابة قلب سري.");
    }

    // تبديل الدور للطرف الآخر
    let nextTurn = (boomPlayerRole === 'p1') ? 'p2' : 'p1';
    boomRoomRef.update({ turn: nextTurn });
}

function showEffectOverlay(title, subtitle) {
    let overlay = document.getElementById('boom-effect-overlay');
    document.getElementById('boom-effect-title').innerText = title;
    document.getElementById('boom-effect-subtitle').innerText = subtitle;
    overlay.classList.remove('hidden');

    setTimeout(() => {
        overlay.classList.add('hidden');
    }, 1200);
}

function triggerWinScreen(winnerRole) {
    gameEnded = true;
    boomShowScreen('boom-screen-win');

    let iWon = (winnerRole === boomPlayerRole);
    let titleEl = document.getElementById('boom-win-title');
    let subEl = document.getElementById('boom-win-subtitle');

    boomRoomRef.once('value', (snapshot) => {
        let data = snapshot.val();
        let opponentSecretWord = (boomPlayerRole === 'p1') ? data.p2_secretWord : data.p1_secretWord;
        document.getElementById('boom-revealed-secret').innerText = `"${opponentSecretWord}"`;
    });

    if (iWon) {
        titleEl.innerText = "🏆 تهانينا، لقد فزت!";
        subEl.innerText = "اكتشفت جميع قلوب الخصم بامتياز!";
        if (typeof confetti === 'function') {
            confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
        }
    } else {
        titleEl.innerText = "💔 هارد لك، لقد خسرت!";
        subEl.innerText = "استطاع الخصم كشف قلوبك أولاً.";
    }
}
