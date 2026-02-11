const admin = require('firebase-admin');

// On initialise l'admin Firebase une seule fois
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
    });
}

exports.handler = async (event, context) => {
    // Optionnel: Vérifier l'origine ou un token secret pour la sécurité

    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    try {
        const { token, title, body, data } = JSON.parse(event.body);

        if (!token) {
            return { statusCode: 400, body: "Missing FCM token" };
        }

        const message = {
            notification: {
                title: title || "Nack-O",
                body: body || "Nouvelle notification",
            },
            data: data || {},
            token: token,
            android: {
                priority: 'high',
                notification: {
                    sound: 'default',
                    clickAction: 'FLUTTER_NOTIFICATION_CLICK',
                },
            },
            webpush: {
                headers: {
                    Urgency: 'high',
                },
                notification: {
                    icon: '/favicon.png',
                    requireInteraction: true,
                },
            },
        };

        const response = await admin.messaging().send(message);

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, messageId: response }),
        };
    } catch (error) {
        console.error('Error sending notification:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, error: error.message }),
        };
    }
};
