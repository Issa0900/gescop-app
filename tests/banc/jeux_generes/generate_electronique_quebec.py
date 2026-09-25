# -*- coding: utf-8 -*-
"""
Génère un jeu de données fictif pour un détaillant québécois d'électronique
grand public (style Best Buy), sur le modèle des jeux 01-10 de ce dossier.

Pas intégré à generate_all.py (qui a sa propre suite de non-régression figée à
10 jeux, cf. qa/REPRISE.md) : script autonome, à lancer séparément, pour tester
manuellement l'import sur un secteur "commerce de détail électronique" et pour
alimenter la démo/onboarding du test Radar.

Sortie : tests/banc/jeux_generes/11_electronique_quebec/
  - produits.csv      (catalogue, colonnes "à la POS", pas les noms internes GESCOP)
  - clients.csv
  - commandes.csv      (une ligne = un article vendu ; plusieurs lignes peuvent
                         partager un même No commande, comme un vrai panier)
  - inventaire.csv     (relevé de stock par succursale, à une date donnée)
  - verite.json         (valeurs attendues, calculées ici, hors moteur GESCOP)

Usage : python generate_electronique_quebec.py   (déterministe, graine fixe)
"""
import csv, json, os, random, datetime as dt

ICI = os.path.dirname(os.path.abspath(__file__))
DOSSIER = os.path.join(ICI, "11_electronique_quebec")
os.makedirs(DOSSIER, exist_ok=True)
R = random.Random(20260926112)

TPS = 0.05
TVQ = 0.09975

SUCCURSALES = [
    ("Montréal - Centre-Ville", "Montréal", "QC"),
    ("Laval - Carrefour", "Laval", "QC"),
    ("Québec - Sainte-Foy", "Québec", "QC"),
    ("Gatineau - Les Promenades", "Gatineau", "QC"),
    ("Sherbrooke - Plaza", "Sherbrooke", "QC"),
]

CATALOGUE = [
    # (sku, nom, categorie, sous-categorie, cout, prix)
    ("TV-55Q-SAM", "Téléviseur Samsung QLED 55po", "Téléviseurs", "QLED", 620.00, 999.99),
    ("TV-65U-LG", "Téléviseur LG UHD 65po", "Téléviseurs", "UHD", 540.00, 899.99),
    ("TV-43S-SON", "Téléviseur Sony 43po Smart", "Téléviseurs", "Smart TV", 310.00, 549.99),
    ("PORT-15-DELL", "Ordinateur portable Dell Inspiron 15", "Ordinateurs portables", "Milieu de gamme", 480.00, 799.99),
    ("PORT-14-HP", "Ordinateur portable HP Pavilion 14", "Ordinateurs portables", "Entrée de gamme", 390.00, 649.99),
    ("PORT-16-APL", "MacBook Air 13po M3", "Ordinateurs portables", "Haut de gamme", 950.00, 1449.99),
    ("TEL-15-APL", "iPhone 15 128Go", "Téléphones intelligents", "Premium", 720.00, 1099.99),
    ("TEL-S24-SAM", "Samsung Galaxy S24", "Téléphones intelligents", "Premium", 610.00, 949.99),
    ("TEL-A15-SAM", "Samsung Galaxy A15", "Téléphones intelligents", "Milieu de gamme", 180.00, 279.99),
    ("AUD-QC45-BOS", "Casque Bose QuietComfort 45", "Audio et casques", "Casques", 190.00, 329.99),
    ("AUD-BUDS-SON", "Écouteurs Sony WF-1000XM5", "Audio et casques", "Écouteurs", 210.00, 349.99),
    ("AUD-BAR-SAM", "Barre de son Samsung HW-Q800", "Audio et casques", "Barres de son", 340.00, 549.99),
    ("ELM-FRI-SAM", "Réfrigérateur Samsung 26pi3", "Électroménagers", "Réfrigération", 1180.00, 1799.99),
    ("ELM-LAV-LG", "Laveuse LG à chargement frontal", "Électroménagers", "Buanderie", 640.00, 999.99),
    ("ELM-MIC-PAN", "Four à micro-ondes Panasonic", "Électroménagers", "Cuisine", 85.00, 149.99),
    ("JEU-PS5-SON", "Console Sony PlayStation 5", "Consoles et jeux vidéo", "Consoles", 430.00, 649.99),
    ("JEU-XSX-MSF", "Console Xbox Series X", "Consoles et jeux vidéo", "Consoles", 420.00, 629.99),
    ("JEU-SW-NIN", "Console Nintendo Switch OLED", "Consoles et jeux vidéo", "Consoles", 260.00, 399.99),
    ("TAB-IPD-APL", "iPad 10e génération", "Tablettes", "Grand public", 340.00, 549.99),
    ("TAB-TABA-SAM", "Samsung Galaxy Tab A9", "Tablettes", "Entrée de gamme", 140.00, 229.99),
    ("ACC-CHG-APL", "Chargeur mural USB-C Apple", "Accessoires", "Chargement", 15.00, 34.99),
    ("ACC-ETU-OTB", "Étui de protection OtterBox", "Accessoires", "Protection", 12.00, 39.99),
    ("ACC-CAB-ANK", "Câble USB-C Anker 2m", "Accessoires", "Câblage", 6.00, 19.99),
]

PRENOMS = ["Julie", "Marc", "Sophie", "Luc", "Nadia", "Éric", "Chloé", "Karim", "Isabelle", "Hugo",
           "Amélie", "Yann", "Léa", "Samuel", "Maya", "Antoine", "Camille", "Félix", "Rosalie", "Simon"]
NOMS = ["Tremblay", "Gagnon", "Roy", "Côté", "Bouchard", "Gauthier", "Morin", "Lavoie", "Fortin", "Gagné",
        "Ouellet", "Pelletier", "Bélanger", "Lévesque", "Bergeron", "Boucher", "Girard", "Simard", "Caron", "Beaulieu"]

D_DEBUT = dt.date(2026, 3, 1)
D_FIN = dt.date(2026, 8, 31)

def arr(x): return round(x + 1e-9, 2)
def date_aleatoire(debut, fin): return debut + dt.timedelta(days=R.randint(0, (fin - debut).days))

def ecrire_csv(nom, entetes, lignes):
    with open(os.path.join(DOSSIER, nom), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(entetes)
        for l in lignes: w.writerow(l)

# ---------------------------------------------------------------- Produits
produits_rows = []
for sku, nom, cat, souscat, cout, prix in CATALOGUE:
    produits_rows.append([sku, nom, cat, souscat, "actif", arr(cout), arr(prix)])
ecrire_csv("produits.csv", ["SKU", "Nom du produit", "Catégorie", "Sous-catégorie", "Statut", "Coût unitaire", "Prix de vente"], produits_rows)

# ---------------------------------------------------------------- Clients
clients_rows = []
clients_ids = []
for i in range(120):
    cid = f"CL{i+1:04d}"
    clients_ids.append(cid)
    prenom, nom = R.choice(PRENOMS), R.choice(NOMS)
    succ = R.choice(SUCCURSALES)
    clients_rows.append([
        cid, f"{prenom} {nom}", f"{prenom.lower()}.{nom.lower()}@courriel.ca",
        succ[1], "QC", date_aleatoire(dt.date(2023, 1, 1), D_DEBUT).isoformat(),
    ])
ecrire_csv("clients.csv", ["No client", "Nom complet", "Courriel", "Ville", "Province", "Date d'inscription"], clients_rows)

# ---------------------------------------------------------------- Commandes (une ligne = un article)
commandes_rows = []
total_ca_ht = 0.0
total_lignes_valides = 0
no_commande = 20260001
for _ in range(260):
    d = date_aleatoire(D_DEBUT, D_FIN)
    succ = R.choice(SUCCURSALES)
    client = R.choice(clients_ids)
    paiement = R.choice(["Carte de crédit", "Carte de débit", "Comptant", "Financement"])
    canal = R.choice(["Magasin", "En ligne"])
    n_articles = R.choices([1, 2, 3], weights=[65, 25, 10])[0]
    paniers = R.sample(CATALOGUE, k=n_articles)
    statut = R.choices(["Complétée", "Retournée", "Annulée"], weights=[92, 5, 3])[0]
    for idx, (sku, nom, cat, souscat, cout, prix) in enumerate(paniers):
        qte = R.choices([1, 2], weights=[85, 15])[0]
        sous_total = arr(prix * qte)
        tps = arr(sous_total * TPS)
        tvq = arr(sous_total * TVQ)
        total = arr(sous_total + tps + tvq)
        commandes_rows.append([
            f"CMD-{no_commande}", f"L{idx+1}", d.isoformat(), client, succ[0], succ[1],
            sku, nom, cat, qte, prix, sous_total, tps, tvq, total, paiement, canal, statut,
        ])
        if statut == "Complétée":
            total_ca_ht += sous_total
            total_lignes_valides += 1
    no_commande += 1
ecrire_csv("commandes.csv", [
    "No commande", "No ligne", "Date", "No client", "Succursale", "Ville",
    "SKU", "Produit", "Catégorie", "Quantité", "Prix unitaire", "Sous-total",
    "TPS", "TVQ", "Total", "Mode de paiement", "Canal", "Statut",
], commandes_rows)

# ---------------------------------------------------------------- Inventaire (relevé au 31 août 2026, par succursale)
inventaire_rows = []
valeur_stock_cout = 0.0
for succ in SUCCURSALES:
    for sku, nom, cat, souscat, cout, prix in CATALOGUE:
        qte = R.randint(0, 45)
        valeur_stock_cout += qte * cout
        inventaire_rows.append([
            D_FIN.isoformat(), succ[0], sku, nom, cat, qte, arr(cout), arr(prix),
        ])
ecrire_csv("inventaire.csv", ["Date inventaire", "Succursale", "SKU", "Produit", "Catégorie", "Qté en stock", "Coût unitaire", "Prix de vente"], inventaire_rows)

# ---------------------------------------------------------------- Vérité (valeurs attendues, calculées ici)
verite = {
    "secteur": "Commerce de détail — Électronique grand public",
    "note": "CA = somme des sous-totaux (hors TPS/TVQ) des lignes de commandes au statut Complétée uniquement.",
    "controles": [
        {"type": "lignes", "entite": "Product", "attendu": len(CATALOGUE)},
        {"type": "lignes", "entite": "Customer", "attendu": len(clients_rows)},
        {"type": "lignes", "entite": "Order", "attendu": len(commandes_rows), "note": "toutes les lignes de commandes sont importees et conservees (Complétée, Retournée, Annulée) : aucune ligne n'est perdue a l'import, l'exclusion des retours/annulations se fait au niveau du calcul du CA, pas du stockage"},
        {"type": "somme", "entite": "Order", "champ": "subtotal", "attendu": arr(sum(r[11] for r in commandes_rows)), "note": "somme brute de toutes les lignes stockees (sans filtre de statut) ; le controle kpi total_revenue ci-dessous verifie le CA net, qui exclut Retournee/Annulee"},
        {"type": "kpi", "id": "total_revenue", "entites": ["Order"], "attendu": arr(total_ca_ht), "note": "CA = somme des sous-totaux des lignes au statut Complétée uniquement (Retournée/Annulée exclues par commandeHorsCA)"},
        {"type": "somme", "entite": "Inventory", "champ": "inventory_value", "attendu": arr(valeur_stock_cout)},
        {"type": "distincts", "entite": "Order", "champ": "succursale", "attendu": len(SUCCURSALES)},
    ],
}
with open(os.path.join(DOSSIER, "verite.json"), "w", encoding="utf-8") as f:
    json.dump(verite, f, ensure_ascii=False, indent=2)

print(f"Jeu généré dans {DOSSIER}")
print(f"  produits.csv   : {len(produits_rows)} lignes")
print(f"  clients.csv    : {len(clients_rows)} lignes")
print(f"  commandes.csv  : {len(commandes_rows)} lignes ({total_lignes_valides} complétées, CA HT attendu = {arr(total_ca_ht)} $)")
print(f"  inventaire.csv : {len(inventaire_rows)} lignes (valeur au coût attendue = {arr(valeur_stock_cout)} $)")
