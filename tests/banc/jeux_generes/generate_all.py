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
print("10 jeux générés dans", ICI)
