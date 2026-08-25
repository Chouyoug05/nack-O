const { CORS, json } = require("./_security");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  const vars = {
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || "NON DEFINI",
    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL ? "DEFINI (longueur " + process.env.FIREBASE_CLIENT_EMAIL.length + ")" : "NON DEFINI",
    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY ? "DEFINI (longueur " + process.env.FIREBASE_PRIVATE_KEY.length + ")" : "NON DEFINI",
    FIREBASE_ADMIN_PROJECT_ID: process.env.FIREBASE_ADMIN_PROJECT_ID || "NON DEFINI",
    FIREBASE_ADMIN_CLIENT_EMAIL: process.env.FIREBASE_ADMIN_CLIENT_EMAIL ? "DEFINI" : "NON DEFINI",
    FIREBASE_ADMIN_PRIVATE_KEY: process.env.FIREBASE_ADMIN_PRIVATE_KEY ? "DEFINI" : "NON DEFINI",
    GCP_PROJECT: process.env.GCP_PROJECT || "NON DEFINI",
    GCLOUD_PROJECT: process.env.GCLOUD_PROJECT || "NON DEFINI",
  };

  return json(200, { variables: vars });
};
