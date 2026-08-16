import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue, remove, onDisconnect } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";

// إعدادات Firebase المجانية (تأكد من إعداد Realtime Database في وحدة تحكم فايربيس الخاصة بك)
const firebaseConfig = {
    databaseURL: "https://ro-fa-hagr-maqis-default-rtdb.firebaseio.com/" // ضع رابط قاعدة بياناتك هنا أو استخدم رابط تجريبي افتراضي
};

// تهيئة Firebase
let db;
try {
    const app = initializeApp(firebaseConfig);
    db = getDatabase(app);
} catch(e) {
    console.error("Firebase init error:", e);
}

// متغيرات حالة اللعبة المحلية
let currentRoomId = null;
let myRole = null; // 'p1' أو 'p2'
let myName = "";
let myChosenMove = null;

// التنقل بين الشاشات
window.showScreen = function(screenId) {
    document.querySelectorAll('.game-screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
};

window.showCreateScreen = function() {
    showScreen('screen-create');
};

window.showJoinScreen = function() {
    showScreen('screen-join');
};

// توليد كود غرفة عشوائي (6 أحرف/أرقام)
function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for(let i=0; i<6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// إنشاء لعبة جديدة (المضيف: يوسف)
window.createGameRoom = async function() {
    myName = document.getElementById('create-player-name').value.trim() || "يوسف";
    currentRoomId = generateRoomCode();
    myRole = 'p1';

    const roomData = {
        p1: { name: myName, online: true, choice: null },
        p2: { name: "", online: false, choice: null },
        scores: { p1: 0, p2: 0 },
        round: 1,
        status: 'waiting', // waiting, playing, reveal, gameover
        roundWinner: "",
        history: {}
    };

    try {
        await set(ref(db, 'rooms/' + currentRoomId), roomData);
        
        // إعداد حالة الاتصال (Presence)
        const p1StatusRef = ref(db, `rooms/${currentRoomId}/p1/online`);
        set(p1StatusRef, true);
        onDisconnect(p1StatusRef).set(false);

        document.getElementById('display-room-code').innerText = currentRoomId;
        showScreen('screen-waiting');
        listenToRoom();
    } catch(err) {
        alert("حدث خطأ في الاتصال بقاعدة البيانات. تأكد من إعداد Firebase.");
    }
};

window.copyRoomCode = function() {
    const code = document.getElementById('display-room-code').innerText;
    navigator.clipboard.writeText(code);
    alert("تم نسخ الكود بنجاح ❤️");
};

// الانضمام للعبة (اللاعب الثاني: سما)
window.joinGameRoom = async function() {
    myName = document.getElementById('join-player-name').value.trim() || "سما";
    const code = document.getElementById('join-room-code').value.trim().toUpperCase();
    const errorEl = document.getElementById('join-error-msg');
    
    if(!code) {
        errorEl.innerText = "يرجى إدخال كود الغرفة.";
        return;
    }

    const roomRef = ref(db, 'rooms/' + code);
    const snapshot = await get(roomRef);

    if(!snapshot.exists()) {
        errorEl.innerText = "❌ الغرفة غير موجودة.";
        return;
    }

    const roomData = snapshot.val();
    if(roomData.p2 && roomData.p2.name && roomData.p2.online) {
        errorEl.innerText = "❌ الغرفة مكتملة.";
        return;
    }

    currentRoomId = code;
    myRole = 'p2';

    await update(ref(db, `rooms/${currentRoomId}/p2`), {
        name: myName,
        online: true,
        choice: null
    });

    const p2StatusRef = ref(db, `rooms/${currentRoomId}/p2/online`);
    onDisconnect(p2StatusRef).set(false);

    listenToRoom();
    showScreen('screen-lobby');
};

// الاستماع لتغييرات الغرفة لحظياً في Firebase
function listenToRoom() {
    if(!currentRoomId) return;

    const roomRef = ref(db, 'rooms/' + currentRoomId);
    onValue(roomRef, (snapshot) => {
        if(!snapshot.exists()) return;
        const data = snapshot.val();

        updateUIState(data);
    });
}

// تحديث الواجهة بناءً على بيانات Firebase
function updateUIState(data) {
    const p1 = data.p1 || { name: "يوسف", online: false };
    const p2 = data.p2 || { name: "سما", online: false };

    // تحديث أسماء اللاعبين في كل الشاشات
    document.getElementById('lobby-p1-name').innerText = p1.name;
    document.getElementById('lobby-p2-name').innerText = p2.name;
    document.getElementById('score-p1-name').innerText = p1.name;
    document.getElementById('score-p2-name').innerText = p2.name;
    document.getElementById('game-p1-label').innerText = p1.name;
    document.getElementById('game-p2-label').innerText = p2.name;
    document.getElementById('rev-p1-name').innerText = p1.name;
    document.getElementById('rev-p2-name').innerText = p2.name;
    document.getElementById('final-p1-name').innerText = p1.name;
    document.getElementById('final-p2-name').innerText = p2.name;

    // التحقق من تواجد اللاعبين والانتقال للوبي
    if(data.status === 'waiting') {
        if(p1.online && p2.online && p2.name) {
            if(myRole === 'p1') {
                document.getElementById('start-game-btn').classList.remove('hidden');
                document.getElementById('waiting-host-start').classList.add('hidden');
            } else {
                document.getElementById('start-game-btn').classList.add('hidden');
                document.getElementById('waiting-host-start').classList.remove('hidden');
                document.getElementById('waiting-host-start').innerText = "⏳ في انتظار المضيف لبدء اللعبة...";
            }
            showScreen('screen-lobby');
        }
    }

    // إدارة حالة اللعب
    if(data.status === 'playing' || data.status === 'reveal') {
        showScreen('screen-game');
        
        // تحديث النقاط والجولة
        document.getElementById('score-p1-val').innerText = data.scores.p1;
        document.getElementById('score-p2-val').innerText = data.scores.p2;
        document.getElementById('current-round-title').innerText = `الجولة ${data.round}`;

        const myChoice = myRole === 'p1' ? p1.choice : p2.choice;

        if(myChoice) {
            document.getElementById('choice-selection-area').classList.add('hidden');
            document.getElementById('choice-waiting-area').classList.remove('hidden');
            const otherName = myRole === 'p1' ? p2.name : p1.name;
            document.getElementById('waiting-other-choice-text').innerText = `في انتظار ${otherName}...`;
        } else {
            document.getElementById('choice-selection-area').classList.remove('hidden');
            document.getElementById('choice-waiting-area').classList.add('hidden');
            document.getElementById('round-result-area').classList.add('hidden');
        }

        // إذا اختار اللاعبان، يتم كشف النتائج
        if(p1.choice && p2.choice) {
            document.getElementById('choice-waiting-area').classList.add('hidden');
            document.getElementById('round-result-area').classList.remove('hidden');

            const emojis = { 'حجر': '🪨', 'ورقة': '📄', 'مقص': '✂️' };
            document.getElementById('rev-p1-emoji').innerText = emojis[p1.choice];
            document.getElementById('rev-p1-text').innerText = p1.choice;
            document.getElementById('rev-p2-emoji').innerText = emojis[p2.choice];
            document.getElementById('rev-p2-text').innerText = p2.choice;
            document.getElementById('round-winner-announcement').innerText = data.roundAnnouncement || "";

            // الانتقال التلقائي للجولة التالية بعد 3 ثوانٍ (للمضيف فقط لتجنب التكرار)
            if(myRole === 'p1' && data.status !== 'transitioning') {
                update(ref(db, `rooms/${currentRoomId}`), { status: 'transitioning' });
                setTimeout(() => {
                    nextRound(data);
                }, 3000);
            }
        }
    }

    // التحقق من نهاية المباراة (الوصول لـ 5 نقاط)
    if(data.status === 'gameover') {
        showScreen('screen-gameover');
        document.getElementById('final-p1-score').innerText = data.scores.p1;
        document.getElementById('final-p2-score').innerText = data.scores.p2;
        document.getElementById('match-winner-announcement').innerText = data.matchWinnerAnnouncement;
        confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
    }

    // تحديث سجل الجولات
    if(data.history) {
        const historyList = document.getElementById('rounds-history-list');
        historyList.innerHTML = "";
        Object.values(data.history).forEach(h => {
            historyList.innerHTML += `
                <div class="history-item">
                    <span>الجولة ${h.round}: ${h.p1Name} (${h.p1Choice}) vs ${h.p2Name} (${h.p2Choice})</span>
                    <strong>${h.winner}</strong>
                </div>
            `;
        });
    }

    // فحص مغادرة الطرف الآخر
    if(p1.online === false && myRole === 'p2') {
        alert("⚠️ اللاعب الأول مغادر الغرفة.");
        location.reload();
    } else if(p2.online === false && myRole === 'p1' && p2.name !== "") {
        // تم التعامل مع الانقطاع
    }
}

// بدء المباراة بواسطة المضيف
window.startMatch = function() {
    update(ref(db, `rooms/${currentRoomId}`), { status: 'playing' });
};

// اختيار الحركة (حجر، ورقة، مقص)
window.makeChoice = function(choice) {
    myChosenMove = choice;
    update(ref(db, `rooms/${currentRoomId}/${myRole}`), { choice: choice });

    // التحقق الفوري إذا اختار الطرف الآخر أيضاً
    get(ref(db, `rooms/${currentRoomId}`)).then((snapshot) => {
        const data = snapshot.val();
        const otherRole = myRole === 'p1' ? 'p2' : 'p1';
        
        if(data[otherRole].choice) {
            // الحوسبة وتحديد الفائز
            evaluateRound(data);
        }
    });
};

// تقييم نتيجة الجولة
function evaluateRound(data) {
    const p1 = data.p1;
    const p2 = data.p2;
    const c1 = p1.choice;
    const c2 = p2.choice;

    let winnerText = "";
    let roundWinnerKey = "";

    if(c1 === c2) {
        winnerText = "تعادل... محدش عايز يزعل التاني 😂❤️";
        roundWinnerKey = "تعادل";
    } else if(
        (c1 === 'حجر' && c2 === 'مقص') ||
        (c1 === 'مقص' && c2 === 'ورقة') ||
        (c1 === 'ورقة' && c2 === 'حجر')
    ) {
        winnerText = `${p1.name} كسب الجولة! 😂❤️`;
        roundWinnerKey = p1.name;
        data.scores.p1 += 1;
    } else {
        winnerText = `${p2.name} كسبت الجولة! ❤️😂`;
        roundWinnerKey = p2.name;
        data.scores.p2 += 1;
    }

    // تسجيل في التاريخ
    const historyId = 'r_' + data.round;
    const historyItem = {
        round: data.round,
        p1Name: p1.name,
        p1Choice: c1,
        p2Name: p2.name,
        p2Choice: c2,
        winner: roundWinnerKey
    };

    // التحقق من نهاية المباراة (5 نقاط)
    let newStatus = 'reveal';
    let matchWinnerAnnounce = "";
    if(data.scores.p1 >= 5 || data.scores.p2 >= 5) {
        newStatus = 'gameover';
        const finalWinner = data.scores.p1 >= 5 ? p1.name : p2.name;
        matchWinnerAnnounce = `❤️ الفائز بالمباراة: ${finalWinner} ❤️`;
    }

    update(ref(db, `rooms/${currentRoomId}`), {
        scores: data.scores,
        status: newStatus,
        roundAnnouncement: winnerText,
        matchWinnerAnnouncement: matchWinnerAnnounce,
        [`history/${historyId}`]: historyItem
    });
}

// الانتقال للجولة التالية
function dataNextRound(data) {
    update(ref(db, `rooms/${currentRoomId}`), {
        round: data.round + 1,
        status: 'playing',
        'p1/choice': null,
        'p2/choice': null,
        roundAnnouncement: ""
    });
}

// دالة الانتقال للجولة التالية للمضيف
async function nextRound(currentData) {
    const snap = await get(ref(db, `rooms/${currentRoomId}`));
    const data = snap.val();
    if(data.status === 'gameover') return;

    update(ref(db, `rooms/${currentRoomId}`), {
        round: data.round + 1,
        status: 'playing',
        'p1/choice': null,
        'p2/choice': null,
        roundAnnouncement: ""
    });
}

// إعادة تعيين مباراة جديدة بنفس الغرفة
window.resetNewMatch = function() {
    update(ref(db, `rooms/${currentRoomId}`), {
        scores: { p1: 0, p2: 0 },
        round: 1,
        status: 'playing',
        'p1/choice': null,
        'p2/choice': null,
        roundAnnouncement: "",
        history: null
    });
};

// مغادرة اللعبة
window.leaveRoom = function() {
    if(confirm("هل أنت متأكد أنك تريد مغادرة اللعبة؟")) {
        if(currentRoomId && myRole) {
            update(ref(db, `rooms/${currentRoomId}/${myRole}`), { online: false, choice: null });
        }
        currentRoomId = null;
        myRole = null;
        showScreen('screen-home');
    }
};
