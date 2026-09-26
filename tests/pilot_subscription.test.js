import test from "node:test";
import assert from "node:assert/strict";
import {
  computePilotExpirationDate,
  checkPilotValidity,
  ADMIN_EMAILS,
  VALID_PILOT_CODES,
} from "../src/lib/pilotAccess.js";

test("computePilotExpirationDate - Calcule exactement 1 mois après la date d'activation", () => {
  const start = new Date("2026-09-26T12:00:00Z");
  const exp = computePilotExpirationDate(start);

  assert.equal(exp.getUTCFullYear(), 2026);
  assert.equal(exp.getUTCMonth(), 9); // Octobre (index 9)
  assert.equal(exp.getUTCDate(), 26);
});

test("computePilotExpirationDate - Évite le débordement sur les mois plus courts (31 janvier -> 28 février)", () => {
  const startNonLeap = new Date("2026-01-31T12:00:00Z");
  const expNonLeap = computePilotExpirationDate(startNonLeap);

  assert.equal(expNonLeap.getUTCFullYear(), 2026);
  assert.equal(expNonLeap.getUTCMonth(), 1); // Février (index 1)
  assert.equal(expNonLeap.getUTCDate(), 28); // 28 février 2026

  const startMarch31 = new Date("2026-03-31T12:00:00Z");
  const expApril = computePilotExpirationDate(startMarch31);

  assert.equal(expApril.getUTCFullYear(), 2026);
  assert.equal(expApril.getUTCMonth(), 3); // Avril (index 3)
  assert.equal(expApril.getUTCDate(), 30); // 30 avril (avril a 30 jours)
});

test("Accès Pilote - Vérification des codes d'accès valides et whitelist admin", () => {
  assert.ok(ADMIN_EMAILS.includes("issaouedraogo0900@gmail.com"));
  assert.ok(VALID_PILOT_CODES.includes("PILOTE2026"));
  assert.ok(VALID_PILOT_CODES.includes("PILOTE"));
  assert.ok(VALID_PILOT_CODES.includes("GESCOP-VIP"));
});

test("checkPilotValidity - Évaluation d'un accès actif vs expiré après 1 mois", () => {
  const now = new Date("2026-10-01T00:00:00Z").getTime();

  // Cas 1 : Expire dans 20 jours
  const activeIso = new Date("2026-10-21T00:00:00Z").toISOString();
  const resActive = checkPilotValidity(activeIso, now);
  assert.equal(resActive.isValid, true);
  assert.equal(resActive.isExpired, false);
  assert.equal(resActive.daysRemaining, 20);

  // Cas 2 : Expiré depuis 5 jours
  const expiredIso = new Date("2026-09-26T00:00:00Z").toISOString();
  const resExpired = checkPilotValidity(expiredIso, now);
  assert.equal(resExpired.isValid, false);
  assert.equal(resExpired.isExpired, true);
  assert.equal(resExpired.daysRemaining, 0);

  // Cas 3 : Date non définie
  const resNull = checkPilotValidity(null, now);
  assert.equal(resNull.isValid, false);
  assert.equal(resNull.isExpired, false);
});
