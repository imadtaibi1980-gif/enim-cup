// ═══════════════════════════════════════════════════════════
//  ENIM CUP — app.js
//  Firebase Realtime Database · Tout partagé en temps réel
// ═══════════════════════════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getDatabase, ref, push, set, remove, onValue, update, get
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// ── 🔥 VOTRE CONFIGURATION FIREBASE ──────────────────────────
// Remplacez ces valeurs par celles de votre projet Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBIcjQfbtPMa401Bk1HbMKtkJkGO2q9OwY",
  authDomain: "enim-cup.firebaseapp.com",
  databaseURL: "https://enim-cup-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "enim-cup",
  storageBucket: "enim-cup.firebasestorage.app",
  messagingSenderId: "191728242430",
  appId: "1:191728242430:web:817a7664ca94bf5e94dfaf"
};
// ─────────────────────────────────────────────────────────────

const fbApp = initializeApp(firebaseConfig);
const db    = getDatabase(fbApp);

// ── ÉTAT LOCAL (cache des données Firebase) ───────────────────
let state = {
  equipes:  {},
  joueurs:  {},
  matchs:   {},
  cartons:  {},
  settings: { email: "admin@enim.ma", pass: "enim2025" }
};
let isLoggedIn = false;

// ── INIT ──────────────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
  initFirebaseListeners();
});

function initFirebaseListeners() {
  let loadCount = 0;
  const needed  = 5;
  const onLoad  = () => { loadCount++; if (loadCount >= needed) hideLoader(); };

  // Écoute temps réel chaque collection
  onValue(ref(db, "equipes"),  snap => { state.equipes  = snap.val() || {}; refreshAll(); onLoad(); });
  onValue(ref(db, "joueurs"),  snap => { state.joueurs  = snap.val() || {}; refreshAll(); onLoad(); });
  onValue(ref(db, "matchs"),   snap => { state.matchs   = snap.val() || {}; refreshAll(); onLoad(); });
  onValue(ref(db, "cartons"),  snap => { state.cartons  = snap.val() || {}; refreshAll(); onLoad(); });
  onValue(ref(db, "settings"), snap => {
    if (snap.val()) state.settings = { ...state.settings, ...snap.val() };
    onLoad();
  });
}

function hideLoader() {
  setTimeout(() => {
    document.getElementById("loader").classList.add("hidden");
    setTimeout(() => document.getElementById("loader").style.display = "none", 500);
  }, 600);
}

function refreshAll() {
  renderHome();
  renderClassement();
  renderEquipes();
  renderMatchs();
  renderStats();
  if (isLoggedIn) {
    renderAdminEquipes();
    renderAdminJoueurs();
    renderAdminMatchs();
    renderAdminCartons();
    fillSelects();
  }
}

// ── NAVIGATION ────────────────────────────────────────────────
window.showPage = function(id) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const pg = document.getElementById("page-" + id);
  if (pg) pg.classList.add("active");

  document.querySelectorAll("[data-page]").forEach(b => {
    b.classList.toggle("active", b.dataset.page === id);
  });

  if (id === "admin") renderAdminPage();
  window.scrollTo(0, 0);
};

window.toggleMobileMenu = function() {
  document.getElementById("mobileMenu").classList.toggle("open");
};

window.adminTab = function(btn, tabId) {
  document.querySelectorAll(".admin-tabs button").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".admin-tab").forEach(t => t.classList.remove("active"));
  btn.classList.add("active");
  document.getElementById(tabId).classList.add("active");
};

window.closeModal = function(id) {
  document.getElementById(id).classList.remove("open");
};

// ── HELPERS ──────────────────────────────────────────────────
function toast(msg, type = "ok") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = "show " + type;
  setTimeout(() => { el.className = ""; }, 3200);
}

function showMsg(id, msg, ok) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = "msg show " + (ok ? "msg-ok" : "msg-err");
  el.textContent = msg;
  setTimeout(() => { el.className = "msg"; }, 3500);
}

function arr(obj) { return Object.entries(obj || {}).map(([k,v]) => ({...v, _id: k})); }

function eqName(id) {
  const e = state.equipes[id];
  return e ? `${e.emoji || "⚽"} ${e.nom}` : "Inconnu";
}

function jName(id) {
  const j = state.joueurs[id];
  return j ? j.nom : "Inconnu";
}

function matchLabel(m) {
  const h = state.equipes[m.homeId];
  const a = state.equipes[m.awayId];
  return `${h ? h.nom : "?"} vs ${a ? a.nom : "?"} (${m.journee || ""})`;
}

// ── CLASSEMENT CALCUL ─────────────────────────────────────────
function getClassement() {
  const teams = arr(state.equipes).map(eq => {
    let j=0, v=0, n=0, d=0, bp=0, bc=0, pts=0, forme=[];
    arr(state.matchs).forEach(m => {
      if (!m.joue) return;
      const home = m.homeId === eq._id;
      const away = m.awayId === eq._id;
      if (!home && !away) return;
      j++;
      const gs = home ? +m.scoreHome : +m.scoreAway;
      const gc = home ? +m.scoreAway : +m.scoreHome;
      bp += gs; bc += gc;
      if (gs > gc)      { v++; pts += 3; forme.push("V"); }
      else if (gs < gc) { d++;           forme.push("D"); }
      else              { n++; pts += 1; forme.push("N"); }
    });
    return { ...eq, j, v, n, d, bp, bc, diff: bp - bc, pts, forme: forme.slice(-5) };
  });
  return teams.sort((a, b) => b.pts - a.pts || b.diff - a.diff || b.bp - a.bp);
}

// ── HOME ──────────────────────────────────────────────────────
function renderHome() {
  const cl = getClassement();
  const matchsJoues = arr(state.matchs).filter(m => m.joue).length;
  const totalButs = arr(state.matchs).filter(m => m.joue).reduce((s, m) => s + +m.scoreHome + +m.scoreAway, 0);

  const set_ = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set_("hs-equipes", Object.keys(state.equipes).length);
  set_("hs-joueurs", Object.keys(state.joueurs).length);
  set_("hs-matchs", matchsJoues);
  set_("hs-buts", totalButs);
  set_("hs-leader", cl[0] ? (cl[0].emoji || "⚽") + " " + cl[0].nom.split(" ").slice(-1)[0] : "–");

  // Prochain match
  const next = arr(state.matchs).filter(m => !m.joue).sort((a,b)=> new Date(a.date||0)-new Date(b.date||0))[0];
  const nm = document.getElementById("nextMatch");
  if (nm) {
    if (!next) { nm.innerHTML = `<span style="color:var(--muted);grid-column:1/-1;text-align:center">Aucun match à venir</span>`; return; }
    const h = state.equipes[next.homeId], a = state.equipes[next.awayId];
    const dateStr = next.date ? new Date(next.date).toLocaleDateString("fr-FR", {weekday:"short",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}) : "Date à définir";
    nm.innerHTML = `
      <div class="nm-team home">${h ? h.emoji+" "+h.nom : "?"}</div>
      <div class="nm-center">
        <div class="nm-vs">VS</div>
        <div class="nm-date">${dateStr}</div>
        <div style="font-size:.72rem;color:var(--muted);margin-top:.3rem">${next.journee||""}</div>
      </div>
      <div class="nm-team">${a ? a.nom+" "+a.emoji : "?"}</div>
    `;
  }
}

// ── CLASSEMENT ────────────────────────────────────────────────
function renderClassement() {
  const cl = getClassement();
  const body = document.getElementById("classementBody");
  if (!body) return;
  if (!cl.length) { body.innerHTML = `<tr><td colspan="11" class="loading-cell">Aucune équipe enregistrée</td></tr>`; return; }
  body.innerHTML = cl.map((eq, i) => {
    const formeHtml = eq.forme.map(f => `<span class="forme-${f.toLowerCase()}">${f}</span>`).join("");
    return `<tr class="rank-${i+1}">
      <td class="rank-num">${i+1}</td>
      <td><div class="team-cell"><span>${eq.emoji||"⚽"}</span>${eq.nom}</div></td>
      <td>${eq.j}</td><td>${eq.v}</td><td>${eq.n}</td><td>${eq.d}</td>
      <td>${eq.bp}</td><td>${eq.bc}</td>
      <td class="${eq.diff>=0?"diff-pos":"diff-neg"}">${eq.diff>0?"+":""}${eq.diff}</td>
      <td class="pts-cell">${eq.pts}</td>
      <td><div class="forme-wrap">${formeHtml}</div></td>
    </tr>`;
  }).join("");
}

// ── ÉQUIPES ───────────────────────────────────────────────────
function renderEquipes() {
  const grid = document.getElementById("teamsGrid");
  if (!grid) return;
  const eqs = arr(state.equipes);
  if (!eqs.length) { grid.innerHTML = `<div class="empty-state"><div class="empty-state-icon">👥</div><p>Aucune équipe enregistrée</p></div>`; return; }
  grid.innerHTML = eqs.map(eq => {
    const joueurs = arr(state.joueurs).filter(j => j.equipeId === eq._id);
    return `<div class="team-card" onclick="openTeamModal('${eq._id}')">
      <div class="tc-head">
        <div class="tc-emoji">${eq.emoji||"⚽"}</div>
        <div>
          <div class="tc-name">${eq.nom}</div>
          <div class="tc-coach">Coach : ${eq.coach||"N/A"}</div>
        </div>
      </div>
      <span class="tc-tag">👤 ${joueurs.length} joueur${joueurs.length!==1?"s":""}</span>
    </div>`;
  }).join("");
}

window.openTeamModal = function(eqId) {
  const eq = state.equipes[eqId];
  if (!eq) return;
  const joueurs = arr(state.joueurs).filter(j => j.equipeId === eqId);
  const cl = getClassement().find(e => e._id === eqId) || {};

  document.getElementById("modalTeamTitle").textContent = (eq.emoji||"⚽") + " " + eq.nom;
  document.getElementById("modalTeamBody").innerHTML = `
    <div class="modal-stats">
      ${[["Pts",cl.pts||0,"var(--gold)"],["V",cl.v||0,"#22c55e"],["N",cl.n||0,"var(--gold)"],["D",cl.d||0,"var(--red)"]].map(([l,v,c])=>`
        <div class="ms-cell">
          <div class="ms-num" style="color:${c}">${v}</div>
          <div class="ms-label">${l}</div>
        </div>`).join("")}
    </div>
    <p style="color:var(--muted);font-size:.82rem;margin-bottom:1rem">Coach : ${eq.coach||"N/A"}</p>
    <div style="font-size:.72rem;color:#60a5fa;text-transform:uppercase;letter-spacing:1px;margin-bottom:.6rem">Joueurs (${joueurs.length})</div>
    ${joueurs.length ? joueurs.map(j => {
      const cartons = arr(state.cartons).filter(c => c.joueurId === j._id);
      const jaunes = cartons.filter(c => c.type==="jaune").length;
      const rouges = cartons.filter(c => c.type==="rouge").length;
      return `<div class="player-row">
        <div>
          <strong>#${j.num||"?"} ${j.nom}</strong>
          <small>${j.poste||""}</small>
        </div>
        <div style="display:flex;gap:.5rem;align-items:center;font-size:.82rem">
          <span>⚽ ${j.buts||0}</span>
          ${jaunes ? `<span class="badge-j">🟨 ${jaunes}</span>` : ""}
          ${rouges ? `<span class="badge-r">🟥 ${rouges}</span>` : ""}
        </div>
      </div>`;
    }).join("") : `<p style="color:var(--muted);font-size:.85rem">Aucun joueur enregistré</p>`}
  `;
  document.getElementById("teamModal").classList.add("open");
};

// ── MATCHS ────────────────────────────────────────────────────
function renderMatchs() {
  const container = document.getElementById("matchsList");
  if (!container) return;
  const matchs = arr(state.matchs).sort((a,b) => new Date(a.date||0)-new Date(b.date||0));
  if (!matchs.length) { container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚽</div><p>Aucun match programmé</p></div>`; return; }

  const groups = {};
  matchs.forEach(m => {
    const g = m.journee || "Sans phase";
    if (!groups[g]) groups[g] = [];
    groups[g].push(m);
  });

  container.innerHTML = Object.entries(groups).map(([label, ms]) => `
    <div class="match-group">
      <div class="match-group-label">${label}</div>
      ${ms.map(m => {
        const h = state.equipes[m.homeId], a = state.equipes[m.awayId];
        const scoreHtml = m.joue
          ? `<div class="match-score-box">${m.scoreHome} – ${m.scoreAway}</div>`
          : `<div class="match-score-box pending">${m.date ? new Date(m.date).toLocaleDateString("fr-FR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}) : "À venir"}</div>`;
        return `<div class="match-card">
          <div class="match-team home">${h ? h.emoji+" "+h.nom : "?"}</div>
          ${scoreHtml}
          <div class="match-team">${a ? a.nom+" "+a.emoji : "?"}</div>
        </div>`;
      }).join("")}
    </div>
  `).join("");
}

// ── STATISTIQUES ──────────────────────────────────────────────
function renderStats() {
  const matchsJoues = arr(state.matchs).filter(m => m.joue);
  const totalButs = matchsJoues.reduce((s,m) => s + +m.scoreHome + +m.scoreAway, 0);
  const jaunes = arr(state.cartons).filter(c => c.type==="jaune").length;
  const rouges = arr(state.cartons).filter(c => c.type==="rouge").length;

  const sc = document.getElementById("statsCards");
  if (sc) sc.innerHTML = [
    ["⚽","totalButs",totalButs,"Buts totaux"],
    ["🎮","matchsJ",matchsJoues.length,"Matchs joués"],
    ["🟨","jaunes",jaunes,"Cartons jaunes"],
    ["🟥","rouges",rouges,"Cartons rouges"],
    ["👥","eqs",Object.keys(state.equipes).length,"Équipes"],
    ["🎽","jrs",Object.keys(state.joueurs).length,"Joueurs"],
  ].map(([ic,,val,lbl]) => `
    <div class="stat-card">
      <div class="sc-icon">${ic}</div>
      <div class="sc-num">${val}</div>
      <div class="sc-label">${lbl}</div>
    </div>`).join("");

  // Buteurs
  const sb = document.getElementById("scorersBody");
  if (sb) {
    const scorers = arr(state.joueurs).map(j => {
      const eq = state.equipes[j.equipeId];
      const cartons = arr(state.cartons).filter(c => c.joueurId === j._id);
      return { ...j, eqLabel: eq ? `${eq.emoji||""} ${eq.nom}` : "?", jaunes: cartons.filter(c=>c.type==="jaune").length, rouges: cartons.filter(c=>c.type==="rouge").length };
    }).filter(j => (j.buts||0) > 0).sort((a,b) => b.buts - a.buts);
    sb.innerHTML = scorers.length ? scorers.map((j,i) => `<tr>
      <td class="rank-num" style="${i<3?"color:var(--gold)":""}">${i+1}</td>
      <td style="font-weight:600">#${j.num||"?"} ${j.nom}</td>
      <td style="color:var(--muted);font-size:.82rem">${j.eqLabel}</td>
      <td class="pts-cell">⚽ ${j.buts}</td>
      <td>${j.jaunes ? `<span class="badge-j">${j.jaunes}</span>` : "–"}</td>
      <td>${j.rouges ? `<span class="badge-r">${j.rouges}</span>` : "–"}</td>
    </tr>`).join("") : `<tr><td colspan="6" class="loading-cell">Aucun but enregistré</td></tr>`;
  }

  // Cartons
  const cb = document.getElementById("cartonsBody");
  if (cb) {
    const cartons = arr(state.cartons).sort((a,b) => (a.minute||0)-(b.minute||0));
    cb.innerHTML = cartons.length ? cartons.map(c => {
      const j = state.joueurs[c.joueurId];
      const eq = j ? state.equipes[j.equipeId] : null;
      const m  = state.matchs[c.matchId];
      const h  = m ? state.equipes[m.homeId] : null;
      const a  = m ? state.equipes[m.awayId] : null;
      return `<tr>
        <td style="font-weight:600">${j ? j.nom : "?"}</td>
        <td style="color:var(--muted);font-size:.82rem">${eq ? eq.nom : "?"}</td>
        <td>${c.type==="jaune" ? `<span class="badge-j">🟨 Jaune</span>` : `<span class="badge-r">🟥 Rouge</span>`}</td>
        <td style="font-size:.82rem;color:var(--muted)">${m ? `${h?h.nom:"?"} vs ${a?a.nom:"?"}` : "?"}</td>
        <td style="font-family:'JetBrains Mono'">${c.minute ? c.minute+"'" : "–"}</td>
      </tr>`;
    }).join("") : `<tr><td colspan="5" class="loading-cell">Aucun carton</td></tr>`;
  }
}

// ── ADMIN AUTH ────────────────────────────────────────────────
function renderAdminPage() {
  document.getElementById("adminLogin").style.display = isLoggedIn ? "none" : "flex";
  document.getElementById("adminDash").style.display  = isLoggedIn ? "block" : "none";
  if (isLoggedIn) {
    const el = document.getElementById("dashUser");
    if (el) el.textContent = "Connecté en tant que : " + state.settings.email;
    renderAdminEquipes();
    renderAdminJoueurs();
    renderAdminMatchs();
    renderAdminCartons();
    fillSelects();
  }
}

window.doLogin = function() {
  const email = document.getElementById("loginEmail").value.trim();
  const pass  = document.getElementById("loginPass").value;
  if (email === state.settings.email && pass === state.settings.pass) {
    isLoggedIn = true;
    renderAdminPage();
    toast("✅ Connecté avec succès !");
  } else {
    showMsg("loginMsg", "❌ Email ou mot de passe incorrect.", false);
  }
};

window.doLogout = function() {
  isLoggedIn = false;
  renderAdminPage();
  toast("👋 Déconnecté.");
};

// ── FILL SELECTS ──────────────────────────────────────────────
function fillSelects() {
  const eqs = arr(state.equipes);
  const eqOpts = eqs.map(e => `<option value="${e._id}">${e.emoji||"⚽"} ${e.nom}</option>`).join("");
  ["j-equipe","m-home","m-away"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<option value="">— Choisir —</option>` + eqOpts;
  });

  const jrs = arr(state.joueurs);
  const jOpts = jrs.map(j => {
    const eq = state.equipes[j.equipeId];
    return `<option value="${j._id}">${j.nom}${eq ? " ("+eq.nom+")" : ""}</option>`;
  }).join("");
  const cj = document.getElementById("c-joueur");
  if (cj) cj.innerHTML = `<option value="">— Joueur —</option>` + jOpts;

  const ms = arr(state.matchs);
  const mOpts = ms.map(m => `<option value="${m._id}">${matchLabel(m)}</option>`).join("");
  const cm = document.getElementById("c-match");
  if (cm) cm.innerHTML = `<option value="">— Match —</option>` + mOpts;
}

// ── ÉQUIPES CRUD ──────────────────────────────────────────────
window.addEquipe = async function() {
  const nom   = document.getElementById("eq-nom").value.trim();
  const emoji = document.getElementById("eq-emoji").value.trim() || "⚽";
  const coach = document.getElementById("eq-coach").value.trim();
  if (!nom) { showMsg("eqMsg", "Le nom est obligatoire.", false); return; }
  await push(ref(db, "equipes"), { nom, emoji, coach });
  document.getElementById("eq-nom").value = "";
  document.getElementById("eq-emoji").value = "";
  document.getElementById("eq-coach").value = "";
  showMsg("eqMsg", "✅ Équipe ajoutée !", true);
  toast("✅ Équipe ajoutée !");
};

window.deleteEquipe = async function(id) {
  if (!confirm("Supprimer cette équipe et ses joueurs ?")) return;
  await remove(ref(db, "equipes/" + id));
  // Supprimer joueurs liés
  const jrs = arr(state.joueurs).filter(j => j.equipeId === id);
  for (const j of jrs) await remove(ref(db, "joueurs/" + j._id));
  toast("🗑 Équipe supprimée.");
};

function renderAdminEquipes() {
  const el = document.getElementById("adminEquipesList");
  if (!el) return;
  const eqs = arr(state.equipes);
  el.innerHTML = eqs.length ? eqs.map(eq => `
    <div class="admin-row">
      <div>
        <strong>${eq.emoji||"⚽"} ${eq.nom}</strong>
        <small>Coach : ${eq.coach||"N/A"} · ${arr(state.joueurs).filter(j=>j.equipeId===eq._id).length} joueurs</small>
      </div>
      <div class="admin-actions">
        <button class="btn btn-danger btn-sm" onclick="deleteEquipe('${eq._id}')">🗑 Suppr.</button>
      </div>
    </div>`).join("") : `<p style="color:var(--muted);font-size:.85rem">Aucune équipe</p>`;
}

// ── JOUEURS CRUD ──────────────────────────────────────────────
window.addJoueur = async function() {
  const nom      = document.getElementById("j-nom").value.trim();
  const num      = parseInt(document.getElementById("j-num").value) || 0;
  const equipeId = document.getElementById("j-equipe").value;
  const poste    = document.getElementById("j-poste").value;
  if (!nom || !equipeId) { showMsg("jMsg", "Nom et équipe sont obligatoires.", false); return; }
  await push(ref(db, "joueurs"), { nom, num, equipeId, poste, buts: 0 });
  document.getElementById("j-nom").value = "";
  document.getElementById("j-num").value = "";
  showMsg("jMsg", "✅ Joueur ajouté !", true);
  toast("✅ Joueur ajouté !");
};

window.deleteJoueur = async function(id) {
  if (!confirm("Supprimer ce joueur ?")) return;
  await remove(ref(db, "joueurs/" + id));
  const cartons = arr(state.cartons).filter(c => c.joueurId === id);
  for (const c of cartons) await remove(ref(db, "cartons/" + c._id));
  toast("🗑 Joueur supprimé.");
};

window.updateButs = async function(id, val) {
  await update(ref(db, "joueurs/" + id), { buts: parseInt(val) || 0 });
};

function renderAdminJoueurs() {
  const el = document.getElementById("adminJoueursList");
  if (!el) return;
  const jrs = arr(state.joueurs);
  el.innerHTML = jrs.length ? jrs.map(j => {
    const eq = state.equipes[j.equipeId];
    return `<div class="admin-row">
      <div>
        <strong>#${j.num||"?"} ${j.nom}</strong>
        <small>${j.poste||""} · ${eq ? eq.nom : "?"}</small>
      </div>
      <div class="admin-actions">
        <span style="font-size:.82rem;display:flex;align-items:center;gap:.3rem">
          ⚽ <input type="number" class="score-inline-input" value="${j.buts||0}" min="0"
               onchange="updateButs('${j._id}',this.value)" title="Buts">
        </span>
        <button class="btn btn-danger btn-sm" onclick="deleteJoueur('${j._id}')">🗑</button>
      </div>
    </div>`;
  }).join("") : `<p style="color:var(--muted);font-size:.85rem">Aucun joueur</p>`;
}

// ── MATCHS CRUD ───────────────────────────────────────────────
window.addMatch = async function() {
  const homeId   = document.getElementById("m-home").value;
  const awayId   = document.getElementById("m-away").value;
  const date     = document.getElementById("m-date").value;
  const journee  = document.getElementById("m-journee").value.trim() || "Phase ?";
  const sh       = document.getElementById("m-sh").value;
  const sa       = document.getElementById("m-sa").value;
  if (!homeId || !awayId) { showMsg("mMsg", "Sélectionnez les deux équipes.", false); return; }
  if (homeId === awayId)  { showMsg("mMsg", "Les équipes doivent être différentes.", false); return; }
  const joue = sh !== "" && sa !== "";
  await push(ref(db, "matchs"), {
    homeId, awayId, date, journee,
    scoreHome: joue ? parseInt(sh) : null,
    scoreAway: joue ? parseInt(sa) : null,
    joue
  });
  document.getElementById("m-sh").value = "";
  document.getElementById("m-sa").value = "";
  showMsg("mMsg", "✅ Match enregistré !", true);
  toast("✅ Match enregistré !");
};

window.deleteMatch = async function(id) {
  if (!confirm("Supprimer ce match ?")) return;
  await remove(ref(db, "matchs/" + id));
  const cartons = arr(state.cartons).filter(c => c.matchId === id);
  for (const c of cartons) await remove(ref(db, "cartons/" + c._id));
  toast("🗑 Match supprimé.");
};

window.updateScore = async function(id) {
  const sh = document.getElementById("sh-"+id).value;
  const sa = document.getElementById("sa-"+id).value;
  if (sh === "" || sa === "") { toast("❌ Entrez les deux scores.", "err"); return; }
  await update(ref(db, "matchs/" + id), {
    scoreHome: parseInt(sh), scoreAway: parseInt(sa), joue: true
  });
  toast("✅ Score mis à jour !");
};

function renderAdminMatchs() {
  const el = document.getElementById("adminMatchsList");
  if (!el) return;
  const ms = arr(state.matchs).sort((a,b) => new Date(a.date||0)-new Date(b.date||0));
  el.innerHTML = ms.length ? ms.map(m => {
    const h = state.equipes[m.homeId], a = state.equipes[m.awayId];
    return `<div class="admin-row">
      <div>
        <strong>${h?h.nom:"?"} vs ${a?a.nom:"?"}</strong>
        <small>${m.journee||""} · ${m.date ? new Date(m.date).toLocaleDateString("fr-FR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}) : "Date non définie"} · ${m.joue ? `Score: ${m.scoreHome}–${m.scoreAway}` : "À venir"}</small>
      </div>
      <div class="admin-actions">
        <input id="sh-${m._id}" class="score-inline-input" type="number" min="0" value="${m.scoreHome??""}" placeholder="D">
        <span style="color:var(--muted)">–</span>
        <input id="sa-${m._id}" class="score-inline-input" type="number" min="0" value="${m.scoreAway??""}" placeholder="E">
        <button class="btn btn-gold btn-sm" onclick="updateScore('${m._id}')">✓</button>
        <button class="btn btn-danger btn-sm" onclick="deleteMatch('${m._id}')">🗑</button>
      </div>
    </div>`;
  }).join("") : `<p style="color:var(--muted);font-size:.85rem">Aucun match</p>`;
}

// ── CARTONS CRUD ──────────────────────────────────────────────
window.addCarton = async function() {
  const joueurId = document.getElementById("c-joueur").value;
  const matchId  = document.getElementById("c-match").value;
  const type     = document.getElementById("c-type").value;
  const minute   = parseInt(document.getElementById("c-minute").value) || null;
  if (!joueurId || !matchId) { showMsg("cMsg", "Joueur et match sont obligatoires.", false); return; }
  await push(ref(db, "cartons"), { joueurId, matchId, type, minute });
  document.getElementById("c-minute").value = "";
  showMsg("cMsg", "✅ Carton enregistré !", true);
  toast("✅ Carton ajouté !");
};

window.deleteCarton = async function(id) {
  await remove(ref(db, "cartons/" + id));
  toast("🗑 Carton supprimé.");
};

function renderAdminCartons() {
  const el = document.getElementById("adminCartonsList");
  if (!el) return;
  const cs = arr(state.cartons);
  el.innerHTML = cs.length ? cs.map(c => {
    const j = state.joueurs[c.joueurId];
    const m = state.matchs[c.matchId];
    const h = m ? state.equipes[m.homeId] : null;
    const a = m ? state.equipes[m.awayId] : null;
    return `<div class="admin-row">
      <div>
        <strong>${j?j.nom:"?"} ${c.type==="jaune"?'<span class="badge-j">🟨 Jaune</span>':'<span class="badge-r">🟥 Rouge</span>'}</strong>
        <small>${m ? `${h?h.nom:"?"} vs ${a?a.nom:"?"}` : "?"} · ${c.minute ? c.minute+"'" : ""}</small>
      </div>
      <button class="btn btn-danger btn-sm" onclick="deleteCarton('${c._id}')">🗑</button>
    </div>`;
  }).join("") : `<p style="color:var(--muted);font-size:.85rem">Aucun carton</p>`;
}

// ── PARAMÈTRES ────────────────────────────────────────────────
window.changePass = async function() {
  const oldP    = document.getElementById("cp-old").value;
  const newP    = document.getElementById("cp-new").value;
  const confirm = document.getElementById("cp-confirm").value;
  if (oldP !== state.settings.pass)  { showMsg("cpMsg", "❌ Mot de passe actuel incorrect.", false); return; }
  if (!newP || newP.length < 6)      { showMsg("cpMsg", "❌ Le nouveau mot de passe doit faire au moins 6 caractères.", false); return; }
  if (newP !== confirm)              { showMsg("cpMsg", "❌ Les mots de passe ne correspondent pas.", false); return; }
  await update(ref(db, "settings"), { pass: newP });
  document.getElementById("cp-old").value = "";
  document.getElementById("cp-new").value = "";
  document.getElementById("cp-confirm").value = "";
  showMsg("cpMsg", "✅ Mot de passe mis à jour !", true);
  toast("✅ Mot de passe changé !");
};

window.changeEmail = async function() {
  const email = document.getElementById("ce-email").value.trim();
  const pass  = document.getElementById("ce-pass").value;
  if (!email)                       { showMsg("ceMsg", "❌ Email invalide.", false); return; }
  if (pass !== state.settings.pass) { showMsg("ceMsg", "❌ Mot de passe incorrect.", false); return; }
  await update(ref(db, "settings"), { email });
  document.getElementById("ce-email").value = "";
  document.getElementById("ce-pass").value  = "";
  showMsg("ceMsg", "✅ Email mis à jour !", true);
  toast("✅ Email admin changé !");
};

window.resetAllData = async function() {
  const confirmed = prompt('Tapez "CONFIRMER" pour réinitialiser toutes les données :');
  if (confirmed !== "CONFIRMER") return;
  await set(ref(db, "equipes"),  null);
  await set(ref(db, "joueurs"),  null);
  await set(ref(db, "matchs"),   null);
  await set(ref(db, "cartons"),  null);
  toast("🗑 Toutes les données ont été supprimées.");
};
