# -*- coding: utf-8 -*-
"""
Génère 10 jeux de données de PME fictives, sur le modèle du rapport Vert Québec
(DEMO/gescop_donnees_test), pour éprouver l'import GESCOP sur des formats variés.

Chaque dossier contient les fichiers d'un jeu et un verite.json : les valeurs
attendues, calculées ICI directement depuis les lignes générées, sans le moteur
de GESCOP. Règles de calcul (celles de l'app, écrites noir sur blanc) :
  - CA commandes = somme hors taxes (sous-total, sinon total - taxes, sinon total)
    des commandes dont le statut n'est ni annulé ni retourné ; le statut fait foi
    sur un indicateur de retour ;
  - CA transactions = somme des transactions de revenu ; charges = dépenses ;
  - masse salariale = somme des coûts de paie (coût total fourni, sinon brut +
    heures sup + primes + part employeur) ;
  - dépenses marketing = somme des dépenses journalières de campagne ;
  - solde de trésorerie = clôture du dernier mois (fournie ou ouverture + entrées - sorties) ;
  - toutes les dates sont passées (au plus août 2026).
Usage : python generate_all.py   (déterministe, graine fixe)
"""
import csv, json, os, random, datetime as dt
from openpyxl import Workbook

ICI = os.path.dirname(os.path.abspath(__file__))
R = random.Random(20260925)
PRENOMS = ["Julie", "Marc", "Sophie", "Luc", "Nadia", "Éric", "Chloé", "Karim", "Isabelle", "Hugo", "Amélie", "Yann", "Léa", "Samuel", "Maya"]
NOMS = ["Tremblay", "Gagnon", "Roy", "Côté", "Bouchard", "Gauthier", "Morin", "Lavoie", "Fortin", "Gagné", "Ouellet", "Pelletier", "Bélanger", "Lévesque", "Bergeron"]
FIRST = ["John", "Emily", "Michael", "Sarah", "David", "Jessica", "Daniel", "Laura", "James", "Olivia", "Ryan", "Megan"]
LAST = ["Smith", "Johnson", "Brown", "Taylor", "Miller", "Wilson", "Moore", "Clark", "Lewis", "Walker", "Hall", "Young"]

def arr(x): return round(x + 1e-9, 2)

def date_aleatoire(debut, fin):
    return debut + dt.timedelta(days=R.randint(0, (fin - debut).days))

def mois_de(d): return d.strftime("%Y-%m")

def ecrire_csv(dossier, nom, entetes, lignes, sep=",", titre=None):
    with open(os.path.join(dossier, nom), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, delimiter=sep)
        if titre:
            for t in titre: w.writerow([t])
            w.writerow([])
        w.writerow(entetes)
        for l in lignes: w.writerow(l)

def ecrire_xlsx(dossier, nom, feuilles):
    """feuilles = [(nom, entetes, lignes, titre|None)]"""
    wb = Workbook(); wb.remove(wb.active)
    for (n, entetes, lignes, titre) in feuilles:
        ws = wb.create_sheet(n)
        if titre:
            for t in titre: ws.append([t])
            ws.append([])
        ws.append(entetes)
        for l in lignes: ws.append(l)
    wb.save(os.path.join(dossier, nom))

def fr_montant(x):  # 1 234,56 $
    s = f"{x:,.2f}".replace(",", " ").replace(".", ",")
    return f"{s} $"

def us_montant(x):  # $1,234.56
    return f"${x:,.2f}"

def dossier(nom):
    d = os.path.join(ICI, nom); os.makedirs(d, exist_ok=True)
    for f in os.listdir(d):
        if f != "verite.json": os.remove(os.path.join(d, f))
    return d

def verite(d, secteur, controles, note):
    with open(os.path.join(d, "verite.json"), "w", encoding="utf-8") as f:
        json.dump({"secteur": secteur, "note": note, "controles": controles}, f, ensure_ascii=False, indent=1)

def kpi(id_, entites, attendu, lot=""): return {"type": "kpi", "id": id_, "entites": entites, "attendu": attendu, "lot": lot}
def lignes(entite, n): return {"type": "lignes", "entite": entite, "attendu": n}
D1, D2 = dt.date(2025, 9, 1), dt.date(2026, 8, 31)

# ---------------------------------------------------------------- 01 restaurant (FR, CSV « ; », décimale virgule, JJ/MM/AAAA)
def j01():
    d = dossier("01_restaurant_montreal")
    tx, rev, dep = [], 0.0, 0.0
    cats_dep = [("Achats alimentaires", "dépense"), ("Loyer", "dépense"), ("Salaires cuisine", "dépense"), ("Électricité", "dépense")]
    jour = D1
    while jour <= D2:
        m = arr(R.uniform(900, 3200)); rev += m
        tx.append([jour.strftime("%d/%m/%Y"), "Ventes salle et terrasse", f"{m:.2f}".replace(".", ","), "Recette", "Ventes"])
        if jour.day in (1, 15):
            for c, t in cats_dep:
                v = arr(R.uniform(800, 6000)); dep += v
                tx.append([jour.strftime("%d/%m/%Y"), c, f"{v:.2f}".replace(".", ","), "Dépense", c])
        jour += dt.timedelta(days=3)
    ecrire_csv(d, "journal_caisse.csv", ["Date", "Libellé", "Montant", "Type", "Catégorie"], tx, sep=";")
    paie, cout = [], 0.0
    for mois in ["2026-06", "2026-07", "2026-08"]:
        for i in range(8):
            brut, pourb = arr(R.uniform(2200, 4200)), arr(R.choice([0, 0, 150, 300]))
            cout += brut  # les pourboires sont payes par les clients : pas un cout employeur
            paie.append([mois, f"EMP{i+1:02d}", f"{PRENOMS[i]} {NOMS[i]}", f"{brut:.2f}".replace(".", ","), f"{pourb:.2f}".replace(".", ",")])
    ecrire_csv(d, "paie.csv", ["Période", "No employé", "Nom", "Salaire brut", "Pourboires déclarés"], paie, sep=";")
    verite(d, "Restaurant (Montréal)", [
        kpi("total_revenue", ["Transaction"], arr(rev), "CA recettes"), kpi("total_expense", ["Transaction"], arr(dep), "charges"),
        kpi("net_income", ["Transaction"], arr(rev - dep)), lignes("Transaction", len(tx)), lignes("Payroll", len(paie)),
        kpi("payroll_total", ["Payroll"], arr(cout), "paie : brut (les pourboires ne sont pas un coût employeur)"),
    ], "CSV séparé par « ; », décimale virgule, dates JJ/MM/AAAA, type « Recette/Dépense ».")

# ---------------------------------------------------------------- 02 SaaS (EN, xlsx multi-feuilles, dépenses signées)
def j02():
    d = dossier("02_saas_toronto")
    clients = [[f"CUS-{i:03d}", f"{FIRST[i % 12]} {LAST[(i * 5) % 12]} Inc.", R.choice(["Starter", "Pro", "Enterprise"]), "Toronto"] for i in range(40)]
    inv, rev = [], 0.0
    for k in range(260):
        c = R.choice(clients); dte = date_aleatoire(D1, D2)
        sub = arr(R.choice([49, 99, 299, 999]) * R.randint(1, 3)); tax = arr(sub * 0.13)
        st = R.choice(["Paid"] * 8 + ["Refunded", "Void"])
        if st not in ("Refunded", "Void"): rev += sub
        inv.append([f"INV-{10000 + k}", dte, c[0], sub, tax, arr(sub + tax), st])
    exp, dep = [], 0.0
    for k in range(120):
        v = arr(R.uniform(200, 9000)); dep += v
        exp.append([date_aleatoire(D1, D2), R.choice(["AWS hosting", "Google Ads", "Office rent", "Contractors", "Software licenses"]), -v])
    pay, cost = [], 0.0
    for mois in ["2026-05", "2026-06", "2026-07", "2026-08"]:
        for i in range(12):
            g, ot, bo, er = arr(R.uniform(5000, 11000)), arr(R.choice([0, 0, 400])), arr(R.choice([0, 1000])), 0
            er = arr(g * 0.09); cost += g + ot + bo + er
            pay.append([f"E{i+1:03d}", mois, g, ot, bo, er])
    ecrire_xlsx(d, "saas_finance_2026.xlsx", [
        ("Customers", ["Customer ID", "Company Name", "Plan", "City"], clients, None),
        ("Invoices", ["Invoice #", "Invoice Date", "Customer ID", "Subtotal", "HST", "Total", "Status"], inv, None),
        ("Expenses", ["Date", "Description", "Amount"], exp, None),
        ("Payroll", ["Employee ID", "Pay Period", "Gross Pay", "Overtime Pay", "Bonus", "Employer Contributions"], pay, None),
    ])
    verite(d, "SaaS (Toronto)", [
        lignes("Customer", 40), lignes("Order", 260), lignes("Payroll", len(pay)),
        kpi("total_revenue", ["Order"], arr(rev), "CA HT hors remboursées/annulées"),
        kpi("total_expense", ["Expense", "Transaction"], arr(dep), "dépenses signées négatives"),
        kpi("payroll_total", ["Payroll"], arr(cost), "brut + heures sup + prime + part employeur"),
    ], "Classeur anglais 4 feuilles ; factures HT + HST ; statuts Refunded/Void ; dépenses en montants négatifs.")

# ---------------------------------------------------------------- 03 grossiste (FR, xlsx, titre + totaux, TPS/TVQ)
def j03():
    d = dossier("03_grossiste_quebec")
    cmd, ht_total = [], 0.0
    for k in range(180):
        qte, pu = R.randint(1, 40), arr(R.uniform(5, 220))
        st = arr(qte * pu); tps, tvq = arr(st * 0.05), arr(st * 0.09975)
        statut = R.choice(["Livrée"] * 7 + ["Annulée", "En cours"])
        if statut != "Annulée": ht_total += st
        cmd.append([f"C-{2026}{k:04d}", date_aleatoire(D1, D2).strftime("%Y-%m-%d"), f"CLI{R.randint(1, 60):03d}", f"PRD{R.randint(1, 80):03d}", qte, pu, st, tps, tvq, arr(st + tps + tvq), statut])
    lignes_cmd = cmd + [["TOTAL GÉNÉRAL", "", "", "", sum(c[4] for c in cmd), "", arr(sum(c[6] for c in cmd)), "", "", arr(sum(c[9] for c in cmd)), ""]]
    ecrire_xlsx(d, "commandes_grossiste.xlsx", [("Commandes", ["No commande", "Date", "Code client", "Code produit", "Qté", "Prix unitaire", "Sous-total", "TPS", "TVQ", "Total TTC", "Statut"], lignes_cmd,
                                                   ["Distribution Laurentides Inc. — Registre des commandes", "Exercice 2025-2026"])])
    verite(d, "Grossiste (Québec)", [lignes("Order", 180), kpi("total_revenue", ["Order"], arr(ht_total), "CA HT (sous-total), annulées exclues")],
           "Deux lignes de titre au-dessus des en-têtes, ligne TOTAL GÉNÉRAL en bas, TPS/TVQ détaillées.")

# ---------------------------------------------------------------- 04 clinique (FR, CSV, SANS colonne type)
def j04():
    d = dossier("04_clinique_sherbrooke")
    tx, rev, dep = [], 0.0, 0.0
    for k in range(300):
        if R.random() < 0.6:
            v = arr(R.uniform(60, 400)); rev += v
            tx.append([date_aleatoire(D1, D2).isoformat(), R.choice(["Consultation physiothérapie", "Séance ostéopathie", "Évaluation initiale"]), v, "Ventes de services"])
        else:
            v = arr(R.uniform(100, 3500)); dep += v
            cat = R.choice(["Loyer", "Salaires", "Fournitures médicales", "Assurances", "Frais bancaires"])
            tx.append([date_aleatoire(D1, D2).isoformat(), f"Paiement {cat.lower()}", v, cat])
    ecrire_csv(d, "grand_livre.csv", ["date", "description", "montant", "categorie"], tx)
    verite(d, "Clinique (Sherbrooke)", [lignes("Transaction", 300), kpi("total_revenue", ["Transaction"], arr(rev)), kpi("total_expense", ["Transaction"], arr(dep))],
           "Aucune colonne type : le sens doit venir de la catégorie (règle du lot 1.2), jamais « positif = revenu ».")

# ---------------------------------------------------------------- 05 e-commerce US (EN, $1,234.56, MM/DD/YYYY, Return_Flag)
def j05():
    d = dossier("05_ecommerce_us")
    rows, rev, ids = [], 0.0, set()
    for k in range(900):
        dte = date_aleatoire(D1, D2)
        qty, price = R.randint(1, 5), arr(R.uniform(8, 180))
        disc = R.choice([0, 0, 0.1, 0.2])
        amount = arr(qty * price * (1 - disc))
        status = R.choice(["Delivered"] * 12 + ["Returned", "Cancelled", "Shipped"])
        flag = "Yes" if status == "Returned" or R.random() < 0.03 else "No"
        if status not in ("Returned", "Cancelled"): rev += amount; ids.add(f"ORD{k:05d}")
        rows.append([f"ORD{k:05d}", dte.strftime("%m/%d/%Y"), f"{FIRST[k % 12]} {LAST[(k * 7) % 12]}", R.choice(["Online", "Mobile App", "Retail Store"]),
                     qty, us_montant(price), f"{int(disc * 100)}%", us_montant(amount), status, flag, R.choice(["Alex Sales Rep", "Jamie Account Manager"])])
    ecrire_csv(d, "orders_export.csv", ["Order ID", "Order Date", "Customer Name", "Sales Channel", "Quantity", "Unit Price", "Discount", "Sales Amount", "Order Status", "Return Flag", "Sales Representative"], rows)
    verite(d, "E-commerce (États-Unis)", [lignes("Order", 900), kpi("total_revenue", ["Order"], arr(rev), "montant après remise, statut fait foi"),
                                          kpi("aov", ["Order"], arr(rev / len(ids)), "panier moyen sur commandes distinctes")],
           "Montants « $1,234.56 », dates MM/JJ/AAAA, remise en %, Return Flag Yes/No contredit parfois le statut, colonne représentant.")

# ---------------------------------------------------------------- 06 manufacturier (FR, xlsx, stocks multi-entrepôts, immobilisations)
def j06():
    d = dossier("06_manufacturier_drummondville")
    stocks = []
    for p in range(30):
        for e in ["Usine Drummondville", "Entrepôt Laval"]:
            q, c = R.randint(0, 500), arr(R.uniform(2, 90))
            stocks.append([f"MAT-{p:03d}", f"Matière {p}", e, q, R.randint(20, 80), c, arr(q * c), "2026-08-31"])
    actifs = []
    for a in range(12):
        v = arr(R.uniform(5000, 250000))
        actifs.append([f"Équipement {a}", R.choice(["Machinerie", "Véhicule", "Informatique"]), f"20{R.randint(15, 25)}-0{R.randint(1, 9)}-15", v, R.choice([5, 7, 10]), arr(v * 0.1), "Linéaire", R.choice(["Usine Drummondville", "Entrepôt Laval"])])
    ecrire_xlsx(d, "operations.xlsx", [
        ("Stocks", ["Code article", "Désignation", "Entrepôt", "Quantité en stock", "Point de commande", "Coût unitaire", "Valeur au coût", "Date d'inventaire"], stocks, None),
        ("Immobilisations", ["Nom de l'actif", "Catégorie", "Date d'acquisition", "Coût d'acquisition", "Durée de vie (ans)", "Valeur résiduelle", "Méthode", "Site"], actifs, None),
    ])
    verite(d, "Manufacturier (Drummondville)", [lignes("Inventory", 60), lignes("Asset", 12),
        {"type": "somme", "entite": "Asset", "champ": "initial_cost", "attendu": arr(sum(a[3] for a in actifs))},
        {"type": "somme", "entite": "Inventory", "champ": "inventory_value", "attendu": arr(sum(s[6] for s in stocks))},
        {"type": "distincts", "entite": "Inventory", "champ": "warehouse_name", "attendu": 2}],
        "Stocks par entrepôt, immobilisations avec coût, durée, valeur résiduelle et site.")

# ---------------------------------------------------------------- 07 agence marketing (EN, campagnes + journalier)
def j07():
    d = dossier("07_agence_marketing")
    camps = [[f"CMP-{i:02d}", f"Campaign {n}", ch, 5000 + i * 1000] for i, (n, ch) in enumerate([("Spring Promo", "Google Ads"), ("Back to School", "Meta"), ("Holiday", "Google Ads"), ("Brand", "LinkedIn")])]
    daily, spend, clicks, revenue = [], 0.0, 0, 0.0
    jour = dt.date(2026, 3, 1)
    while jour <= dt.date(2026, 8, 31):
        for c in camps:
            s, cl = arr(R.uniform(20, 300)), R.randint(10, 400)
            rv = arr(s * R.uniform(0.5, 6)); spend += s; clicks += cl; revenue += rv
            daily.append([jour.isoformat(), c[0], R.randint(1000, 30000), cl, s, R.randint(0, 20), rv])
        jour += dt.timedelta(days=1)
    ecrire_csv(d, "campaigns.csv", ["Campaign ID", "Campaign Name", "Channel", "Budget"], camps)
    ecrire_csv(d, "campaign_daily_performance.csv", ["Date", "Campaign ID", "Impressions", "Clicks", "Spend", "Conversions", "Revenue"], daily)
    verite(d, "Agence marketing", [lignes("Campaign", 4), lignes("CampaignDaily", len(daily)),
        kpi("marketing_spend", ["CampaignDaily", "Campaign"], arr(spend)), kpi("roas", ["CampaignDaily", "Campaign"], arr(revenue / spend)),
        kpi("cpc", ["CampaignDaily", "Campaign"], arr(spend / clicks))], "Campagnes et performance journalière (anglais).")

# ---------------------------------------------------------------- 08 boulangerie (FR, xlsx dates réelles, trésorerie sans clôture)
def j08():
    d = dossier("08_boulangerie_levis")
    tres, solde = [], 12000.0
    for m in range(1, 9):
        e, s = arr(R.uniform(30000, 52000)), arr(R.uniform(26000, 49000))
        tres.append([dt.datetime(2026, m, 1), arr(solde), e, s]); solde = arr(solde + e - s)
    ecrire_xlsx(d, "tresorerie_2026.xlsx", [("Flux", ["Mois", "Solde d'ouverture", "Entrées de fonds", "Sorties de fonds"], tres, None)])
    verite(d, "Boulangerie (Lévis)", [lignes("Cashflow", 8), {"type": "solde", "attendu": arr(solde)}],
           "Relevé mensuel sans colonne de clôture : le solde doit être reconstitué (lot 2), dates en vraies cellules Excel.")

# ---------------------------------------------------------------- 09 cabinet conseil (en-têtes mixtes, commandes par NOM client)
def j09():
    d = dossier("09_cabinet_conseil")
    clients = [[f"CL-{i:03d}", f"{PRENOMS[i]} {NOMS[i]}", f"{PRENOMS[i].lower()}@exemple.ca", R.choice(["PME", "OBNL"])] for i in range(15)]
    mandats, rev = [], 0.0
    for k in range(120):
        c = R.choice(clients); h = arr(R.uniform(500, 12000))
        st = R.choice(["Facturé"] * 6 + ["Annulé"])
        if st != "Annulé": rev += h
        mandats.append([f"M-{k:04d}", date_aleatoire(D1, D2).isoformat(), c[1], h, st])
    ecrire_csv(d, "clients.csv", ["Client ID", "Nom complet", "Email", "Segment"], clients)
    ecrire_csv(d, "mandats.csv", ["Mandate No", "Date", "Client", "Honoraires", "Statut"], mandats)
    verite(d, "Cabinet conseil", [lignes("Customer", 15), lignes("Order", 120), kpi("total_revenue", ["Order"], arr(rev)),
        {"type": "clients_rattaches", "attendu": 120}], "Mandats nommant le client par son nom seulement ; en-têtes anglais et français mêlés.")

# ---------------------------------------------------------------- 10 quincaillerie (FR, xlsx, sommaire avec totaux consolidés, employés, paie)
def j10():
    d = dossier("10_quincaillerie_trois_rivieres")
    succ = ["Trois-Rivières Centre", "Cap-de-la-Madeleine"]
    somm = []
    for m in ["2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08"]:
        tot_v = tot_c = 0.0
        for s in succ:
            v, c = arr(R.uniform(80000, 160000)), arr(R.uniform(50000, 100000)); tot_v += v; tot_c += c
            somm.append([s, m, v, c, arr(v - c)])
        somm.append(["Total consolidé", m, arr(tot_v), arr(tot_c), arr(tot_v - tot_c)])
    emp = [[f"Q{i:02d}", PRENOMS[i], NOMS[i], R.choice(succ), arr(R.uniform(38000, 72000))] for i in range(14)]
    paie, cout = [], 0.0
    for m in ["2026-07", "2026-08"]:
        for e in emp:
            b = arr(e[4] / 12); ch = arr(b * 0.14); cout += b + ch
            paie.append([e[0], m, b, ch])
    ecrire_xlsx(d, "quincaillerie.xlsx", [
        ("Sommaire", ["Succursale", "Mois", "Ventes ($)", "Coût des ventes ($)", "Marge brute ($)"], somm, None),
        ("Employés", ["Matricule", "Prénom", "Nom", "Succursale", "Salaire annuel"], emp, None),
        ("Paie", ["Matricule", "Période", "Salaire brut", "Charges patronales"], paie, None),
    ])
    verite(d, "Quincaillerie (Trois-Rivières)", [lignes("ExecutiveSummary", 12), lignes("Employee", 14), lignes("Payroll", len(paie)),
        kpi("payroll_total", ["Payroll"], arr(cout), "brut + charges patronales"),
        {"type": "distincts", "entite": "Employee", "champ": "branch", "attendu": 2}],
        "Sommaire par succursale avec une ligne « Total consolidé » par mois (à exclure des faits).")

for f in [j01, j02, j03, j04, j05, j06, j07, j08, j09, j10]: f()

# ================================================================ Modules supplémentaires
# Deuxième passe : chaque module de l'app absent des jeux ci-dessus (produits,
# achats, fournisseurs, paiements, dépenses, interactions, événements,
# concurrents, veille, objectifs) est ajouté à au moins deux jeux, sous des
# formats différents. Graine séparée : les fichiers des jeux ci-dessus ne
# changent pas.
M = random.Random(20260926)

def md(debut=D1, fin=D2):
    return debut + dt.timedelta(days=M.randint(0, (fin - debut).days))

def compte(entite, champ, valeur, n): return {"type": "compte", "entite": entite, "champ": champ, "valeur": valeur, "attendu": n}
def somme(entite, champ, v): return {"type": "somme", "entite": entite, "champ": champ, "attendu": arr(v)}
def distincts(entite, champ, n): return {"type": "distincts", "entite": entite, "champ": champ, "attendu": n}

def ajouter(nom, controles, note):
    d = os.path.join(ICI, nom)
    p = os.path.join(d, "verite.json")
    v = json.load(open(p, encoding="utf-8"))
    v["controles"] += controles
    v["note"] += " Modules ajoutés : " + note
    json.dump(v, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    return d

# --- Fournisseurs / achats (FR, « ; », décimale virgule) : 01 restaurant
def m01():
    d = os.path.join(ICI, "01_restaurant_montreal")
    four = [("F-01", "Boucherie Saint-Laurent", "Montréal"), ("F-02", "Primeurs du Marché", "Laval"),
            ("F-03", "Vins Rouge & Blanc", "Montréal"), ("F-04", "Emballages Pro", "Longueuil")]
    ecrire_csv(d, "fournisseurs.csv", ["No fournisseur", "Raison sociale", "Ville", "Conditions de paiement"],
               [[f[0], f[1], f[2], M.choice(["Net 30", "Net 15", "Comptant"])] for f in four], sep=";")
    achats, tot, annules = [], 0.0, 0
    for k in range(60):
        f = M.choice(four); q = M.randint(2, 40); pu = arr(M.uniform(3, 60)); t = arr(q * pu)
        st = M.choice(["Reçu"] * 7 + ["En retard", "Annulé"])
        if st == "Annulé": annules += 1
        tot += t
        achats.append([f"A-{k:03d}", md().strftime("%d/%m/%Y"), f[0], q, fr_montant(pu).replace(" $", ""), fr_montant(t).replace(" $", ""), st])
    ecrire_csv(d, "achats.csv", ["No achat", "Date", "Fournisseur", "Quantité", "Coût unitaire", "Coût total", "Statut"], achats, sep=";")
    ajouter("01_restaurant_montreal", [lignes("Supplier", 4), distincts("Supplier", "supplier_name", 4),
        lignes("Purchase", 60), somme("Purchase", "total_cost", tot), compte("Purchase", "status", "annule", annules)],
        "fournisseurs et achats (CSV « ; », JJ/MM/AAAA, montants à virgule).")

# --- Paiements et tickets de support (EN, xlsx) : 02 SaaS
def m02():
    d = os.path.join(ICI, "02_saas_toronto")
    pay, tot = [], 0.0
    for k in range(80):
        a = arr(M.uniform(49, 2400)); tot += a
        pay.append([f"PAY-{k:04d}", f"INV-{M.randint(0, 259):04d}", md().isoformat(), a, M.choice(["Credit Card", "ACH", "Wire"]), "Succeeded"])
    tick, neg, mails = [], 0, 0
    for k in range(50):
        ch = M.choice(["Email", "Chat", "Phone"]); se = M.choice(["Positive", "Neutral", "Negative"])
        neg += se == "Negative"; mails += ch == "Email"
        tick.append([f"T-{k:03d}", md().isoformat(), f"C-{M.randint(1, 40):03d}", ch, se, M.choice(["Billing", "Bug", "Onboarding"])])
    ecrire_xlsx(d, "payments_support.xlsx", [
        ("Payments", ["Payment ID", "Invoice #", "Paid On", "Amount", "Method", "Status"], pay, None),
        ("Support Tickets", ["Ticket ID", "Opened", "Customer ID", "Channel", "Sentiment", "Subject"], tick, None)])
    ajouter("02_saas_toronto", [lignes("Payment", 80), somme("Payment", "amount", tot),
        lignes("Interaction", 50), compte("Interaction", "sentiment", "negatif", neg), compte("Interaction", "channel", "email", mails)],
        "paiements et tickets de support (xlsx anglais).")

# --- Catalogue produits et fournisseurs avec ESG (FR, xlsx, ligne de titre) : 03 grossiste
def m03():
    d = os.path.join(ICI, "03_grossiste_quebec")
    cats = ["Cuisine", "Maison", "Entretien"]
    prod, pv = [], 0.0
    for k in range(40):
        c = arr(M.uniform(4, 90)); p = arr(c * M.uniform(1.3, 2.2)); pv += p
        prod.append([f"SKU-{k:04d}", f"Article {k}", M.choice(cats), c, p])
    four, esg = [], []
    for k, n in enumerate(["Distribution Nordik", "Atelier Beauce", "Import Pacifique", "Papeterie Mauricie", "Métal Estrie"]):
        s = M.randint(40, 95); esg.append(s)
        four.append([f"FR-{k:02d}", n, M.choice(["Québec", "Ontario"]), s])
    ecrire_xlsx(d, "catalogue.xlsx", [
        ("Produits", ["Code produit", "Désignation", "Famille", "Prix coûtant", "Prix de vente"], prod, ["Catalogue 2026", "Grossiste Québec"]),
        ("Fournisseurs", ["Code fournisseur", "Nom du fournisseur", "Province", "Score ESG"], four, None)])
    ajouter("03_grossiste_quebec", [lignes("Product", 40), somme("Product", "selling_price", pv), distincts("Product", "category", 3),
        lignes("Supplier", 5), kpi("weighted_esg_score", ["Supplier"], arr(sum(esg) / len(esg)))],
        "catalogue produits et fournisseurs avec score ESG (xlsx avec titre).")

# --- Dépenses et événements (FR, CSV, sans colonne type) : 04 clinique
def m04():
    d = os.path.join(ICI, "04_clinique_sherbrooke")
    dep, tot = [], 0.0
    for k in range(45):
        a = arr(M.uniform(80, 3500)); tot += a
        dep.append([md().isoformat(), M.choice(["Loyer", "Fournitures médicales", "Assurances", "Logiciels"]), M.choice(["Medisource", "Bell", "Intact"]), a])
    ecrire_csv(d, "depenses_fournisseurs.csv", ["Date", "Catégorie", "Fournisseur", "Montant"], dep)
    ev = [[md().isoformat(), t, desc] for t, desc in [("Fermeture", "Fermeture pour rénovation"), ("Ouverture", "Nouvelle salle de physiothérapie"),
          ("Promotion", "Journée portes ouvertes"), ("Fermeture", "Tempête de verglas")]]
    ecrire_csv(d, "evenements.csv", ["Date", "Type d'événement", "Description"], ev)
    ajouter("04_clinique_sherbrooke", [lignes("Expense", 45), kpi("total_expense", ["Expense"], arr(tot)), distincts("Expense", "category", 4),
        lignes("Event", 4), distincts("Event", "event_type", 3)],
        "dépenses (sans colonne type) et journal d'événements.")

# --- Produits et avis clients (EN, $, MM/DD/YYYY) : 05 e-commerce
def m05():
    d = os.path.join(ICI, "05_ecommerce_us")
    prod, pv = [], 0.0
    for k in range(30):
        c = arr(M.uniform(5, 60)); p = arr(c * M.uniform(1.5, 3)); pv += p
        prod.append([f"P{k:03d}", f"Item {k}", M.choice(["Home", "Kitchen", "Outdoor"]), us_montant(c), us_montant(p), M.choice(["Active", "Discontinued"])])
    ecrire_csv(d, "products.csv", ["Product ID", "Product Name", "Category", "Unit Cost", "Retail Price", "Status"], prod)
    rev, neg = [], 0
    for k in range(40):
        s = M.randint(1, 5); se = "Negative" if s <= 2 else "Neutral" if s == 3 else "Positive"; neg += se == "Negative"
        rev.append([f"R{k:03d}", md().strftime("%m/%d/%Y"), f"CUST-{M.randint(1, 90):04d}", "Online review", se, s])
    ecrire_csv(d, "customer_reviews.csv", ["Review ID", "Date", "Customer ID", "Type", "Sentiment", "Stars"], rev)
    ajouter("05_ecommerce_us", [lignes("Product", 30), somme("Product", "selling_price", pv), lignes("Interaction", 40),
        compte("Interaction", "sentiment", "negatif", neg)],
        "catalogue produits (montants en $) et avis clients (MM/JJ/AAAA).")

# --- Bons de commande fournisseurs sans colonne de total (FR/EN mêlés, xlsx) : 06 manufacturier
def m06():
    d = os.path.join(ICI, "06_manufacturier_drummondville")
    four = [["SUP-1", "Acier Drummond", "Drummondville", "Net 45"], ["SUP-2", "Plastiques Victo", "Victoriaville", "Net 30"],
            ["SUP-3", "Boulons Laval", "Laval", "Net 30"]]
    po, tot = [], 0.0
    for k in range(50):
        q = M.randint(10, 500); pu = arr(M.uniform(0.5, 40)); tot += arr(q * pu)
        dt0 = md(); po.append([f"PO-{k:04d}", dt0.isoformat(), M.choice(four)[0], f"MP-{M.randint(1, 20):02d}", q, pu,
                               (dt0 + dt.timedelta(days=M.randint(5, 30))).isoformat(), M.choice(["Received", "Pending", "Received"])])
    ecrire_xlsx(d, "achats_fournisseurs.xlsx", [
        ("Fournisseurs", ["Supplier ID", "Nom", "Ville", "Payment Terms"], four, None),
        ("Bons de commande", ["PO Number", "Date commande", "Supplier ID", "Item", "Qty", "Unit Cost", "Expected Delivery", "Statut"], po, None)])
    ajouter("06_manufacturier_drummondville", [lignes("Supplier", 3), lignes("Purchase", 50),
        somme("Purchase", "total_cost", tot)],
        "fournisseurs et bons de commande sans colonne de total (quantité × coût unitaire).")

# --- Concurrents et veille (FR) : 07 agence marketing
def m07():
    d = os.path.join(ICI, "07_agence_marketing")
    conc = [["C1", "Agence Boréale", "Montréal", "Leader", "Supérieur"], ["C2", "Studio Fleuve", "Québec", "Challenger", "Égal"],
            ["C3", "Pixel Nord", "Sherbrooke", "Niche", "Inférieur"], ["C4", "Média Laurentides", "Saint-Jérôme", "Suiveur", "Égal"]]
    ecrire_csv(d, "concurrents.csv", ["ID concurrent", "Nom", "Ville", "Position marché", "Positionnement prix"], conc)
    sig = [["Hausse du taux directeur", "Économie", "Négatif", md().isoformat()], ["Crédit d'impôt numérique prolongé", "Gouvernement", "Positif", md().isoformat()],
           ["Nouvel entrant en publicité locale", "Concurrence", "Négatif", md().isoformat()], ["Budget pub des PME en hausse", "Marché", "Positif", md().isoformat()],
           ["Inflation des services", "Économie", "Neutre", md().isoformat()]]
    ecrire_csv(d, "veille.csv", ["Titre", "Famille", "Impact", "Date"], sig)
    ajouter("07_agence_marketing", [lignes("Competitor", 4), compte("Competitor", "market_position", "leader", 1),
        lignes("ExternalSignal", 5), compte("ExternalSignal", "family", "economie", 2), compte("ExternalSignal", "impact", "negatif", 2)],
        "concurrents et signaux de veille (familles et impacts en français).")

# --- Objectifs et dépenses (FR, « ; ») : 08 boulangerie
def m08():
    d = os.path.join(ICI, "08_boulangerie_levis")
    obj = [["O1", "Ventes", "Chiffre d'affaires mensuel", "45000", "Élevée"], ["O2", "Finance", "Marge brute %", "62", "Moyenne"],
           ["O3", "Ventes", "Panier moyen", "18,50", "Moyenne"], ["O4", "Clients", "Clients fidèles", "300", "Faible"]]
    ecrire_csv(d, "objectifs.csv", ["No", "Domaine", "Indicateur", "Cible", "Priorité"], obj, sep=";")
    dep, tot = [], 0.0
    for k in range(30):
        a = arr(M.uniform(40, 1800)); tot += a
        dep.append([md().strftime("%d/%m/%Y"), M.choice(["Farine", "Électricité", "Emballages"]), fr_montant(a).replace(" $", "")])
    ecrire_csv(d, "depenses.csv", ["Date", "Poste", "Montant"], dep, sep=";")
    ajouter("08_boulangerie_levis", [lignes("Goal", 4), somme("Goal", "target", 45000 + 62 + 18.5 + 300), compte("Goal", "domain", "ventes", 2),
        lignes("Expense", 30), kpi("total_expense", ["Expense"], arr(tot))],
        "objectifs (cibles à virgule) et dépenses.")

# --- Objectifs, événements et interactions (EN) : 09 cabinet
def m09():
    d = os.path.join(ICI, "09_cabinet_conseil")
    obj = [["G1", "Sales", "Billable revenue", 750000, "High"], ["G2", "Clients", "Active clients", 20, "Medium"], ["G3", "Operations", "Utilization rate", 75, "High"]]
    ecrire_csv(d, "goals.csv", ["Goal ID", "Domain", "Metric", "Target", "Priority"], obj)
    ev = [[md().isoformat(), "Conference", "Speaking slot at CPA congress"], [md().isoformat(), "Hiring", "Two senior consultants"],
          [md().isoformat(), "Conference", "Client summit"]]
    ecrire_csv(d, "events.csv", ["Date", "Event Type", "Description"], ev)
    it, tel = [], 0
    for k in range(25):
        ch = M.choice(["Phone", "Email"]); tel += ch == "Phone"
        it.append([f"I-{k:03d}", md().isoformat(), f"CL-{M.randint(0, 14):03d}", ch, M.choice(["Positive", "Neutral"])])
    ecrire_csv(d, "client_touchpoints.csv", ["Interaction ID", "Date", "Client ID", "Channel", "Sentiment"], it)
    ajouter("09_cabinet_conseil", [lignes("Goal", 3), somme("Goal", "target", 750000 + 20 + 75), lignes("Event", 3), distincts("Event", "event_type", 2),
        lignes("Interaction", 25), compte("Interaction", "channel", "telephone", tel)],
        "objectifs, événements et interactions clients (anglais).")

# --- Concurrents, veille et produits (EN, xlsx) : 10 quincaillerie
def m10():
    d = os.path.join(ICI, "10_quincaillerie_trois_rivieres")
    conc = [["K1", "Home Depot", "Trois-Rivières", "Leader"], ["K2", "Rona", "Trois-Rivières", "Challenger"], ["K3", "BMR Cap", "Cap-de-la-Madeleine", "Follower"]]
    sig = [["Housing starts slow down", "Economy", "Negative"], ["Renovation tax credit", "Government", "Positive"], ["Lumber prices drop", "Suppliers", "Positive"]]
    prod, pv = [], 0.0
    for k in range(25):
        p = arr(M.uniform(2, 250)); pv += p
        prod.append([f"Q-{k:04d}", f"Tool {k}", M.choice(["Hardware", "Paint", "Garden"]), p])
    ecrire_xlsx(d, "marche.xlsx", [
        ("Competitors", ["Competitor ID", "Name", "City", "Market Position"], conc, None),
        ("Market Signals", ["Title", "Category", "Impact"], sig, None),
        ("Products", ["SKU", "Product", "Department", "Selling Price"], prod, None)])
    ajouter("10_quincaillerie_trois_rivieres", [lignes("Competitor", 3), compte("Competitor", "market_position", "leader", 1),
        lignes("ExternalSignal", 3), compte("ExternalSignal", "family", "fournisseurs", 1),
        lignes("Product", 25), somme("Product", "selling_price", pv)],
        "concurrents, veille et produits (xlsx anglais).")

for f in [m01, m02, m03, m04, m05, m06, m07, m08, m09, m10]: f()
print("modules supplémentaires ajoutés")
print("10 jeux générés dans", ICI)
