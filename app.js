let db = null
let user = null
let clients = []
let brs = []
let ecranActuel = "accueil"
let filtreClients = "rappels"
let filtreBrs = "a_venir"
let ficheId = null
let photo = null
let modeInscription = false
let maPhoto = null
let photoProfil = null
let seulementMoi = lireMemoire("seulementMoi") === "1"

const modeEssai = !SUPABASE_URL || !SUPABASE_KEY
if (!modeEssai) {
  db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true }
  })
}

const STATUTS_CLIENT = {
  a_rappeler: "À rappeler",
  vendu: "Vendu",
  pas_interesse: "Pas intéressé"
}

const STATUTS_BRS = {
  en_attente: "En attente",
  installe: "Installé",
  probleme: "Problème",
  complete: "Tout est bon"
}

const CHAMPS_CLIENT = ["nom", "telephone", "statut", "rappel", "offre", "appareil", "prix", "notes"]
const CHAMPS_BRS = ["marque", "nom", "telephone", "commande", "adresse", "services", "date_install", "statut", "rappele", "probleme", "notes"]

const COLONNES_CLIENTS = "id, created_at, user_id, vendeur, modifie_par, " + CHAMPS_CLIENT.join(", ")
const COLONNES_BRS = "id, created_at, user_id, vendeur, modifie_par, " + CHAMPS_BRS.join(", ")


// ---------- Petits outils ----------

function $(id) {
  return document.getElementById(id)
}

function lireMemoire(cle) {
  try {
    return localStorage.getItem(cle)
  } catch (e) {
    return null
  }
}

function ecrireMemoire(cle, valeur) {
  try {
    localStorage.setItem(cle, valeur)
  } catch (e) {}
}

function dateDans(jours) {
  const d = new Date()
  d.setDate(d.getDate() + jours)
  const mois = String(d.getMonth() + 1).padStart(2, "0")
  const jour = String(d.getDate()).padStart(2, "0")
  return d.getFullYear() + "-" + mois + "-" + jour
}

function aujourdhui() {
  return dateDans(0)
}

function joursAvant(date) {
  const debut = new Date(aujourdhui() + "T12:00:00")
  const fin = new Date(date + "T12:00:00")
  return Math.round((fin - debut) / 86400000)
}

function dateTexte(date) {
  if (!date) return ""
  const jours = joursAvant(date)
  if (jours === 0) return "Aujourd'hui"
  if (jours === 1) return "Demain"
  if (jours === -1) return "Hier"
  if (jours < 0 && jours > -7) return "Il y a " + -jours + " jours"
  const d = new Date(date + "T12:00:00")
  return d.toLocaleDateString("fr-CA", { weekday: "short", day: "numeric", month: "short" })
}

function formatTel(texte) {
  const chiffres = texte.replace(/\D/g, "")
  if (chiffres.length === 10) {
    return chiffres.slice(0, 3) + "-" + chiffres.slice(3, 6) + "-" + chiffres.slice(6)
  }
  if (chiffres.length === 11 && chiffres[0] === "1") {
    return chiffres.slice(1, 4) + "-" + chiffres.slice(4, 7) + "-" + chiffres.slice(7)
  }
  return texte.trim()
}

function monProfil() {
  if (modeEssai) return JSON.parse(lireMemoire("profil") || "{}")
  return user.user_metadata || {}
}

function nomUser() {
  if (modeEssai) return monProfil().nom || "Moi"
  return monProfil().nom || user.email
}

function appliquerTheme(theme) {
  if (theme) document.documentElement.dataset.theme = theme
  else delete document.documentElement.dataset.theme
}

appliquerTheme(lireMemoire("theme") || "")

function toast(texte) {
  const boite = $("toast")
  boite.textContent = texte
  boite.classList.add("visible")
  clearTimeout(boite.minuterie)
  boite.minuterie = setTimeout(() => boite.classList.remove("visible"), 2000)
}

function afficherErreur(texte) {
  $("erreur").textContent = texte || ""
  $("erreur").hidden = !texte
}


// ---------- Écrans ----------

function montrer(ecran) {
  const ecrans = ["connexion", "accueil", "clients", "brs", "fiche-client", "fiche-brs", "profil"]
  for (const nom of ecrans) {
    $("ecran-" + nom).hidden = nom !== ecran
  }

  const principal = ["accueil", "clients", "brs"].includes(ecran)
  if (principal) ecranActuel = ecran

  const titres = { accueil: "Aujourd'hui", clients: "Clients", brs: "BRS" }
  $("titre-ecran").textContent = titres[ecran] || ""

  $("haut").hidden = !principal
  $("nav").hidden = !principal
  $("btn-plus").hidden = !principal || ecran === "accueil"
  $("barre-portee").hidden = !principal
  $("btn-profil").hidden = !principal
  $("btn-deconnexion").hidden = modeEssai
  $("feuille").hidden = true
  document.body.classList.toggle("page-connexion", ecran === "connexion")

  document.querySelectorAll("#nav button").forEach(function (b) {
    b.classList.toggle("actif", b.dataset.ecran === ecran)
  })
  document.querySelectorAll("#barre-portee button").forEach(function (b) {
    b.classList.toggle("actif", (b.dataset.moi === "1") === seulementMoi)
  })

  window.scrollTo(0, 0)
}

document.querySelectorAll("#nav button").forEach(function (bouton) {
  bouton.onclick = () => montrer(bouton.dataset.ecran)
})

document.querySelectorAll("#barre-portee button").forEach(function (bouton) {
  bouton.onclick = function () {
    seulementMoi = bouton.dataset.moi === "1"
    ecrireMemoire("seulementMoi", seulementMoi ? "1" : "0")
    afficherTout()
    montrer(ecranActuel)
  }
})

document.querySelectorAll("[data-ajouter]").forEach(function (bouton) {
  bouton.onclick = function () {
    $("feuille").hidden = true
    if (bouton.dataset.ajouter === "brs") ouvrirBrs(null)
    else ouvrirClient(null)
  }
})

$("btn-plus").onclick = () => $("feuille").hidden = false
document.querySelector(".feuille-fond").onclick = () => $("feuille").hidden = true
document.querySelector(".fermer-feuille").onclick = () => $("feuille").hidden = true


// ---------- Connexion ----------

async function demarrer() {
  if (modeEssai) {
    user = { id: "local" }
    $("bandeau-essai").hidden = false
    await rafraichir()
    montrer("accueil")
    return
  }

  const reponse = await db.auth.getSession()
  if (reponse.data.session) {
    user = reponse.data.session.user
    montrer("accueil")
    await rafraichir()
  } else {
    $("form-connexion").courriel.value = lireMemoire("courriel") || ""
    montrer("connexion")
  }
}

$("btn-changer-mode").onclick = function () {
  modeInscription = !modeInscription
  const form = $("form-connexion")
  $("champ-nom").hidden = !modeInscription
  $("titre-connexion").textContent = modeInscription ? "Créer un compte" : "Connexion"
  $("btn-connexion").textContent = modeInscription ? "Créer mon compte" : "Se connecter"
  $("btn-changer-mode").textContent = modeInscription ? "J'ai déjà un compte" : "Pas de compte? Créer un compte"
  form.querySelector(".message").textContent = ""
}

$("form-connexion").onsubmit = async function (e) {
  e.preventDefault()
  const form = e.target
  const message = form.querySelector(".message")
  const courriel = form.courriel.value.trim()
  const motdepasse = form.motdepasse.value
  const nom = form.nom.value.trim()
  message.textContent = ""
  ecrireMemoire("courriel", courriel)

  let reponse
  if (modeInscription) {
    if (!nom) {
      message.textContent = "Écris ton nom pour que les autres sachent qui a fait le suivi."
      return
    }
    reponse = await db.auth.signUp({
      email: courriel,
      password: motdepasse,
      options: { data: { nom: nom } }
    })
  } else {
    reponse = await db.auth.signInWithPassword({ email: courriel, password: motdepasse })
  }

  if (reponse.error) {
    message.textContent = traduireErreur(reponse.error.message)
    return
  }
  if (!reponse.data.session) {
    message.textContent = "Compte créé! Va confirmer ton courriel, puis connecte-toi."
    return
  }

  user = reponse.data.session.user
  montrer("accueil")
  await rafraichir()
}

$("btn-deconnexion").onclick = async function () {
  if (!confirm("Te déconnecter?")) return
  await db.auth.signOut()
  user = null
  maPhoto = null
  clients = []
  brs = []
  montrer("connexion")
}

function traduireErreur(message) {
  if (message.includes("Invalid login")) return "Courriel ou mot de passe incorrect."
  if (message.includes("already registered")) return "Ce courriel a déjà un compte."
  if (message.includes("Email not confirmed")) return "Confirme d'abord ton courriel (regarde tes courriels)."
  if (message.includes("Signups not allowed")) return "Les inscriptions sont fermées. Demande à ton gestionnaire de t'inviter."
  return message
}


// ---------- Données ----------

async function charger(table, colonnes) {
  if (modeEssai) {
    return JSON.parse(lireMemoire(table) || "[]")
  }
  const reponse = await db.from(table).select(colonnes)
  if (reponse.error) {
    if (reponse.error.message.includes("appareil") || reponse.error.message.includes("prix")) {
      afficherErreur("Il manque les colonnes Téléphone et Prix dans Supabase : exécute le petit texte SQL envoyé par Claude.")
    } else if (table === "brs") {
      afficherErreur("La section BRS ne se charge pas (" + reponse.error.message + ")")
    } else {
      afficherErreur("Erreur de chargement : " + reponse.error.message)
    }
    return null
  }
  return reponse.data
}

async function chargerPhotoProfil() {
  if (modeEssai) {
    maPhoto = lireMemoire("photoProfil") || ""
    return
  }
  const reponse = await db.from("profils").select("photo").eq("user_id", user.id).maybeSingle()
  maPhoto = (reponse.data && reponse.data.photo) || ""
}

async function rafraichir() {
  afficherErreur("")
  if (maPhoto === null) await chargerPhotoProfil()
  const listeClients = await charger("clients", COLONNES_CLIENTS)
  if (listeClients) clients = listeClients
  const listeBrs = await charger("brs", COLONNES_BRS)
  if (listeBrs) brs = listeBrs
  afficherTout()
}

async function sauver(table, id, infos) {
  if (modeEssai) {
    const liste = JSON.parse(lireMemoire(table) || "[]")
    if (id) {
      Object.assign(liste.find(x => x.id === id), infos)
    } else {
      infos.id = Date.now()
      infos.created_at = new Date().toISOString()
      infos.user_id = "local"
      infos.vendeur = "Moi"
      liste.push(infos)
    }
    ecrireMemoire(table, JSON.stringify(liste))
    return null
  }

  let reponse
  if (id) {
    infos.modifie_par = nomUser()
    reponse = await db.from(table).update(infos).eq("id", id)
  } else {
    infos.vendeur = nomUser()
    reponse = await db.from(table).insert(infos)
  }
  return reponse.error
}

async function supprimer(table, id) {
  if (modeEssai) {
    const liste = JSON.parse(lireMemoire(table) || "[]")
    ecrireMemoire(table, JSON.stringify(liste.filter(x => x.id !== id)))
    return null
  }
  const reponse = await db.from(table).delete().eq("id", id)
  return reponse.error
}

async function chargerPhoto(table, id) {
  if (modeEssai) {
    const liste = JSON.parse(lireMemoire(table) || "[]")
    const element = liste.find(x => x.id === id)
    return element ? element.photo : null
  }
  const reponse = await db.from(table).select("photo").eq("id", id).single()
  if (reponse.error) return null
  return reponse.data.photo
}

document.addEventListener("visibilitychange", function () {
  const surUneListe = ["accueil", "clients", "brs"].some(e => !$("ecran-" + e).hidden)
  if (!document.hidden && user && surUneListe) rafraichir()
})


// ---------- Cartes ----------

function visibles(liste) {
  if (!seulementMoi) return liste
  return liste.filter(x => x.user_id === user.id)
}

function correspond(element, recherche) {
  if (!recherche) return true
  const chiffres = recherche.replace(/\D/g, "")
  const texte = [element.nom, element.offre, element.appareil, element.notes, element.vendeur, element.adresse, element.commande, element.services, element.marque]
    .filter(Boolean).join(" ").toLowerCase()
  const tel = (element.telephone || "").replace(/\D/g, "")
  return texte.includes(recherche) || (chiffres.length >= 3 && tel.includes(chiffres))
}

function initiales(nom) {
  return (nom || "?").trim().split(/\s+/).slice(0, 2).map(m => m[0]).join("").toUpperCase()
}

function creerCarte(element, badge, couleur, details, avatar) {
  const li = document.createElement("li")
  li.className = "item"
  li.innerHTML = `
    <div class="rangee">
      <div class="avatar"></div>
      <div class="corps">
        <strong></strong>
        <p class="details"></p>
        <div class="ligne-bas"><span class="badge"></span><span class="qui"></span></div>
      </div>
      <div class="liens"></div>
    </div>
  `
  li.querySelector(".avatar").textContent = initiales(element.nom)
  li.querySelector(".avatar").classList.add(avatar)
  li.querySelector("strong").textContent = element.nom
  li.querySelector(".details").textContent = details || ""
  li.querySelector(".details").hidden = !details
  li.querySelector(".badge").textContent = badge
  li.querySelector(".badge").classList.add(couleur)
  li.querySelector(".qui").textContent = element.vendeur || ""

  if (element.telephone) {
    const chiffres = element.telephone.replace(/[^\d+]/g, "")
    const liens = li.querySelector(".liens")
    liens.innerHTML = `<a class="rond" aria-label="Appeler">📞</a><a class="rond" aria-label="Texto">💬</a>`
    liens.children[0].href = "tel:" + chiffres
    liens.children[1].href = "sms:" + chiffres
    liens.children[0].onclick = e => e.stopPropagation()
    liens.children[1].onclick = e => e.stopPropagation()
  }
  return li
}

function carteClient(c) {
  let badge = STATUTS_CLIENT[c.statut] || ""
  let couleur = "gris"

  if (c.statut === "vendu") couleur = "vert"
  if (c.statut === "a_rappeler") {
    couleur = "bleu"
    if (c.rappel) {
      badge = "📞 " + dateTexte(c.rappel)
      const jours = joursAvant(c.rappel)
      if (jours < 0) couleur = "rouge"
      if (jours === 0) couleur = "orange"
    }
  }

  const details = [c.offre, c.appareil, c.prix ? c.prix + " $/mois" : ""].filter(Boolean).join(" · ")
  const li = creerCarte(c, badge, couleur, details, couleur)
  li.onclick = () => ouvrirClient(c)
  return li
}

function etapeBrs(b) {
  if (b.statut === "complete") return 4
  if (b.rappele) return 3
  if (b.statut === "installe") return 2
  return 1
}

function carteBrs(b, action) {
  let badge = STATUTS_BRS[b.statut] || ""
  let couleur = { en_attente: "bleu", installe: "orange", probleme: "rouge", complete: "vert" }[b.statut] || "gris"

  if (b.statut === "en_attente" && b.date_install) {
    badge = "🗓 " + dateTexte(b.date_install)
    const jours = joursAvant(b.date_install)
    if (jours < 0) couleur = "rouge"
    if (jours === 0) couleur = "orange"
  }
  if (b.statut === "installe" && !b.rappele) badge = "À rappeler"

  let details = b.services || ""
  if (b.commande) details += (details ? " · " : "") + "#" + b.commande

  const marque = b.marque === "Virgin" ? "virgin" : "bell"
  const li = creerCarte(b, badge, couleur, details, marque)

  const etape = etapeBrs(b)
  const progres = document.createElement("div")
  progres.className = "progres" + (b.statut === "probleme" ? " probleme" : "")
  for (let i = 1; i <= 4; i++) {
    const barre = document.createElement("i")
    if (i <= etape) barre.className = "fait"
    progres.appendChild(barre)
  }
  const etapes = document.createElement("div")
  etapes.className = "etapes"
  etapes.innerHTML = "<span>Commandé</span><span>Installé</span><span>Rappelé</span><span>Terminé</span>"
  li.querySelector(".details").after(progres, etapes)

  if (b.statut === "probleme" && b.probleme) {
    const alerte = document.createElement("p")
    alerte.className = "alerte"
    alerte.textContent = "⚠️ " + b.probleme
    li.appendChild(alerte)
  }

  if (action) {
    const bouton = document.createElement("button")
    bouton.className = "rapide"
    bouton.textContent = action.texte
    bouton.onclick = async function (e) {
      e.stopPropagation()
      bouton.disabled = true
      const erreur = await sauver("brs", b.id, Object.assign({}, action.champs))
      if (erreur) {
        bouton.disabled = false
        alert("Erreur : " + erreur.message)
        return
      }
      toast("C'est noté ✓")
      await rafraichir()
    }
    li.appendChild(bouton)
  }

  li.onclick = () => ouvrirBrs(b)
  return li
}


// ---------- Aujourd'hui ----------

function afficherTout() {
  afficherAccueil()
  afficherClients()
  afficherBrs()
}

function afficherAccueil() {
  const today = aujourdhui()
  const moisCourant = today.slice(0, 7)
  const mesClients = visibles(clients)
  const mesBrs = visibles(brs)

  const prenom = modeEssai ? "" : " " + nomUser().split(" ")[0]
  const heure = new Date().getHours()
  const salut = heure < 12 ? "Bon matin" : heure < 18 ? "Bonjour" : "Bonsoir"
  $("hero-date").textContent = new Date().toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" })
  $("bonjour").textContent = salut + prenom + " " + (monProfil().emoji || "👋")
  majAvatarProfil()

  $("stat-ventes").textContent = mesClients.filter(c => c.statut === "vendu" && (c.created_at || "").slice(0, 7) === moisCourant).length
  $("stat-installs").textContent = mesBrs.filter(b => (b.statut === "installe" || b.statut === "complete") && (b.date_install || "").slice(0, 7) === moisCourant).length
  $("stat-problemes").textContent = mesBrs.filter(b => b.statut === "probleme").length

  const parDate = (champ) => (a, b) => (a[champ] || "9999").localeCompare(b[champ] || "9999")

  const blocs = [
    {
      titre: "📞 Clients à rappeler",
      liste: mesClients.filter(c => c.statut === "a_rappeler" && c.rappel && c.rappel <= today).sort(parDate("rappel")),
      carte: c => carteClient(c)
    },
    {
      titre: "🔧 Installations à confirmer",
      liste: mesBrs.filter(b => b.statut === "en_attente" && b.date_install && b.date_install <= today).sort(parDate("date_install")),
      carte: b => carteBrs(b, { texte: "✓ C'est installé", champs: { statut: "installe" } })
    },
    {
      titre: "☎️ Rappeler après l'installation",
      liste: mesBrs.filter(b => b.statut === "installe" && !b.rappele).sort(parDate("date_install")),
      carte: b => carteBrs(b, { texte: "✓ Rappelé, tout est bon", champs: { rappele: true, statut: "complete" } })
    },
    {
      titre: "⚠️ Problèmes BRS",
      liste: mesBrs.filter(b => b.statut === "probleme").sort(parDate("date_install")),
      carte: b => carteBrs(b)
    }
  ]

  const bientot = {
    titre: "📅 Installations des 7 prochains jours",
    liste: mesBrs.filter(b => b.statut === "en_attente" && b.date_install > today && b.date_install <= dateDans(7)).sort(parDate("date_install")),
    carte: b => carteBrs(b)
  }

  const boite = $("blocs-accueil")
  boite.innerHTML = ""
  let urgent = 0

  for (const bloc of blocs) {
    urgent += bloc.liste.length
  }

  if (urgent === 0) {
    const bravo = document.createElement("div")
    bravo.className = "tout-va-bien"
    bravo.innerHTML = "<strong>🎉</strong>Rien d'urgent aujourd'hui. Bonne journée!"
    boite.appendChild(bravo)
  }

  for (const bloc of blocs.concat([bientot])) {
    if (bloc.liste.length === 0) continue
    const div = document.createElement("div")
    div.className = "bloc"
    div.innerHTML = `<h3><b></b><span></span></h3><ul class="liste"></ul>`
    div.querySelector("b").textContent = bloc.titre
    div.querySelector("span").textContent = bloc.liste.length
    for (const element of bloc.liste) {
      div.querySelector("ul").appendChild(bloc.carte(element))
    }
    boite.appendChild(div)
  }

  if (urgent === 0) $("hero-resume").textContent = "Tout est à jour. Rien d'urgent aujourd'hui."
  else if (urgent === 1) $("hero-resume").textContent = "Tu as 1 chose à faire aujourd'hui."
  else $("hero-resume").textContent = "Tu as " + urgent + " choses à faire aujourd'hui."

  majCarteNotifs()

  $("pastille").textContent = urgent
  $("pastille").hidden = urgent === 0
}


// ---------- Liste des clients ----------

function filtrerClients(liste, filtre) {
  if (filtre === "rappels") return liste.filter(c => c.statut === "a_rappeler")
  if (filtre === "tous") return liste
  return liste.filter(c => c.statut === filtre)
}

function remplirAppareils() {
  const modeles = []
  for (const c of clients) {
    if (c.appareil && !modeles.includes(c.appareil)) modeles.push(c.appareil)
  }
  $("appareils").innerHTML = ""
  for (const modele of modeles.sort()) {
    const option = document.createElement("option")
    option.value = modele
    $("appareils").appendChild(option)
  }
}

function afficherClients() {
  remplirAppareils()
  const recherche = $("recherche-clients").value.trim().toLowerCase()
  const mesClients = visibles(clients).filter(c => correspond(c, recherche))

  document.querySelectorAll("#filtres-clients button").forEach(function (b) {
    b.textContent = b.dataset.nom + " (" + filtrerClients(mesClients, b.dataset.filtre).length + ")"
    b.classList.toggle("actif", b.dataset.filtre === filtreClients)
  })

  let liste = filtrerClients(mesClients, filtreClients)
  if (filtreClients === "rappels") {
    liste.sort((a, b) => (a.rappel || "9999").localeCompare(b.rappel || "9999"))
  } else {
    liste.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
  }

  const ul = $("liste-clients")
  ul.innerHTML = ""
  for (const c of liste) ul.appendChild(carteClient(c))
  $("vide-clients").hidden = liste.length > 0
}

document.querySelectorAll("#filtres-clients button").forEach(function (b) {
  b.onclick = function () {
    filtreClients = b.dataset.filtre
    afficherClients()
  }
})

$("recherche-clients").oninput = afficherClients


// ---------- Liste des BRS ----------

function filtrerBrs(liste, filtre) {
  if (filtre === "a_venir") return liste.filter(b => b.statut === "en_attente")
  if (filtre === "a_rappeler") return liste.filter(b => b.statut === "installe" && !b.rappele)
  if (filtre === "tous") return liste
  return liste.filter(b => b.statut === filtre)
}

function afficherBrs() {
  const recherche = $("recherche-brs").value.trim().toLowerCase()
  const mesBrs = visibles(brs).filter(b => correspond(b, recherche))

  document.querySelectorAll("#filtres-brs button").forEach(function (b) {
    b.textContent = b.dataset.nom + " (" + filtrerBrs(mesBrs, b.dataset.filtre).length + ")"
    b.classList.toggle("actif", b.dataset.filtre === filtreBrs)
  })

  let liste = filtrerBrs(mesBrs, filtreBrs)
  if (filtreBrs === "a_venir") {
    liste.sort((a, b) => (a.date_install || "9999").localeCompare(b.date_install || "9999"))
  } else {
    liste.sort((a, b) => (b.date_install || "").localeCompare(a.date_install || ""))
  }

  const ul = $("liste-brs")
  ul.innerHTML = ""
  for (const b of liste) ul.appendChild(carteBrs(b))
  $("vide-brs").hidden = liste.length > 0
}

document.querySelectorAll("#filtres-brs button").forEach(function (b) {
  b.onclick = function () {
    filtreBrs = b.dataset.filtre
    afficherBrs()
  }
})

$("recherche-brs").oninput = afficherBrs


// ---------- Fiches (client et BRS) ----------

function remplir(form, element, champs) {
  for (const champ of champs) {
    const input = form.elements[champ]
    if (input.type === "checkbox") input.checked = !!element[champ]
    else input.value = element[champ] || ""
  }
}

function lire(form, champs) {
  const infos = {}
  for (const champ of champs) {
    const input = form.elements[champ]
    if (input.type === "checkbox") infos[champ] = input.checked
    else infos[champ] = input.value.trim() || null
  }
  return infos
}

function preparerFiche(form, element, titre) {
  form.querySelector(".titre-fiche").textContent = titre
  form.querySelector(".message").textContent = ""

  let info = ""
  if (element) {
    info = "Ajouté par " + (element.vendeur || "?")
    if (element.created_at) info += " le " + new Date(element.created_at).toLocaleDateString("fr-CA")
    if (element.modifie_par) info += " · modifié par " + element.modifie_par
  }
  form.querySelector(".info").textContent = info
  form.querySelector(".supprimer").hidden = !element || element.user_id !== user.id

  photo = null
  afficherPhoto(form)
  majChoix(form)
  majContacts(form)
  form.querySelector("details.plus").open = !!(form.elements.notes.value || form.elements.adresse && form.elements.adresse.value)
}

async function ouvrirClient(c) {
  const form = $("form-client")
  ficheId = c ? c.id : null
  remplir(form, c || { statut: "a_rappeler", rappel: dateDans(1) }, CHAMPS_CLIENT)
  preparerFiche(form, c, c ? c.nom : "Nouveau client")
  montrer("fiche-client")
  if (!c) form.nom.focus()
  if (c) {
    photo = await chargerPhoto("clients", c.id)
    afficherPhoto(form)
    if (photo) form.querySelector("details.plus").open = true
  }
}

async function ouvrirBrs(b) {
  const form = $("form-brs")
  ficheId = b ? b.id : null
  remplir(form, b || { statut: "en_attente" }, CHAMPS_BRS)
  preparerFiche(form, b, b ? b.nom : "Nouveau BRS")
  montrer("fiche-brs")
  if (b) {
    photo = await chargerPhoto("brs", b.id)
    afficherPhoto(form)
    if (photo) form.querySelector("details.plus").open = true
  }
}

function majChoix(form) {
  form.querySelectorAll(".choix").forEach(function (div) {
    const valeur = form.elements[div.dataset.champ].value
    const valeurs = div.dataset.multiple ? valeur.split(", ") : [valeur]
    div.querySelectorAll("button").forEach(function (b) {
      b.classList.toggle("actif", valeurs.includes(b.dataset.valeur))
    })
  })

  const appareil = form.querySelector(".champ-appareil")
  if (appareil) appareil.hidden = !form.elements.offre.value.includes("Post 24 mois")

  const rappel = form.querySelector(".champ-rappel")
  if (rappel) rappel.hidden = form.elements.statut.value !== "a_rappeler"

  const probleme = form.querySelector(".champ-probleme")
  if (probleme) probleme.hidden = form.elements.statut.value !== "probleme" && !form.elements.probleme.value
}

function majContacts(form) {
  const tel = form.elements.telephone.value.replace(/[^\d+]/g, "")
  const contacts = form.querySelector(".contacts")
  contacts.hidden = tel.length < 7
  contacts.querySelector(".appeler").href = "tel:" + tel
  contacts.querySelector(".texto").href = "sms:" + tel
}

function afficherPhoto(form) {
  const apercu = form.querySelector(".apercu")
  apercu.hidden = !photo
  form.querySelector(".retirer-photo").hidden = !photo
  if (photo) apercu.src = photo
}

function reduirePhoto(fichier) {
  return new Promise(function (resolve) {
    const img = new Image()
    img.onload = function () {
      const max = 1200
      let largeur = img.width
      let hauteur = img.height
      if (largeur > max || hauteur > max) {
        const ratio = Math.min(max / largeur, max / hauteur)
        largeur = Math.round(largeur * ratio)
        hauteur = Math.round(hauteur * ratio)
      }
      const canvas = document.createElement("canvas")
      canvas.width = largeur
      canvas.height = hauteur
      canvas.getContext("2d").drawImage(img, 0, 0, largeur, hauteur)
      URL.revokeObjectURL(img.src)
      resolve(canvas.toDataURL("image/jpeg", 0.7))
    }
    img.src = URL.createObjectURL(fichier)
  })
}

async function enregistrer(form, champs) {
  const infos = lire(form, champs)
  infos.photo = photo
  const bouton = form.querySelector("button[type=submit]")
  bouton.disabled = true
  const erreur = await sauver(form.dataset.table, ficheId, infos)
  bouton.disabled = false

  if (erreur) {
    let texte = "Erreur : " + erreur.message
    if (erreur.message.includes("appareil") || erreur.message.includes("prix")) {
      texte = "Il manque les colonnes Téléphone et Prix dans Supabase : exécute le petit texte SQL envoyé par Claude."
    }
    form.querySelector(".message").textContent = texte
    return
  }
  toast("Enregistré ✓")
  montrer(ecranActuel)
  await rafraichir()
}

$("form-client").onsubmit = function (e) {
  e.preventDefault()
  if (!e.target.elements.offre.value.includes("Post 24 mois")) e.target.elements.appareil.value = ""
  e.target.elements.prix.value = e.target.elements.prix.value.replace("$", "").trim()
  enregistrer(e.target, CHAMPS_CLIENT)
}

$("form-brs").onsubmit = function (e) {
  e.preventDefault()
  if (!e.target.elements.marque.value) {
    e.target.querySelector(".message").textContent = "Choisis Bell ou Virgin Plus."
    window.scrollTo(0, 0)
    return
  }
  enregistrer(e.target, CHAMPS_BRS)
}

document.querySelectorAll(".choix").forEach(function (div) {
  const form = div.closest("form")
  div.onclick = function (e) {
    const bouton = e.target.closest("button")
    if (!bouton) return
    const input = form.elements[div.dataset.champ]
    if (div.dataset.multiple) {
      let valeurs = input.value ? input.value.split(", ") : []
      if (valeurs.includes(bouton.dataset.valeur)) {
        valeurs = valeurs.filter(v => v !== bouton.dataset.valeur)
      } else {
        if (div.dataset.exclusif) {
          const autres = Array.from(div.querySelectorAll("button")).map(b => b.dataset.valeur)
          valeurs = valeurs.filter(v => !autres.includes(v))
        }
        valeurs.push(bouton.dataset.valeur)
      }
      input.value = valeurs.join(", ")
    } else {
      input.value = bouton.dataset.valeur
      form.querySelector(".message").textContent = ""
      if (div.dataset.champ === "statut" && input.value === "complete" && form.elements.rappele) {
        form.elements.rappele.checked = true
      }
    }
    majChoix(form)
    if (form.id === "form-profil") apercuProfil()
  }
})

document.querySelectorAll("form.fiche[data-table]").forEach(function (form) {
  form.querySelectorAll(".dates-rapides").forEach(function (div) {
    div.onclick = function (e) {
      const bouton = e.target.closest("button")
      if (!bouton) return
      form.elements[div.dataset.champ].value = dateDans(Number(bouton.dataset.jours))
    }
  })

  form.elements.telephone.oninput = () => majContacts(form)
  form.elements.telephone.onblur = function () {
    form.elements.telephone.value = formatTel(form.elements.telephone.value)
    majContacts(form)
  }

  form.querySelector(".input-photo").onchange = async function (e) {
    const fichier = e.target.files[0]
    if (!fichier) return
    photo = await reduirePhoto(fichier)
    afficherPhoto(form)
    e.target.value = ""
  }

  form.querySelector(".retirer-photo").onclick = function () {
    photo = null
    afficherPhoto(form)
  }

  form.querySelector(".annuler").onclick = () => montrer(ecranActuel)

  form.querySelector(".bouton-calendrier").onclick = function () {
    const nom = form.elements.nom.value.trim() || "Client"
    const tel = form.elements.telephone.value.trim()
    if (form.dataset.table === "brs") {
      const marque = form.elements.marque.value === "Virgin" ? "Virgin Plus" : "Bell"
      const details = ["Tél. : " + tel, "Commande : " + form.elements.commande.value, "Services : " + form.elements.services.value]
      ajouterCalendrier("🔧 Installation " + marque + " – " + nom, form.elements.date_install.value, details.join("\n"), form.elements.adresse.value)
    } else {
      const details = ["Tél. : " + tel, "Proposé : " + form.elements.offre.value, "Téléphone : " + form.elements.appareil.value, "Prix : " + form.elements.prix.value + " $/mois"]
      ajouterCalendrier("📞 Rappeler " + nom, form.elements.rappel.value, details.join("\n"), "")
    }
  }

  form.querySelector(".supprimer").onclick = async function () {
    if (!confirm("Supprimer pour de bon?")) return
    const erreur = await supprimer(form.dataset.table, ficheId)
    if (erreur) {
      form.querySelector(".message").textContent = "Erreur : " + erreur.message
      return
    }
    toast("Supprimé")
    montrer(ecranActuel)
    await rafraichir()
  }
})


// ---------- Calendrier ----------

function echapper(texte) {
  return (texte || "").replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\n/g, "\\n")
}

function ajouterCalendrier(titre, date, details, adresse) {
  if (!date) {
    toast("Choisis une date d'abord")
    return
  }
  const lignes = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Espace Equipe//FR",
    "BEGIN:VEVENT",
    "UID:" + Date.now() + "@espace-equipe",
    "DTSTAMP:" + new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z",
    "DTSTART;VALUE=DATE:" + date.replace(/-/g, ""),
    "SUMMARY:" + echapper(titre),
    "DESCRIPTION:" + echapper(details),
    "LOCATION:" + echapper(adresse),
    "BEGIN:VALARM",
    "TRIGGER:PT9H",
    "ACTION:DISPLAY",
    "DESCRIPTION:" + echapper(titre),
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR"
  ]
  const fichier = new Blob([lignes.join("\r\n")], { type: "text/calendar" })
  window.location.href = URL.createObjectURL(fichier)
}


// ---------- Notifications ----------

const notifsPossibles = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window
const estIphone = /iPhone|iPad|iPod/.test(navigator.userAgent)

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {})
}

function estInstallee() {
  return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true
}

function cleVapid(texte) {
  const base64 = (texte + "=".repeat((4 - texte.length % 4) % 4)).replace(/-/g, "+").replace(/_/g, "/")
  const brut = atob(base64)
  return Uint8Array.from(brut, c => c.charCodeAt(0))
}

function carteNotifs(titre, texte, bouton) {
  $("carte-notifs").hidden = false
  $("notifs-titre").textContent = titre
  $("notifs-texte").textContent = texte
  $("btn-notifs").hidden = !bouton
  $("btn-notifs").textContent = bouton || ""
}

async function majCarteNotifs() {
  $("carte-notifs").hidden = true
  if (modeEssai || typeof VAPID_PUBLIC === "undefined") return

  if (estIphone && !estInstallee()) {
    carteNotifs("Reçois ton résumé chaque matin", "Installe l'app d'abord : Partager → Sur l'écran d'accueil.", "")
    return
  }
  if (!notifsPossibles) return

  if (Notification.permission === "denied") {
    carteNotifs("Notifications bloquées", "Réglages du téléphone → Notifications → Équipe.", "")
    return
  }

  if (Notification.permission === "granted") {
    const inscription = await navigator.serviceWorker.ready
    const abonnement = await inscription.pushManager.getSubscription()
    if (abonnement) {
      carteNotifs("Notifications activées", "Résumé de ta journée chaque matin à 8 h.", "Tester")
      return
    }
  }

  carteNotifs("Résumé chaque matin à 8 h", "Une notification avec tes rappels et installations du jour.", "Activer")
}

$("btn-notifs").onclick = async function () {
  const bouton = $("btn-notifs")
  bouton.disabled = true
  if (bouton.textContent === "Tester") await testerNotifs()
  else await activerNotifs()
  bouton.disabled = false
}

async function activerNotifs() {
  const permission = await Notification.requestPermission()
  if (permission !== "granted") {
    majCarteNotifs()
    return
  }

  try {
    const inscription = await navigator.serviceWorker.ready
    let abonnement = await inscription.pushManager.getSubscription()
    if (!abonnement) {
      abonnement = await inscription.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: cleVapid(VAPID_PUBLIC)
      })
    }
    const infos = abonnement.toJSON()
    const reponse = await db.from("abonnements").upsert({
      endpoint: infos.endpoint,
      user_id: user.id,
      p256dh: infos.keys.p256dh,
      auth: infos.keys.auth
    })
    if (reponse.error) throw reponse.error
    toast("Notifications activées 🔔")
  } catch (erreur) {
    alert("Impossible d'activer les notifications : " + erreur.message)
  }
  majCarteNotifs()
}

async function testerNotifs() {
  const session = (await db.auth.getSession()).data.session
  let resultat
  try {
    const reponse = await fetch(SUPABASE_URL + "/functions/v1/" + FONCTION_NOTIFS, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + session.access_token,
        "apikey": SUPABASE_KEY
      },
      body: JSON.stringify({ test: true })
    })
    resultat = await reponse.text()
    if (!reponse.ok) {
      alert("Le test n'a pas marché (" + reponse.status + ") : " + resultat)
      return
    }
  } catch (erreur) {
    alert("Impossible de joindre la fonction de notifications. Vérifie son adresse dans Supabase et que « Verify JWT » est désactivé.")
    return
  }
  toast("Notification envoyée, regarde ton téléphone")
}


// ---------- Profil ----------

function dessinerAvatar(element, photo, emoji, couleur, nom) {
  element.textContent = photo ? "" : emoji || initiales(nom)
  element.style.backgroundColor = couleur
  element.style.backgroundImage = photo ? "url(" + photo + ")" : "none"
}

function majAvatarProfil() {
  const profil = monProfil()
  dessinerAvatar($("btn-profil"), maPhoto, profil.emoji, profil.couleur || "rgba(255, 255, 255, 0.2)", nomUser())
}

function apercuProfil() {
  const form = $("form-profil")
  const nom = form.elements.nom.value.trim() || "?"
  dessinerAvatar($("apercu-profil"), photoProfil, form.elements.emoji.value, form.elements.couleur.value || "#00549a", nom)
  $("retirer-photo-profil").hidden = !photoProfil
  $("nom-apercu").textContent = nom
  appliquerTheme(form.elements.theme.value)
}

$("btn-profil").onclick = ouvrirProfil
$("retour-profil").onclick = function () {
  appliquerTheme(lireMemoire("theme") || "")
  montrer(ecranActuel)
}

function ouvrirProfil() {
  const form = $("form-profil")
  const profil = monProfil()
  form.elements.nom.value = nomUser()
  form.elements.emoji.value = profil.emoji || ""
  form.elements.couleur.value = profil.couleur || "#00549a"
  form.elements.theme.value = lireMemoire("theme") || ""
  photoProfil = maPhoto
  form.querySelector(".message").textContent = ""
  $("courriel-profil").textContent = modeEssai ? "Mode essai" : user.email

  const moisCourant = aujourdhui().slice(0, 7)
  const mesClients = clients.filter(c => c.user_id === user.id)
  const mesBrs = brs.filter(b => b.user_id === user.id)
  $("p-ventes").textContent = mesClients.filter(c => c.statut === "vendu" && (c.created_at || "").slice(0, 7) === moisCourant).length
  $("p-installs").textContent = mesBrs.filter(b => (b.statut === "installe" || b.statut === "complete") && (b.date_install || "").slice(0, 7) === moisCourant).length
  $("p-suivis").textContent = mesClients.filter(c => c.statut === "a_rappeler").length

  $("groupe-notifs-profil").hidden = modeEssai
  $("profil-notifs").textContent = "Un résumé de ta journée chaque matin à 8 h. Active-les à partir de l'écran Aujourd'hui."

  majChoix(form)
  apercuProfil()
  montrer("profil")
}

$("form-profil").elements.nom.oninput = apercuProfil

$("input-photo-profil").onchange = async function (e) {
  const fichier = e.target.files[0]
  if (!fichier) return
  photoProfil = await photoCarree(fichier, 256)
  apercuProfil()
  e.target.value = ""
}

$("retirer-photo-profil").onclick = function () {
  photoProfil = null
  apercuProfil()
}

function photoCarree(fichier, taille) {
  return new Promise(function (resolve) {
    const img = new Image()
    img.onload = function () {
      const cote = Math.min(img.width, img.height)
      const x = (img.width - cote) / 2
      const y = (img.height - cote) / 2
      const canvas = document.createElement("canvas")
      canvas.width = taille
      canvas.height = taille
      canvas.getContext("2d").drawImage(img, x, y, cote, cote, 0, 0, taille, taille)
      URL.revokeObjectURL(img.src)
      resolve(canvas.toDataURL("image/jpeg", 0.8))
    }
    img.src = URL.createObjectURL(fichier)
  })
}

$("btn-tester-profil").onclick = testerNotifs

$("form-profil").onsubmit = async function (e) {
  e.preventDefault()
  const form = e.target
  const infos = {
    nom: form.elements.nom.value.trim(),
    emoji: form.elements.emoji.value,
    couleur: form.elements.couleur.value
  }
  ecrireMemoire("theme", form.elements.theme.value)

  if (modeEssai) {
    ecrireMemoire("profil", JSON.stringify(infos))
    ecrireMemoire("photoProfil", photoProfil || "")
  } else {
    if (photoProfil !== maPhoto) {
      const envoi = await db.from("profils").upsert({ user_id: user.id, photo: photoProfil })
      if (envoi.error) {
        form.querySelector(".message").textContent = "La photo n'a pas pu être enregistrée : il faut exécuter le texte SQL des profils dans Supabase."
        return
      }
    }
    const ancienNom = nomUser()
    const reponse = await db.auth.updateUser({ data: infos })
    if (reponse.error) {
      form.querySelector(".message").textContent = "Erreur : " + reponse.error.message
      return
    }
    user = reponse.data.user
    if (infos.nom !== ancienNom) {
      await db.from("clients").update({ vendeur: infos.nom }).eq("user_id", user.id)
      await db.from("brs").update({ vendeur: infos.nom }).eq("user_id", user.id)
    }
  }

  maPhoto = photoProfil || ""
  toast("Profil enregistré ✓")
  montrer(ecranActuel)
  await rafraichir()
}

demarrer()
