const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, X-Nack-Internal-Secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(statusCode, body) {
  return { statusCode, headers: CORS, body: JSON.stringify(body) };
}

function parseBody(event) {
  try {
    return JSON.parse(event.body || "{}");
  } catch {
    return null;
  }
}

/** Secret interne pour les appels serveur-à-serveur.
 *  Fail-closed : si NACK_INTERNAL_SECRET n'est pas défini, toute requête est refusée. */
function checkInternalSecret(event) {
  const expected = process.env.NACK_INTERNAL_SECRET;
  if (!expected) return false;
  const provided =
    event.headers["x-nack-internal-secret"] ||
    event.headers["X-Nack-Internal-Secret"] ||
    "";
  return provided === expected;
}

module.exports = { CORS, json, parseBody, checkInternalSecret };
