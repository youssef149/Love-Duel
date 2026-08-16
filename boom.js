// المتغيرات الأساسية
let boomPeer, boomConn, boomRole;
let myChosenHearts = [], opponentSecretHearts = [];
let isMyTurn = false, gameStarted = false;

// دالة التنقل بين الشاشات
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

function showHome() { showScreen('screen-home'); }
function showJoinScreen() { showScreen('screen-join'); }

// 1. إنشاء الغرفة
function createRoom() {
    const id = Math.floor(1000 + Math.random() * 9000).toString();
    boomPeer = new Peer('boom-' + id);
    boomPeer.on('open', () => {
        alert("كود الغرفة: " + id + "\nشاركه مع الطرف التاني!");
        boomRole = 'p1';
        isMyTurn = true;
    });
    boomPeer.on('connection', (conn) => {
        boomConn = conn;
        setupListeners();
        showScreen('screen-setup');
    });
}

// 2. الانضمام
function joinRoom() {
    const id = document.getElementById('join-code').value;
    boomPeer = new Peer();
    boomConn = boomPeer.connect('boom-' + id);
    boomRole = 'p2';
    boomConn.on('open', () => {
        setupListeners();
        showScreen('screen-setup');
    });
}

// 3. التجهيز (اختيار القلوب)
const setupGrid = document.getElementById('setup-grid');
for(let i=0; i<9; i++) {
    let b = document.createElement('button');
    b.className = 'cell-btn';
    b.onclick = () => {
        if(myChosenHearts.includes(i)) {
            myChosenHearts = myChosenHearts.filter(x => x !== i);
            b.classList.remove('selected');
        } else if(myChosenHearts.length < 3) {
            myChosenHearts.push(i);
            b.classList.add('selected');
        }
    };
    setupGrid.appendChild(b);
}

function lockSetup() {
    if(myChosenHearts.length !== 3) return alert("اختار 3 قلوب!");
    boomConn.send({ type: 'READY', hearts: myChosenHearts });
    checkAndStart();
}

// 4. استماع البيانات (هنا حل مشكلة الطرف التاني)
function setupListeners() {
    boomConn.on('data', (data) => {
        if(data.type === 'READY') {
            opponentSecretHearts = data.hearts;
            checkAndStart();
        } else if(data.type === 'GUESS') {
            let isBoom = myChosenHearts.includes(data.index);
            boomConn.send({ type: 'RESULT', isBoom: isBoom, index: data.index });
        } else if(data.type === 'RESULT') {
            updateBoard(data.index, data.isBoom);
        }
    });
}

function checkAndStart() {
    if(opponentSecretHearts.length > 0 || myChosenHearts.length === 3) {
        gameStarted = true;
        showScreen('screen-game');
        buildGameGrid();
    }
}

// 5. اللعب
function buildGameGrid() {
    const grid = document.getElementById('game-grid');
    grid.innerHTML = '';
    for(let i=0; i<9; i++) {
        let b = document.createElement('button');
        b.className = 'cell-btn';
        b.onclick = () => { if(isMyTurn) boomConn.send({ type: 'GUESS', index: i }); };
        grid.appendChild(b);
    }
}

function updateBoard(index, isBoom) {
    let btn = document.getElementById('game-grid').children[index];
    btn.innerText = isBoom ? '💥' : '🛡️';
    
    // التعديل: تغيير الكلمة إلى "سيف"
    const overlay = document.getElementById('boom-effect-overlay');
    document.getElementById('effect-title').innerText = isBoom ? "💥 بووم!" : "🛡️ سيف";
    document.getElementById('effect-desc').innerText = isBoom ? "كشفت قلب سري!" : "هذا المكان سيف!";
    
    overlay.style.display = 'flex';
    setTimeout(() => overlay.style.display = 'none', 1500);
    
    isMyTurn = !isMyTurn;
}
