import { fallbackAgenda, fallbackReviews, firebaseConfig } from "./firebase-config.js";

const WHATSAPP_PHONE = "5493413504208";
const FIREBASE_VERSION = "12.14.0";

const state = {
    app: null,
    analytics: null,
    auth: null,
    db: null,
    firestore: null,
    authFns: null,
    user: null,
    firebaseReady: false
};

// Map of tour title -> { description, duration }
let toursMap = {};

initViews();
initPwaInstallPrompt();
registerServiceWorker();
initWhatsappButtons();
initForms();
initFirebase();

function initViews() {
    const views = Array.from(document.querySelectorAll("[data-view]"));
    const links = Array.from(document.querySelectorAll("[data-view-link]"));

    const showView = viewName => {
        const target = views.find(view => view.dataset.view === viewName) || views[0];
        if (!target) return;

        views.forEach(view => {
            view.classList.toggle("is-active", view === target);
        });

        links.forEach(link => {
            link.classList.toggle("is-active", link.dataset.viewLink === target.dataset.view);
        });

        document.body.dataset.currentView = target.dataset.view;
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    links.forEach(link => {
        link.addEventListener("click", event => {
            event.preventDefault();
            const viewName = link.dataset.viewLink;
            history.pushState(null, "", `#${viewName}`);
            showView(viewName);
        });
    });

    // Ensure the Juegos link always navigates to juegos.html (avoid SPA interception)
    const juegosLink = document.getElementById("nav-juegos");
    if (juegosLink) {
        juegosLink.addEventListener("click", event => {
            event.preventDefault();
            window.location.href = juegosLink.getAttribute("href");
        });
    }

    window.addEventListener("popstate", () => {
        showView(getHashView());
    });

    showView(getHashView());
}

function getHashView() {
    return window.location.hash.replace("#", "") || "inicio";
}

let deferredInstallPrompt = null;

function initPwaInstallPrompt() {
    const installButton = document.getElementById("install-app-btn");
    if (!installButton) return;

    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
    if (isStandalone) {
        installButton.hidden = true;
        return;
    }

    window.addEventListener("beforeinstallprompt", event => {
        event.preventDefault();
        deferredInstallPrompt = event;
        installButton.hidden = false;
    });

    installButton.addEventListener("click", async () => {
        if (!deferredInstallPrompt) return;

        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        installButton.hidden = true;
    });

    window.addEventListener("appinstalled", () => {
        deferredInstallPrompt = null;
        installButton.hidden = true;
    });
}

function registerServiceWorker() {
    if (!("serviceWorker" in navigator) || window.location.protocol === "file:") return;

    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./sw.js").catch(error => {
            console.warn("No se pudo registrar el service worker.", error);
        });
    });
}

function initWhatsappButtons() {
    document.querySelectorAll("[data-whatsapp-tour]").forEach(button => {
        // Skip buttons that are inside a tour card (those open the booking form instead)
        if (button.closest('.tour-card')) return;
        button.addEventListener("click", () => {
            const tour = button.dataset.whatsappTour;
            openWhatsapp(`Hola Ignacio, quiero consultar por el recorrido "${tour}".`);
        });
    });
}

function initForms() {
    const bookingForm = document.getElementById("booking-form");
    const suggestionForm = document.getElementById("suggestion-form");
    const reviewForm = document.getElementById("review-form");

    bookingForm?.addEventListener("submit", handleBookingSubmit);
    suggestionForm?.addEventListener("submit", handleSuggestionSubmit);
    reviewForm?.addEventListener("submit", handleReviewSubmit);

    document.getElementById("register-user-btn")?.addEventListener("click", handleRegister);
    document.getElementById("login-user-btn")?.addEventListener("click", handleLogin);
    document.getElementById("logout-user-btn")?.addEventListener("click", () => {
        state.authFns?.signOut(state.auth);
    });

    initPasswordToggles();

    // Price display/update handlers for the booking form
    const durationSelect = document.getElementById("booking-duration");
    const peopleInput = document.getElementById("booking-people");

    if (durationSelect) {
        durationSelect.addEventListener("change", () => {
            const selected = durationSelect.selectedOptions?.[0];
            const price = selected?.dataset?.price || "";
            const priceInput = document.getElementById("booking-price");
            if (priceInput) priceInput.value = price || "";
            updateBookingPriceUI(price || "");
        });
    }

    if (peopleInput) {
        peopleInput.addEventListener("input", () => {
            const price = document.getElementById("booking-price")?.value || "";
            updateBookingPriceUI(price || "");
        });
        peopleInput.addEventListener("change", () => {
            const price = document.getElementById("booking-price")?.value || "";
            updateBookingPriceUI(price || "");
        });
    }

    document.getElementById("booking-modal-close")?.addEventListener("click", closeBookingModal);
    document.getElementById("booking-modal-backdrop")?.addEventListener("click", closeBookingModal);
    window.addEventListener("keydown", event => {
        if (event.key === "Escape") closeBookingModal();
    });

    // Build map of tours (title -> description, duration) from the Recorridos cards
    buildToursMap();

    // When user selects a tour from the dropdown, reveal the rest of the form
    const bookingTourSelect = document.getElementById("booking-tour");
    if (bookingTourSelect) {
        bookingTourSelect.addEventListener("change", () => {
            handleTourSelection(bookingTourSelect.value);
        });
    }

    // Make 'Reservar' buttons inside tour cards open the booking flow (instead of direct WhatsApp)
    document.querySelectorAll('.tour-card [data-whatsapp-tour]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const tour = btn.dataset.whatsappTour;
            showBookingForTour(tour);
        });
    });
}

function buildToursMap() {
    toursMap = {};
    document.querySelectorAll('.tour-card').forEach(card => {
        const body = card.querySelector('.tour-card__body') || card;
        const titleEl = body.querySelector('h3');
        const descEl = body.querySelector('p');
        const spans = Array.from(body.querySelectorAll('span'));
        const title = titleEl?.textContent?.trim() || null;
        if (!title) return;

        // Find the span that contains 'Tiempo estimado'
        const timeSpan = spans.find(s => /tiempo estimado/i.test(s.textContent || ''));
        const durationText = timeSpan ? timeSpan.textContent.replace(/Tiempo estimado:\s*/i, '').trim() : '';

        toursMap[title] = {
            description: descEl?.textContent?.trim() || '',
            duration: durationText
        };
    });
}

function normalizeDurationString(text) {
    if (!text) return '';
    const s = String(text).toLowerCase();
    if (s.includes('tres') || s.includes('3 horas') || s.includes('3 hora')) return '3 horas';
    if (s.includes('hora y media') || s.includes('1 hora y media') || s.includes('una hora y media')) return '2 horas';
    if (s.includes('dos') || s.includes('2 horas') || s.includes('2 hora')) return '2 horas';
    if (s.includes('hora')) return '1 hora';
    return text;
}

function handleTourSelection(tour) {
    const descEl = document.getElementById('booking-tour-description');
    const bookingFields = document.getElementById('booking-fields');
    const durationSelect = document.getElementById('booking-duration');

    if (!tour) {
        if (descEl) descEl.hidden = true;
        if (bookingFields) bookingFields.hidden = true;
        return;
    }

    const info = toursMap[tour] || {};
    if (descEl) {
        if (info.description) {
            descEl.textContent = info.description;
            descEl.hidden = false;
        } else {
            descEl.hidden = true;
        }
    }

    if (bookingFields) bookingFields.hidden = false;

    // Auto-select duration based on tour estimate
    const normalized = normalizeDurationString(info.duration || '');
    if (normalized && durationSelect) {
        let opt = Array.from(durationSelect.options).find(o => o.value === normalized);
        if (!opt) {
            opt = new Option(normalized, normalized);
            durationSelect.add(opt);
        }
        durationSelect.value = opt.value;
        durationSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // focus name field for convenience
    document.getElementById('booking-name')?.focus();
}

function showBookingForTour(tour) {
    const bookingTour = document.getElementById('booking-tour');
    if (!bookingTour) return;

    openBookingModal();
    resetBookingContext();

    // Ensure option exists
    let opt = Array.from(bookingTour.options).find(o => o.value === tour);
    if (!opt) {
        opt = new Option(tour, tour);
        bookingTour.add(opt);
    }
    bookingTour.value = tour;
    bookingTour.dispatchEvent(new Event('change', { bubbles: true }));
}

function openBookingModal() {
    const form = document.getElementById("booking-form");
    const backdrop = document.getElementById("booking-modal-backdrop");
    if (!form || !backdrop) return;

    backdrop.hidden = false;
    form.hidden = false;
    form.classList.add("is-open");
    document.body.classList.add("booking-modal-open");
}

function closeBookingModal() {
    const form = document.getElementById("booking-form");
    const backdrop = document.getElementById("booking-modal-backdrop");
    if (!form || !backdrop || form.hidden) return;

    form.classList.remove("is-open");
    form.hidden = true;
    backdrop.hidden = true;
    document.body.classList.remove("booking-modal-open");
}

function resetBookingContext() {
    document.getElementById("booking-form")?.reset();
    const fields = document.getElementById("booking-fields");
    if (fields) fields.hidden = true;
    const description = document.getElementById("booking-tour-description");
    if (description) description.hidden = true;
    const agendaInput = document.getElementById("booking-agenda-id");
    const priceInput = document.getElementById("booking-price");
    if (agendaInput) agendaInput.value = "";
    if (priceInput) priceInput.value = "";
    setText("selected-agenda-feedback", "");
    setText("form-feedback", "");
    updateBookingPriceUI("");
}

function initPasswordToggles() {
    document.querySelectorAll("[data-toggle-password]").forEach(toggle => {
        const input = document.getElementById(toggle.dataset.togglePassword);
        if (!input) return;

        toggle.addEventListener("change", () => {
            input.type = toggle.checked ? "text" : "password";
        });
    });
}

async function initFirebase() {
    try {
        const [appMod, analyticsMod, authMod, firestoreMod] = await Promise.all([
            import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
            import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-analytics.js`),
            import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`),
            import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`)
        ]);

        state.app = appMod.initializeApp(firebaseConfig);
        state.auth = authMod.getAuth(state.app);
        state.db = firestoreMod.getFirestore(state.app);
        state.firestore = firestoreMod;
        state.authFns = authMod;
        state.firebaseReady = true;

        analyticsMod.isSupported()
            .then(supported => {
                if (supported) state.analytics = analyticsMod.getAnalytics(state.app);
            })
            .catch(() => {});

        authMod.onAuthStateChanged(state.auth, user => {
            state.user = user;
            updateAuthUI(user);
        });

        subscribeAgenda();
        subscribeReviews();
        loadPaymentConfig();
    } catch (error) {
        console.warn("Firebase no está disponible. La página conserva las funciones públicas.", error);
        renderAgenda(fallbackAgenda);
        renderReviews(fallbackReviews);
        setText("auth-status", "Firebase no está disponible ahora. Podés seguir consultando por WhatsApp.");
    }
}

async function handleBookingSubmit(event) {
    event.preventDefault();

    const feedback = document.getElementById("form-feedback");
    const priceDetails = getBookingPriceDetails();
    const people = Math.max(1, Number(getValue("booking-people") || 1));
    const payload = {
        name: getValue("booking-name"),
        email: getValue("booking-email"),
        phone: getValue("booking-phone"),
        tour: getValue("booking-tour"),
        agendaId: getValue("booking-agenda-id"),
        date: getValue("booking-date") || "A coordinar",
        people,
        duration: getValue("booking-duration"),
        pricePerPerson: priceDetails.pricePerPerson,
        priceTotal: priceDetails.total,
        priceLabel: priceDetails.label,
        source: getValue("booking-agenda-id") ? "agenda" : "recorrido",
        message: getValue("booking-message"),
        uid: state.user?.uid || null
    };

    if (!payload.name || !payload.email || !payload.phone || !payload.tour) {
        feedback.textContent = "Completá nombre, email, WhatsApp y recorrido.";
        return;
    }

    if (!state.firebaseReady) {
        feedback.textContent = "No se pudo enviar la reserva porque Firebase no está disponible ahora. Probá de nuevo en unos minutos.";
        return;
    }

    feedback.textContent = "Enviando reserva...";

    try {
        await state.firestore.addDoc(state.firestore.collection(state.db, "registrations"), {
            ...payload,
            status: "pending",
            createdAt: state.firestore.serverTimestamp()
        });

        if (payload.agendaId && state.user) {
            await reserveAgendaSpots(payload.agendaId, people);
        }

        feedback.textContent = "Reserva enviada. Te voy a contactar para confirmar disponibilidad y seña.";
        event.target.reset();
        document.getElementById("booking-fields").hidden = true;
        updateBookingPriceUI("");
        setTimeout(closeBookingModal, 1400);
    } catch (error) {
        console.warn("No se pudo guardar la reserva en Firebase.", error);
        feedback.textContent = "No se pudo guardar la reserva. Probá de nuevo en unos minutos.";
    }
}

    function parsePriceNumber(str) {
        if (!str) return null;
        const m = String(str).match(/(\d{1,3}(?:[.,]\d{3})*|\d+)/);
        if (!m) return null;
        const num = Number(m[1].replace(/[.,]/g, ""));
        return Number.isFinite(num) ? num : null;
    }

    function detectCurrency(str) {
        if (!str) return 'ARS';
        const s = String(str).toLowerCase();
        if (s.includes('dólar') || s.includes('dolar') || s.includes('usd')) return 'USD';
        if (s.includes('euro') || s.includes('eur')) return 'EUR';
        return 'ARS';
    }

    function formatCurrency(num, currency = 'ARS') {
        if (num == null) return '';
        if (currency === 'ARS') {
            return `$${String(num).replace(/\B(?=(\d{3})+(?!\d))/g, ".")} ARS`;
        }
        if (currency === 'USD') {
            return `$${String(num).replace(/\B(?=(\d{3})+(?!\d))/g, ",")} USD`;
        }
        if (currency === 'EUR') {
            return `€${String(num).replace(/\B(?=(\d{3})+(?!\d))/g, ",")} EUR`;
        }
        return `${num} ${currency}`;
    }

function updateBookingPriceUI(priceRaw) {
        const display = document.getElementById("booking-price-display");
        const priceInput = document.getElementById("booking-price");
        const peopleSelect = document.getElementById("booking-people");

        if (!display) return;

        if (!priceRaw || String(priceRaw).trim() === "") {
            display.hidden = true;
            if (priceInput) priceInput.value = "";
            return;
        }

        if (priceInput) priceInput.value = priceRaw;

        const priceNumber = parsePriceNumber(priceRaw);
        const currency = detectCurrency(priceRaw);
        const peopleNum = peopleCount(peopleSelect?.value);

        if (priceNumber) {
            const perPerson = formatCurrency(priceNumber, currency);
            const total = formatCurrency(priceNumber * peopleNum, currency);
            display.textContent = `Precio por persona: ${perPerson}. Total estimado (${peopleSelect?.value || ''}): ${total}.`;
        } else {
            display.textContent = `Precio: ${priceRaw}.`;
        }

        display.hidden = false;
    }

function getBookingPriceDetails() {
    const priceInput = document.getElementById("booking-price");
    const durationSelect = document.getElementById("booking-duration");
    const selectedOption = durationSelect?.selectedOptions?.[0];
    const priceRaw = priceInput?.value || selectedOption?.dataset?.price || "";
    const priceNumber = parsePriceNumber(priceRaw);
    const currency = detectCurrency(priceRaw);
    const people = Math.max(1, Number(getValue("booking-people") || 1));

    if (!priceNumber) {
        return {
            pricePerPerson: null,
            total: null,
            label: priceRaw ? `Precio: ${priceRaw}` : "Precio a confirmar"
        };
    }

    return {
        pricePerPerson: priceNumber,
        total: priceNumber * people,
        label: `${formatCurrency(priceNumber, currency)} por persona · ${formatCurrency(priceNumber * people, currency)} total`
    };
}

async function handleSuggestionSubmit(event) {
    event.preventDefault();

    const feedback = document.getElementById("suggestion-feedback");
    const payload = {
        name: getValue("suggestion-name"),
        contact: getValue("suggestion-contact"),
        text: getValue("suggestion-text"),
        uid: state.user?.uid || null
    };

    if (!payload.name || !payload.contact || !payload.text) {
        feedback.textContent = "Completá todos los campos para enviar la sugerencia.";
        return;
    }

    if (!state.firebaseReady) {
        feedback.textContent = "Firebase no está disponible. También podés enviarla por WhatsApp.";
        openWhatsapp(`Hola Ignacio, quiero sugerir un recorrido: ${payload.text}`);
        return;
    }

    try {
        await state.firestore.addDoc(state.firestore.collection(state.db, "suggestions"), {
            ...payload,
            status: "new",
            createdAt: state.firestore.serverTimestamp()
        });
        event.target.reset();
        feedback.textContent = "Sugerencia enviada. Gracias por sumar ideas.";
    } catch (error) {
        feedback.textContent = "No se pudo enviar. Probá por WhatsApp.";
    }
}

async function handleReviewSubmit(event) {
    event.preventDefault();

    const feedback = document.getElementById("review-feedback");

    if (!state.user) {
        feedback.textContent = "Ingresá o registrate para dejar una reseña.";
        return;
    }

    if (!state.firebaseReady) {
        feedback.textContent = "Firebase no está disponible ahora.";
        return;
    }

    const text = getValue("review-text");
    if (!text) {
        feedback.textContent = "Escribí tu reseña antes de enviarla.";
        return;
    }

    try {
        await state.firestore.addDoc(state.firestore.collection(state.db, "reviews"), {
            uid: state.user.uid,
            name: state.user.displayName || state.user.email,
            stars: Number(getValue("review-stars")),
            text,
            approved: false,
            createdAt: state.firestore.serverTimestamp()
        });
        event.target.reset();
        feedback.textContent = "Reseña enviada. Queda pendiente de aprobación.";
    } catch (error) {
        feedback.textContent = "No se pudo guardar la reseña.";
    }
}

async function handleRegister() {
    const feedback = document.getElementById("auth-status");

    if (!state.firebaseReady) {
        feedback.textContent = "Firebase no está disponible ahora.";
        return;
    }

    const name = getValue("auth-name");
    const email = normalizeEmail(getValue("auth-email"));
    const password = getValue("auth-password");

    if (!name || !email || !password) {
        feedback.textContent = "Completá nombre, email y contraseña.";
        return;
    }

    try {
        const credential = await state.authFns.createUserWithEmailAndPassword(state.auth, email, password);
        await state.authFns.updateProfile(credential.user, { displayName: name });
        await state.firestore.setDoc(state.firestore.doc(state.db, "users", credential.user.uid), {
            name,
            email,
            createdAt: state.firestore.serverTimestamp()
        });
        feedback.textContent = "Cuenta creada. Ya podés dejar reseñas.";
    } catch (error) {
        feedback.textContent = getFirebaseMessage(error);
    }
}

async function handleLogin() {
    const feedback = document.getElementById("auth-status");

    if (!state.firebaseReady) {
        feedback.textContent = "Firebase no está disponible ahora.";
        return;
    }

    try {
        await state.authFns.signInWithEmailAndPassword(state.auth, normalizeEmail(getValue("auth-email")), getValue("auth-password"));
        feedback.textContent = "Sesión iniciada.";
    } catch (error) {
        feedback.textContent = getFirebaseMessage(error);
    }
}

function updateAuthUI(user) {
    const status = document.getElementById("auth-status");
    const logout = document.getElementById("logout-user-btn");
    const login = document.getElementById("login-user-btn");
    const register = document.getElementById("register-user-btn");

    if (!status) return;

    if (user) {
        status.textContent = `Sesión iniciada como ${user.displayName || user.email}.`;
        logout.hidden = false;
        login.hidden = true;
        register.hidden = true;
    } else {
        status.textContent = "Creá una cuenta para dejar reseñas asociadas a tu usuario.";
        logout.hidden = true;
        login.hidden = false;
        register.hidden = false;
    }
}

function subscribeAgenda() {
    const { collection, onSnapshot, query, where } = state.firestore;
    const agendaQuery = query(collection(state.db, "agenda"), where("published", "==", true));

    onSnapshot(agendaQuery, snapshot => {
        const items = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .sort(compareAgendaItems);
        renderAgenda(items.length ? items : fallbackAgenda);
    }, error => {
        console.warn("No se pudo leer la agenda publicada.", error);
        renderAgenda(fallbackAgenda);
        setText("selected-agenda-feedback", "No se pudo cargar la agenda publicada. Podés consultar por WhatsApp.");
    });
}

function subscribeReviews() {
    const { collection, onSnapshot, query, where } = state.firestore;
    const reviewsQuery = query(collection(state.db, "reviews"), where("approved", "==", true));

    onSnapshot(reviewsQuery, snapshot => {
        const items = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .sort(compareCreatedDesc);
        renderReviews(items.length ? items : fallbackReviews);
    }, error => {
        console.warn("No se pudieron leer las reseñas aprobadas.", error);
        renderReviews(fallbackReviews);
    });
}

async function loadPaymentConfig() {
    try {
        const paymentRef = state.firestore.doc(state.db, "siteConfig", "payment");
        const snap = await state.firestore.getDoc(paymentRef);
        if (!snap.exists()) return;
        const payment = snap.data();

        if (payment.details) setText("payment-details", payment.details);
        if (payment.link) {
            const link = document.getElementById("payment-link");
            link.href = payment.link;
            link.textContent = payment.label || "Abonar seña";
        }
    } catch (error) {
        console.warn("No se pudo leer configuración de seña.", error);
    }
}

function renderAgenda(items) {
    const list = document.getElementById("agenda-list");
    if (!list) return;

    list.innerHTML = items.map(item => `
        <article class="agenda-card">
            <h3>${escapeHtml(item.tour || "Salida guiada")}</h3>
            <span>${escapeHtml(formatAgendaDate(item.date))} · ${escapeHtml(item.time || "Horario a confirmar")}</span>
            <span>${escapeHtml(item.duration || "Duración a completar")} · ${escapeHtml(item.price || "Precio según duración")}</span>
            <span>${escapeHtml(item.meeting || "Punto de encuentro a confirmar")}</span>
            <em>${escapeHtml(item.spots || capacityLabel(item) || "Cupos a confirmar")}</em>
            ${item.id ? `<button class="site-button site-button--small" type="button" data-select-agenda="${escapeHtml(item.id)}" data-agenda-tour="${escapeHtml(item.tour || "")}" data-agenda-date="${escapeHtml(item.date || "")}" data-agenda-time="${escapeHtml(item.time || "")}" data-agenda-duration="${escapeHtml(item.duration || "")}" data-agenda-price="${escapeHtml(item.price || "")}">Sumarme a esta salida</button>` : ""}
        </article>
    `).join("");

    list.querySelectorAll("[data-select-agenda]").forEach(button => {
        button.addEventListener("click", () => selectAgendaItem(button));
    });
}

function renderReviews(items) {
    const list = document.getElementById("reviews-list");
    if (!list) return;

    list.innerHTML = items.map(item => `
        <article class="review-card">
            <strong>${"★".repeat(Number(item.stars || 5))}${"☆".repeat(5 - Number(item.stars || 5))}</strong>
            <h3>${escapeHtml(item.name || "Visitante")}</h3>
            <p>${escapeHtml(item.text || "")}</p>
        </article>
    `).join("");
}

function openWhatsapp(message) {
    const url = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener");
}

async function reserveAgendaSpots(agendaId, amount) {
    const { doc, runTransaction, serverTimestamp } = state.firestore;
    const agendaRef = doc(state.db, "agenda", agendaId);

    await runTransaction(state.db, async transaction => {
        const snap = await transaction.get(agendaRef);
        if (!snap.exists()) return;

        const data = snap.data();
        const capacity = Number(data.capacity || 0);
        const booked = Number(data.booked || 0);
        const nextBooked = booked + amount;

        if (capacity && nextBooked > capacity) {
            throw new Error("capacity-exceeded");
        }

        transaction.update(agendaRef, {
            booked: nextBooked,
            spots: capacity ? `${Math.max(capacity - nextBooked, 0)} lugares disponibles` : "Cupos a confirmar",
            updatedAt: serverTimestamp()
        });
    });
}

function selectAgendaItem(button) {
    const agendaId = button.dataset.selectAgenda || "";
    const tour = button.dataset.agendaTour || "";
    const date = button.dataset.agendaDate || "";
    const time = button.dataset.agendaTime || "";
    const duration = button.dataset.agendaDuration || "";
    const price = button.dataset.agendaPrice || "";

    openBookingModal();
    resetBookingContext();

    const agendaInput = document.getElementById("booking-agenda-id");
    const tourInput = document.getElementById("booking-tour");
    const dateInput = document.getElementById("booking-date");
    const durationInput = document.getElementById("booking-duration");
    const priceInput = document.getElementById("booking-price");

    if (agendaInput) agendaInput.value = agendaId;
    if (tourInput && tour) {
        if (![...tourInput.options].some(option => option.value === tour)) {
            tourInput.add(new Option(tour, tour));
        }
        tourInput.value = tour;
        // trigger handler to reveal fields, description and set duration
        tourInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (dateInput && date) dateInput.value = date;
    if (durationInput && (duration || price)) {
        const value = duration || "Duración";
        let existing = [...durationInput.options].find(opt => opt.value === value);
        if (!existing) {
            existing = new Option(value, value);
            durationInput.add(existing);
        }
        if (price) {
            existing.dataset.price = price;
            if (!existing.dataset.originalText) existing.dataset.originalText = existing.text;
            const parsed = parsePriceNumber(price);
            const currency = detectCurrency(price);
            const displayPrice = parsed ? formatCurrency(parsed, currency) : price;
            existing.text = `${value} - ${displayPrice}`;
        } else if (existing.dataset.originalText) {
            existing.text = existing.dataset.originalText;
        }
        durationInput.value = value;
    }

    if (priceInput) priceInput.value = price || "";

    // Update visible price UI
    updateBookingPriceUI(price || (durationInput?.selectedOptions?.[0]?.dataset?.price || ""));

    setText(
        "selected-agenda-feedback",
        `Salida especial seleccionada: ${tour || "recorrido"} ${date ? `· ${date}` : ""} ${time ? `· ${time}` : ""}.`
    );
}

function peopleCount(label) {
    const firstNumber = Number(String(label || "1").match(/\d+/)?.[0] || 1);
    return Math.max(firstNumber, 1);
}

function capacityLabel(item) {
    const capacity = Number(item.capacity || 0);
    if (!capacity) return "";
    const booked = Number(item.booked || 0);
    return `${Math.max(capacity - booked, 0)} lugares disponibles`;
}

function compareAgendaItems(a, b) {
    const left = `${a.date || "9999-12-31"} ${a.time || "99:99"}`;
    const right = `${b.date || "9999-12-31"} ${b.time || "99:99"}`;
    return left.localeCompare(right);
}

function compareCreatedDesc(a, b) {
    const left = a.createdAt?.toMillis?.() || 0;
    const right = b.createdAt?.toMillis?.() || 0;
    return right - left;
}

function getValue(id) {
    return document.getElementById(id)?.value.trim() || "";
}

function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
}

function setText(id, text) {
    const element = document.getElementById(id);
    if (element) element.textContent = text;
}

function formatAgendaDate(value) {
    if (!value || value === "A definir") return "Fecha a confirmar";
    return value;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function getFirebaseMessage(error) {
    const code = error?.code || "";
    if (code.includes("auth/email-already-in-use")) return "Ese email ya está registrado.";
    if (code.includes("auth/invalid-credential") || code.includes("auth/wrong-password")) return "Email o contraseña incorrectos.";
    if (code.includes("auth/user-not-found")) return "No existe una cuenta con ese email.";
    if (code.includes("auth/invalid-email")) return "El email no tiene un formato válido.";
    if (code.includes("auth/too-many-requests")) return "Firebase bloqueó temporalmente el acceso por demasiados intentos. Probá más tarde.";
    if (code.includes("auth/network-request-failed")) return "No hay conexión con Firebase.";
    if (code.includes("auth/weak-password")) return "La contraseña debe tener al menos 6 caracteres.";
    if (code.includes("auth/operation-not-allowed")) return "Activá Email/Password en Firebase Authentication.";
    return "No se pudo completar la operación.";
}
