// Scripts for firebase and firebase messaging
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing in the messagingSenderId.
firebase.initializeApp({
    apiKey: "AIzaSyCHbORTw-dgJW4OWIRazYrhAemERLV68sM",
    authDomain: "nack-8c299.firebaseapp.com",
    projectId: "nack-8c299",
    storageBucket: "nack-8c299.firebasestorage.app",
    messagingSenderId: "94970966128",
    appId: "1:94970966128:web:e3af16bcd2a262e66cc4b5",
    measurementId: "G-CZC9NPN8T1",
});

// Retrieve an instance of Firebase Messaging so that it can handle background messages.
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    // Customize notification here
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/favicon.png'
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
