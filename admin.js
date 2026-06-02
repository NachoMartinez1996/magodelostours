import { ADMIN_EMAIL, firebaseConfig } from "./firebase-config.js";

const FIREBASE_VERSION = "12.14.0";

const state = {
    auth: null,
    db: null,
    authFns: null,
    firestore: null,
    unsubscribers: [],
    subscribed: false
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
                setText("admin-session-feedback", "");
                cleanupSubscriptions();
                authMod.signOut(state.auth);
            }

            if (isAdmin) {
                setText("admin-login-feedback", "Ingreso correcto.");
                setText("admin-session-feedback", `Sesión iniciada como ${user.email}. Cargando datos...`);
                if (!state.subscribed) subscribeAdminLists();
                loadPaymentConfig();
            }

            if (!user) {
                setText("admin-session-feedback", "");
                cleanupSubscriptions();
            }
        });
    } catch (error) {
        setText("admin-login-feedback", "No se pudo cargar Firebase. Revisá conexión y configuración.");
    }
}

function bindAdminEvents() {
    initPasswordToggles();

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

        setText("admin-login-feedback", "Ingresando...");

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

function initPasswordToggles() {
    document.querySelectorAll("[data-toggle-password]").forEach(toggle => {
        const input = document.getElementById(toggle.dataset.togglePassword);
        if (!input) return;

        toggle.addEventListener("change", () => {
            input.type = toggle.checked ? "text" : "password";
        });
    });
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

    setText("agenda-feedback", "Guardando salida...");

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
        setText("agenda-feedback", payload.published ? "Salida guardada y publicada en la web." : "Salida guardada como oculta.");
    } catch (error) {
        console.warn("No se pudo guardar la salida.", error);
        setText("agenda-feedback", getFirestoreMessage(error, "No se pudo guardar la salida."));
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

    setText("csv-feedback", "Importando filas...");

    try {
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
                published: parseCsvBoolean(published),
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            count++;
        }

        event.target.reset();
        setText("csv-feedback", `${count} salida(s) importada(s) y publicadas segun la columna publicado.`);
    } catch (error) {
        console.warn("No se pudo importar la agenda.", error);
        setText("csv-feedback", getFirestoreMessage(error, "No se pudo importar la agenda."));
    }
}

async function handlePaymentSubmit(event) {
    event.preventDefault();
    const { doc, serverTimestamp, setDoc } = state.firestore;

    setText("payment-feedback", "Guardando datos de seña...");

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
    cleanupSubscriptions();
    state.unsubscribers = [
        subscribeAgenda(),
        subscribeReviews(),
        subscribeSuggestions(),
        subscribeRegistrations()
    ].filter(Boolean);
    state.subscribed = true;
}

function cleanupSubscriptions() {
    state.unsubscribers.forEach(unsubscribe => unsubscribe?.());
    state.unsubscribers = [];
    state.subscribed = false;
}

function subscribeAgenda() {
    const { collection, deleteDoc, doc, onSnapshot, orderBy, query } = state.firestore;
    const agendaQuery = query(collection(state.db, "agenda"), orderBy("date", "asc"));

    return onSnapshot(agendaQuery, snapshot => {
        const container = document.getElementById("admin-agenda-list");
        container.innerHTML = "";

        if (snapshot.empty) {
            renderEmpty(container, "Todavía no hay salidas cargadas.");
            setText("admin-session-feedback", "Sesión iniciada. No hay salidas cargadas todavía.");
            return;
        }

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
            card.appendChild(actionButton("Eliminar", () => runAdminAction(
                () => deleteDoc(doc(state.db, "agenda", item.id)),
                "Salida eliminada."
            )));
            container.appendChild(card);
        });
        setText("admin-session-feedback", `Sesión iniciada. ${snapshot.size} salida(s) cargada(s).`);
    }, error => handleAdminSnapshotError("admin-agenda-list", "No se pudo leer la agenda.", error));
}

function subscribeReviews() {
    const { collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } = state.firestore;
    const reviewsQuery = query(collection(state.db, "reviews"), orderBy("createdAt", "desc"));

    return onSnapshot(reviewsQuery, snapshot => {
        const container = document.getElementById("admin-reviews-list");
        container.innerHTML = "";

        if (snapshot.empty) {
            renderEmpty(container, "No hay reseñas pendientes.");
            return;
        }

        snapshot.docs.forEach(item => {
            const data = item.data();
            const card = adminCard(`
                <strong>${"★".repeat(Number(data.stars || 5))} ${escapeHtml(data.name || "")}</strong>
                <span>${escapeHtml(data.text || "")}</span>
                <em>${data.approved ? "Aprobada" : "Pendiente"}</em>
            `);
            card.appendChild(actionButton("Aprobar", () => runAdminAction(
                () => updateDoc(doc(state.db, "reviews", item.id), { approved: true }),
                "Reseña aprobada."
            )));
            card.appendChild(actionButton("Eliminar", () => runAdminAction(
                () => deleteDoc(doc(state.db, "reviews", item.id)),
                "Reseña eliminada."
            )));
            container.appendChild(card);
        });
    }, error => handleAdminSnapshotError("admin-reviews-list", "No se pudieron leer las reseñas.", error));
}

function subscribeSuggestions() {
    const { collection, doc, onSnapshot, orderBy, query, updateDoc } = state.firestore;
    const suggestionsQuery = query(collection(state.db, "suggestions"), orderBy("createdAt", "desc"));

    return onSnapshot(suggestionsQuery, snapshot => {
        const container = document.getElementById("admin-suggestions-list");
        container.innerHTML = "";

        if (snapshot.empty) {
            renderEmpty(container, "No hay sugerencias nuevas.");
            return;
        }

        snapshot.docs.forEach(item => {
            const data = item.data();
            const card = adminCard(`
                <strong>${escapeHtml(data.name || "Sin nombre")}</strong>
                <span>${escapeHtml(data.contact || "")}</span>
                <span>${escapeHtml(data.text || "")}</span>
                <em>${escapeHtml(data.status || "new")}</em>
            `);
            card.appendChild(actionButton("Marcar visto", () => runAdminAction(
                () => updateDoc(doc(state.db, "suggestions", item.id), { status: "seen" }),
                "Sugerencia marcada como vista."
            )));
            container.appendChild(card);
        });
    }, error => handleAdminSnapshotError("admin-suggestions-list", "No se pudieron leer las sugerencias.", error));
}

function subscribeRegistrations() {
    const { collection, doc, onSnapshot, orderBy, query, updateDoc } = state.firestore;
    const registrationsQuery = query(collection(state.db, "registrations"), orderBy("createdAt", "desc"));

    return onSnapshot(registrationsQuery, snapshot => {
        const container = document.getElementById("admin-registrations-list");
        container.innerHTML = "";

        if (snapshot.empty) {
            renderEmpty(container, "No hay inscripciones registradas.");
            return;
        }

        snapshot.docs.forEach(item => {
            const data = item.data();
            const card = adminCard(`
                <strong>${escapeHtml(data.name || "")} · ${escapeHtml(data.tour || "")}</strong>
                <span>${escapeHtml(data.email || "")} · ${escapeHtml(data.phone || "")}</span>
                <span>${escapeHtml(data.date || "")} · ${escapeHtml(data.people || "")} · ${escapeHtml(data.duration || "")}</span>
                <span>${escapeHtml(data.priceLabel || "Precio a confirmar")} · ${escapeHtml(data.source || "recorrido")}</span>
                <em>${escapeHtml(data.status || "pending")}</em>
            `);
            card.appendChild(actionButton("Confirmar", () => runAdminAction(
                () => updateDoc(doc(state.db, "registrations", item.id), { status: "confirmed" }),
                "Inscripción confirmada."
            )));
            card.appendChild(actionButton("Seña recibida", () => runAdminAction(
                () => updateDoc(doc(state.db, "registrations", item.id), { deposit: "received" }),
                "Seña registrada."
            )));
            container.appendChild(card);
        });
    }, error => handleAdminSnapshotError("admin-registrations-list", "No se pudieron leer las inscripciones.", error));
}

async function loadPaymentConfig() {
    const { doc, getDoc } = state.firestore;

    try {
        const snap = await getDoc(doc(state.db, "siteConfig", "payment"));
        if (!snap.exists()) return;
        const data = snap.data();
        document.getElementById("payment-details-admin").value = data.details || "";
        document.getElementById("payment-link-admin").value = data.link || "";
        document.getElementById("payment-label-admin").value = data.label || "";
    } catch (error) {
        console.warn("No se pudieron leer los datos de seña.", error);
        setText("payment-feedback", getFirestoreMessage(error, "No se pudieron leer los datos de seña."));
    }
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

function renderEmpty(container, message) {
    if (!container) return;
    const card = adminCard(`<span>${escapeHtml(message)}</span>`);
    card.classList.add("admin-card--empty");
    container.appendChild(card);
}

async function runAdminAction(action, successMessage) {
    try {
        setText("admin-session-feedback", "Aplicando cambio...");
        await action();
        setText("admin-session-feedback", successMessage);
    } catch (error) {
        console.warn("No se pudo completar la acción del panel.", error);
        setText("admin-session-feedback", getFirestoreMessage(error, "No se pudo completar la acción."));
    }
}

function handleAdminSnapshotError(containerId, message, error) {
    console.warn(message, error);
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = "";
        renderEmpty(container, getFirestoreMessage(error, message));
    }
    setText("admin-session-feedback", getFirestoreMessage(error, message));
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

function parseCsvBoolean(value) {
    const normalized = String(value || "").trim().toLowerCase();
    return !["false", "falso", "0", "no", "oculto", "oculta"].includes(normalized);
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

function getFirestoreMessage(error, fallback) {
    const code = error?.code || "";
    if (code.includes("permission-denied")) return "Firebase no dio permiso para esta acción. Revisá que hayas iniciado sesión como Ignacio y que las reglas estén publicadas.";
    if (code.includes("failed-precondition")) return "Firebase necesita un índice para esta consulta o tiene una condición pendiente.";
    if (code.includes("unavailable")) return "Firebase no está disponible ahora. Probá de nuevo en unos minutos.";
    if (code.includes("not-found")) return "Ese registro ya no existe.";
    return fallback;
}
