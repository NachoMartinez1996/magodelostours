import { ADMIN_EMAIL, firebaseConfig } from "./firebase-config.js";

const FIREBASE_VERSION = "12.14.0";

const state = {
    auth: null,
    db: null,
    authFns: null,
    firestore: null
};

initAdmin();

async function initAdmin() {
    try {
        const [appMod, authMod, firestoreMod] = await Promise.all([
            import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
            import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`),
            import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`)
        ]);

        const app = appMod.initializeApp(firebaseConfig);
        state.auth = authMod.getAuth(app);
        state.db = firestoreMod.getFirestore(app);
        state.authFns = authMod;
        state.firestore = firestoreMod;

        bindAdminEvents();

        authMod.onAuthStateChanged(state.auth, user => {
            const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
            document.getElementById("admin-login").hidden = isAdmin;
            document.getElementById("admin-panel").hidden = !isAdmin;

            if (user && !isAdmin) {
                setText("admin-login-feedback", "Este panel está habilitado solo para Ignacio.");
                authMod.signOut(state.auth);
            }

            if (isAdmin) {
                subscribeAdminLists();
                loadPaymentConfig();
            }
        });
    } catch (error) {
        setText("admin-login-feedback", "No se pudo cargar Firebase. Revisá conexión y configuración.");
    }
}

function bindAdminEvents() {
    const adminEmailInput = document.getElementById("admin-email");
    if (adminEmailInput && !adminEmailInput.value) {
        adminEmailInput.value = ADMIN_EMAIL;
    }

    document.getElementById("admin-login-form")?.addEventListener("submit", async event => {
        event.preventDefault();
        const email = normalizeEmail(getValue("admin-email"));
        const password = getValue("admin-password");

        if (!email || !password) {
            setText("admin-login-feedback", "Completá email y contraseña.");
            return;
        }

        try {
            await state.authFns.signInWithEmailAndPassword(
                state.auth,
                email,
                password
            );
        } catch (error) {
            setText("admin-login-feedback", getFirebaseMessage(error));
        }
    });

    document.getElementById("admin-reset-password")?.addEventListener("click", async () => {
        const email = normalizeEmail(getValue("admin-email")) || ADMIN_EMAIL;

        try {
            await state.authFns.sendPasswordResetEmail(state.auth, email);
            setText("admin-login-feedback", `Te envi\u00e9 un mail para crear o recuperar la contrase\u00f1a de ${email}.`);
        } catch (error) {
            setText("admin-login-feedback", getFirebaseMessage(error));
        }
    });

    document.getElementById("admin-logout")?.addEventListener("click", () => {
        state.authFns.signOut(state.auth);
    });

    document.getElementById("agenda-form")?.addEventListener("submit", handleAgendaSubmit);
    document.getElementById("csv-form")?.addEventListener("submit", handleCsvSubmit);
    document.getElementById("payment-form")?.addEventListener("submit", handlePaymentSubmit);
}

async function handleAgendaSubmit(event) {
    event.preventDefault();
    const { addDoc, collection, doc, serverTimestamp, updateDoc } = state.firestore;
    const id = getValue("agenda-id");
    const capacity = Number(getValue("agenda-capacity") || 0);
    const booked = Number(getValue("agenda-booked") || 0);
    const payload = {
        tour: getValue("agenda-tour"),
        date: getValue("agenda-date"),
        time: getValue("agenda-time"),
        duration: getValue("agenda-duration"),
        price: getValue("agenda-price"),
        capacity,
        booked,
        spots: capacity ? `${Math.max(capacity - booked, 0)} lugares disponibles` : "Cupos a confirmar",
        meeting: getValue("agenda-meeting"),
        published: document.getElementById("agenda-published").checked,
        updatedAt: serverTimestamp()
    };

    if (!payload.tour) {
        setText("agenda-feedback", "El recorrido es obligatorio.");
        return;
    }

    try {
        if (id) {
            await updateDoc(doc(state.db, "agenda", id), payload);
        } else {
            await addDoc(collection(state.db, "agenda"), {
                ...payload,
                createdAt: serverTimestamp()
            });
        }
        event.target.reset();
        document.getElementById("agenda-id").value = "";
        document.getElementById("agenda-published").checked = true;
        document.getElementById("agenda-booked").value = "0";
        setText("agenda-feedback", "Salida guardada.");
    } catch (error) {
        setText("agenda-feedback", "No se pudo guardar la salida.");
    }
}

async function handleCsvSubmit(event) {
    event.preventDefault();
    const rows = document.getElementById("csv-agenda").value
        .split(/\r?\n/)
        .map(row => row.trim())
        .filter(Boolean);

    if (!rows.length) {
        setText("csv-feedback", "Pegá al menos una fila.");
        return;
    }

    const { addDoc, collection, serverTimestamp } = state.firestore;
    let count = 0;

    for (const row of rows) {
        const [date, time, tour, duration, price, capacity, meeting, published] = row.split(",").map(cell => cell.trim());
        if (!tour) continue;
        const numericCapacity = Number(capacity || 0);
        await addDoc(collection(state.db, "agenda"), {
            date,
            time,
            tour,
            duration,
            price,
            capacity: numericCapacity,
            booked: 0,
            spots: numericCapacity ? `${numericCapacity} lugares disponibles` : "Cupos a confirmar",
            meeting,
            published: published !== "false",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        count++;
    }

    event.target.reset();
    setText("csv-feedback", `${count} salida(s) importada(s).`);
}

async function handlePaymentSubmit(event) {
    event.preventDefault();
    const { doc, serverTimestamp, setDoc } = state.firestore;

    try {
        await setDoc(doc(state.db, "siteConfig", "payment"), {
            details: getValue("payment-details-admin"),
            link: getValue("payment-link-admin"),
            label: getValue("payment-label-admin") || "Abonar seña",
            updatedAt: serverTimestamp()
        }, { merge: true });
        setText("payment-feedback", "Datos de seña actualizados.");
    } catch (error) {
        setText("payment-feedback", "No se pudo actualizar la seña.");
    }
}

function subscribeAdminLists() {
    subscribeAgenda();
    subscribeReviews();
    subscribeSuggestions();
    subscribeRegistrations();
}

function subscribeAgenda() {
    const { collection, deleteDoc, doc, onSnapshot, orderBy, query } = state.firestore;
    const agendaQuery = query(collection(state.db, "agenda"), orderBy("date", "asc"));

    onSnapshot(agendaQuery, snapshot => {
        const container = document.getElementById("admin-agenda-list");
        container.innerHTML = "";

        snapshot.docs.forEach(item => {
            const data = item.data();
            const card = adminCard(`
                <strong>${escapeHtml(data.tour)}</strong>
                <span>${escapeHtml(data.date || "Sin fecha")} · ${escapeHtml(data.time || "Sin hora")}</span>
                <span>${escapeHtml(data.duration || "")} · ${escapeHtml(data.price || "")}</span>
                <span>${escapeHtml(data.meeting || "")}</span>
                <em>${data.published === false ? "Oculta" : "Publicada"} · ${escapeHtml(data.spots || "Cupos a confirmar")}</em>
            `);
            card.appendChild(actionButton("Editar", () => fillAgendaForm(item.id, data)));
            card.appendChild(actionButton("Eliminar", () => deleteDoc(doc(state.db, "agenda", item.id))));
            container.appendChild(card);
        });
    });
}

function subscribeReviews() {
    const { collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } = state.firestore;
    const reviewsQuery = query(collection(state.db, "reviews"), orderBy("createdAt", "desc"));

    onSnapshot(reviewsQuery, snapshot => {
        const container = document.getElementById("admin-reviews-list");
        container.innerHTML = "";

        snapshot.docs.forEach(item => {
            const data = item.data();
            const card = adminCard(`
                <strong>${"★".repeat(Number(data.stars || 5))} ${escapeHtml(data.name || "")}</strong>
                <span>${escapeHtml(data.text || "")}</span>
                <em>${data.approved ? "Aprobada" : "Pendiente"}</em>
            `);
            card.appendChild(actionButton("Aprobar", () => updateDoc(doc(state.db, "reviews", item.id), { approved: true })));
            card.appendChild(actionButton("Eliminar", () => deleteDoc(doc(state.db, "reviews", item.id))));
            container.appendChild(card);
        });
    });
}

function subscribeSuggestions() {
    const { collection, doc, onSnapshot, orderBy, query, updateDoc } = state.firestore;
    const suggestionsQuery = query(collection(state.db, "suggestions"), orderBy("createdAt", "desc"));

    onSnapshot(suggestionsQuery, snapshot => {
        const container = document.getElementById("admin-suggestions-list");
        container.innerHTML = "";

        snapshot.docs.forEach(item => {
            const data = item.data();
            const card = adminCard(`
                <strong>${escapeHtml(data.name || "Sin nombre")}</strong>
                <span>${escapeHtml(data.contact || "")}</span>
                <span>${escapeHtml(data.text || "")}</span>
                <em>${escapeHtml(data.status || "new")}</em>
            `);
            card.appendChild(actionButton("Marcar visto", () => updateDoc(doc(state.db, "suggestions", item.id), { status: "seen" })));
            container.appendChild(card);
        });
    });
}

function subscribeRegistrations() {
    const { collection, doc, onSnapshot, orderBy, query, updateDoc } = state.firestore;
    const registrationsQuery = query(collection(state.db, "registrations"), orderBy("createdAt", "desc"));

    onSnapshot(registrationsQuery, snapshot => {
        const container = document.getElementById("admin-registrations-list");
        container.innerHTML = "";

        snapshot.docs.forEach(item => {
            const data = item.data();
            const card = adminCard(`
                <strong>${escapeHtml(data.name || "")} · ${escapeHtml(data.tour || "")}</strong>
                <span>${escapeHtml(data.email || "")} · ${escapeHtml(data.phone || "")}</span>
                <span>${escapeHtml(data.date || "")} · ${escapeHtml(data.people || "")} · ${escapeHtml(data.duration || "")}</span>
                <em>${escapeHtml(data.status || "pending")}</em>
            `);
            card.appendChild(actionButton("Confirmar", () => updateDoc(doc(state.db, "registrations", item.id), { status: "confirmed" })));
            card.appendChild(actionButton("Seña recibida", () => updateDoc(doc(state.db, "registrations", item.id), { deposit: "received" })));
            container.appendChild(card);
        });
    });
}

async function loadPaymentConfig() {
    const { doc, getDoc } = state.firestore;
    const snap = await getDoc(doc(state.db, "siteConfig", "payment"));
    if (!snap.exists()) return;
    const data = snap.data();
    document.getElementById("payment-details-admin").value = data.details || "";
    document.getElementById("payment-link-admin").value = data.link || "";
    document.getElementById("payment-label-admin").value = data.label || "";
}

function fillAgendaForm(id, data) {
    document.getElementById("agenda-id").value = id;
    document.getElementById("agenda-tour").value = data.tour || "";
    document.getElementById("agenda-date").value = data.date || "";
    document.getElementById("agenda-time").value = data.time || "";
    document.getElementById("agenda-duration").value = data.duration || "";
    document.getElementById("agenda-price").value = data.price || "";
    document.getElementById("agenda-capacity").value = data.capacity || "";
    document.getElementById("agenda-booked").value = data.booked || "0";
    document.getElementById("agenda-meeting").value = data.meeting || "";
    document.getElementById("agenda-published").checked = data.published !== false;
    document.getElementById("agenda-form").scrollIntoView({ behavior: "smooth" });
}

function adminCard(html) {
    const card = document.createElement("article");
    card.className = "admin-card";
    card.innerHTML = html;
    return card;
}

function actionButton(label, onClick) {
    const button = document.createElement("button");
    button.className = "site-button site-button--small site-button--light";
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
}

function getValue(id) {
    return document.getElementById(id)?.value.trim() || "";
}

function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
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
    if (code.includes("auth/invalid-credential") || code.includes("auth/wrong-password")) return "La cuenta admin existe, pero esa contraseña no coincide. Usá Crear o recuperar contraseña.";
    if (code.includes("auth/user-not-found")) return "No existe un usuario de Firebase Auth con ese email.";
    if (code.includes("auth/user-disabled")) return "Ese usuario está deshabilitado en Firebase Auth.";
    if (code.includes("auth/invalid-email")) return "El email no tiene un formato válido.";
    if (code.includes("auth/too-many-requests")) return "Firebase bloqueó temporalmente el acceso por demasiados intentos. Probá más tarde o recuperá la contraseña.";
    if (code.includes("auth/network-request-failed")) return "No hay conexión con Firebase.";
    if (code.includes("auth/operation-not-allowed")) return "Activá Email/Password en Firebase Authentication.";
    return "No se pudo ingresar.";
}
