# -*- coding: utf-8 -*-
"""
Vérité « tous modules » des fichiers du dossier DEMO, calculée ICI directement
depuis les fichiers, sans le moteur de GESCOP. Complète verite_demo.ts (qui ne
contrôlait guère que le CA et le nombre de lignes) : pour chaque module présent
dans un classeur (ventes, clients, produits, stocks, employés, paie, dépenses,
trésorerie, fournisseurs, achats, immobilisations, marketing, interactions,
concurrents, veille, objectifs, événements), le nombre de lignes et les
chiffres que la page du module doit afficher.

Règles de calcul (celles de l'app, écrites noir sur blanc) :
  - paie : coût employeur total de chaque fiche (payroll_total) ;
  - dépenses : montant hors taxes (les taxes payées sont récupérables) ;
  - achats : coût hors taxes (sous-total) ;
  - stocks : valeur au coût (colonne de valeur, sinon quantité × coût unitaire) ;
  - immobilisations : valeur nette comptable ;
  - trésorerie : solde de clôture de la dernière période ;
  - clients actifs : statut « Actif » ;
  - listes (canal, sentiment, famille…) : valeur de l'app après traduction.

Usage : python tests/banc/verite_demo_modules.py  (écrit verite_demo_modules.json)
"""
import json, os
from collections import Counter
from openpyxl import load_workbook

ICI = os.path.dirname(os.path.abspath(__file__))
DEMO = os.path.abspath(os.path.join(ICI, "..", "..", "..", "DEMO"))

def arr(x): return round(x + 1e-9, 2)
def num(v):
    if v is None or v == "": return 0.0
    return float(v)

def feuille(wb, nom):
    ws = wb[nom]
    rows = list(ws.iter_rows(values_only=True))
    tete = [str(h).strip() if h is not None else "" for h in rows[0]]
    out = []
    for r in rows[1:]:
        if r is None or all(c is None or str(c).strip() == "" for c in r): continue
        out.append({tete[i]: r[i] for i in range(len(tete)) if tete[i]})
    return out

def derniere_photo(rows, produit, entrepot, date):
    """Un stock est une photo : pour un meme produit dans un meme entrepot, seule
    la ligne la plus recente compte (additionner les dates double le stock)."""
    last = {}
    for r in rows:
        k = (r[produit], r[entrepot])
        if k not in last or str(r[date]) >= str(last[k][date]): last[k] = r
    return list(last.values())

def kpi(id_, attendu, note=""): return {"type": "kpi", "id": id_, "attendu": attendu, "note": note}
def lignes(entite, n): return {"type": "lignes", "entite": entite, "attendu": n}
def somme(entite, champ, v, note=""): return {"type": "somme", "entite": entite, "champ": champ, "attendu": arr(v), "note": note}
def distincts(entite, champ, n): return {"type": "distincts", "entite": entite, "champ": champ, "attendu": n}
def compte(entite, champ, valeur, n): return {"type": "compte", "entite": entite, "champ": champ, "valeur": valeur, "attendu": n}
def solde(v): return {"type": "solde", "attendu": arr(v)}

VERITE = []

# ------------------------------------------------------------ Xplorer 3 mois (18 feuilles, une par module)
def xplorer_3mois():
    f = "GESCOP_Donnees_Test_Xplorer_3Mois.xlsx"
    wb = load_workbook(os.path.join(DEMO, f), read_only=True, data_only=True)
    F = lambda n: feuille(wb, n)
    pay, exp, pur, prod = F("Payroll"), F("Expenses"), F("Purchase"), F("Products")
    cus, inter, emp, cf = F("Customers"), F("Interaction"), F("Employees"), F("Cashflow")
    camp, cd, comp, sig, goal, ev, sup, inv = F("Campaigns"), F("CampaignDaily"), F("Competitors"), F("ExternalSignal"), F("Goal"), F("Event"), F("Suppliers"), F("Inventory")
    dernier = max(cf, key=lambda r: str(r["date"]))
    senti = Counter(str(r["sentiment"]).lower() for r in inter)
    VERITE.append({"fichier": f, "controles": [
        lignes("Payroll", len(pay)), kpi("payroll_total", arr(sum(num(r["total_cost"]) for r in pay))),
        lignes("Expense", len(exp)), somme("Expense", "amount", sum(num(r["amount"]) for r in exp)),
        lignes("Purchase", len(pur)), somme("Purchase", "total_cost", sum(num(r["total_cost"]) for r in pur)),
        lignes("Product", len(prod)), somme("Product", "selling_price", sum(num(r["selling_price"]) for r in prod)),
        lignes("Supplier", len(sup)),
        lignes("Inventory", len(inv)),
        lignes("Customer", len(cus)), kpi("active_customers", sum(1 for r in cus if str(r["status"]).lower() == "actif")),
        lignes("Interaction", len(inter)), compte("Interaction", "sentiment", "positif", senti.get("positif", 0)),
        compte("Interaction", "sentiment", "negatif", senti.get("négatif", 0) + senti.get("negatif", 0)),
        lignes("Employee", len(emp)),
        lignes("Cashflow", len(cf)), solde(num(dernier["closing_cash"])),
        lignes("Campaign", len(camp)), somme("Campaign", "spend", sum(num(r["spend"]) for r in camp)),
        lignes("CampaignDaily", len(cd)), somme("CampaignDaily", "spend", sum(num(r["spend"]) for r in cd)),
        lignes("Competitor", len(comp)), compte("Competitor", "market_position", "leader", sum(1 for r in comp if str(r["market_position"]).lower() == "leader")),
        lignes("ExternalSignal", len(sig)),
        lignes("Goal", len(goal)), somme("Goal", "target", sum(num(r["target"]) for r in goal)),
        lignes("Event", len(ev)),
    ]})

# ------------------------------------------------------------ Simulation Québec 3 ans (14 feuilles, suffixes _cad)
def simulation_3ans():
    f = "Simulation_Entreprise_Quebec_3Ans_Complet.xlsx"
    wb = load_workbook(os.path.join(DEMO, f), read_only=True, data_only=True)
    F = lambda n: feuille(wb, n)
    pay, exp, pur, ast, inv = F("Payroll"), F("Expense"), F("Purchase"), F("Asset"), F("Inventory")
    cus, emp, cf, cd, camp, prod, sup = F("Customer"), F("Employee"), F("Cashflow"), F("CampaignDaily"), F("Campaign"), F("Product"), F("Supplier")
    dernier = max(cf, key=lambda r: str(r["period_month"]))
    VERITE.append({"fichier": f, "controles": [
        kpi("payroll_total", arr(sum(num(r["total_employer_cost_cad"]) for r in pay)), "coût employeur total"),
        somme("Expense", "amount", sum(num(r["amount_ht_cad"]) for r in exp), "hors taxes"),
        somme("Purchase", "total_cost", sum(num(r["subtotal_cad"]) for r in pur), "hors taxes"),
        kpi("net_book_value_total", arr(sum(num(r["net_book_value_cad"]) for r in ast))),
        somme("Asset", "initial_cost", sum(num(r["acquisition_cost_cad"]) for r in ast)),
        lignes("Inventory", len(inv)), kpi("inventory_value_total", arr(sum(num(r["total_inventory_value_cad"]) for r in inv))),
        lignes("Customer", len(cus)), kpi("active_customers", sum(1 for r in cus if str(r["status"]).lower() == "actif")),
        lignes("Employee", len(emp)),
        lignes("Product", len(prod)), lignes("Supplier", len(sup)), lignes("Campaign", len(camp)),
        somme("Campaign", "budget", sum(num(r["allocated_budget_cad"]) for r in camp)),
        kpi("marketing_spend", arr(sum(num(r["daily_cost_cad"]) for r in cd)), "coût journalier des campagnes"),
        solde(num(dernier["closing_bank_balance_cad"])),
    ]})

# ------------------------------------------------------------ GESCOP.xlsx (10 feuilles de 500 lignes, en-têtes français)
def gescop():
    f = "GESCOP.xlsx"
    wb = load_workbook(os.path.join(DEMO, f), read_only=True, data_only=True)
    F = lambda n: feuille(wb, n)
    emp, dep, inv, pur, mkt, tre, four, prod = F("Employes"), F("Depenses"), F("Inventaire_Stocks"), F("Achats_Fournisseurs"), F("Marketing"), F("Tresorerie"), F("Fournisseurs"), F("Produits")
    dernier = max(tre, key=lambda r: str(r["Date"]))
    esg = [num(r["Score ESG"]) for r in four if r.get("Score ESG") is not None]
    VERITE.append({"fichier": f, "controles": [
        kpi("total_expense", arr(sum(num(r["Montant"]) for r in dep)), "dépenses seules (aucune transaction)"),
        somme("Employee", "annual_salary", sum(num(r["Salaire annuel"]) for r in emp)),
        somme("Employee", "total_employer_cost", sum(num(r["Coût employeur total"]) for r in emp)),
        kpi("inventory_value_total", arr(sum(num(r["Valeur du stock"]) for r in derniere_photo(inv, "ID Produit", "ID Entrepôt", "Date"))),
            "valeur au coût, dernière photo par produit et entrepôt (un stock n'est pas un flux)"),
        somme("Purchase", "total_cost", sum(num(r["Coût total"]) for r in pur)),
        kpi("marketing_spend", arr(sum(num(r["Dépense"]) for r in mkt))),
        kpi("weighted_esg_score", arr(sum(esg) / len(esg))),
        somme("Product", "selling_price", sum(num(r["Prix de vente"]) for r in prod)),
        solde(num(dernier["Solde de clôture"])),
    ]})

for fn in [xplorer_3mois, simulation_3ans, gescop]: fn()
with open(os.path.join(ICI, "verite_demo_modules.json"), "w", encoding="utf-8") as fh:
    json.dump(VERITE, fh, ensure_ascii=False, indent=1)
print(sum(len(v["controles"]) for v in VERITE), "contrôles pour", len(VERITE), "fichiers")
