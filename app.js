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

const CHAMPS_CLIENT = ["nom", "telephone", "statut", "rappel", "offre", "notes"]
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

function nomUser() {
  if (modeEssai) return "Moi"
  return user.user_metadata.nom || user.email
}

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
  const ecrans = ["connexion", "accueil", "clients", "brs", "fiche-client", "fiche-brs"]
  for (const nom of ecrans) {
    $("ecran-" + nom).hidden = nom !== ecran
  }

  const principal = ["accueil", "clients", "brs"].includes(ecran)
  if (principal) ecranActuel = ecran

  $("nav").hidden = !principal
  $("barre-portee").hidden = !principal
  $("btn-deconnexion").hidden = modeEssai || ecran === "connexion"

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
    if (bouton.dataset.ajouter === "brs") ouvrirBrs(null)
    else ouvrirClient(null)
  }
})


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
    if (table === "brs" && reponse.error.message.includes("brs")) {
      afficherErreur("La section BRS n'est pas encore activée : il faut coller le texte SQL des BRS dans Supabase.")
    } else {
      afficherErreur("Erreur de chargement : " + reponse.error.message)
    }
    return null
  }
  return reponse.data
}

async function rafraichir() {
  afficherErreur("")
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
  const texte = [element.nom, element.offre, element.notes, element.vendeur, element.adresse, element.commande, element.services, element.marque]
    .filter(Boolean).join(" ").toLowerCase()
  const tel = (element.telephone || "").replace(/\D/g, "")
  return texte.includes(recherche) || (chiffres.length >= 3 && tel.includes(chiffres))
}

function creerCarte(titre, badge, couleur, details, telephone, vendeur) {
  const li = document.createElement("li")
  li.className = "item"
  li.innerHTML = `
    <div class="ligne1"><strong></strong><span class="badge"></span></div>
    <p class="details"></p>
    <div class="bas"><span class="qui"></span><span class="liens"></span></div>
  `
  li.querySelector("strong").textContent = titre
  li.querySelector(".badge").textContent = badge
  li.querySelector(".badge").classList.add(couleur)
  li.querySelector(".details").textContent = details || ""
  li.querySelector(".details").hidden = !details
  li.querySelector(".qui").textContent = vendeur || ""

  if (telephone) {
    const chiffres = telephone.replace(/[^\d+]/g, "")
    const liens = li.querySelector(".liens")
    liens.innerHTML = `<a>📞 Appeler</a><a>💬 Texto</a>`
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
      badge = dateTexte(c.rappel)
      const jours = joursAvant(c.rappel)
      if (jours < 0) couleur = "rouge"
      if (jours === 0) couleur = "orange"
    }
  }

  const li = creerCarte(c.nom, badge, couleur, c.offre, c.telephone, c.vendeur)
  li.classList.add("bord-" + couleur)
  li.onclick = () => ouvrirClient(c)
  return li
}

function carteBrs(b, action) {
  let badge = STATUTS_BRS[b.statut] || ""
  let couleur = { en_attente: "bleu", installe: "orange", probleme: "rouge", complete: "vert" }[b.statut] || "gris"

  if (b.statut === "en_attente" && b.date_install) {
    badge = "Install. " + dateTexte(b.date_install).toLowerCase()
    const jours = joursAvant(b.date_install)
    if (jours < 0) couleur = "rouge"
    if (jours === 0) couleur = "orange"
  }
  if (b.statut === "installe" && !b.rappele) badge = "Installé · à rappeler"

  let details = [b.marque === "Virgin" ? "Virgin Plus" : "Bell", b.services].filter(Boolean).join(" · ")
  if (b.commande) details += " · #" + b.commande

  const li = creerCarte(b.nom, badge, couleur, details, b.telephone, b.vendeur)
  li.classList.add(b.marque === "Virgin" ? "virgin" : "bell")

  if (b.statut === "probleme" && b.probleme) {
    const alerte = document.createElement("p")
    alerte.className = "alerte"
    alerte.textContent = "⚠️ " + b.probleme
    li.querySelector(".details").after(alerte)
  }

  if (action) {
    const bouton = document.createElement("button")
    bouton.className = "rapide"
    bouton.textContent = action.texte
    bouton.onclick = async function (e) {
      e.stopPropagation()
      const erreur = await sauver("brs", b.id, Object.assign({}, action.champs))
      if (erreur) {
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
  const date = new Date().toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" })
  $("bonjour").textContent = "Bonjour" + prenom + " 👋 · " + date

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

  $("pastille").textContent = urgent
  $("pastille").hidden = urgent === 0
}


// ---------- Liste des clients ----------

function filtrerClients(liste, filtre) {
  if (filtre === "rappels") return liste.filter(c => c.statut === "a_rappeler")
  if (filtre === "tous") return liste
  return liste.filter(c => c.statut === filtre)
}

function afficherClients() {
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
  }
}

async function ouvrirBrs(b) {
  const form = $("form-brs")
  ficheId = b ? b.id : null
  remplir(form, b || { marque: "Bell", statut: "en_attente" }, CHAMPS_BRS)
  preparerFiche(form, b, b ? b.nom : "Nouveau BRS")
  montrer("fiche-brs")
  if (b) {
    photo = await chargerPhoto("brs", b.id)
    afficherPhoto(form)
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
    form.querySelector(".message").textContent = "Erreur : " + erreur.message
    return
  }
  toast("Enregistré ✓")
  montrer(ecranActuel)
  await rafraichir()
}

$("form-client").onsubmit = function (e) {
  e.preventDefault()
  enregistrer(e.target, CHAMPS_CLIENT)
}

$("form-brs").onsubmit = function (e) {
  e.preventDefault()
  enregistrer(e.target, CHAMPS_BRS)
}

document.querySelectorAll("form.fiche").forEach(function (form) {
  form.querySelectorAll(".choix").forEach(function (div) {
    div.onclick = function (e) {
      const bouton = e.target.closest("button")
      if (!bouton) return
      const input = form.elements[div.dataset.champ]
      if (div.dataset.multiple) {
        let valeurs = input.value ? input.value.split(", ") : []
        if (valeurs.includes(bouton.dataset.valeur)) {
          valeurs = valeurs.filter(v => v !== bouton.dataset.valeur)
        } else {
          valeurs.push(bouton.dataset.valeur)
        }
        input.value = valeurs.join(", ")
      } else {
        input.value = bouton.dataset.valeur
        if (div.dataset.champ === "statut" && input.value === "complete" && form.elements.rappele) {
          form.elements.rappele.checked = true
        }
      }
      majChoix(form)
    }
  })

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

demarrer()
