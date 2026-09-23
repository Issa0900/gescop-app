import { isIncome, isExpense, txAmount } from "@/lib/transactionClassifier";
import { monthlyAggComplete } from "@/lib/periods";
import { montantHT, commandeHorsCA, transactionsDejaCommandees, transactionsDepensesDejaSaisies } from "@/lib/core/kpiRecords";

/**
 * Recettes et depenses, avec les MEMES regles que le moteur KPI (kpiRecords) :
 * commandes au montant hors taxes, annulees/retournees/hors devise exclues ;
 * une transaction qui encaisse une commande importee, ou qui repete une
 * depense importee, n'est comptee qu'une fois. Additionner commandes et
 * transactions telles quelles doublait le chiffre d'affaires des fichiers
 * qui contiennent les deux (Xplorer 3 mois : 130 976 $ au lieu de 65 488 $).
 */
function flux(transactions = [], expenseEntityRows = [], orderRows = [], executiveSummaryRows = []) {
  const tx = (transactions || []).filter(Boolean).map((t) => ({ ...t, _entity: "Transaction" }));
  const cmd = (orderRows || []).filter(Boolean).map((o) => ({ ...o, _entity: "Order" }));
  const dep = (expenseEntityRows || []).filter(Boolean).map((e) => ({ ...e, _entity: "Expense" }));
  const dejaCommandees = transactionsDejaCommandees([...tx, ...cmd]);
  const dejaSaisies = transactionsDepensesDejaSaisies([...tx, ...dep]);
  const { incomes: txnIncomes, expenses: txnExpenses } = prepareTransactions(tx);
  const orderIncomes = cmd.filter((o) => !commandeHorsCA(o))
    .map((o) => ({ ...o, _amount: Number.isFinite(montantHT(o)) ? montantHT(o) : 0 }))
    .filter((o) => o._amount > 0);
  // Sans depense bancaire, le cout des marchandises vendues tient lieu de depense.
  const orderExpenses = (txnExpenses.length === 0)
    ? cmd.filter((o) => !commandeHorsCA(o)).map((o) => ({
        ...o,
        _amount: Number(o?.total_cost) || Number(o?.cost) || ((Number(o?.quantity) || 0) * (Number(o?.unit_cost) || 0)) || 0,
      })).filter((o) => o._amount > 0)
    : [];
  const clesCommandees = new Set([...dejaCommandees].map(cleTx));
  const clesSaisies = new Set([...dejaSaisies].map(cleTx));
  let incomes = [...txnIncomes.filter((t) => !clesCommandees.has(cleTx(t))), ...orderIncomes];
  let expenses = [
    ...txnExpenses.filter((t) => !clesSaisies.has(cleTx(t))),
    ...dep.map((e) => ({ ...e, _amount: Number(e?.amount) || 0 })),
    ...orderExpenses,
  ];
  // Aucune vente ni transaction : la synthese du fichier sert d'affichage.
  if (incomes.length === 0 && (executiveSummaryRows || []).length > 0) {
    incomes = (executiveSummaryRows || []).filter(Boolean).map((e) => ({ ...e, _amount: Number(e?.total_revenue) || Number(e?.total) || 0 })).filter((e) => e._amount > 0);
    expenses = (executiveSummaryRows || []).filter(Boolean).map((e) => ({ ...e, _amount: Number(e?.total_cost) || Number(e?.cost) || 0 })).filter((e) => e._amount > 0);
  }
  return { incomes, expenses };
}

// prepareTransactions copie chaque ligne : on retrouve l'originale par ses champs.
const cleTx = (t) => `${t.date}|${t.amount}|${t.type}|${t.description}`;

export function prepareTransactions(transactions) {
  const rows = transactions || [];
  return {
    incomes: rows.filter(isIncome).map((row) => ({ ...row, _amount: txAmount(row, "income") })),
    expenses: rows.filter(isExpense).map((row) => ({ ...row, _amount: txAmount(row, "expense") })),
  };
}

export function financialSummary(transactions = [], expenseEntityRows = [], orderRows = [], executiveSummaryRows = []) {
  const { incomes, expenses } = flux(transactions, expenseEntityRows, orderRows, executiveSummaryRows);
  const revenue = incomes.reduce((sum, row) => sum + row._amount, 0);
  const expense = expenses.reduce((sum, row) => sum + row._amount, 0);
  const netIncome = revenue - expense;
  return {
    incomes,
    expenses,
    revenue,
    expense,
    netIncome,
    marginPct: revenue > 0 ? (netIncome / revenue) * 100 : 0,
  };
}

/**
 * @param {Array} [transactions]
 * @param {Array} [expenseEntityRows] - rows from the dedicated Expense entity
 * @param {Array} [orderRows] - rows from the dedicated Order entity (sales/retail)
 * @param {Array} [executiveSummaryRows] - rows from ExecutiveSummary (aggregated monthly P&L)
 */
export function financialMonthlySeries(transactions = [], expenseEntityRows = [], orderRows = [], executiveSummaryRows = []) {
  const { incomes, expenses } = flux(transactions, expenseEntityRows, orderRows, executiveSummaryRows);
  const revenue = monthlyAggComplete(incomes, "date", "_amount");
  const expense = monthlyAggComplete(expenses, "date", "_amount");
  const months = [...new Set([
    ...revenue.map((point) => point.month),
    ...expense.map((point) => point.month),
  ])].sort();
  return months.map((month) => {
    const incomeValue = revenue.find((point) => point.month === month)?.val || 0;
    const expenseValue = expense.find((point) => point.month === month)?.val || 0;
    return {
      month,
      income: incomeValue,
      expense: expenseValue,
      margin: incomeValue - expenseValue,
    };
  });
}
