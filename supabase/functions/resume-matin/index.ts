import webpush from "npm:web-push@3.6.7"
import { createClient } from "npm:@supabase/supabase-js@2.118.0"

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)

const entetes = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-region, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS"
}

function maintenant() {
  const morceaux = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date())
  const valeur = (type: string) => morceaux.find((m) => m.type === type)!.value
  return {
    date: valeur("year") + "-" + valeur("month") + "-" + valeur("day"),
    heure: Number(valeur("hour"))
  }
}

function pluriel(nombre: number, un: string, plusieurs: string) {
  return nombre + " " + (nombre > 1 ? plusieurs : un)
}

function resume(userId: string, clients: any[], brs: any[], date: string) {
  const mesClients = clients.filter((c) => c.user_id === userId)
  const mesBrs = brs.filter((b) => b.user_id === userId)

  const aRappeler = mesClients.filter((c) => c.statut === "a_rappeler" && c.rappel && c.rappel <= date).length
  const installs = mesBrs.filter((b) => b.statut === "en_attente" && b.date_install && b.date_install <= date).length
  const apresInstall = mesBrs.filter((b) => b.statut === "installe" && !b.rappele).length
  const problemes = mesBrs.filter((b) => b.statut === "probleme").length

  const lignes = []
  if (aRappeler) lignes.push("📞 " + pluriel(aRappeler, "client à rappeler", "clients à rappeler"))
  if (installs) lignes.push("🔧 " + pluriel(installs, "installation à confirmer", "installations à confirmer"))
  if (apresInstall) lignes.push("☎️ " + pluriel(apresInstall, "client à rappeler après l'installation", "clients à rappeler après l'installation"))
  if (problemes) lignes.push("⚠️ " + pluriel(problemes, "problème BRS", "problèmes BRS"))
  return lignes
}

async function envoyer(abonnement: any, message: any) {
  try {
    await webpush.sendNotification(
      { endpoint: abonnement.endpoint, keys: { p256dh: abonnement.p256dh, auth: abonnement.auth } },
      JSON.stringify(message)
    )
    return true
  } catch (erreur: any) {
    if (erreur.statusCode === 404 || erreur.statusCode === 410) {
      await db.from("abonnements").delete().eq("endpoint", abonnement.endpoint)
    }
    console.log("Erreur d'envoi", erreur.statusCode, erreur.body)
    return false
  }
}

function reponse(contenu: any, statut = 200) {
  return new Response(JSON.stringify(contenu), {
    status: statut,
    headers: { ...entetes, "Content-Type": "application/json" }
  })
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: entetes })
  try {
    return await traiter(req)
  } catch (erreur: any) {
    return reponse({ erreur: erreur.message }, 500)
  }
})

async function traiter(req: Request) {
  const publique = Deno.env.get("VAPID_PUBLIC_KEY")
  const privee = Deno.env.get("VAPID_PRIVATE_KEY")
  if (!publique || !privee) return reponse({ erreur: "Il manque les secrets VAPID_PUBLIC_KEY ou VAPID_PRIVATE_KEY" }, 500)
  webpush.setVapidDetails("https://gaby6333.github.io/Job-Bell/", publique.trim(), privee.trim())

  const corps = await req.json().catch(() => ({}))
  const { date, heure } = maintenant()
  let abonnements: any[] = []

  if (corps.test) {
    const jeton = (req.headers.get("Authorization") || "").replace("Bearer ", "")
    const { data } = await db.auth.getUser(jeton)
    if (!data.user) return reponse({ erreur: "Pas connecté" }, 401)
    abonnements = (await db.from("abonnements").select("*").eq("user_id", data.user.id)).data || []
    if (abonnements.length === 0) return reponse({ erreur: "Aucun appareil inscrit" }, 400)
  } else {
    if (req.headers.get("x-cle") !== (Deno.env.get("CLE_CRON") || "").trim()) return reponse({ erreur: "Non autorisé" }, 403)
    if (heure !== 8 && !corps.forcer) return reponse({ message: "Pas encore 8 h", heure })
    abonnements = (await db.from("abonnements").select("*")).data || []
  }

  const clients = (await db.from("clients").select("user_id, statut, rappel")).data || []
  const brs = (await db.from("brs").select("user_id, statut, date_install, rappele")).data || []

  let envoyes = 0
  for (const abonnement of abonnements) {
    const lignes = resume(abonnement.user_id, clients, brs, date)
    if (lignes.length === 0 && !corps.test) continue

    const message = lignes.length
      ? { titre: "☀️ Ta journée", texte: lignes.join("\n") }
      : { titre: "🔔 Ça marche!", texte: "Rien d'urgent pour l'instant. Tu recevras ton résumé chaque matin à 8 h." }

    if (await envoyer(abonnement, message)) envoyes++
  }

  if (corps.test && envoyes === 0) return reponse({ erreur: "La notification n'a pas pu être envoyée à ton appareil" }, 500)

  return reponse({ envoyes })
}
