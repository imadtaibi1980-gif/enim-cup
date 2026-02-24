// ═══════════════════════════════════════════════════════════
//  ENIM CUP — app.js  v2
//  Phase de Groupes (A/B/C/D) + Quarts + Demis + Finale
//  Firebase Realtime Database — données partagées en temps réel
// ═══════════════════════════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getDatabase, ref, push, set, remove, onValue, update
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// ── 🔥 VOTRE CONFIGURATION FIREBASE ──────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyBIcjQfbtPMa401Bk1HbMKtkJkGO2q9OwY",
  authDomain:        "enim-cup.firebaseapp.com",
  databaseURL:       "https://enim-cup-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:         "enim-cup",
  storageBucket:     "enim-cup.firebasestorage.app",
  messagingSenderId: "191728242430",
  appId:             "1:191728242430:web:817a7664ca94bf5e94dfaf"
};
// ─────────────────────────────────────────────────────────────

const fbApp = initializeApp(firebaseConfig);
const db    = getDatabase(fbApp);

// ── ÉTAT ──────────────────────────────────────────────────────
let state = {
  equipes:  {},
  joueurs:  {},
  matchs:   {},
  cartons:  {},
  settings: { email: "admin@enim.ma", pass: "enim2025" }
};
let isLoggedIn   = false;
let activeGroup  = "A";   // groupe affiché dans le classement
let matchFilter  = "all"; // filtre dans la page matchs

// ── INIT ──────────────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
  let loaded = 0;
  const done = () => { if (++loaded >= 5) hideLoader(); };
  onValue(ref(db,"equipes"),  s => { state.equipes  = s.val()||{}; refreshAll(); done(); });
  onValue(ref(db,"joueurs"),  s => { state.joueurs  = s.val()||{}; refreshAll(); done(); });
  onValue(ref(db,"matchs"),   s => { state.matchs   = s.val()||{}; refreshAll(); done(); });
  onValue(ref(db,"cartons"),  s => { state.cartons  = s.val()||{}; refreshAll(); done(); });
  onValue(ref(db,"settings"), s => { if(s.val()) state.settings={...state.settings,...s.val()}; done(); });
});

function hideLoader() {
  setTimeout(() => {
    document.getElementById("loader").classList.add("hidden");
    setTimeout(() => document.getElementById("loader").style.display="none", 500);
  }, 800);
}

function refreshAll() {
  renderHome();
  renderGroupClassement();
  renderMatchsList();
  renderBracket();
  renderEquipes();
  renderStats();
  if (isLoggedIn) {
    renderAdminEquipes(); renderAdminJoueurs();
    renderAdminMatchs();  renderAdminCartons();
    fillSelects();
  }
}

// ── HELPERS ───────────────────────────────────────────────────
const arr = obj => Object.entries(obj||{}).map(([k,v])=>({...v,_id:k}));

function toast(msg, type="ok") {
  const el = document.getElementById("toast");
  el.textContent = msg; el.className = "show "+type;
  setTimeout(() => { el.className = ""; }, 3000);
}

function showMsg(id, msg, ok) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className   = "msg show " + (ok ? "msg-ok" : "msg-err");
  setTimeout(() => { el.className = "msg"; }, 3500);
}

const PHASE_ORDER = { groupe:1, quart:2, demi:3, "3eme":3.5, finale:4 };
const PHASE_LABEL = {
  groupe: "Phase de Groupes",
  quart:  "Quart de Finale",
  demi:   "Demi-Finale",
  "3eme": "Match 3ème Place",
  finale: "Finale"
};

// ── NAVIGATION ────────────────────────────────────────────────
window.showPage = function(id) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const pg = document.getElementById("page-"+id);
  if (pg) pg.classList.add("active");
  document.querySelectorAll("[data-page]").forEach(b =>
    b.classList.toggle("active", b.dataset.page === id)
  );
  if (id === "admin") renderAdminPage();
  window.scrollTo(0,0);
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

window.switchGroup = function(btn, group) {
  activeGroup = group;
  document.querySelectorAll("#groupTabs button").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  renderGroupClassement();
};

window.filterMatchPhase = function(btn, phase) {
  matchFilter = phase;
  document.querySelectorAll(".group-tabs button[onclick*='filterMatchPhase']").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  renderMatchsList();
};

window.onPhaseChange = function() {
  const phase = document.getElementById("m-phase").value;
  const wrap  = document.getElementById("groupeSelectWrap");
  if (wrap) wrap.style.display = phase === "groupe" ? "block" : "none";
};

// ── CLASSEMENT D'UN GROUPE ────────────────────────────────────
function getGroupClassement(group) {
  // équipes du groupe
  const teams = arr(state.equipes).filter(e => e.groupe === group);
  // matchs du groupe joués
  const groupMatchs = arr(state.matchs).filter(m => m.phase === "groupe" && m.groupe === group && m.joue);

  return teams.map(eq => {
    let j=0,v=0,n=0,d=0,bp=0,bc=0,pts=0,forme=[];
    groupMatchs.forEach(m => {
      const home = m.homeId === eq._id, away = m.awayId === eq._id;
      if (!home && !away) return;
      j++;
      const gs = home ? +m.scoreHome : +m.scoreAway;
      const gc = home ? +m.scoreAway : +m.scoreHome;
      bp+=gs; bc+=gc;
      if(gs>gc)      { v++; pts+=3; forme.push("V"); }
      else if(gs<gc) { d++;         forme.push("D"); }
      else           { n++; pts+=1; forme.push("N"); }
    });
    return {...eq, j, v, n, d, bp, bc, diff:bp-bc, pts, forme:forme.slice(-5)};
  }).sort((a,b) => b.pts-a.pts || b.diff-a.diff || b.bp-a.bp);
}

function renderGroupClassement() {
  const el = document.getElementById("groupContent");
  if (!el) return;
  const cl = getGroupClassement(activeGroup);

  if (!cl.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">👥</div>
      <p>Aucune équipe dans le Groupe ${activeGroup}.<br>Ajoutez des équipes depuis l'espace Admin.</p></div>`;
    return;
  }

  const maxPts = Math.max(...cl.map(e=>e.pts), 1);

  el.innerHTML = `
    <div class="group-header">
      <div class="group-badge">${activeGroup}</div>
      <div class="group-title">Groupe ${activeGroup}</div>
      <div class="qualified-label">✅ Top 2 qualifiés</div>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>#</th><th>Équipe</th><th title="Matchs joués">J</th>
          <th title="Victoires">V</th><th title="Nuls">N</th><th title="Défaites">D</th>
          <th title="Buts pour">BP</th><th title="Buts contre">BC</th>
          <th title="Différence">+/-</th><th>Pts</th><th>Forme</th></tr>
        </thead>
        <tbody>
          ${cl.map((eq, i) => {
            const isQualified = i < 2;
            const formeHtml = eq.forme.map(f =>
              `<span class="forme-${f.toLowerCase()}">${f}</span>`
            ).join("");
            return `<tr class="rank-${i+1} ${isQualified ? "qualified-row" : ""}">
              <td class="rank-num">${i+1}</td>
              <td><div class="team-cell">
                <span>${eq.emoji||"⚽"}</span>${eq.nom}
                ${isQualified ? `<span style="font-size:.65rem;color:var(--green-ok);margin-left:.3rem">✅</span>` : ""}
              </div></td>
              <td>${eq.j}</td><td>${eq.v}</td><td>${eq.n}</td><td>${eq.d}</td>
              <td>${eq.bp}</td><td>${eq.bc}</td>
              <td class="${eq.diff>=0?"diff-pos":"diff-neg"}">${eq.diff>0?"+":""}${eq.diff}</td>
              <td class="pts-cell">${eq.pts}</td>
              <td><div class="forme-wrap">${formeHtml}</div></td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
    <p style="font-size:.78rem;color:var(--muted);margin-top:.75rem">✅ = qualifié pour les Quarts de Finale</p>
  `;
}

// ── HOME ──────────────────────────────────────────────────────
function renderHome() {
  const matchsJoues = arr(state.matchs).filter(m=>m.joue).length;
  const totalButs   = arr(state.matchs).filter(m=>m.joue).reduce((s,m)=>s+(+m.scoreHome)+(+m.scoreAway),0);

  const s = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  s("hs-equipes", Object.keys(state.equipes).length);
  s("hs-matchs",  matchsJoues);
  s("hs-buts",    totalButs);

  // Phase actuelle
  const phases = [...new Set(arr(state.matchs).filter(m=>m.joue).map(m=>m.phase))];
  const maxPhase = Math.max(0, ...phases.map(p=>PHASE_ORDER[p]||0));
  ["groupe","quart","demi","finale"].forEach((p,i) => {
    const el = document.getElementById("ph-"+p);
    if (!el) return;
    const order = PHASE_ORDER[p] || (i+1);
    el.classList.toggle("active", order === maxPhase || (maxPhase === 0 && p === "groupe"));
    el.classList.toggle("done", order < maxPhase);
  });

  // Prochain match
  const next = arr(state.matchs).filter(m=>!m.joue)
    .sort((a,b)=>new Date(a.date||0)-new Date(b.date||0))[0];
  const nm = document.getElementById("nextMatch");
  if (!nm) return;
  if (!next) {
    nm.innerHTML = `<span style="color:var(--muted);grid-column:1/-1;text-align:center">Aucun match à venir</span>`;
    return;
  }
  const h = state.equipes[next.homeId], a = state.equipes[next.awayId];
  const dateStr = next.date
    ? new Date(next.date).toLocaleDateString("fr-FR",{weekday:"short",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})
    : "Date à définir";
  nm.innerHTML = `
    <div class="nm-team home">${h ? h.emoji+" "+h.nom : "?"}</div>
    <div class="nm-center">
      <div class="nm-vs">VS</div>
      <div class="nm-date">${dateStr}</div>
      <div style="font-size:.72rem;color:var(--blue);margin-top:.2rem">${PHASE_LABEL[next.phase]||""}</div>
    </div>
    <div class="nm-team">${a ? a.nom+" "+a.emoji : "?"}</div>
  `;
}

// ── MATCHS ────────────────────────────────────────────────────
function renderMatchsList() {
  const el = document.getElementById("matchsList");
  if (!el) return;

  let matchs = arr(state.matchs).sort((a,b)=>
    (PHASE_ORDER[a.phase]||0)-(PHASE_ORDER[b.phase]||0) || new Date(a.date||0)-new Date(b.date||0)
  );

  if (matchFilter !== "all") {
    matchs = matchs.filter(m => m.phase === matchFilter);
  }

  if (!matchs.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚽</div><p>Aucun match pour ce filtre</p></div>`;
    return;
  }

  // Grouper par phase → groupe (si phase de groupes)
  const groups = {};
  matchs.forEach(m => {
    const key = m.phase === "groupe"
      ? `groupe_${m.groupe||"?"}`
      : m.phase || "autre";
    if (!groups[key]) groups[key] = [];
    groups[key].push(m);
  });

  el.innerHTML = Object.entries(groups).map(([key, ms]) => {
    let label = "";
    if (key.startsWith("groupe_")) {
      label = `Groupe ${key.split("_")[1]} — Phase de Groupes`;
    } else {
      label = PHASE_LABEL[key] || key;
    }
    return `
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
    `;
  }).join("");
}

// ── BRACKET ───────────────────────────────────────────────────
function renderBracket() {
  const el = document.getElementById("bracketView");
  if (!el) return;

  const getPhaseMatchs = phase => arr(state.matchs).filter(m=>m.phase===phase)
    .sort((a,b)=>(a.label||"").localeCompare(b.label||""));

  const quarts = getPhaseMatchs("quart");
  const demis  = getPhaseMatchs("demi");
  const troise = getPhaseMatchs("3eme");
  const finale = getPhaseMatchs("finale");

  if (!quarts.length && !demis.length && !finale.length) {
    el.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">🎯</div>
      <p>Le tableau final apparaîtra ici dès que les matchs à élimination directe seront ajoutés.</p>
      <p style="margin-top:.5rem;font-size:.8rem;color:var(--blue)">Phase de groupes en cours…</p>
    </div>`;
    return;
  }

  const matchCard = (m) => {
    if (!m) return `<div class="bracket-match"><div class="bracket-team tbd">À définir</div><div class="bracket-team tbd">À définir</div></div>`;
    const h = state.equipes[m.homeId];
    const a = state.equipes[m.awayId];
    const hWin = m.joue && +m.scoreHome > +m.scoreAway;
    const aWin = m.joue && +m.scoreAway > +m.scoreHome;
    return `<div class="bracket-match">
      <div class="bracket-team ${hWin?"winner":""}">
        <span>${h ? h.emoji+" "+h.nom : "À définir"}</span>
        ${m.joue ? `<span class="bracket-score">${m.scoreHome}</span>` : ""}
      </div>
      <div class="bracket-team ${aWin?"winner":""}">
        <span>${a ? a.emoji+" "+a.nom : "À définir"}</span>
        ${m.joue ? `<span class="bracket-score">${m.scoreAway}</span>` : ""}
      </div>
    </div>`;
  };

  // Trouver le champion
  const finalMatch = finale[0];
  let champion = null;
  if (finalMatch && finalMatch.joue) {
    const winnerId = +finalMatch.scoreHome > +finalMatch.scoreAway ? finalMatch.homeId : finalMatch.awayId;
    champion = state.equipes[winnerId];
  }

  el.innerHTML = `
    <div class="bracket-container">
      <div class="bracket">
        ${quarts.length ? `
        <div class="bracket-round">
          <div class="bracket-round-title">Quarts de Finale</div>
          ${quarts.map(m => matchCard(m)).join("")}
          ${quarts.length < 4 ? Array(4-quarts.length).fill(0).map(()=>`
            <div class="bracket-match" style="opacity:.3">
              <div class="bracket-team tbd">À venir</div>
              <div class="bracket-team tbd">À venir</div>
            </div>`).join("") : ""}
        </div>` : ""}
        ${demis.length ? `
        <div class="bracket-round">
          <div class="bracket-round-title">Demi-Finales</div>
          ${demis.map(m => matchCard(m)).join("")}
          ${demis.length < 2 ? Array(2-demis.length).fill(0).map(()=>`
            <div class="bracket-match" style="opacity:.3">
              <div class="bracket-team tbd">À venir</div>
              <div class="bracket-team tbd">À venir</div>
            </div>`).join("") : ""}
        </div>` : ""}
        <div class="bracket-round">
          <div class="bracket-round-title">Finale</div>
          ${finale.length ? matchCard(finale[0]) : `
            <div class="bracket-match" style="opacity:.3">
              <div class="bracket-team tbd">À venir</div>
              <div class="bracket-team tbd">À venir</div>
            </div>`}
          ${troise.length ? `
          <div style="margin-top:.5rem">
            <div style="font-size:.7rem;color:var(--muted);text-align:center;margin-bottom:.3rem">3ème Place</div>
            ${matchCard(troise[0])}
          </div>` : ""}
        </div>
      </div>
    </div>
    ${champion ? `
    <div class="champion-card">
      <div class="champion-emoji">🏆</div>
      <div class="champion-title">CHAMPION ENIM CUP 2025</div>
      <div class="champion-name">${champion.emoji||"⚽"} ${champion.nom}</div>
    </div>` : ""}
  `;
}

// ── ÉQUIPES ───────────────────────────────────────────────────
function renderEquipes() {
  const el = document.getElementById("teamsGrid");
  if (!el) return;
  const eqs = arr(state.equipes).sort((a,b)=>(a.groupe||"").localeCompare(b.groupe||""));
  if (!eqs.length) { el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">👥</div><p>Aucune équipe</p></div>`; return; }
  el.innerHTML = eqs.map(eq => {
    const joueurs = arr(state.joueurs).filter(j=>j.equipeId===eq._id);
    return `<div class="team-card" onclick="openTeamModal('${eq._id}')">
      <div class="tc-head">
        <div class="tc-emoji">${eq.emoji||"⚽"}</div>
        <div>
          <div class="tc-name">${eq.nom}</div>
          <div class="tc-coach">Coach : ${eq.coach||"N/A"}</div>
        </div>
      </div>
      <span class="tc-tag" style="background:rgba(255,214,0,.1);color:var(--gold);border-color:rgba(255,214,0,.2)">
        Groupe ${eq.groupe||"?"}
      </span>
      <span class="tc-tag" style="margin-left:.3rem">👤 ${joueurs.length} joueur${joueurs.length!==1?"s":""}</span>
    </div>`;
  }).join("");
}

window.openTeamModal = function(eqId) {
  const eq = state.equipes[eqId];
  if (!eq) return;
  const joueurs = arr(state.joueurs).filter(j=>j.equipeId===eqId);
  const cl = getGroupClassement(eq.groupe||"A").find(e=>e._id===eqId) || {};
  document.getElementById("modalTeamTitle").textContent = (eq.emoji||"⚽")+" "+eq.nom;
  document.getElementById("modalTeamBody").innerHTML = `
    <div style="margin-bottom:.75rem">
      <span class="tc-tag" style="background:rgba(255,214,0,.1);color:var(--gold);border-color:rgba(255,214,0,.2)">Groupe ${eq.groupe||"?"}</span>
    </div>
    <div class="modal-stats">
      ${[["Pts",cl.pts||0,"var(--gold)"],["V",cl.v||0,"#22c55e"],["N",cl.n||0,"var(--gold)"],["D",cl.d||0,"var(--red)"]].map(([l,v,c])=>
        `<div class="ms-cell"><div class="ms-num" style="color:${c}">${v}</div><div class="ms-label">${l}</div></div>`
      ).join("")}
    </div>
    <p style="color:var(--muted);font-size:.82rem;margin-bottom:1rem">Coach : ${eq.coach||"N/A"}</p>
    <div style="font-size:.72rem;color:#60a5fa;text-transform:uppercase;letter-spacing:1px;margin-bottom:.6rem">
      Joueurs (${joueurs.length})
    </div>
    ${joueurs.length ? joueurs.map(j => {
      const cartons = arr(state.cartons).filter(c=>c.joueurId===j._id);
      const jaunes  = cartons.filter(c=>c.type==="jaune").length;
      const rouges  = cartons.filter(c=>c.type==="rouge").length;
      return `<div class="player-row">
        <div><strong>#${j.num||"?"} ${j.nom}</strong><small>${j.poste||""}</small></div>
        <div style="display:flex;gap:.4rem;align-items:center;font-size:.82rem">
          <span>⚽ ${j.buts||0}</span>
          ${jaunes ? `<span class="badge-j">🟨${jaunes}</span>` : ""}
          ${rouges ? `<span class="badge-r">🟥${rouges}</span>` : ""}
        </div>
      </div>`;
    }).join("") : `<p style="color:var(--muted);font-size:.85rem">Aucun joueur</p>`}
  `;
  document.getElementById("teamModal").classList.add("open");
};

// ── STATS ─────────────────────────────────────────────────────
function renderStats() {
  const mj   = arr(state.matchs).filter(m=>m.joue);
  const buts = mj.reduce((s,m)=>s+(+m.scoreHome)+(+m.scoreAway),0);
  const j    = arr(state.cartons).filter(c=>c.type==="jaune").length;
  const r    = arr(state.cartons).filter(c=>c.type==="rouge").length;

  const sc = document.getElementById("statsCards");
  if (sc) sc.innerHTML = [
    ["⚽",buts,"Buts totaux"],["🎮",mj.length,"Matchs joués"],
    ["🟨",j,"Cartons jaunes"],["🟥",r,"Cartons rouges"],
    ["👥",Object.keys(state.equipes).length,"Équipes"],["🎽",Object.keys(state.joueurs).length,"Joueurs"],
  ].map(([ic,val,lbl])=>`
    <div class="stat-card">
      <div class="sc-icon">${ic}</div><div class="sc-num">${val}</div><div class="sc-label">${lbl}</div>
    </div>`).join("");

  const sb = document.getElementById("scorersBody");
  if (sb) {
    const scorers = arr(state.joueurs).map(j=>{
      const eq = state.equipes[j.equipeId];
      const cs = arr(state.cartons).filter(c=>c.joueurId===j._id);
      return {...j, eqNom:eq?eq.nom:"?", groupe:eq?eq.groupe:"?",
        jaunes:cs.filter(c=>c.type==="jaune").length, rouges:cs.filter(c=>c.type==="rouge").length};
    }).filter(j=>(j.buts||0)>0).sort((a,b)=>b.buts-a.buts);
    sb.innerHTML = scorers.length ? scorers.map((j,i)=>`<tr>
      <td class="rank-num" style="${i<3?"color:var(--gold)":""}">${i+1}</td>
      <td style="font-weight:600">#${j.num||"?"} ${j.nom}</td>
      <td style="color:var(--muted);font-size:.82rem">${j.eqNom}</td>
      <td><span style="background:rgba(255,214,0,.1);color:var(--gold);font-size:.7rem;padding:.1rem .4rem;border-radius:4px">Gr.${j.groupe}</span></td>
      <td class="pts-cell">⚽ ${j.buts}</td>
      <td>${j.jaunes?`<span class="badge-j">${j.jaunes}</span>`:"–"}</td>
      <td>${j.rouges?`<span class="badge-r">${j.rouges}</span>`:"–"}</td>
    </tr>`).join("") : `<tr><td colspan="7" class="loading-cell">Aucun but enregistré</td></tr>`;
  }

  const cb = document.getElementById("cartonsBody");
  if (cb) {
    const cs = arr(state.cartons);
    cb.innerHTML = cs.length ? cs.map(c=>{
      const j = state.joueurs[c.joueurId];
      const eq = j ? state.equipes[j.equipeId] : null;
      const m  = state.matchs[c.matchId];
      const h  = m ? state.equipes[m.homeId] : null;
      const a  = m ? state.equipes[m.awayId] : null;
      return `<tr>
        <td style="font-weight:600">${j?j.nom:"?"}</td>
        <td style="color:var(--muted);font-size:.82rem">${eq?eq.nom:"?"}</td>
        <td>${c.type==="jaune"?`<span class="badge-j">🟨 Jaune</span>`:`<span class="badge-r">🟥 Rouge</span>`}</td>
        <td style="font-size:.82rem;color:var(--muted)">${m?`${h?h.nom:"?"} vs ${a?a.nom:"?"}`:"?"}</td>
        <td style="font-family:'JetBrains Mono'">${c.minute?c.minute+"'":"–"}</td>
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
    if (el) el.textContent = "Connecté : "+state.settings.email;
    renderAdminEquipes(); renderAdminJoueurs(); renderAdminMatchs(); renderAdminCartons(); fillSelects();
  }
}

window.doLogin = function() {
  const email = document.getElementById("loginEmail").value.trim();
  const pass  = document.getElementById("loginPass").value;
  if (email===state.settings.email && pass===state.settings.pass) {
    isLoggedIn = true; renderAdminPage(); toast("✅ Connexion réussie !");
  } else {
    showMsg("loginMsg","❌ Email ou mot de passe incorrect.",false);
  }
};

window.doLogout = function() {
  isLoggedIn = false; renderAdminPage(); toast("👋 Déconnecté.");
};

// ── FILL SELECTS ──────────────────────────────────────────────
function fillSelects() {
  const eqs = arr(state.equipes).sort((a,b)=>(a.groupe||"").localeCompare(b.groupe||""));
  const eqOpts = eqs.map(e=>`<option value="${e._id}">[Gr.${e.groupe||"?"}] ${e.emoji||""} ${e.nom}</option>`).join("");
  ["m-home","m-away"].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.innerHTML=`<option value="">— Choisir —</option>`+eqOpts;
  });
  const jEqOpts = eqs.map(e=>`<option value="${e._id}">${e.emoji||""} ${e.nom} (Gr.${e.groupe||"?"})</option>`).join("");
  const je=document.getElementById("j-equipe");
  if(je) je.innerHTML=`<option value="">— Choisir —</option>`+jEqOpts;

  const jrs = arr(state.joueurs);
  const jOpts = jrs.map(j=>{
    const eq=state.equipes[j.equipeId];
    return `<option value="${j._id}">${j.nom}${eq?" ("+eq.nom+")":""}`;
  }).join("");
  const cj=document.getElementById("c-joueur");
  if(cj) cj.innerHTML=`<option value="">— Joueur —</option>`+jOpts;

  const ms = arr(state.matchs).sort((a,b)=>(PHASE_ORDER[a.phase]||0)-(PHASE_ORDER[b.phase]||0));
  const mOpts = ms.map(m=>{
    const h=state.equipes[m.homeId],a=state.equipes[m.awayId];
    return `<option value="${m._id}">${PHASE_LABEL[m.phase]||m.phase} — ${h?h.nom:"?"} vs ${a?a.nom:"?"}`;
  }).join("");
  const cm=document.getElementById("c-match");
  if(cm) cm.innerHTML=`<option value="">— Match —</option>`+mOpts;
}

// ── ÉQUIPES CRUD ──────────────────────────────────────────────
window.addEquipe = async function() {
  const nom    = document.getElementById("eq-nom").value.trim();
  const emoji  = document.getElementById("eq-emoji").value.trim()||"⚽";
  const groupe = document.getElementById("eq-groupe").value;
  const coach  = document.getElementById("eq-coach").value.trim();
  if (!nom) { showMsg("eqMsg","Le nom est obligatoire.",false); return; }
  // Vérifier max 4 équipes par groupe
  const existing = arr(state.equipes).filter(e=>e.groupe===groupe).length;
  if (existing >= 4) { showMsg("eqMsg",`Le Groupe ${groupe} a déjà 4 équipes (maximum).`,false); return; }
  await push(ref(db,"equipes"),{nom,emoji,groupe,coach});
  document.getElementById("eq-nom").value=""; document.getElementById("eq-emoji").value=""; document.getElementById("eq-coach").value="";
  showMsg("eqMsg","✅ Équipe ajoutée !",true); toast("✅ Équipe ajoutée !");
};

window.deleteEquipe = async function(id) {
  if(!confirm("Supprimer cette équipe ?")) return;
  await remove(ref(db,"equipes/"+id));
  const jrs=arr(state.joueurs).filter(j=>j.equipeId===id);
  for(const j of jrs) await remove(ref(db,"joueurs/"+j._id));
  toast("🗑 Équipe supprimée.");
};

function renderAdminEquipes() {
  const el=document.getElementById("adminEquipesList"); if(!el) return;
  const byGroup = {A:[],B:[],C:[],D:[]};
  arr(state.equipes).forEach(e=>{const g=e.groupe||"A"; if(byGroup[g]) byGroup[g].push(e);});
  let html = "";
  Object.entries(byGroup).forEach(([g,eqs])=>{
    if(!eqs.length) return;
    html += `<div style="font-size:.75rem;color:var(--gold);font-weight:700;margin:.75rem 0 .3rem;text-transform:uppercase;letter-spacing:1px">Groupe ${g}</div>`;
    html += eqs.map(eq=>`
      <div class="admin-row">
        <div><strong>${eq.emoji||"⚽"} ${eq.nom}</strong>
          <small>Coach: ${eq.coach||"N/A"} · ${arr(state.joueurs).filter(j=>j.equipeId===eq._id).length} joueurs</small>
        </div>
        <button class="btn btn-danger btn-sm" onclick="deleteEquipe('${eq._id}')">🗑</button>
      </div>`).join("");
  });
  el.innerHTML = html || `<p style="color:var(--muted);font-size:.85rem">Aucune équipe</p>`;
}

// ── JOUEURS CRUD ──────────────────────────────────────────────
window.addJoueur = async function() {
  const nom=document.getElementById("j-nom").value.trim();
  const num=parseInt(document.getElementById("j-num").value)||0;
  const equipeId=document.getElementById("j-equipe").value;
  const poste=document.getElementById("j-poste").value;
  if(!nom||!equipeId){showMsg("jMsg","Nom et équipe obligatoires.",false);return;}
  await push(ref(db,"joueurs"),{nom,num,equipeId,poste,buts:0});
  document.getElementById("j-nom").value=""; document.getElementById("j-num").value="";
  showMsg("jMsg","✅ Joueur ajouté !",true); toast("✅ Joueur ajouté !");
};

window.deleteJoueur = async function(id) {
  if(!confirm("Supprimer ce joueur ?")) return;
  await remove(ref(db,"joueurs/"+id));
  for(const c of arr(state.cartons).filter(c=>c.joueurId===id)) await remove(ref(db,"cartons/"+c._id));
  toast("🗑 Joueur supprimé.");
};

window.updateButs = async function(id,val) {
  await update(ref(db,"joueurs/"+id),{buts:parseInt(val)||0});
};

function renderAdminJoueurs() {
  const el=document.getElementById("adminJoueursList"); if(!el) return;
  const jrs=arr(state.joueurs).sort((a,b)=>{
    const ea=state.equipes[a.equipeId], eb=state.equipes[b.equipeId];
    return (ea?.groupe||"").localeCompare(eb?.groupe||"") || (ea?.nom||"").localeCompare(eb?.nom||"");
  });
  el.innerHTML = jrs.length ? jrs.map(j=>{
    const eq=state.equipes[j.equipeId];
    return `<div class="admin-row">
      <div><strong>#${j.num||"?"} ${j.nom}</strong>
        <small>${j.poste||""} · ${eq?`${eq.nom} (Gr.${eq.groupe})`:"?"}</small>
      </div>
      <div class="admin-actions">
        <span style="font-size:.82rem;display:flex;align-items:center;gap:.3rem">
          ⚽<input type="number" class="score-inline-input" value="${j.buts||0}" min="0" onchange="updateButs('${j._id}',this.value)">
        </span>
        <button class="btn btn-danger btn-sm" onclick="deleteJoueur('${j._id}')">🗑</button>
      </div>
    </div>`;
  }).join("") : `<p style="color:var(--muted);font-size:.85rem">Aucun joueur</p>`;
}

// ── MATCHS CRUD ───────────────────────────────────────────────
window.addMatch = async function() {
  const homeId  = document.getElementById("m-home").value;
  const awayId  = document.getElementById("m-away").value;
  const phase   = document.getElementById("m-phase").value;
  const groupe  = phase==="groupe" ? document.getElementById("m-groupe").value : null;
  const date    = document.getElementById("m-date").value;
  const label   = document.getElementById("m-label").value.trim();
  const sh      = document.getElementById("m-sh").value;
  const sa      = document.getElementById("m-sa").value;
  if(!homeId||!awayId){showMsg("mMsg","Sélectionnez les deux équipes.",false);return;}
  if(homeId===awayId){showMsg("mMsg","Les deux équipes doivent être différentes.",false);return;}
  const joue = sh!==""&&sa!=="";
  await push(ref(db,"matchs"),{homeId,awayId,phase,groupe,date,label,
    scoreHome:joue?parseInt(sh):null, scoreAway:joue?parseInt(sa):null, joue});
  document.getElementById("m-sh").value=""; document.getElementById("m-sa").value="";
  showMsg("mMsg","✅ Match enregistré !",true); toast("✅ Match ajouté !");
};

window.deleteMatch = async function(id) {
  if(!confirm("Supprimer ce match ?")) return;
  await remove(ref(db,"matchs/"+id));
  for(const c of arr(state.cartons).filter(c=>c.matchId===id)) await remove(ref(db,"cartons/"+c._id));
  toast("🗑 Match supprimé.");
};

window.updateScore = async function(id) {
  const sh=document.getElementById("sh-"+id).value;
  const sa=document.getElementById("sa-"+id).value;
  if(sh===""||sa===""){toast("❌ Entrez les deux scores.","err");return;}
  await update(ref(db,"matchs/"+id),{scoreHome:parseInt(sh),scoreAway:parseInt(sa),joue:true});
  toast("✅ Score mis à jour !");
};

function renderAdminMatchs() {
  const el=document.getElementById("adminMatchsList"); if(!el) return;
  const ms=arr(state.matchs).sort((a,b)=>(PHASE_ORDER[a.phase]||0)-(PHASE_ORDER[b.phase]||0)||new Date(a.date||0)-new Date(b.date||0));
  el.innerHTML = ms.length ? ms.map(m=>{
    const h=state.equipes[m.homeId],a=state.equipes[m.awayId];
    const phLabel = m.phase==="groupe" ? `Groupe ${m.groupe||"?"} — ${PHASE_LABEL.groupe}` : PHASE_LABEL[m.phase]||m.phase;
    return `<div class="admin-row">
      <div>
        <strong>${h?h.nom:"?"} vs ${a?a.nom:"?"}</strong>
        <small>${phLabel} ${m.label?`· ${m.label}`:""} · ${m.joue?`Score: ${m.scoreHome}–${m.scoreAway}`:"À venir"}</small>
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
  const joueurId=document.getElementById("c-joueur").value;
  const matchId=document.getElementById("c-match").value;
  const type=document.getElementById("c-type").value;
  const minute=parseInt(document.getElementById("c-minute").value)||null;
  if(!joueurId||!matchId){showMsg("cMsg","Joueur et match obligatoires.",false);return;}
  await push(ref(db,"cartons"),{joueurId,matchId,type,minute});
  document.getElementById("c-minute").value="";
  showMsg("cMsg","✅ Carton ajouté !",true); toast("✅ Carton ajouté !");
};

window.deleteCarton = async function(id) {
  await remove(ref(db,"cartons/"+id)); toast("🗑 Carton supprimé.");
};

function renderAdminCartons() {
  const el=document.getElementById("adminCartonsList"); if(!el) return;
  const cs=arr(state.cartons);
  el.innerHTML = cs.length ? cs.map(c=>{
    const j=state.joueurs[c.joueurId], m=state.matchs[c.matchId];
    const h=m?state.equipes[m.homeId]:null, a=m?state.equipes[m.awayId]:null;
    return `<div class="admin-row">
      <div>
        <strong>${j?j.nom:"?"} ${c.type==="jaune"?'<span class="badge-j">🟨 Jaune</span>':'<span class="badge-r">🟥 Rouge</span>'}</strong>
        <small>${m?`${h?h.nom:"?"} vs ${a?a.nom:"?"}`:""} ${c.minute?c.minute+"'":""}</small>
      </div>
      <button class="btn btn-danger btn-sm" onclick="deleteCarton('${c._id}')">🗑</button>
    </div>`;
  }).join("") : `<p style="color:var(--muted);font-size:.85rem">Aucun carton</p>`;
}

// ── PARAMÈTRES ────────────────────────────────────────────────
window.changePass = async function() {
  const oldP=document.getElementById("cp-old").value;
  const newP=document.getElementById("cp-new").value;
  const conf=document.getElementById("cp-confirm").value;
  if(oldP!==state.settings.pass){showMsg("cpMsg","❌ Mot de passe actuel incorrect.",false);return;}
  if(!newP||newP.length<6){showMsg("cpMsg","❌ Minimum 6 caractères.",false);return;}
  if(newP!==conf){showMsg("cpMsg","❌ Les mots de passe ne correspondent pas.",false);return;}
  await update(ref(db,"settings"),{pass:newP});
  document.getElementById("cp-old").value=""; document.getElementById("cp-new").value=""; document.getElementById("cp-confirm").value="";
  showMsg("cpMsg","✅ Mot de passe mis à jour !",true); toast("✅ Mot de passe changé !");
};

window.changeEmail = async function() {
  const email=document.getElementById("ce-email").value.trim();
  const pass=document.getElementById("ce-pass").value;
  if(!email){showMsg("ceMsg","❌ Email invalide.",false);return;}
  if(pass!==state.settings.pass){showMsg("ceMsg","❌ Mot de passe incorrect.",false);return;}
  await update(ref(db,"settings"),{email});
  document.getElementById("ce-email").value=""; document.getElementById("ce-pass").value="";
  showMsg("ceMsg","✅ Email mis à jour !",true); toast("✅ Email changé !");
};

window.resetAllData = async function() {
  const c=prompt('Tapez "CONFIRMER" pour tout supprimer :');
  if(c!=="CONFIRMER") return;
  await set(ref(db,"equipes"),null); await set(ref(db,"joueurs"),null);
  await set(ref(db,"matchs"),null);  await set(ref(db,"cartons"),null);
  toast("🗑 Données réinitialisées.");
};
