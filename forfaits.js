// Liste des forfaits par zone. Pour changer un prix ou ajouter un forfait, modifie seulement ce fichier.
// EXEMPLES : les noms, vitesses et prix sont à remplacer par les vrais.
const ZONES = [
  {
    nom: "Zone 1",
    description: "Fibre jusqu'à la maison",
    couleur: "#00549a",
    forfaits: [
      { nom: "Gigabit Fibe 500", vitesse: "500 Mbit/s", prix: "XX $/mois", note: "1 à 2 personnes" },
      { nom: "Gigabit Fibe 1.5", vitesse: "1,5 Gbit/s", prix: "XX $/mois", note: "Famille, télétravail" },
      { nom: "Gigabit Fibe 3.0", vitesse: "3 Gbit/s", prix: "XX $/mois", note: "Gamers, grosse maison" },
      { nom: "Gigabit Fibe 8.0", vitesse: "8 Gbit/s", prix: "XX $/mois", note: "Le plus rapide" }
    ]
  },
  {
    nom: "Zone 2",
    description: "Pas encore la fibre jusqu'à la maison",
    couleur: "#7b3fa0",
    forfaits: [
      { nom: "Internet 25", vitesse: "25 Mbit/s", prix: "XX $/mois", note: "Usage léger" },
      { nom: "Internet 50", vitesse: "50 Mbit/s", prix: "XX $/mois", note: "1 à 2 personnes" },
      { nom: "Internet 100", vitesse: "100 Mbit/s", prix: "XX $/mois", note: "Famille" }
    ]
  }
]
