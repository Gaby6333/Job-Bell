self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()))

self.addEventListener("push", function (e) {
  let message = {}
  try {
    message = e.data ? e.data.json() : {}
  } catch (erreur) {
    message = { texte: e.data ? e.data.text() : "" }
  }
  e.waitUntil(
    self.registration.showNotification(message.titre || "Espace Équipe", {
      body: message.texte || "",
      icon: "icon-180.png",
      badge: "icon-180.png"
    })
  )
})

self.addEventListener("notificationclick", function (e) {
  e.notification.close()
  e.waitUntil(
    self.clients.matchAll({ type: "window" }).then(function (fenetres) {
      for (const fenetre of fenetres) {
        if ("focus" in fenetre) return fenetre.focus()
      }
      return self.clients.openWindow("./")
    })
  )
})
