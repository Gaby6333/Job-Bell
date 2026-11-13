let db = null
let user = null
let clients = []
let filtre = "rappels"
let ficheId = null
let photo = null
let modeInscription = false

const modeEssai = !SUPABASE_URL || !SUPABASE_KEY
if (!modeEssai) {
  db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
}

function $(id) {
  return document.getElementById(id)
}

function montrer(ecran) {
  $("ecran-connexion").hidden = ecran !== "connexion"
  $("ecran-liste").hidden = ecran !== "liste"
  $("ecran-fiche").hidden = ecran !== "fiche"
  $("ecran-forfaits").hidden = ecran !== "forfaits"
  $("ecran-forfait").hidden = ecran !== "forfait"
  $("menu").hidden = ecran !== "liste" && ecran !== "forfaits"
  $("btn-deconnexion").hidden = modeEssai || ecran === "connexion"
  document.querySelectorAll("#menu button").forEach(function (b) {
    b.classList.toggle("actif", b.dataset.ecran === ecran)
  })
  window.scrollTo(0, 0)
}

function aujourdhui() {
  const d = new Date()
  const mois = String(d.getMonth() + 1).padStart(2, "0")
  const jour = String(d.getDate()).padStart(2, "0")
  return d.getFullYear() + "-" + mois + "-" + jour
}

function formatDate(texte) {
  if (!texte) return ""
  const d = new Date(texte + "T12:00:00")
  return d.toLocaleDateString("fr-CA", { day: "numeric", month: "short" })
}

function nomUser() {
  if (modeEssai) return "Moi"
  return user.user_metadata.nom || user.email
}


// ---------- Connexion ----------

async function demarrer() {
  if (modeEssai) {
    user = { id: "local" }
    $("bandeau-essai").hidden = false
    await chargerForfaits()
    await chargerClients()
    montrer("liste")
    return
  }

  const reponse = await db.auth.getSession()
  if (reponse.data.session) {
    user = reponse.data.session.user
    await chargerForfaits()
    await chargerClients()
    montrer("liste")
  } else {
    montrer("connexion")
  }
}

$("btn-changer-mode").onclick = function () {
  modeInscription = !modeInscription
  $("champ-nom").hidden = !modeInscription
  $("titre-connexion").textContent = modeInscription ? "Créer un compte" : "Connexion"
  $("btn-connexion").textContent = modeInscription ? "Créer mon compte" : "Se connecter"
  $("btn-changer-mode").textContent = modeInscription ? "J'ai déjà un compte" : "Pas de compte? Créer un compte"
  $("msg-connexion").textContent = ""
}

$("form-connexion").onsubmit = async function (e) {
  e.preventDefault()
  const form = e.target
  const courriel = form.courriel.value.trim()
  const motdepasse = form.motdepasse.value
  const nom = form.nom.value.trim()
  $("msg-connexion").textContent = ""

  let reponse
  if (modeInscription) {
    if (!nom) {
      $("msg-connexion").textContent = "Écris ton nom pour que les autres sachent qui a fait le suivi."
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
    $("msg-connexion").textContent = traduireErreur(reponse.error.message)
    return
  }
  if (!reponse.data.session) {
    $("msg-connexion").textContent = "Compte créé! Va confirmer ton courriel, puis connecte-toi."
    return
  }

  user = reponse.data.session.user
  await chargerForfaits()
  await chargerClients()
  montrer("liste")
}

$("btn-deconnexion").onclick = async function () {
  await db.auth.signOut()
  user = null
  clients = []
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

async function chargerClients() {
  if (modeEssai) {
    clients = JSON.parse(localStorage.getItem("clients") || "[]")
  } else {
    const reponse = await db
      .from("clients")
      .select("id, created_at, user_id, vendeur, nom, telephone, zone, offre, notes, statut, rappel, modifie_par")
      .order("rappel", { ascending: true, nullsFirst: false })
    if (reponse.error) {
      alert("Erreur de chargement : " + reponse.error.message)
      return
    }
    clients = reponse.data
  }
  afficherListe()
}

async function sauverClient(infos) {
  if (modeEssai) {
    if (ficheId) {
      const client = clients.find(c => c.id === ficheId)
      Object.assign(client, infos)
    } else {
      infos.id = Date.now()
      infos.created_at = new Date().toISOString()
      infos.user_id = "local"
      infos.vendeur = "Moi"
      clients.push(infos)
    }
    localStorage.setItem("clients", JSON.stringify(clients))
    return null
  }

  let reponse
  if (ficheId) {
    infos.modifie_par = nomUser()
    reponse = await db.from("clients").update(infos).eq("id", ficheId)
  } else {
    infos.vendeur = nomUser()
    reponse = await db.from("clients").insert(infos)
  }
  return reponse.error
}

async function supprimerClient(id) {
  if (modeEssai) {
    clients = clients.filter(c => c.id !== id)
    localStorage.setItem("clients", JSON.stringify(clients))
    return null
  }
  const reponse = await db.from("clients").delete().eq("id", id)
  return reponse.error
}

async function chargerPhoto(id) {
  if (modeEssai) {
    const client = clients.find(c => c.id === id)
    return client.photo || null
  }
  const reponse = await db.from("clients").select("photo").eq("id", id).single()
  if (reponse.error) return null
  return reponse.data.photo
}


// ---------- Liste ----------

function afficherListe() {
  const today = aujourdhui()
  const moisCourant = today.slice(0, 7)
  const recherche = $("recherche").value.trim().toLowerCase()

  let nbRetard = 0
  let nbAujourdhui = 0
  let nbVendus = 0
  for (const c of clients) {
    if (c.statut === "a_rappeler" && c.rappel && c.rappel < today) nbRetard++
    if (c.statut === "a_rappeler" && c.rappel === today) nbAujourdhui++
    if (c.statut === "vendu" && c.created_at && c.created_at.slice(0, 7) === moisCourant) nbVendus++
  }
  $("nb-retard").textContent = nbRetard
  $("nb-aujourdhui").textContent = nbAujourdhui
  $("nb-vendus").textContent = nbVendus

  let visibles = clients
  if (filtre === "rappels") {
    visibles = clients.filter(c => c.statut === "a_rappeler")
  } else if (filtre === "miens") {
    visibles = clients.filter(c => c.user_id === user.id)
  }

  if (recherche) {
    const chiffres = recherche.replace(/\D/g, "")
    visibles = visibles.filter(function (c) {
      const texte = (c.nom + " " + (c.offre || "") + " " + (c.notes || "") + " " + (c.vendeur || "")).toLowerCase()
      const tel = (c.telephone || "").replace(/\D/g, "")
      return texte.includes(recherche) || (chiffres && tel.includes(chiffres))
    })
  }

  visibles = visibles.slice().sort(function (a, b) {
    const da = a.rappel || "9999"
    const dbb = b.rappel || "9999"
    return da.localeCompare(dbb)
  })

  const liste = $("liste")
  liste.innerHTML = ""

  for (const c of visibles) {
    const li = document.createElement("li")

    if (c.statut === "vendu") li.classList.add("vendu")
    else if (c.statut === "a_rappeler" && c.rappel && c.rappel < today) li.classList.add("retard")
    else if (c.statut === "a_rappeler" && c.rappel === today) li.classList.add("aujourdhui")

    let date = ""
    if (c.statut === "vendu") date = "✅ Vendu"
    else if (c.statut === "pas_interesse") date = "Pas intéressé"
    else if (c.rappel === today) date = "Aujourd'hui"
    else if (c.rappel) date = formatDate(c.rappel)

    li.innerHTML = `
      <div class="ligne1"><strong></strong><span class="date"></span></div>
      <p class="offre"></p>
      <div class="bas"><span class="vendeur"></span><a class="tel"></a></div>
    `
    li.querySelector("strong").textContent = c.nom
    li.querySelector(".date").textContent = date
    li.querySelector(".offre").textContent = c.offre || ""
    li.querySelector(".vendeur").textContent = (c.vendeur || "") + (c.zone ? " · " + c.zone : "")

    const lienTel = li.querySelector(".tel")
    if (c.telephone) {
      lienTel.textContent = "📞 " + c.telephone
      lienTel.href = "tel:" + c.telephone.replace(/[^\d+]/g, "")
      lienTel.onclick = e => e.stopPropagation()
    }

    li.onclick = () => ouvrirFiche(c)
    liste.appendChild(li)
  }

  $("liste-vide").hidden = visibles.length > 0
}

document.querySelectorAll(".onglets button").forEach(function (bouton) {
  bouton.onclick = function () {
    document.querySelectorAll(".onglets button").forEach(b => b.classList.remove("actif"))
    bouton.classList.add("actif")
    filtre = bouton.dataset.filtre
    afficherListe()
  }
})

$("recherche").oninput = afficherListe


// ---------- Fiche ----------

$("btn-ajouter").onclick = () => ouvrirFiche(null)

async function ouvrirFiche(client) {
  const form = $("form-fiche")
  form.reset()
  $("msg-fiche").textContent = ""
  photo = null
  afficherPhoto()

  if (client) {
    ficheId = client.id
    $("titre-fiche").textContent = client.nom
    form.nom.value = client.nom
    form.telephone.value = client.telephone || ""
    remplirSelectZone(client.zone)
    form.offre.value = client.offre || ""
    form.notes.value = client.notes || ""
    form.statut.value = client.statut || "a_rappeler"
    form.rappel.value = client.rappel || ""

    let info = "Ajouté par " + (client.vendeur || "?")
    if (client.created_at) info += " le " + new Date(client.created_at).toLocaleDateString("fr-CA")
    if (client.modifie_par) info += " · modifié par " + client.modifie_par
    $("info-vendeur").textContent = info

    $("btn-supprimer").hidden = client.user_id !== user.id
    afficherPropositions()
    montrer("fiche")

    photo = await chargerPhoto(client.id)
    afficherPhoto()
  } else {
    ficheId = null
    remplirSelectZone("")
    $("titre-fiche").textContent = "Nouveau client"
    $("info-vendeur").textContent = ""
    $("btn-supprimer").hidden = true
    afficherPropositions()
    montrer("fiche")
  }
}

function afficherPhoto() {
  $("apercu-photo").hidden = !photo
  $("btn-retirer-photo").hidden = !photo
  if (photo) $("apercu-photo").src = photo
}

$("input-photo").onchange = async function (e) {
  const fichier = e.target.files[0]
  if (!fichier) return
  photo = await reduirePhoto(fichier)
  afficherPhoto()
  e.target.value = ""
}

$("btn-retirer-photo").onclick = function () {
  photo = null
  afficherPhoto()
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

$("form-fiche").onsubmit = async function (e) {
  e.preventDefault()
  const form = e.target
  const infos = {
    nom: form.nom.value.trim(),
    telephone: form.telephone.value.trim(),
    zone: form.zone.value || null,
    offre: form.offre.value.trim(),
    notes: form.notes.value.trim(),
    statut: form.statut.value,
    rappel: form.rappel.value || null,
    photo: photo
  }

  const erreur = await sauverClient(infos)
  if (erreur) {
    $("msg-fiche").textContent = "Erreur : " + erreur.message
    return
  }
  await chargerClients()
  montrer("liste")
}

$("btn-annuler").onclick = () => montrer("liste")

$("btn-supprimer").onclick = async function () {
  if (!confirm("Supprimer ce client pour de bon?")) return
  const erreur = await supprimerClient(ficheId)
  if (erreur) {
    $("msg-fiche").textContent = "Erreur : " + erreur.message
    return
  }
  await chargerClients()
  montrer("liste")
}

// ---------- Forfaits Internet ----------

let forfaits = []
let zoneAffichee = null
let modeModif = false
let forfaitId = null
const couleurs = ["#00549a", "#7b3fa0", "#00897b", "#c75b00"]

async function chargerForfaits() {
  if (modeEssai) {
    forfaits = JSON.parse(localStorage.getItem("forfaits") || "[]")
  } else {
    const reponse = await db.from("forfaits").select("*").order("zone").order("id")
    if (reponse.error) {
      alert("Erreur de chargement des forfaits : " + reponse.error.message)
      return
    }
    forfaits = reponse.data
  }
  remplirSelectZone($("select-zone").value)
}

function listeZones() {
  const zones = []
  for (const f of forfaits) {
    if (!zones.includes(f.zone)) zones.push(f.zone)
  }
  return zones.sort()
}

function couleurZone(zone) {
  const i = listeZones().indexOf(zone)
  return couleurs[Math.max(i, 0) % couleurs.length]
}

document.querySelectorAll("#menu button").forEach(function (bouton) {
  bouton.onclick = function () {
    if (bouton.dataset.ecran === "forfaits") afficherForfaits()
    montrer(bouton.dataset.ecran)
  }
})

$("btn-modifier-forfaits").onclick = function () {
  modeModif = !modeModif
  afficherForfaits()
}

function afficherForfaits() {
  const zones = listeZones()
  if (!zones.includes(zoneAffichee)) zoneAffichee = zones[0] || null

  $("btn-modifier-forfaits").textContent = modeModif ? "Terminé" : "✏️ Modifier les forfaits"
  $("btn-ajouter-forfait").hidden = !modeModif

  const choix = $("choix-zone")
  choix.innerHTML = ""
  for (const zone of zones) {
    const couleur = couleurZone(zone)
    const bouton = document.createElement("button")
    bouton.textContent = zone
    bouton.style.borderColor = couleur
    if (zone === zoneAffichee) {
      bouton.style.background = couleur
      bouton.style.color = "white"
    } else {
      bouton.style.color = couleur
    }
    bouton.onclick = function () {
      zoneAffichee = zone
      afficherForfaits()
    }
    choix.appendChild(bouton)
  }

  const liste = $("liste-forfaits")
  liste.innerHTML = ""
  $("forfaits-vide").hidden = zones.length > 0

  for (const f of forfaits.filter(f => f.zone === zoneAffichee)) {
    const couleur = couleurZone(f.zone)
    const li = document.createElement("li")
    li.style.borderLeftColor = couleur
    li.innerHTML = `
      <div class="vitesse"></div>
      <div class="infos"><strong></strong><span class="note"></span></div>
      <div class="prix"></div>
    `
    li.querySelector(".vitesse").textContent = f.vitesse || ""
    li.querySelector(".vitesse").style.color = couleur
    li.querySelector("strong").textContent = f.nom
    li.querySelector(".note").textContent = f.note || ""
    li.querySelector(".prix").textContent = f.prix || ""
    if (modeModif) {
      li.classList.add("modifiable")
      li.onclick = () => ouvrirForfait(f)
    }
    liste.appendChild(li)
  }
}

$("btn-ajouter-forfait").onclick = () => ouvrirForfait(null)

function ouvrirForfait(f) {
  const form = $("form-forfait")
  form.reset()
  $("msg-forfait").textContent = ""

  const choix = $("zones-existantes")
  choix.innerHTML = ""
  for (const zone of listeZones()) {
    const option = document.createElement("option")
    option.value = zone
    choix.appendChild(option)
  }

  if (f) {
    forfaitId = f.id
    $("titre-forfait").textContent = "Modifier le forfait"
    form.zone.value = f.zone
    form.nom.value = f.nom
    form.vitesse.value = f.vitesse || ""
    form.prix.value = f.prix || ""
    form.note.value = f.note || ""
    $("btn-supprimer-forfait").hidden = false
  } else {
    forfaitId = null
    $("titre-forfait").textContent = "Nouveau forfait"
    form.zone.value = zoneAffichee || ""
    $("btn-supprimer-forfait").hidden = true
  }
  montrer("forfait")
}

$("form-forfait").onsubmit = async function (e) {
  e.preventDefault()
  const form = e.target
  const infos = {
    zone: form.zone.value.trim(),
    nom: form.nom.value.trim(),
    vitesse: form.vitesse.value.trim(),
    prix: form.prix.value.trim(),
    note: form.note.value.trim()
  }

  let erreur = null
  if (modeEssai) {
    if (forfaitId) {
      Object.assign(forfaits.find(f => f.id === forfaitId), infos)
    } else {
      infos.id = Date.now()
      forfaits.push(infos)
    }
    localStorage.setItem("forfaits", JSON.stringify(forfaits))
  } else if (forfaitId) {
    erreur = (await db.from("forfaits").update(infos).eq("id", forfaitId)).error
  } else {
    erreur = (await db.from("forfaits").insert(infos)).error
  }

  if (erreur) {
    $("msg-forfait").textContent = "Erreur : " + erreur.message
    return
  }
  zoneAffichee = infos.zone
  await chargerForfaits()
  afficherForfaits()
  montrer("forfaits")
}

$("btn-annuler-forfait").onclick = () => montrer("forfaits")

$("btn-supprimer-forfait").onclick = async function () {
  if (!confirm("Supprimer ce forfait?")) return
  let erreur = null
  if (modeEssai) {
    forfaits = forfaits.filter(f => f.id !== forfaitId)
    localStorage.setItem("forfaits", JSON.stringify(forfaits))
  } else {
    erreur = (await db.from("forfaits").delete().eq("id", forfaitId)).error
  }
  if (erreur) {
    $("msg-forfait").textContent = "Erreur : " + erreur.message
    return
  }
  await chargerForfaits()
  afficherForfaits()
  montrer("forfaits")
}

function remplirSelectZone(valeur) {
  const select = $("select-zone")
  const zones = listeZones()
  if (valeur && !zones.includes(valeur)) zones.push(valeur)
  select.innerHTML = '<option value="">Pas d\'Internet / je ne sais pas</option>'
  for (const zone of zones) {
    const option = document.createElement("option")
    option.value = zone
    option.textContent = zone
    select.appendChild(option)
  }
  select.value = valeur || ""
}

$("select-zone").onchange = afficherPropositions

function afficherPropositions() {
  const select = $("select-zone")
  const boite = $("propositions")
  boite.innerHTML = ""

  const couleur = couleurZone(select.value)
  for (const f of forfaits.filter(f => f.zone === select.value)) {
    const puce = document.createElement("button")
    puce.type = "button"
    puce.textContent = f.nom + (f.vitesse ? " · " + f.vitesse : "")
    puce.style.borderColor = couleur
    puce.style.color = couleur
    puce.onclick = function () {
      const offre = $("form-fiche").offre
      let texte = f.nom
      const details = [f.vitesse, f.prix].filter(Boolean).join(", ")
      if (details) texte += " (" + details + ")"
      offre.value = offre.value.trim() ? offre.value.trim() + " + " + texte : texte
    }
    boite.appendChild(puce)
  }
}

demarrer()
