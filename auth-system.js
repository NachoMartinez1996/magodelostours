/**
 * Sistema de usuarios — auth, perfil, reservas y reseñas sincronizadas.
 */

export function initAuthSystem(deps) {
    const {
        getState,
        getValue,
        setText,
        normalizeEmail,
        getFirebaseMessage,
        escapeHtml,
        initPasswordToggles,
        onProfileLoaded
    } = deps;

    let authMode = "login";
    let userProfile = null;
    let unsubProfile = null;
    let unsubBookings = null;
    let unsubReviews = null;
    let activePanel = "account";

    const els = {
        guest: document.getElementById("auth-guest-panel"),
        dashboard: document.getElementById("auth-dashboard"),
        authForm: document.getElementById("auth-form"),
        authNameField: document.querySelector(".auth-name-field"),
        authName: document.getElementById("auth-name"),
        authEmail: document.getElementById("auth-email"),
        authPassword: document.getElementById("auth-password"),
        authStatus: document.getElementById("auth-status"),
        authSubmit: document.getElementById("auth-submit-btn"),
        authForgot: document.getElementById("auth-forgot-btn"),
        googleBtn: document.getElementById("google-signin-btn"),
        passwordStrength: document.getElementById("password-strength"),
        logoutBtn: document.getElementById("logout-user-btn"),
        verifyBanner: document.getElementById("email-verify-banner"),
        resendVerify: document.getElementById("resend-verify-btn"),
        headerChip: document.getElementById("header-user-chip"),
        headerAvatar: document.getElementById("header-user-avatar"),
        headerName: document.getElementById("header-user-name"),
        profileAvatar: document.getElementById("profile-avatar"),
        profileName: document.getElementById("profile-display-name"),
        profileEmail: document.getElementById("profile-display-email"),
        profileSince: document.getElementById("profile-member-since"),
        statBookings: document.getElementById("stat-bookings"),
        statReviews: document.getElementById("stat-reviews"),
        statGames: document.getElementById("stat-games"),
        profileForm: document.getElementById("profile-edit-form"),
        profileFeedback: document.getElementById("profile-edit-feedback"),
        bookingsList: document.getElementById("profile-bookings-list"),
        reviewsList: document.getElementById("profile-reviews-list"),
        navPerfil: document.querySelector('[data-view-link="perfil"]')
    };

    bindEvents();
    initPasswordToggles?.();
    setAuthTab("login");

    function bindEvents() {
        document.querySelectorAll("[data-auth-tab]").forEach(btn => {
            btn.addEventListener("click", () => setAuthTab(btn.dataset.authTab));
        });

        els.authForm?.addEventListener("submit", async event => {
            event.preventDefault();
            if (authMode === "register") await handleRegister();
            else await handleLogin();
        });

        els.authPassword?.addEventListener("input", updatePasswordStrength);

        els.authForgot?.addEventListener("click", handlePasswordReset);
        els.googleBtn?.addEventListener("click", handleGoogleSignIn);
        els.logoutBtn?.addEventListener("click", () => {
            const { authFns, auth } = getState();
            authFns?.signOut(auth);
        });
        els.resendVerify?.addEventListener("click", handleResendVerification);

        document.querySelectorAll("[data-profile-tab]").forEach(btn => {
            btn.addEventListener("click", () => showProfilePanel(btn.dataset.profileTab));
        });

        els.profileForm?.addEventListener("submit", handleProfileSave);
    }

    function setAuthTab(mode) {
        authMode = mode === "register" ? "register" : "login";
        document.querySelectorAll("[data-auth-tab]").forEach(btn => {
            btn.classList.toggle("is-active", btn.dataset.authTab === authMode);
            btn.setAttribute("aria-selected", btn.dataset.authTab === authMode ? "true" : "false");
        });
        if (els.authNameField) els.authNameField.hidden = authMode !== "register";
        if (els.passwordStrength) els.passwordStrength.hidden = authMode !== "register";
        if (els.authSubmit) els.authSubmit.textContent = authMode === "register" ? "Crear cuenta" : "Ingresar";
        if (els.authPassword) els.authPassword.autocomplete = authMode === "register" ? "new-password" : "current-password";
        setAuthFeedback("");
    }

    function setAuthFeedback(message, type = "") {
        if (!els.authStatus) return;
        els.authStatus.textContent = message;
        els.authStatus.dataset.tone = type;
        els.authStatus.classList.toggle("is-error", type === "error");
        els.authStatus.classList.toggle("is-success", type === "success");
    }

    function setProfileFeedback(message, type = "") {
        if (!els.profileFeedback) return;
        els.profileFeedback.textContent = message;
        els.profileFeedback.classList.toggle("is-error", type === "error");
        els.profileFeedback.classList.toggle("is-success", type === "success");
    }

    function updatePasswordStrength() {
        if (!els.passwordStrength || authMode !== "register") return;
        const password = els.authPassword?.value || "";
        const { score, label } = scorePassword(password);
        els.passwordStrength.hidden = !password;
        els.passwordStrength.dataset.score = String(score);
        const labelEl = els.passwordStrength.querySelector(".password-strength__label");
        if (labelEl) labelEl.textContent = password ? label : "";
    }

    function scorePassword(password) {
        if (!password) return { score: 0, label: "" };
        let score = 0;
        if (password.length >= 8) score++;
        if (password.length >= 12) score++;
        if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
        if (/\d/.test(password)) score++;
        if (/[^A-Za-z0-9]/.test(password)) score++;
        const labels = ["Muy débil", "Débil", "Regular", "Buena", "Excelente"];
        return { score: Math.min(score, 4), label: labels[Math.min(score, 4)] };
    }

    async function handleRegister() {
        const state = getState();
        if (!state.firebaseReady) {
            setAuthFeedback("Firebase no está disponible ahora.", "error");
            return;
        }

        const name = getValue("auth-name");
        const email = normalizeEmail(getValue("auth-email"));
        const password = getValue("auth-password");

        if (!name || !email || !password) {
            setAuthFeedback("Completá nombre, email y contraseña.", "error");
            return;
        }
        if (password.length < 6) {
            setAuthFeedback("La contraseña debe tener al menos 6 caracteres.", "error");
            return;
        }

        setAuthFeedback("Creando tu cuenta...");
        setSubmitting(true);

        try {
            const credential = await state.authFns.createUserWithEmailAndPassword(state.auth, email, password);
            await state.authFns.updateProfile(credential.user, { displayName: name });
            await ensureUserDoc(credential.user, { name, email });
            try {
                await state.authFns.sendEmailVerification(credential.user);
            } catch (_) {}
            setAuthFeedback("¡Cuenta creada! Revisá tu email para verificarla.", "success");
            setAuthTab("login");
        } catch (error) {
            setAuthFeedback(getFirebaseMessage(error), "error");
        } finally {
            setSubmitting(false);
        }
    }

    async function handleLogin() {
        const state = getState();
        if (!state.firebaseReady) {
            setAuthFeedback("Firebase no está disponible ahora.", "error");
            return;
        }

        setAuthFeedback("Ingresando...");
        setSubmitting(true);

        try {
            const credential = await state.authFns.signInWithEmailAndPassword(
                state.auth,
                normalizeEmail(getValue("auth-email")),
                getValue("auth-password")
            );
            await touchLastLogin(credential.user);
            setAuthFeedback("");
        } catch (error) {
            setAuthFeedback(getFirebaseMessage(error), "error");
        } finally {
            setSubmitting(false);
        }
    }

    async function handleGoogleSignIn() {
        const state = getState();
        if (!state.firebaseReady) {
            setAuthFeedback("Firebase no está disponible ahora.", "error");
            return;
        }

        setAuthFeedback("Conectando con Google...");
        if (els.googleBtn) els.googleBtn.disabled = true;

        try {
            const provider = new state.authFns.GoogleAuthProvider();
            provider.setCustomParameters({ prompt: "select_account" });
            const credential = await state.authFns.signInWithPopup(state.auth, provider);
            const user = credential.user;
            await ensureUserDoc(user, {
                name: user.displayName || user.email?.split("@")[0] || "Explorador",
                email: user.email,
                photoURL: user.photoURL || ""
            });
            await touchLastLogin(user);
            setAuthFeedback("");
        } catch (error) {
            if (error?.code !== "auth/popup-closed-by-user") {
                setAuthFeedback(getFirebaseMessage(error), "error");
            } else {
                setAuthFeedback("");
            }
        } finally {
            if (els.googleBtn) els.googleBtn.disabled = false;
        }
    }

    async function handlePasswordReset() {
        const state = getState();
        const email = normalizeEmail(getValue("auth-email"));
        if (!email) {
            setAuthFeedback("Escribí tu email para recibir el enlace de recuperación.", "error");
            return;
        }

        try {
            await state.authFns.sendPasswordResetEmail(state.auth, email);
            setAuthFeedback(`Te enviamos un enlace a ${email}.`, "success");
        } catch (error) {
            setAuthFeedback(getFirebaseMessage(error), "error");
        }
    }

    async function handleResendVerification() {
        const state = getState();
        const user = state.user;
        if (!user) return;

        try {
            await state.authFns.sendEmailVerification(user);
            setText("verify-banner-text", "Email de verificación reenviado. Revisá tu bandeja.");
        } catch (error) {
            setText("verify-banner-text", getFirebaseMessage(error));
        }
    }

    async function handleProfileSave(event) {
        event.preventDefault();
        const state = getState();
        const user = state.user;
        if (!user || !state.firebaseReady) return;

        const name = getValue("profile-name");
        const phone = getValue("profile-phone");
        const city = getValue("profile-city");

        if (!name) {
            setProfileFeedback("El nombre no puede quedar vacío.", "error");
            return;
        }

        setProfileFeedback("Guardando cambios...");

        try {
            await state.authFns.updateProfile(user, { displayName: name });
            const { doc, setDoc, serverTimestamp } = state.firestore;
            await setDoc(doc(state.db, "users", user.uid), {
                name,
                phone,
                city,
                email: user.email,
                updatedAt: serverTimestamp()
            }, { merge: true });

            userProfile = { ...userProfile, name, phone, city };
            renderDashboard(user, userProfile);
            persistAuthUser(user, userProfile);
            onProfileLoaded?.(user, userProfile);
            setProfileFeedback("Perfil actualizado.", "success");
        } catch (error) {
            setProfileFeedback(getFirebaseMessage(error), "error");
        }
    }

    async function ensureUserDoc(user, extra = {}) {
        const state = getState();
        const { doc, getDoc, setDoc, serverTimestamp } = state.firestore;
        const ref = doc(state.db, "users", user.uid);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
            await setDoc(ref, {
                name: extra.name || user.displayName || "",
                email: user.email || extra.email || "",
                phone: extra.phone || "",
                city: extra.city || "",
                photoURL: extra.photoURL || user.photoURL || "",
                createdAt: serverTimestamp(),
                lastLoginAt: serverTimestamp(),
                stats: { bookings: 0, reviews: 0 }
            });
        } else if (extra.photoURL && !snap.data().photoURL) {
            await setDoc(ref, { photoURL: extra.photoURL, updatedAt: serverTimestamp() }, { merge: true });
        }
    }

    async function touchLastLogin(user) {
        const state = getState();
        try {
            const { doc, setDoc, serverTimestamp } = state.firestore;
            await setDoc(doc(state.db, "users", user.uid), {
                lastLoginAt: serverTimestamp()
            }, { merge: true });
        } catch (_) {}
    }

    function cleanupSubscriptions() {
        unsubProfile?.();
        unsubBookings?.();
        unsubReviews?.();
        unsubProfile = unsubBookings = unsubReviews = null;
        userProfile = null;
    }

    async function loadUserData(user) {
        cleanupSubscriptions();
        const state = getState();
        if (!state.firebaseReady || !user) return;

        const { doc, onSnapshot } = state.firestore;
        unsubProfile = onSnapshot(doc(state.db, "users", user.uid), snap => {
            userProfile = snap.exists() ? snap.data() : {};
            renderDashboard(user, userProfile);
            persistAuthUser(user, userProfile);
            onProfileLoaded?.(user, userProfile);
        }, () => {
            userProfile = {};
            renderDashboard(user, userProfile);
        });

        subscribeUserBookings(user.uid);
        subscribeUserReviews(user.uid);
    }

    function subscribeUserBookings(uid) {
        const state = getState();
        const { collection, onSnapshot, query, where, orderBy } = state.firestore;

        try {
            const q = query(
                collection(state.db, "registrations"),
                where("uid", "==", uid),
                orderBy("createdAt", "desc")
            );
            unsubBookings = onSnapshot(q, snapshot => {
                renderBookings(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
                if (els.statBookings) els.statBookings.textContent = String(snapshot.size);
            }, () => renderBookings([]));
        } catch (_) {
            renderBookings([]);
        }
    }

    function subscribeUserReviews(uid) {
        const state = getState();
        const { collection, onSnapshot, query, where, orderBy } = state.firestore;

        try {
            const q = query(
                collection(state.db, "reviews"),
                where("uid", "==", uid),
                orderBy("createdAt", "desc")
            );
            unsubReviews = onSnapshot(q, snapshot => {
                renderUserReviews(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
                if (els.statReviews) els.statReviews.textContent = String(snapshot.size);
            }, () => renderUserReviews([]));
        } catch (_) {
            renderUserReviews([]);
        }
    }

    function renderBookings(items) {
        if (!els.bookingsList) return;
        if (!items.length) {
            els.bookingsList.innerHTML = `<article class="profile-empty-card"><p>Todavía no tenés reservas sincronizadas. Cuando confirmes una salida estando logueado, aparecerá acá.</p></article>`;
            return;
        }

        els.bookingsList.innerHTML = items.map(item => `
            <article class="profile-booking-card">
                <div class="profile-booking-card__head">
                    <strong>${escapeHtml(item.tour || "Recorrido")}</strong>
                    <span class="profile-badge profile-badge--${escapeHtml(item.status || "pending")}">${statusLabel(item.status)}</span>
                </div>
                <span>${escapeHtml(item.date || "Fecha a coordinar")} · ${escapeHtml(String(item.people || 1))} persona(s)</span>
                <span>${escapeHtml(item.duration || "")}${item.priceLabel ? ` · ${escapeHtml(item.priceLabel)}` : ""}</span>
                ${item.deposit === "received" ? '<em class="profile-deposit-ok">Seña recibida</em>' : ""}
            </article>
        `).join("");
    }

    function renderUserReviews(items) {
        if (!els.reviewsList) return;
        if (!items.length) {
            els.reviewsList.innerHTML = `<article class="profile-empty-card"><p>No dejaste reseñas todavía. Visitá la sección Comunidad para contar tu experiencia.</p></article>`;
            return;
        }

        els.reviewsList.innerHTML = items.map(item => `
            <article class="profile-review-card">
                <div class="profile-booking-card__head">
                    <strong>${"★".repeat(Number(item.stars || 5))}</strong>
                    <span class="profile-badge profile-badge--${item.approved ? "confirmed" : "pending"}">${item.approved ? "Publicada" : "En revisión"}</span>
                </div>
                <p>${escapeHtml(item.text || "")}</p>
            </article>
        `).join("");
    }

    function statusLabel(status) {
        if (status === "confirmed") return "Confirmada";
        if (status === "cancelled") return "Cancelada";
        return "Pendiente";
    }

    function initials(name, email) {
        const source = (name || email || "?").trim();
        const parts = source.split(/\s+/).filter(Boolean);
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        return source.slice(0, 2).toUpperCase();
    }

    function avatarHtml(user, profile) {
        const photo = profile?.photoURL || user.photoURL;
        const name = profile?.name || user.displayName || user.email;
        if (photo) {
            return `<img src="${escapeHtml(photo)}" alt="" referrerpolicy="no-referrer">`;
        }
        return `<span aria-hidden="true">${escapeHtml(initials(name, user.email))}</span>`;
    }

    function formatMemberSince(profile) {
        const ts = profile?.createdAt;
        if (!ts?.toDate) return "Miembro de la comunidad";
        const date = ts.toDate();
        return `Miembro desde ${date.toLocaleDateString("es-AR", { month: "long", year: "numeric" })}`;
    }

    function countGameScores() {
        try {
            const memory = JSON.parse(localStorage.getItem("leaderboard_memory") || "[]");
            const challenge = JSON.parse(localStorage.getItem("leaderboard_challenge") || "[]");
            const uid = getState().user?.uid;
            if (!uid) return memory.length + challenge.length;
            const mine = [...memory, ...challenge].filter(e => e.uid === uid || e.name);
            return mine.length;
        } catch (_) {
            return 0;
        }
    }

    function renderDashboard(user, profile = {}) {
        const name = profile.name || user.displayName || user.email?.split("@")[0] || "Explorador";
        const avatar = avatarHtml(user, profile);

        if (els.profileAvatar) els.profileAvatar.innerHTML = avatar;
        if (els.headerAvatar) els.headerAvatar.innerHTML = avatar;
        if (els.profileName) els.profileName.textContent = name;
        if (els.headerName) els.headerName.textContent = name.split(" ")[0];
        if (els.profileEmail) els.profileEmail.textContent = user.email || "";
        if (els.profileSince) els.profileSince.textContent = formatMemberSince(profile);
        if (els.statGames) els.statGames.textContent = String(countGameScores());

        const nameInput = document.getElementById("profile-name");
        const phoneInput = document.getElementById("profile-phone");
        const cityInput = document.getElementById("profile-city");
        if (nameInput && !nameInput.matches(":focus")) nameInput.value = name || "";
        if (phoneInput && !phoneInput.matches(":focus")) phoneInput.value = profile.phone || "";
        if (cityInput && !cityInput.matches(":focus")) cityInput.value = profile.city || "";

        if (els.verifyBanner) {
            const needsVerify = user.providerData?.some(p => p.providerId === "password") && !user.emailVerified;
            els.verifyBanner.hidden = !needsVerify;
        }
    }

    function showProfilePanel(panel) {
        activePanel = panel;
        document.querySelectorAll("[data-profile-tab]").forEach(btn => {
            btn.classList.toggle("is-active", btn.dataset.profileTab === panel);
        });
        document.getElementById("profile-panel-account")?.toggleAttribute("hidden", panel !== "account");
        document.getElementById("profile-panel-bookings")?.toggleAttribute("hidden", panel !== "bookings");
        document.getElementById("profile-panel-reviews")?.toggleAttribute("hidden", panel !== "reviews");
    }

    function persistAuthUser(user, profile = {}) {
        try {
            localStorage.setItem("authUser", JSON.stringify({
                uid: user.uid,
                email: user.email || null,
                displayName: profile.name || user.displayName || null,
                phoneNumber: profile.phone || user.phoneNumber || null,
                photoURL: profile.photoURL || user.photoURL || null
            }));
        } catch (_) {}
    }

    function setSubmitting(isSubmitting) {
        if (els.authSubmit) els.authSubmit.disabled = isSubmitting;
        if (els.googleBtn) els.googleBtn.disabled = isSubmitting;
    }

    function updateAuthUI(user) {
        const isLoggedIn = Boolean(user);

        if (els.guest) els.guest.hidden = isLoggedIn;
        if (els.dashboard) els.dashboard.hidden = !isLoggedIn;
        if (els.headerChip) els.headerChip.hidden = !isLoggedIn;
        if (els.navPerfil) els.navPerfil.hidden = isLoggedIn;

        if (user) {
            loadUserData(user);
            showProfilePanel(activePanel);
        } else {
            cleanupSubscriptions();
            if (els.headerChip) els.headerChip.hidden = true;
            if (els.navPerfil) els.navPerfil.hidden = false;
            try { localStorage.removeItem("authUser"); } catch (_) {}
            setAuthTab("login");
        }
    }

    return { updateAuthUI };
}

export async function saveRegistrationToCloud(state, booking) {
    if (!state.firebaseReady || !state.firestore) return null;

    try {
        const { addDoc, collection, serverTimestamp } = state.firestore;
        const docRef = await addDoc(collection(state.db, "registrations"), {
            name: booking.name,
            email: booking.email,
            phone: booking.phone,
            tour: booking.tour,
            agendaId: booking.agendaId || "",
            meeting: booking.meeting || "",
            date: booking.date || "A coordinar",
            people: booking.people || 1,
            duration: booking.duration || "",
            priceLabel: booking.priceLabel || "",
            pricePerPerson: booking.pricePerPerson || null,
            priceTotal: booking.priceTotal || null,
            message: booking.message || "",
            source: booking.source || "recorrido",
            uid: booking.uid || state.user?.uid || null,
            status: "pending",
            deposit: "pending",
            createdAt: serverTimestamp()
        });
        return docRef.id;
    } catch (error) {
        console.warn("No se pudo sincronizar la reserva con Firebase.", error);
        return null;
    }
}
