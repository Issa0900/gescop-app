// Formules sans valeur calculee.
//
// Un classeur genere par un script (openpyxl, pandas) contient les formules
// mais pas leur resultat : Excel ne l'a jamais ouvert pour les calculer. La
// cellule arrive donc vide a l'import. Sur le dossier DEMO, 864 cellules
// d'Entreprise_Simulation (prix net, sous-total HT, taxes, total TTC) et 4 805
// de Nordik etaient vides : tout le chiffre d'affaires du premier devenait
// « non mesurable ».
//
// On evalue ici le sous-ensemble de formules que produisent ces exports :
// arithmetique, comparaisons, references (y compris vers une autre feuille),
// plages, et SUM / AVERAGE / MIN / MAX / COUNT / COUNTA / COUNTIF / SUMIF /
// IF / IFERROR / AND / OR / NOT / ROUND / ABS. Une formule hors de ce
// sous-ensemble (TODAY, DATEVALUE...) reste vide, comme avant : on ne devine
// jamais une valeur, on calcule ou on s'abstient.

type Valeur = number | string | boolean | null;
type Plage = { plage: Valeur[] };
type Resultat = Valeur | Plage;

class NonSupporte extends Error {}

const colNum = (lettres: string) => [...lettres].reduce((n, c) => n * 26 + (c.charCodeAt(0) - 64), 0);
const colLettres = (n: number) => { let s = ""; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; };

interface Jeton { t: "num" | "str" | "ref" | "id" | "op" | "(" | ")" | "," | ":" | "bool"; v: string }

function decouper(f: string): Jeton[] {
  const j: Jeton[] = [];
  let i = 0;
  while (i < f.length) {
    const c = f[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '"') {
      let k = i + 1, s = "";
      while (k < f.length) { if (f[k] === '"' && f[k + 1] === '"') { s += '"'; k += 2; continue; } if (f[k] === '"') break; s += f[k++]; }
      j.push({ t: "str", v: s }); i = k + 1; continue;
    }
    // Reference, eventuellement prefixee d'une feuille : 'Ventes (1200+)'!$K$5 ou Feuil1!A1
    const m = f.slice(i).match(/^(?:('(?:[^']|'')+'|[A-Za-z_][\w.]*)!)?(\$?[A-Z]{1,3}\$?\d+)/);
    if (m && !/^[A-Za-z_][\w.]*\(/.test(f.slice(i))) {
      const feuille = m[1] ? m[1].replace(/^'|'$/g, "").replace(/''/g, "'") : "";
      j.push({ t: "ref", v: `${feuille}!${m[2].replace(/\$/g, "")}` }); i += m[0].length; continue;
    }
    const n = f.slice(i).match(/^\d+(\.\d+)?([eE][-+]?\d+)?/);
    if (n) { j.push({ t: "num", v: n[0] }); i += n[0].length; continue; }
    const id = f.slice(i).match(/^[A-Za-z_][\w.]*/);
    if (id) {
      const u = id[0].toUpperCase();
      j.push(u === "TRUE" || u === "FALSE" ? { t: "bool", v: u } : { t: "id", v: u });
      i += id[0].length; continue;
    }
    const op = f.slice(i).match(/^(<>|<=|>=|[-+*/^&=<>%])/);
    if (op) { j.push({ t: "op", v: op[0] }); i += op[0].length; continue; }
    if ("(),:".includes(c)) { j.push({ t: c as any, v: c }); i++; continue; }
    throw new NonSupporte(`caractere ${c}`);
  }
  return j;
}

const estVide = (v: any) => v === null || v === undefined || v === "";
function nombre(v: any): number {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (estVide(v)) return 0;
  const n = Number(String(v).trim());
  if (Number.isNaN(n)) throw new NonSupporte("texte dans un calcul");
  return n;
}
const scalaire = (r: Resultat): Valeur => (r && typeof r === "object" && "plage" in r ? (r.plage[0] ?? null) : r as Valeur);
const aplatir = (args: Resultat[]): Valeur[] => args.flatMap((a) => (a && typeof a === "object" && "plage" in a ? a.plage : [a as Valeur]));

function critere(c: Valeur): (v: Valeur) => boolean {
  const s = String(c ?? "");
  const m = s.match(/^(<>|<=|>=|=|<|>)(.*)$/);
  const op = m ? m[1] : "=";
  const cible = m ? m[2] : s;
  const cibleNum = cible.trim() !== "" && !Number.isNaN(Number(cible)) ? Number(cible) : null;
  return (v) => {
    if (cibleNum !== null && typeof v === "number") {
      switch (op) { case "=": return v === cibleNum; case "<>": return v !== cibleNum; case "<": return v < cibleNum; case ">": return v > cibleNum; case "<=": return v <= cibleNum; case ">=": return v >= cibleNum; }
    }
    const a = String(v ?? "").toLowerCase(), b = cible.toLowerCase();
    return op === "<>" ? a !== b : op === "=" ? a === b : false;
  };
}

export class EvaluateurClasseur {
  private enCours = new Set<string>();
  calculees = 0;
  echecs = 0;
  private wb: any;
  constructor(wb: any) { this.wb = wb; }

  /** Valeur d'une cellule, calculee si elle n'a qu'une formule. */
  valeur(feuille: string, adresse: string): Valeur {
    const ws = this.wb.Sheets[feuille];
    if (!ws) throw new NonSupporte(`feuille ${feuille}`);
    const cell = ws[adresse];
    if (!cell) return null;
    // Une formule sans resultat enregistre arrive en « stub » (t = "z",
    // lecture avec sheetStubs) : sa valeur apparente (0) n'est pas un resultat.
    const aCalculer = cell.f && (cell.t === "z" || cell.v === undefined);
    if (!aCalculer) return cell.t === "z" ? null : (cell.v ?? null);
    const cle = `${feuille}!${adresse}`;
    if (this.enCours.has(cle)) throw new NonSupporte("reference circulaire");
    this.enCours.add(cle);
    try {
      const v = scalaire(this.evaluer(String(cell.f), feuille));
      cell.v = v;
      cell.t = typeof v === "number" ? "n" : typeof v === "boolean" ? "b" : "s";
      this.calculees++;
      return v;
    } finally {
      this.enCours.delete(cle);
    }
  }

  evaluer(formule: string, feuille: string): Resultat {
    const jetons = decouper(formule.replace(/^=/, ""));
    let p = 0;
    const voir = () => jetons[p];
    const prendre = () => jetons[p++];
    const attendre = (t: string) => { const x = prendre(); if (!x || x.t !== t) throw new NonSupporte(`attendu ${t}`); return x; };
    const self = this;

    function plage(a: string, b: string): Plage {
      const [fa, ca] = a.split("!");
      const [, cb] = b.split("!");
      const f = fa || feuille;
      const ma = ca.match(/^([A-Z]+)(\d+)$/)!, mb = cb.match(/^([A-Z]+)(\d+)$/)!;
      const c1 = Math.min(colNum(ma[1]), colNum(mb[1])), c2 = Math.max(colNum(ma[1]), colNum(mb[1]));
      const l1 = Math.min(+ma[2], +mb[2]), l2 = Math.max(+ma[2], +mb[2]);
      const out: Valeur[] = [];
      for (let l = l1; l <= l2; l++) for (let c = c1; c <= c2; c++) out.push(self.valeur(f, `${colLettres(c)}${l}`));
      return { plage: out };
    }

    function primaire(): Resultat {
      const x = prendre();
      if (!x) throw new NonSupporte("fin de formule");
      if (x.t === "num") return Number(x.v);
      if (x.t === "str") return x.v;
      if (x.t === "bool") return x.v === "TRUE";
      if (x.t === "(") { const v = comparaison(); attendre(")"); return v; }
      if (x.t === "ref") {
        if (voir()?.t === ":") {
          prendre();
          const y = attendre("ref");
          return plage(x.v, y.v);
        }
        const [f, a] = x.v.split("!");
        return self.valeur(f || feuille, a);
      }
      if (x.t === "id") {
        attendre("(");
        const args: (() => Resultat)[] = [];
        // Arguments evalues a la demande : IF n'evalue que la branche retenue.
        const debuts: number[] = [];
        if (voir()?.t !== ")") {
          for (;;) {
            debuts.push(p);
            let prof = 0;
            while (p < jetons.length) {
              const t = jetons[p];
              if (t.t === "(") prof++;
              if (t.t === ")") { if (prof === 0) break; prof--; }
              if (t.t === "," && prof === 0) break;
              p++;
            }
            if (voir()?.t === ",") { prendre(); continue; }
            break;
          }
        }
        const fin = p;
        attendre(")");
        for (let k = 0; k < debuts.length; k++) {
          const debut = debuts[k];
          const arret = k + 1 < debuts.length ? debuts[k + 1] - 1 : fin;
          args.push(() => {
            const sauve = p;
            p = debut;
            const v = comparaison();
            if (p !== arret) throw new NonSupporte("argument mal forme");
            p = sauve;
            return v;
          });
        }
        return fonction(x.v, args);
      }
      if (x.t === "op" && (x.v === "-" || x.v === "+")) { const v = nombre(scalaire(primaire())); return x.v === "-" ? -v : v; }
      throw new NonSupporte(`jeton ${x.v}`);
    }

    function fonction(nom: string, args: (() => Resultat)[]): Resultat {
      const tous = () => aplatir(args.map((a) => a()));
      const nombres = () => tous().filter((v) => typeof v === "number") as number[];
      switch (nom) {
        case "SUM": return nombres().reduce((a, b) => a + b, 0);
        case "AVERAGE": { const n = nombres(); if (!n.length) throw new NonSupporte("moyenne vide"); return n.reduce((a, b) => a + b, 0) / n.length; }
        case "MIN": { const n = nombres(); return n.length ? Math.min(...n) : 0; }
        case "MAX": { const n = nombres(); return n.length ? Math.max(...n) : 0; }
        case "COUNT": return nombres().length;
        case "COUNTA": return tous().filter((v) => !estVide(v)).length;
        case "COUNTIF": { const pl = aplatir([args[0]()]); const ok = critere(scalaire(args[1]())); return pl.filter(ok).length; }
        case "SUMIF": {
          const pl = aplatir([args[0]()]);
          const ok = critere(scalaire(args[1]()));
          const somme = args[2] ? aplatir([args[2]()]) : pl;
          return pl.reduce((acc: number, v, i) => acc + (ok(v) && typeof somme[i] === "number" ? (somme[i] as number) : 0), 0);
        }
        case "IF": { const c = scalaire(args[0]()); const vrai = typeof c === "string" ? c !== "" : Boolean(nombre(c)); return vrai ? (args[1] ? args[1]() : true) : (args[2] ? args[2]() : false); }
        case "IFERROR": try { return args[0](); } catch (e) { if (e instanceof NonSupporte && !/texte|division/.test(e.message)) throw e; return args[1] ? args[1]() : ""; }
        case "AND": return args.every((a) => Boolean(nombre(scalaire(a()))));
        case "OR": return args.some((a) => Boolean(nombre(scalaire(a()))));
        case "NOT": return !nombre(scalaire(args[0]()));
        case "ROUND": { const d = args[1] ? nombre(scalaire(args[1]())) : 0; const f = 10 ** d; return Math.round(nombre(scalaire(args[0]())) * f) / f; }
        case "ABS": return Math.abs(nombre(scalaire(args[0]())));
        default: throw new NonSupporte(`fonction ${nom}`);
      }
    }

    function puissance(): Resultat {
      let g = primaire();
      while (voir()?.t === "op" && voir().v === "^") { prendre(); g = nombre(scalaire(g)) ** nombre(scalaire(primaire())); }
      if (voir()?.t === "op" && voir().v === "%") { prendre(); g = nombre(scalaire(g)) / 100; }
      return g;
    }
    function produit(): Resultat {
      let g = puissance();
      while (voir()?.t === "op" && (voir().v === "*" || voir().v === "/")) {
        const op = prendre().v;
        const d = nombre(scalaire(puissance()));
        const a = nombre(scalaire(g));
        if (op === "/" && d === 0) throw new NonSupporte("division par zero");
        g = op === "*" ? a * d : a / d;
      }
      return g;
    }
    function somme(): Resultat {
      let g = produit();
      while (voir()?.t === "op" && (voir().v === "+" || voir().v === "-")) {
        const op = prendre().v;
        const d = nombre(scalaire(produit()));
        g = op === "+" ? nombre(scalaire(g)) + d : nombre(scalaire(g)) - d;
      }
      return g;
    }
    function concat(): Resultat {
      let g = somme();
      while (voir()?.t === "op" && voir().v === "&") { prendre(); g = `${scalaire(g) ?? ""}${scalaire(somme()) ?? ""}`; }
      return g;
    }
    function comparaison(): Resultat {
      const g = concat();
      const x = voir();
      if (x?.t === "op" && ["=", "<>", "<", ">", "<=", ">="].includes(x.v)) {
        prendre();
        const a = scalaire(g), b = scalaire(concat());
        const num = typeof a === "number" || typeof b === "number";
        const A: any = num ? nombre(a) : String(a ?? "").toLowerCase();
        const B: any = num ? nombre(b) : String(b ?? "").toLowerCase();
        switch (x.v) { case "=": return A === B; case "<>": return A !== B; case "<": return A < B; case ">": return A > B; case "<=": return A <= B; default: return A >= B; }
      }
      return g;
    }

    const v = comparaison();
    if (p !== jetons.length) throw new NonSupporte("formule non lue en entier");
    return v;
  }
}

/**
 * Calcule, dans tout le classeur, les cellules qui n'ont qu'une formule.
 * Modifie le classeur en place ; rend le nombre de cellules calculees et
 * celles laissees vides faute de pouvoir les calculer.
 */
export function calculerFormulesManquantes(wb: any): { calculees: number; laissees: number } {
  const ev = new EvaluateurClasseur(wb);
  let laissees = 0;
  for (const nom of wb.SheetNames || []) {
    const ws = wb.Sheets[nom];
    for (const adresse of Object.keys(ws || {})) {
      if (adresse.startsWith("!")) continue;
      const cell = ws[adresse];
      if (!cell || !cell.f || (cell.t !== "z" && cell.v !== undefined)) continue;
      try { ev.valeur(nom, adresse); } catch {
        // Incalculable : la cellule reste VIDE, jamais le 0 apparent du stub.
        delete cell.v;
        laissees++;
      }
    }
  }
  return { calculees: ev.calculees, laissees };
}
