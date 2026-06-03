// Data - Logo Sources
const logoSources = ["Logos/LogoGemini.png", "Logo.png"];
const APP_SHELL_CACHE_PREFIX = "rosario-shell-";
const UPDATE_APPLIED_FLAG = "el-mago-tours-games-updated";
const OFFLINE_REQUIRED_FILES = [
    "./juegos.html",
    "./style.css",
    "./script.js",
    "./manifest.json",
    "./android-chrome-192x192.png",
    "./Logos/LogoGemini.png"
];

let serviceWorkerRegistration = null;
let pendingServiceWorker = null;
let isApplyingServiceWorkerUpdate = false;
// Firebase for games (optional): version and runtime state
const FIREBASE_VERSION = "12.14.0";
const gamesState = {
    app: null,
    auth: null,
    db: null,
    firestore: null,
    authFns: null,
    user: null,
    firebaseReady: false
};

// Memory Game Data
const memoryData = [
    { imagen: "Memoria/castagnino.jpg", referencia: "Museo Municipal de Bellas Artes 'Juan B. Castagnino'" },
    { imagen: "Memoria/catedral.jpg", referencia: "Catedral Basílica Santuario 'Nuestra Señora del Rosario'" },
    { imagen: "Memoria/escarapela.png", referencia: "Cuna de la Escarapela" },
    { imagen: "Memoria/estevez.jpg", referencia: "Museo de Arte Decorativo 'Firma y Odilo Estévez'" },
    { imagen: "Memoria/helado.jpg", referencia: "Capital Nacional del Helado Artesanal" },
    { imagen: "Memoria/independencia.jpg", referencia: "Parque Independencia" },
    { imagen: "Memoria/monumento.jpg", referencia: "Monumento Histórico Nacional a la Bandera" },
    { imagen: "Memoria/puente.jpg", referencia: "Puente 'Nuestra Señora del Rosario'" },
    { imagen: "Memoria/urquiza.jpg", referencia: "Parque Urquiza" },
    { imagen: "Memoria/gigante.png", referencia: "Estadio Mundialista 'Gigante de Arroyito'" },
    { imagen: "Memoria/coloso.jpg", referencia: "Estadio 'Marcelo A. Bielsa'" },
    { imagen: "Memoria/elcirculo.png", referencia: "Teatro El Círculo" }
];

// Challenge Game Data - Words
const challengeWordSequence = ["Rosario", "Te", "Guío"];

// Challenge Game Data - Trivia Cards (18 questions total, 3 per card, 6 cards)
const triviaDecks = [
    {
        cardId: "trivia-1",
        label: "Tarjeta 1",
        questions: [
            {
                text: "¿Cuál fue el primer club deportivo de Rosario?",
                options: [
                    { text: "Rosario Cricket Club", correct: true },
                    { text: "Jockey Club de Rosario", correct: false },
                    { text: "Club Gimnasia y Esgrima", correct: false }
                ],
                reference: "El Rosario Cricket Club fue creado en 1867 por un grupo de inmigrantes ingleses. En 1884 cambia su nombre por el de Atlético del Rosario que conserva en nuestros días.",
                source: "Andrés Bossio, Revista Rosario Historias deAquí a la Vuelta, Nº 9. Pág.3."
            },
            {
                text: "¿Cuál es el nombre oficial del barrio Arroyito?",
                options: [
                    { text: "Cañada de Salinas", correct: false },
                    { text: "Lisandro de la Torre", correct: true },
                    { text: "General Sarmiento", correct: false }
                ],
                reference: "",
                source: "Capitel en Barrio Arroyito, Diario La Capital, 1/06/1997. Pág. 8"
            },
            {
                text: "¿Quién fue Teófilo Zeballos?",
                options: [
                    { text: "El primer bombero que realizó un salvataje de un edificio en llamas", correct: false },
                    { text: "El primero que hizo una ascensión en globo aerostático en nuestra ciudad", correct: true },
                    { text: "El primer ordenanza que tuvo la Municipalidad de Rosario", correct: false }
                ],
                reference: "El 22 de febrero de 1874, Teófilo Zeballos, mejicano, se elevaba en el cielo rosarino, dando lugar a la primera ascensión en globo aerostático en nuestra ciudad, lo llevó a cabo en la actual Plaza López.",
                source: "revista 'Una Mano de su Mutual', Asociación Médica de Rosario, Año 2, Nº 9, Marzo 1996. Pág.34-36."
            }
        // Update header user area on juegos.html using gamesState or localStorage.authUser
        function updateGamesHeaderUI() {
            const nameEl = document.getElementById('games-user-name');
            const actionBtn = document.getElementById('games-user-action');
            if (!nameEl || !actionBtn) return;

            let user = gamesState.user;
            if (!user) {
                try { user = JSON.parse(localStorage.getItem('authUser') || 'null'); } catch (e) { user = null; }
            }

            if (user && (user.uid || user.email)) {
                const display = user.displayName || user.email || user.name || 'Usuario';
                nameEl.textContent = display;
                actionBtn.textContent = 'Cerrar sesión';
                actionBtn.onclick = async () => {
                    // Prefer Firebase sign out if available
                    if (gamesState.firebaseReady && gamesState.authFns && gamesState.auth) {
                        try {
                            await gamesState.authFns.signOut(gamesState.auth);
                        } catch (e) { console.warn('Error en signOut:', e); }
                    }
                    try { localStorage.removeItem('authUser'); } catch (e) {}
                    updateGamesHeaderUI();
                    // redirect to perfil page to encourage re-login if needed
                    window.location.href = 'index.html#perfil';
                };
            } else {
                nameEl.textContent = '';
                actionBtn.textContent = 'Entrar';
                actionBtn.onclick = () => { window.location.href = 'index.html#perfil'; };
            }
        }

        // Sync header when other tabs update authUser
        window.addEventListener('storage', (e) => {
            if (e.key === 'authUser') updateGamesHeaderUI();
        });
        ]
    },
    {
        cardId: "trivia-2",
        label: "Tarjeta 2",
        questions: [
            {
                text: "¿Cuál era el nombre de la primera fábrica de acero que se instaló en Rosario, generando un importante núcleo de concentración fabril?",
                options: [
                    { text: "Aceros Rosario, 1991", correct: false },
                    { text: "Acerera del Paraná, 1850", correct: false },
                    { text: "Acindar S.A., 1942", correct: true }
                ],
                reference: "Acindar Industria de Acero S.A., instaló en Rosario su primera fábrica de acero. Contaba con un Horno Siemens Martin de 30 toneladas de capacidad y un pequeño tren laminador de origen nacional.",
                source: "Carlos del Frade, 'Postales del ex cordón industrial del Gran Rosario'. Pág.92. Ediciones Fantasía Industrial. 1994."
            },
            {
                text: "¿Quién fue el escritor y poeta español que llegó a Rosario, a fines de 1935 para protagonizar un recital poético y dar una conferencia?",
                options: [
                    { text: "Federico García Lorca", correct: true },
                    { text: "Miguel Hernández", correct: false },
                    { text: "Rafael Alberti", correct: false }
                ],
                reference: "",
                source: "Revista Historias de Aquí a la Vuelta, Nº 13, Año 1991."
            },
            {
                text: "¿Quién expresó estas palabras enviadas desde París, donde estaba cumpliendo una misión diplomática?: '...Por mi parte, mi sueño dorado es habitar en algún lugar de nuestras campañas de América. Ojalá pudiera tener una bonita quinta cerca del Paraná o en el Rosario...'?",
                options: [
                    { text: "Justo José de Urquiza", correct: false },
                    { text: "Juan Manuel de Rosas", correct: false },
                    { text: "Juan Bautista Alberdi", correct: true }
                ],
                reference: "Si bien Alberdi jamás residió en nuestra ciudad, José Nicolás Puccio, influido por el espíritu de la Generación del 80, rendiría homenaje al autor de 'Las Bases', fundando un pueblo con el nombre de Alberdi.",
                source: "Revista 'Una Mano de su Mutual', Asociación Médica de Rosario, Año 2, Nº 5, Marzo de 1995. Pág.28"
            }
        ]
    },
    {
        cardId: "trivia-3",
        label: "Tarjeta 3",
        questions: [
            {
                text: "¿En qué año y dónde fueron ubicadas definitivamente las esculturas de Lola Mora?",
                options: [
                    { text: "En 1990 - En la terminal de Ómnibus 'Mariano Moreno'", correct: false },
                    { text: "En 1997 - En el Pasaje Juramento (Bs.As. entre Santa Fe y Córdoba)", correct: true },
                    { text: "En 1993 - En la Plaza Pringles (Córdoba entre Pte. Roca y Paraguay)", correct: false }
                ],
                reference: "",
                source: "Diario La Capital, 8/10/1997, 2da.sección, pag.1."
            },
            {
                text: "¿Cuál fue el origen del actual Centro Cultural 'Roberto Fontanarrosa', (ex Bernardino Rivadavia) situado en la Plaza Montenegro?",
                options: [
                    { text: "El Hotel Gran Rosario", correct: false },
                    { text: "La vieja Escuela de Señoritas", correct: false },
                    { text: "El Centro de Prensa del Mundial de Fútbol de 1978", correct: true }
                ],
                reference: "",
                source: "Miguel A. de Marco y Oscar Ensinck, en Historia de Rosario, Asociación Amigos del Museo Histórico 'Dr. Julio Marc'. Pág.356."
            },
            {
                text: "El Centro Municipal de Distrito Noroeste lleva el nombre de 'Olga y Leticia Cossettini' ¿En qué se destacaron Olga y Leticia?",
                options: [
                    { text: "En teatro", correct: false },
                    { text: "En educación", correct: true },
                    { text: "En política", correct: false }
                ],
                reference: "El CMD Noroeste ubicado en Provincias Unidas 150 bis fue inaugurado el 18 de septiembre de 2006, se encuentra emplazado en un predio con significativa vegetación, anteriormente ocupado por una fábrica. Tomó su nombre de quienes llevaron adelante una de las experiencias pedagógicas más innovadoras del país. Con el espíritu de la 'Escuela Nueva', Olga y Leticia Cossettini se desempeñaron durante fructuosos años a la cabeza de la Escuela Nº 69 'Dr. Gabriel Carrasco', ubicada en Barrio Alberdi y reconocida por las autoridades estatales como establecimiento educativo piloto. Contemplando las características de una población diversa (hijos de pescadores, obreros, comerciantes de clase media y familias acomodadas) las hermanas Cossettini realizaron una reforma profunda de la vida escolar, permitiendo —según dichos de la propia Olga— 'abrir de par en par las puertas de las aulas a la vida'.",
                source: "Municipalidad de Rosario - www.rosario.gov.ar"
            }
        ]
    },
    {
        cardId: "trivia-4",
        label: "Tarjeta 4",
        questions: [
            {
                text: "Un gran naturalista del siglo XIX estuvo en Rosario en los años treinta, y realizó investigaciones en las barrancas del Arroyo Saladillo. ¿De quién se trata?",
                options: [
                    { text: "Charles Darwin", correct: true },
                    { text: "Alfred Wallace", correct: false },
                    { text: "Ernst Haekel", correct: false }
                ],
                reference: "",
                source: "Museo Provincial de Ciencias Naturales 'Dr. Ángel Gallardo'"
            },
            {
                text: "¿Quién fue el Presidente argentino que visitó el Hipódromo Independencia el 26 de octubre de 1902, a casi un año de su inauguración?",
                options: [
                    { text: "Julio A. Roca", correct: true },
                    { text: "Hipólito Irigoyen", correct: false },
                    { text: "José Félix Uriburu", correct: false }
                ],
                reference: "El Hipódromo Independencia se inauguró oficialmente el 8 de diciembre de 1901.",
                source: "Capitel en el Hipódromo, La Capital, 6/4/1997, p.8."
            },
            {
                text: "El segundo Centro de Distrito que se inauguró en el año 1999 en el marco de proceso de Descentralización y Modernización del Estado Municipal, lleva el nombre de Felipe Moré. ¿A qué se dedicaba Felipe Moré?",
                options: [
                    { text: "Al periodismo", correct: true },
                    { text: "A las artes plásticas", correct: false },
                    { text: "Al remo", correct: false }
                ],
                reference: "Su nombre resultó de una votación en la que participaron los alumnos de las escuelas primarias del distrito. Felipe Moré nació en 1852, fue periodista, fundó el diario 'El Mensajero' y ocupó altas posiciones públicas en el gobierno. El 25 de junio de 1890 fue designado Comisario Municipal para la Villa San Francisquito y luego cónsul argentino en Portugal. Fue gran propulsor del progreso de Rosario, al que mucho contribuyó con su pluma ágil y valiente. Falleció en la ciudad de Lisboa el 3 de abril de 1905. Sus restos fueron repatriados en 1906.",
                source: "Municipalidad de Rosario - www.rosario.gov.ar"
            }
        ]
    },
    {
        cardId: "trivia-5",
        label: "Tarjeta 5",
        questions: [
            {
                text: "¿Quién es el prestigioso arquitecto que diseñó el Distrito Sudoeste 'Emilia Bertolé', ubicado en Av. Francia 4435 e inaugurado en septiembre de 2009?",
                options: [
                    { text: "César Pelli", correct: true },
                    { text: "Clorindo Testa", correct: false },
                    { text: "Amancio Williams", correct: false }
                ],
                reference: "El edificio, inaugurado en septiembre de 2009, se encuentra enclavado en un terreno de 15.000 m2 y cuenta con 6.900 m2 de espacio cubierto. Es la primera obra del prestigioso arquitecto César Pelli en el interior del país y de carácter público en la Argentina. César Pelli es un arquitecto argentino, nacido el 12 de octubre de 1926 en la provincia de Tucumán. Estudió arquitectura y se graduó en la Universidad Nacional de Tucumán. Posteriormente comenzó a trabajar en su país, hasta que en 1952 se trasladó a los Estados Unidos, donde finalmente se nacionalizó estadounidense. Fue decano de la Facultad de Arquitectura de la Universidad de Yale. Ha sido distinguido con la medalla de oro del American Architect Institute (Instituto Estadounidense de Arquitectos). Las torres Petronas, (452 metros) en Kuala Lumpur, capital de Malasia, fueron los edificios más altos del mundo entre 1998 y 2003.",
                source: "http://es.wikipedia.org/wiki/C%C3%A9sar_Pelli\nhttp://es.wikipedia.org/wiki/Torres_Petronas\nMunicipalidad de Rosario - www.rosario.gov.ar"
            },
            {
                text: "La primera ciudad en hermanarse con Rosario, de acuerdo con un convenio propulsado por nuestro municipio, fue la ciudad italiana llamada Imperia, ¿Qué particularidad tiene esta ciudad en relación a la historia de Rosario?",
                options: [
                    { text: "Desde allí trajeron a los leones de mármol que se encuentran en la entrada del Palacio Municipal.", correct: false },
                    { text: "Es la ciudad donde nació el padre de Manuel Belgrano", correct: true },
                    { text: "Es la ciudad donde en 1986 se construyó un barrio llamado Rosario, ideado por un arquitecto rosarino que reside hace 30 años en Imperia.", correct: false }
                ],
                reference: "Rosario e Imperia se hermanaron el 3 de octubre de 1987. El objetivo principal de este convenio es el intercambio cultural y de experiencias técnicas en las pequeñas y medianas empresas; también se busca afianzar el sistema democrático y acordar proyectos entre ciudades de distintos países que de esta manera puedan crecer más allá de las políticas estatales.",
                source: "Diario La Capital, 11/6/1998, 1ra.Pág. 2da. sección."
            },
            {
                text: "¿Quién fue Juanito Laguna?",
                options: [
                    { text: "Un escritor famoso de la década del 30", correct: false },
                    { text: "Un personaje de la obra del artista plástico Antonio Berni", correct: true },
                    { text: "El primer pasajero que subió al tranvía cuando éste se inauguró", correct: false }
                ],
                reference: "",
                source: "Revista La Maga Nº 27 - 1997 - Pág.13"
            }
        ]
    },
    {
        cardId: "trivia-6",
        label: "Tarjeta 6",
        questions: [
            {
                text: "El edificio donde se emplaza la sede central de la Municipalidad de Rosario, es conocido como el Palacio de Los Leones, por las dos esculturas de leones idénticos y simétricos que están junto a la escalinata principal. Estas son réplicas a menor escala, de originales que actualmente existen, ¿De qué lugar fueron traídos?",
                options: [
                    { text: "Desde Roma (de un Palacio en la Vía Venetto)", correct: false },
                    { text: "Desde Génova (de la Iglesia de San Lorenzo)", correct: true },
                    { text: "Desde Buenos Aires (del Congreso Nacional)", correct: false }
                ],
                reference: "",
                source: "Capitel en Zona Centro, Diario La Capital, 17/11/1996"
            },
            {
                text: "¿Cuándo nevó por última vez en Rosario?",
                options: [
                    { text: "En 1973", correct: true },
                    { text: "En 1963", correct: false },
                    { text: "En 1995", correct: false }
                ],
                reference: "",
                source: "Archivo Periodístico de Canal 5 de Rosario."
            },
            {
                text: "¿Qué personalidad del ámbito de la Educación fue declarada Ciudadana Ilustre en el año 1993?",
                options: [
                    { text: "Leticia Cossettini", correct: false },
                    { text: "Rosa Ziperovich", correct: true },
                    { text: "Mercedes Sánchez Negrete", correct: false }
                ],
                reference: "En el año 1993 el Honorable Concejo Municipal la declaró Ciudadana Ilustre, rindiendo homenaje a sus ochenta años de lucha por la educación pública y su compromiso con los derechos humanos.",
                source: "Municipalidad de Rosario - www.rosario.gov.ar"
            }
        ]
    }
];

// DOM Elements
const viewElements = document.querySelectorAll(".view");
const navigationButtons = document.querySelectorAll("[data-open-view]");

const memoryBoard = document.getElementById("memory-board");
const memoryTime = document.getElementById("memory-time");
const memoryProgress = document.getElementById("memory-progress");
const memoryFeedback = document.getElementById("memory-feedback");
const memoryStartButton = document.getElementById("memory-start-btn");
const memoryResetButton = document.getElementById("memory-reset-btn");

const challengeBoard = document.getElementById("challenge-board");
const challengeFeedback = document.getElementById("challenge-feedback");
const challengeWordCount = document.getElementById("challenge-word-count");
const challengeResetButton = document.getElementById("challenge-reset-btn");
const offlineStatus = document.getElementById("offline-status");
const offlineStatusLabel = document.getElementById("offline-status-label");
const updateStatus = document.getElementById("update-status");
const updateStatusLabel = document.getElementById("update-status-label");
const clearCacheButton = document.getElementById("clear-cache-btn");
const cacheFeedback = document.getElementById("cache-feedback");
const updateBanner = document.getElementById("update-banner");
const updateBannerTitle = document.getElementById("update-banner-title");
const updateBannerText = document.getElementById("update-banner-text");
const updateAppButton = document.getElementById("update-app-btn");

// State Objects
const memoryState = {
    cards: [],
    selected: [],
    lockBoard: false,
    started: false,
    matchedPairs: 0,
    timeRemaining: 120,
    timerId: null,
    resolveTimeoutId: null
};

const challengeState = {
    cards: [],
    selectedWords: [],
    selectedIds: new Set(),
    triviaMode: false,
    roundComplete: false,
    currentTriviaCard: null,
    currentTriviaQuestions: [],
    currentQuestionIndex: 0,
    triviaScore: 0,
    triviaTotalQuestions: 0,
    advanceTimeoutId: null
};

// Event Listeners
navigationButtons.forEach(btn => {
    btn.addEventListener("click", () => openView(btn.dataset.openView));
});

memoryStartButton.addEventListener("click", startMemoryGame);
memoryResetButton.addEventListener("click", resetMemoryGame);
challengeResetButton.addEventListener("click", resetChallengeGame);

// Initialize on page load
initializeApp();

// Functions - Utilities
function initializeApp() {
    normalizeRefreshUrl();
    resetMemoryGame();
    resetChallengeGame();
    initializeAppControls();
    showAppliedUpdateFeedback();
    registerServiceWorker();
    // Try to initialize Firebase for global leaderboards, but always render local first
    try { renderLeaderboards(); } catch (e) { /* ignore */ }
    try { initFirebaseGames(); } catch (e) { /* ignore */ }
    try { updateGamesHeaderUI(); } catch (e) {}
}

// Initialize Firebase (games page) to use Firestore leaderboards when available
async function initFirebaseGames() {
    try {
        const [appMod, authMod, firestoreMod] = await Promise.all([
            import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
            import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`),
            import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`)
        ]);
        const cfg = await import('./firebase-config.js');

        gamesState.app = appMod.initializeApp(cfg.firebaseConfig);
        gamesState.auth = authMod.getAuth(gamesState.app);
        gamesState.db = firestoreMod.getFirestore(gamesState.app);
        gamesState.firestore = firestoreMod;
        gamesState.authFns = authMod;
        gamesState.firebaseReady = true;

        // Track auth state so we only allow writes when user is authenticated with Firebase
        authMod.onAuthStateChanged(gamesState.auth, user => {
            gamesState.user = user;
            try { updateGamesHeaderUI(); } catch (e) {}
        });

        // Subscribe to realtime leaderboards updates
        subscribeLeaderboardsFirestore();
    } catch (error) {
        console.warn('Firebase para juegos no está disponible:', error);
    }
}

function subscribeLeaderboardsFirestore() {
    if (!gamesState.firebaseReady) return;
    try {
        const { collection, query, orderBy, limit: limitFn, onSnapshot } = gamesState.firestore;
        const memCol = collection(gamesState.db, 'leaderboard_memory');
        const chCol = collection(gamesState.db, 'leaderboard_challenge');
        const memQ = query(memCol, orderBy('score', 'desc'), limitFn(10));
        const chQ = query(chCol, orderBy('score', 'desc'), limitFn(10));

        onSnapshot(memQ, snapshot => {
            const entries = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            renderTableFromEntries('leaderboard-memory', entries);
        }, err => console.warn('Error snapshot leaderboard_memory', err));

        onSnapshot(chQ, snapshot => {
            const entries = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            renderTableFromEntries('leaderboard-challenge', entries);
        }, err => console.warn('Error snapshot leaderboard_challenge', err));
    } catch (e) {
        console.warn('No se pudo suscribir a leaderboards en Firestore', e);
    }
}

// --- Leaderboard helpers (localStorage-backed) ---
function getAuthUserFromLocal() {
    try {
        const raw = localStorage.getItem('authUser');
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (e) {
        return null;
    }
}

function loadLeaderboard(game) {
    try {
        const raw = localStorage.getItem('leaderboard_' + game) || '[]';
        return JSON.parse(raw);
    } catch (e) {
        return [];
    }
}

function saveLeaderboard(game, entries) {
    try {
        localStorage.setItem('leaderboard_' + game, JSON.stringify(entries));
    } catch (e) {
        console.warn('No se pudo guardar leaderboard', e);
    }
}
// Fallback local save (keeps previous behavior)
async function addScoreLocal(game, scoreValue, details = {}) {
    const user = getAuthUserFromLocal();
    if (!user) return false;
    const entries = loadLeaderboard(game);
    const entry = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2,8),
        uid: user.uid || null,
        name: user.displayName || user.email || 'Jugador',
        email: user.email || null,
        score: Number(scoreValue) || 0,
        details: details || {},
        when: new Date().toISOString()
    };
    entries.push(entry);
    // sort: higher score first
    entries.sort((a,b) => b.score - a.score);
    // keep top 50
    saveLeaderboard(game, entries.slice(0, 50));
    return true;
}

// Primary addScore: try Firestore when available and user is authenticated there,
// otherwise fall back to local storage.
async function addScore(game, scoreValue, details = {}) {
    // If Firestore is available, prefer writing there (requires Firebase Auth)
    if (gamesState.firebaseReady) {
        if (gamesState.user && gamesState.user.uid) {
            try {
                const { collection, addDoc, serverTimestamp } = gamesState.firestore;
                const colName = game === 'memory' ? 'leaderboard_memory' : 'leaderboard_challenge';
                await gamesState.firestore.addDoc(gamesState.firestore.collection(gamesState.db, colName), {
                    uid: gamesState.user.uid,
                    name: gamesState.user.displayName || gamesState.user.email || 'Jugador',
                    email: gamesState.user.email || null,
                    score: Number(scoreValue) || 0,
                    details: details || {},
                    when: gamesState.firestore.serverTimestamp()
                });
                return true;
            } catch (e) {
                console.warn('No se pudo guardar en Firestore, usando fallback local', e);
                return await addScoreLocal(game, scoreValue, details);
            }
        }
        // Firestore available but user not authenticated => do not write remotely
        return false;
    }

    // No Firestore available: use local fallback
    return await addScoreLocal(game, scoreValue, details);
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function getIsoFromWhen(when) {
    if (!when) return '';
    try {
        if (typeof when === 'string') return when;
        if (when.toDate && typeof when.toDate === 'function') return when.toDate().toISOString();
        if (when.seconds) return new Date(when.seconds * 1000).toISOString();
        return String(when);
    } catch (e) { return String(when); }
}

function renderTableFromEntries(tableId, entries) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    if (!tbody) return;
    tbody.innerHTML = (entries || []).map((e, i) => `\n        <tr>\n            <td>${i+1}</td>\n            <td>${escapeHtml(e.name || '')}</td>\n            <td>${escapeHtml(String(e.score || ''))}</td>\n            <td>${escapeHtml(formatDateShort(getIsoFromWhen(e.when) || ''))}</td>\n        </tr>`).join('');
}

function formatDateShort(iso) {
    try {
        const d = new Date(iso);
        return d.toLocaleString();
    } catch (e) { return iso; }
}

function renderLeaderboardTable(game, tableId) {
    const entries = loadLeaderboard(game) || [];
    renderTableFromEntries(tableId, entries);
}

async function renderLeaderboards() {
    // If Firestore is available, the onSnapshot subscription will update tables in realtime.
    // Attempt a one-shot fetch when Firestore is ready; otherwise render local fallback.
    if (gamesState.firebaseReady) {
        try {
            const { collection, query, orderBy, limit: limitFn, getDocs } = gamesState.firestore;
            const memCol = collection(gamesState.db, 'leaderboard_memory');
            const chCol = collection(gamesState.db, 'leaderboard_challenge');
            const memQ = query(memCol, orderBy('score', 'desc'), limitFn(10));
            const chQ = query(chCol, orderBy('score', 'desc'), limitFn(10));
            const [memSnap, chSnap] = await Promise.all([
                gamesState.firestore.getDocs(memQ),
                gamesState.firestore.getDocs(chQ)
            ]);
            renderTableFromEntries('leaderboard-memory', memSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            renderTableFromEntries('leaderboard-challenge', chSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            return;
        } catch (e) {
            console.warn('No se pudo leer leaderboards de Firestore:', e);
        }
    }

    // Fallback to local storage
    renderLeaderboardTable('memory', 'leaderboard-memory');
    renderLeaderboardTable('challenge', 'leaderboard-challenge');
}

function initializeAppControls() {
    if (clearCacheButton) {
        clearCacheButton.addEventListener("click", handleCacheReset);
    }

    if (updateAppButton) {
        updateAppButton.addEventListener("click", applyPendingUpdate);
    }

    window.addEventListener("online", updateOfflineAvailability);
    window.addEventListener("offline", updateOfflineAvailability);
    window.addEventListener("focus", checkForServiceWorkerUpdate);
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
            checkForServiceWorkerUpdate();
        }
    });

    updateOfflineAvailability();
}

async function registerServiceWorker() {
    if (!("serviceWorker" in navigator) || window.location.protocol === "file:") {
        setOfflineStatus(
            window.location.protocol === "file:"
                ? "Sin conexión no disponible con archivo local"
                : "Sin conexión no disponible en este navegador",
            "warning"
        );
        setCacheFeedback("Abrí esta app desde un servidor web para activar el modo offline y las actualizaciones.");
        if (clearCacheButton) {
            clearCacheButton.disabled = true;
        }
        return;
    }

    navigator.serviceWorker.addEventListener("controllerchange", () => {
        updateOfflineAvailability();

        if (!isApplyingServiceWorkerUpdate) {
            return;
        }

        sessionStorage.setItem(UPDATE_APPLIED_FLAG, "1");
        window.location.reload();
    });

    try {
        serviceWorkerRegistration = await navigator.serviceWorker.register("./sw.js");
        bindServiceWorkerLifecycle(serviceWorkerRegistration);
        await updateOfflineAvailability();
        checkForServiceWorkerUpdate();
    } catch (error) {
        setOfflineStatus("No se pudo activar el modo offline", "danger");
        setCacheFeedback("Falló el registro del modo offline. Revisá la conexión y volvé a cargar.");
        console.error("No se pudo registrar el service worker.", error);
    }
}

function openView(viewId) {
    stopMemoryTimer();
    clearMemoryResolveTimeout();

    if (viewId !== "challenge-view") {
        closeTriviaModal();
        clearChallengeAdvanceTimeout();
        challengeState.triviaMode = false;
        challengeState.currentTriviaCard = null;
        challengeState.currentTriviaQuestions = [];
        enableChallengeBoard();
    }
    
    viewElements.forEach(view => {
        view.classList.toggle("view--active", view.id === viewId);
    });
    
    if (viewId === "memory-view") {
        resetMemoryGame();
    }
    
    if (viewId === "challenge-view") {
        resetChallengeGame();
    }
}

function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function setNotice(element, message, type) {
    element.className = `notice notice--${type}`;
    element.textContent = message;
}

function normalizeRefreshUrl() {
    const url = new URL(window.location.href);

    if (!url.searchParams.has("refresh")) {
        return;
    }

    url.searchParams.delete("refresh");
    window.history.replaceState({}, "", url.toString());
}

function showAppliedUpdateFeedback() {
    if (!sessionStorage.getItem(UPDATE_APPLIED_FLAG)) {
        return;
    }

    sessionStorage.removeItem(UPDATE_APPLIED_FLAG);
    setCacheFeedback("La webapp ya está actualizada con la versión más reciente.");
}

function setOfflineStatus(message, tone) {
    if (!offlineStatus || !offlineStatusLabel) {
        return;
    }

    offlineStatus.className = `status-pill status-pill--${tone}`;
    offlineStatusLabel.textContent = message;
}

function setUpdateStatus(message, tone = "warning") {
    if (!updateStatus || !updateStatusLabel) {
        return;
    }

    updateStatus.className = `status-pill status-pill--${tone}`;
    updateStatusLabel.textContent = message;
}

function setCacheFeedback(message) {
    if (cacheFeedback) {
        cacheFeedback.textContent = message;
    }
}

async function isOfflineReady() {
    if (!("caches" in window)) {
        return false;
    }

    const cacheNames = await caches.keys();
    const shellCacheName = cacheNames.find(cacheName => cacheName.startsWith(APP_SHELL_CACHE_PREFIX));

    if (!shellCacheName) {
        return false;
    }

    const cache = await caches.open(shellCacheName);
    const cachedFiles = await Promise.all(
        OFFLINE_REQUIRED_FILES.map(file => cache.match(file, { ignoreSearch: true }))
    );

    return cachedFiles.every(Boolean);
}

async function updateOfflineAvailability() {
    if (window.location.protocol === "file:") {
        setOfflineStatus("Sin conexión no disponible con archivo local", "warning");
        return;
    }

    if (!("serviceWorker" in navigator) || !("caches" in window)) {
        setOfflineStatus("Sin conexión no disponible en este navegador", "warning");
        return;
    }

    try {
        const ready = await isOfflineReady();

        if (ready && navigator.onLine) {
            setOfflineStatus("Disponible sin conexión", "success");
            return;
        }

        if (ready && !navigator.onLine) {
            setOfflineStatus("Abierta sin conexión", "success");
            return;
        }

        if (!ready && navigator.onLine) {
            setOfflineStatus("Guardado offline pendiente", "pending");
            return;
        }

        setOfflineStatus("Sin copia offline guardada", "danger");
    } catch (error) {
        setOfflineStatus("No pudimos verificar el modo offline", "warning");
    }
}

function showUpdateNotice(
    title = "Nueva versión disponible.",
    description = "Ya hay una actualización lista para aplicar en esta webapp."
) {
    pendingServiceWorker = serviceWorkerRegistration?.waiting || pendingServiceWorker;

    if (updateStatus) {
        updateStatus.classList.remove("is-hidden");
        setUpdateStatus("Nueva versión lista para actualizar");
    }

    if (updateBanner) {
        updateBanner.classList.remove("is-hidden");
    }

    if (updateBannerTitle) {
        updateBannerTitle.textContent = title;
    }

    if (updateBannerText) {
        updateBannerText.textContent = description;
    }
}

function hideUpdateNotice() {
    pendingServiceWorker = null;

    if (updateStatus) {
        updateStatus.classList.add("is-hidden");
    }

    if (updateBanner) {
        updateBanner.classList.add("is-hidden");
    }
}

function bindServiceWorkerLifecycle(registration) {
    if (registration.waiting && navigator.serviceWorker.controller) {
        pendingServiceWorker = registration.waiting;
        showUpdateNotice();
    }

    registration.addEventListener("updatefound", () => {
        const installingWorker = registration.installing;

        if (!installingWorker) {
            return;
        }

        installingWorker.addEventListener("statechange", () => {
            if (installingWorker.state !== "installed") {
                return;
            }

            updateOfflineAvailability();

            if (!navigator.serviceWorker.controller) {
                setCacheFeedback("La copia offline ya quedó guardada en este dispositivo.");
                return;
            }

            pendingServiceWorker = registration.waiting || installingWorker;
            showUpdateNotice();
            setCacheFeedback("Hay una nueva versión lista para actualizar.");
        });
    });
}

function checkForServiceWorkerUpdate() {
    if (!serviceWorkerRegistration || !navigator.onLine) {
        return;
    }

    if (serviceWorkerRegistration.waiting && navigator.serviceWorker.controller) {
        pendingServiceWorker = serviceWorkerRegistration.waiting;
        showUpdateNotice();
        return;
    }

    serviceWorkerRegistration.update().catch(() => {});
}

function applyPendingUpdate() {
    if (updateAppButton) {
        updateAppButton.disabled = true;
    }

    const waitingWorker = serviceWorkerRegistration?.waiting || pendingServiceWorker;

    if (!waitingWorker) {
        setCacheFeedback("Buscando la última versión disponible…");
        checkForServiceWorkerUpdate();

        window.setTimeout(() => {
            if (updateAppButton) {
                updateAppButton.disabled = false;
            }
        }, 1200);
        return;
    }

    isApplyingServiceWorkerUpdate = true;
    setCacheFeedback("Aplicando la nueva versión de la webapp…");
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
}

async function handleCacheReset() {
    if (!clearCacheButton) {
        return;
    }

    if (!navigator.onLine) {
        setCacheFeedback("Necesitás conexión para limpiar la caché y descargar la versión más reciente.");
        return;
    }

    const originalLabel = clearCacheButton.textContent;
    clearCacheButton.disabled = true;
    clearCacheButton.textContent = "Limpiando…";
    hideUpdateNotice();
    setCacheFeedback("Limpiando la caché local y recargando la versión más reciente…");

    try {
        if ("serviceWorker" in navigator) {
            const registration = await navigator.serviceWorker.getRegistration("./");

            if (registration) {
                await registration.unregister();
            }
        }

        if ("caches" in window) {
            const cacheNames = await caches.keys();
            await Promise.all(
                cacheNames
                    .filter(cacheName => cacheName.startsWith("rosario-"))
                    .map(cacheName => caches.delete(cacheName))
            );
        }

        sessionStorage.removeItem(UPDATE_APPLIED_FLAG);

        const refreshUrl = new URL(window.location.href);
        refreshUrl.searchParams.set("refresh", Date.now().toString());
        window.location.replace(refreshUrl.toString());
    } catch (error) {
        clearCacheButton.disabled = false;
        clearCacheButton.textContent = originalLabel;
        setCacheFeedback("No se pudo limpiar la caché. Probá otra vez.");
    }
}

function createGameCard(frontContentFn) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "game-card";

    const inner = document.createElement("div");
    inner.className = "game-card__inner";

    // Back face
    const back = document.createElement("div");
    back.className = "game-card__face game-card__face--back";

    const brand = document.createElement("div");
    brand.className = "game-card__brand";

    const logo = document.createElement("img");
    logo.className = "game-card__back-logo";
    logo.alt = "El Mago de los Tours";

    const fallback = document.createElement("span");
    fallback.className = "game-card__back-fallback";
    fallback.textContent = "El Mago de los Tours";
    fallback.hidden = true;

    let logoIndex = 0;
    const loadLogo = () => {
        logo.src = logoSources[logoIndex];
    };

    logo.addEventListener("error", () => {
        logoIndex++;
        if (logoIndex < logoSources.length) {
            loadLogo();
        } else {
            logo.remove();
            fallback.hidden = false;
        }
    });

    loadLogo();
    brand.appendChild(logo);
    brand.appendChild(fallback);
    back.appendChild(brand);

    // Front face
    const front = document.createElement("div");
    front.className = "game-card__face game-card__face--front";
    frontContentFn(front);

    inner.appendChild(back);
    inner.appendChild(front);
    btn.appendChild(inner);

    return btn;
}

// Functions - Memory Game
function buildMemoryBoard() {
    // Create card data: flatten memoryData into image + text pairs
    const cards = memoryData.flatMap((item, idx) => [
        {
            id: `image-${idx}`,
            pairId: idx,
            type: "image",
            imagen: item.imagen,
            referencia: item.referencia
        },
        {
            id: `text-${idx}`,
            pairId: idx,
            type: "text",
            imagen: item.imagen,
            referencia: item.referencia
        }
    ]);

    memoryState.cards = shuffle(cards);
    memoryBoard.innerHTML = "";
    memoryBoard.classList.remove("is-locked");

    memoryState.cards.forEach(cardData => {
        const cardElement = createGameCard(frontFace => {
            if (cardData.type === "image") {
                frontFace.classList.add("memory-face--image");
                const img = document.createElement("img");
                img.src = cardData.imagen;
                img.alt = cardData.referencia;
                frontFace.appendChild(img);
            } else {
                frontFace.classList.add("memory-face--text");
                const txt = document.createElement("span");
                txt.textContent = cardData.referencia;
                frontFace.appendChild(txt);
            }
        });

        cardElement.addEventListener("click", () => {
            handleMemoryCardClick(cardElement, cardData);
        });

        memoryBoard.appendChild(cardElement);
    });
}

function handleMemoryCardClick(cardElement, cardData) {
    if (!memoryState.started || memoryState.lockBoard) return;
    if (cardElement.classList.contains("is-flipped") || cardElement.classList.contains("is-matched")) return;

    cardElement.classList.add("is-flipped");
    memoryState.selected.push({ element: cardElement, data: cardData });

    if (memoryState.selected.length < 2) return;

    memoryState.lockBoard = true;

    memoryState.resolveTimeoutId = window.setTimeout(() => {
        const [firstCard, secondCard] = memoryState.selected;

        if (!firstCard || !secondCard) {
            memoryState.lockBoard = false;
            memoryState.resolveTimeoutId = null;
            return;
        }

        const isMatch = firstCard.data.pairId === secondCard.data.pairId;

        if (isMatch) {
            setTimeout(() => {
                firstCard.element.classList.add("is-matched");
                secondCard.element.classList.add("is-matched");
                memoryState.matchedPairs++;
                updateMemoryProgress();
                setNotice(memoryFeedback, "¡Pareja encontrada! Seguí así.", "success");

                if (memoryState.matchedPairs === memoryData.length) {
                    endMemoryGame(true);
                }

                memoryState.selected = [];
                memoryState.lockBoard = false;
                memoryState.resolveTimeoutId = null;
            }, 600);
        } else {
            setTimeout(() => {
                firstCard.element.classList.remove("is-flipped");
                secondCard.element.classList.remove("is-flipped");
                setNotice(memoryFeedback, "No coinciden. Probá otra combinación.", "danger");

                memoryState.selected = [];
                memoryState.lockBoard = false;
                memoryState.resolveTimeoutId = null;
            }, 600);
        }
    }, 1000);
}

function startMemoryGame() {
    stopMemoryTimer();
    clearMemoryResolveTimeout();

    memoryState.started = true;
    memoryState.lockBoard = false;
    memoryState.selected = [];
    memoryState.matchedPairs = 0;
    memoryState.timeRemaining = 120;

    buildMemoryBoard();
    updateMemoryTime();
    updateMemoryProgress();

    setNotice(memoryFeedback, "El tablero está activo. Buscá cada pareja antes de que termine el tiempo.", "warning");

    memoryState.timerId = window.setInterval(() => {
        memoryState.timeRemaining--;
        updateMemoryTime();

        if (memoryState.timeRemaining <= 0) {
            endMemoryGame(false);
        }
    }, 1000);
}

function resetMemoryGame() {
    stopMemoryTimer();
    clearMemoryResolveTimeout();

    memoryState.started = false;
    memoryState.lockBoard = false;
    memoryState.selected = [];
    memoryState.matchedPairs = 0;
    memoryState.timeRemaining = 120;

    buildMemoryBoard();
    updateMemoryTime();
    updateMemoryProgress();

    setNotice(memoryFeedback, "Presioná iniciar para comenzar una nueva ronda de memoria.", "neutral");
}

async function endMemoryGame(hasWon) {
    stopMemoryTimer();
    clearMemoryResolveTimeout();

    memoryState.started = false;
    memoryState.lockBoard = true;
    memoryBoard.classList.add("is-locked");

    if (hasWon) {
        // Attempt to save score (time remaining) if user is logged
        try {
            const saved = await addScore('memory', memoryState.timeRemaining, { pairs: memoryState.matchedPairs });
            if (saved) {
                setNotice(memoryFeedback, `¡Excelente! Encontraste las 12 parejas antes de que terminara el tiempo. Puntaje guardado (${memoryState.timeRemaining} s).`, "success");
            } else {
                setNotice(memoryFeedback, "¡Excelente! Encontraste las 12 parejas antes de que terminara el tiempo. Iniciá sesión para guardar tu puntaje.", "success");
            }
        } catch (e) {
            console.warn('Error guardando puntaje memoria:', e);
        }
        try { renderLeaderboards(); } catch (e) {}
    } else {
        setNotice(memoryFeedback, "Se terminó el tiempo. Reiniciá la ronda para volver a intentarlo.", "danger");
    }
}

function updateMemoryTime() {
    memoryTime.textContent = `${Math.max(memoryState.timeRemaining, 0)} s`;
}

function updateMemoryProgress() {
    memoryProgress.textContent = `${memoryState.matchedPairs} / ${memoryData.length}`;
}

function stopMemoryTimer() {
    if (memoryState.timerId) {
        clearInterval(memoryState.timerId);
        memoryState.timerId = null;
    }
}

function clearMemoryResolveTimeout() {
    if (memoryState.resolveTimeoutId) {
        clearTimeout(memoryState.resolveTimeoutId);
        memoryState.resolveTimeoutId = null;
    }
}

// Functions - Challenge Game
function buildChallengeBoard() {
    challengeBoard.innerHTML = "";
    challengeBoard.classList.remove("is-locked");
    challengeState.selectedWords = [];
    challengeState.selectedIds = new Set();
    challengeState.triviaMode = false;
    challengeState.roundComplete = false;

    // Create 3 word cards + 6 trivia cards = 9 total
    const wordCards = challengeWordSequence.map((word, idx) => ({
        id: `word-${idx}`,
        type: "word",
        word: word,
        index: idx
    }));

    const triviaCards = triviaDecks.map((deck, idx) => ({
        id: `trivia-${idx}`,
        type: "trivia",
        deck: deck,
        deckIndex: idx
    }));

    challengeState.cards = shuffle([...wordCards, ...triviaCards]);

    challengeState.cards.forEach(cardData => {
        const cardElement = createGameCard(frontFace => {
            if (cardData.type === "word") {
                frontFace.classList.add("word-face");
                const wordSpan = document.createElement("span");
                wordSpan.className = "word-face__label";
                wordSpan.textContent = cardData.word;
                frontFace.appendChild(wordSpan);
            } else {
                frontFace.classList.add("trivia-face");
                const triviaSpan = document.createElement("span");
                triviaSpan.className = "trivia-face__label";
                triviaSpan.textContent = cardData.deck.label;
                frontFace.appendChild(triviaSpan);
            }
        });

        cardElement.addEventListener("click", () => {
            handleChallengeCardClick(cardElement, cardData);
        });

        challengeBoard.appendChild(cardElement);
    });

    updateChallengeProgress();
}

function handleChallengeCardClick(cardElement, cardData) {
    if (cardElement.classList.contains("is-flipped") || challengeState.triviaMode || challengeState.roundComplete) return;

    cardElement.classList.add("is-flipped");

    if (cardData.type === "word") {
        if (!challengeState.selectedIds.has(cardData.index)) {
            challengeState.selectedIds.add(cardData.index);
            challengeState.selectedWords.push(cardData.word);
            updateChallengeProgress();

            if (challengeState.selectedWords.join("") === challengeWordSequence.join("")) {
                finishChallengeRound("¡Ganaste! Encontraste la frase 'Rosario Te Guío' en orden.", "success");
            } else if (challengeState.selectedWords.length === 3) {
                finishChallengeRound("¡Encontraste las 3 palabras! (Pero no en orden)", "warning");
            } else {
                setNotice(challengeFeedback, `Palabra encontrada: ${cardData.word}`, "neutral");
            }
        }
    } else {
        // Trivia card clicked
        startTriviaMode(cardElement, cardData);
    }
}

function startTriviaMode(cardElement, cardData) {
    challengeState.triviaMode = true;
    challengeState.currentTriviaCard = cardData;
    challengeState.currentTriviaQuestions = shuffle(cardData.deck.questions);
    challengeState.currentQuestionIndex = 0;
    challengeState.triviaScore = 0;
    challengeState.triviaTotalQuestions = challengeState.currentTriviaQuestions.length;

    // Disable challenge board
    disableChallengeBoard();

    // Show first trivia question
    showTriviaQuestion();
}

function showTriviaQuestion() {
    const questionIndex = challengeState.currentQuestionIndex;
    const question = challengeState.currentTriviaQuestions[questionIndex];

    if (!question) {
        endTriviaMode();
        return;
    }

    // Create trivia container
    const triviaContainer = document.createElement("div");
    triviaContainer.className = "trivia-container";
    triviaContainer.id = "trivia-modal";

    const questionText = document.createElement("div");
    questionText.className = "trivia-question";
    questionText.textContent = question.text;

    const optionsContainer = document.createElement("div");
    optionsContainer.className = "trivia-options";

    // Randomize options order
    const randomizedOptions = shuffle(question.options);

    randomizedOptions.forEach(option => {
        const optionBtn = document.createElement("button");
        optionBtn.className = "trivia-option";
        optionBtn.textContent = option.text;
        optionBtn.addEventListener("click", () => {
            handleTriviaAnswer(optionBtn, option, question);
        });
        optionsContainer.appendChild(optionBtn);
    });

    triviaContainer.appendChild(questionText);
    triviaContainer.appendChild(optionsContainer);

    // Add to page
    document.body.appendChild(triviaContainer);

    // Update progress
    const progressEl = document.createElement("div");
    progressEl.className = "trivia-progress";
    progressEl.textContent = `Pregunta ${questionIndex + 1} de ${challengeState.triviaTotalQuestions}`;
    triviaContainer.insertBefore(progressEl, optionsContainer);
}

function handleTriviaAnswer(optionBtn, selectedOption, question) {
    // Disable all options
    const triviaContainer = document.getElementById("trivia-modal");
    const options = triviaContainer.querySelectorAll(".trivia-option");
    options.forEach(opt => opt.disabled = true);

    if (selectedOption.correct) {
        optionBtn.classList.add("trivia-option--correct");
        challengeState.triviaScore++;
        setNotice(challengeFeedback, "¡Respuesta correcta!", "success");
    } else {
        optionBtn.classList.add("trivia-option--incorrect");
        // Find and highlight correct answer
        options.forEach(opt => {
            if (opt.textContent === question.options.find(o => o.correct).text) {
                opt.classList.add("trivia-option--correct");
            }
        });
        setNotice(challengeFeedback, "Respuesta incorrecta. La opción correcta está resaltada.", "danger");
    }

    const hasReference = Boolean(question.reference && question.reference.trim());
    const hasSource = Boolean(question.source && question.source.trim());

    if (hasReference || hasSource) {
        const refContainer = document.createElement("div");
        refContainer.className = "trivia-reference";

        if (hasReference) {
            const refTitle = document.createElement("strong");
            refTitle.textContent = "Información adicional:";
            const refText = document.createElement("p");
            refText.textContent = question.reference;
            refContainer.appendChild(refTitle);
            refContainer.appendChild(refText);
        }

        if (hasSource) {
            const sourceText = document.createElement("p");
            sourceText.className = "trivia-source";
            sourceText.textContent = `Fuente: ${question.source}`;
            refContainer.appendChild(sourceText);
        }

        triviaContainer.appendChild(refContainer);

        const actions = document.createElement("div");
        actions.className = "trivia-actions";

        const nextButton = document.createElement("button");
        nextButton.type = "button";
        nextButton.className = "primary-button";
        nextButton.textContent = challengeState.currentQuestionIndex === challengeState.triviaTotalQuestions - 1
            ? "Ver resultado"
            : "Siguiente pregunta";
        nextButton.addEventListener("click", advanceTriviaQuestion);

        actions.appendChild(nextButton);
        triviaContainer.appendChild(actions);
        return;
    }

    challengeState.advanceTimeoutId = window.setTimeout(() => {
        advanceTriviaQuestion();
    }, 3000);
}

async function endTriviaMode() {
    challengeState.triviaMode = false;
    challengeState.currentTriviaCard = null;
    challengeState.currentTriviaQuestions = [];
    clearChallengeAdvanceTimeout();
    const finalScore = challengeState.triviaScore;
    const totalQuestions = challengeState.triviaTotalQuestions;
    // Attempt to save challenge score (number of correct answers) if user logged
    try {
        const saved = await addScore('challenge', finalScore, { totalQuestions });
        if (saved) {
            finishChallengeRound(
                `¡Trivia completada! Acertaste ${finalScore} de ${totalQuestions} preguntas. Puntaje guardado.`,
                finalScore === totalQuestions ? "success" : "warning"
            );
        } else {
            finishChallengeRound(
                `¡Trivia completada! Acertaste ${finalScore} de ${totalQuestions} preguntas. Iniciá sesión para guardar tu puntaje.`,
                finalScore === totalQuestions ? "success" : "warning"
            );
        }
    } catch (e) {
        console.warn('Error guardando puntaje desafío:', e);
        finishChallengeRound(
            `¡Trivia completada! Acertaste ${finalScore} de ${totalQuestions} preguntas.`,
            finalScore === totalQuestions ? "success" : "warning"
        );
    }
    try { renderLeaderboards(); } catch (e) {}
}

function resetChallengeGame() {
    closeTriviaModal();
    clearChallengeAdvanceTimeout();
    challengeState.selectedWords = [];
    challengeState.selectedIds = new Set();
    challengeState.triviaMode = false;
    challengeState.roundComplete = false;
    challengeState.currentTriviaCard = null;
    challengeState.currentTriviaQuestions = [];
    challengeState.currentQuestionIndex = 0;
    challengeState.triviaScore = 0;
    challengeState.triviaTotalQuestions = 0;

    buildChallengeBoard();
    setNotice(challengeFeedback, "Haz clic en las tarjetas para descubrir palabras o trivias.", "neutral");
}

function updateChallengeProgress() {
    challengeWordCount.textContent = `${challengeState.selectedIds.size} / 3`;
}

function disableChallengeBoard() {
    challengeBoard.classList.add("is-locked");
}

function enableChallengeBoard() {
    challengeBoard.classList.remove("is-locked");
}

function finishChallengeRound(message, type) {
    challengeState.triviaMode = false;
    challengeState.roundComplete = true;
    challengeState.currentTriviaCard = null;
    challengeState.currentTriviaQuestions = [];
    clearChallengeAdvanceTimeout();
    revealAllChallengeCards();
    disableChallengeBoard();
    setNotice(challengeFeedback, message, type);
}

function advanceTriviaQuestion() {
    const triviaContainer = document.getElementById("trivia-modal");
    clearChallengeAdvanceTimeout();

    if (triviaContainer) {
        triviaContainer.remove();
    }

    challengeState.currentQuestionIndex++;
    showTriviaQuestion();
}

function clearChallengeAdvanceTimeout() {
    if (challengeState.advanceTimeoutId) {
        clearTimeout(challengeState.advanceTimeoutId);
        challengeState.advanceTimeoutId = null;
    }
}

function closeTriviaModal() {
    const triviaContainer = document.getElementById("trivia-modal");
    if (triviaContainer) {
        triviaContainer.remove();
    }
}

function revealAllChallengeCards() {
    const cardElements = challengeBoard.querySelectorAll(".game-card");
    cardElements.forEach(cardElement => {
        cardElement.classList.add("is-flipped");
    });
}
