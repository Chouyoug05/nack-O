import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, doc, setDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

// Configuration Firebase (utilisez vos propres clés)
const firebaseConfig = {
  apiKey: "AIzaSyBvQZQZQZQZQZQZQZQZQZQZQZQZQZQZQ",
  authDomain: "nack-8c299.firebaseapp.com",
  projectId: "nack-8c299",
  storageBucket: "nack-8c299.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdefghijklmnop"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function initBarConnecteeCollections() {
  try {
    // Connexion admin (remplacez par vos identifiants admin)
    await signInWithEmailAndPassword(auth, 'admin@nack.pro', 'admin_password');
    console.log('✅ Connexion admin réussie');

    // Récupérer tous les utilisateurs (vous devrez adapter selon votre structure)
    const users = [
      // Ajoutez ici les UIDs des utilisateurs qui ont des problèmes
      'tMBumI36wQg0uHSel4saih0SepC3' // Exemple d'UID
    ];

    for (const userId of users) {
      console.log(`\n🔧 Initialisation pour l'utilisateur: ${userId}`);

      // Créer une table exemple
      try {
        const tableRef = await addDoc(collection(db, `profiles/${userId}/tables`), {
          name: 'Table 1',
          type: 'table',
          capacity: 4,
          description: 'Table principale',
          createdAt: Date.now()
        });
        console.log(`✅ Table créée: ${tableRef.id}`);
      } catch (error) {
        console.log(`⚠️ Table déjà existante ou erreur: ${error.message}`);
      }

      // Créer une commande exemple
      try {
        const orderRef = await addDoc(collection(db, `profiles/${userId}/barOrders`), {
          orderNumber: 'CMD001',
          tableZone: 'Table 1',
          products: [
            { name: 'Regab', quantity: 2, price: 500 }
          ],
          total: 1000,
          status: 'pending',
          createdAt: Date.now()
        });
        console.log(`✅ Commande créée: ${orderRef.id}`);
      } catch (error) {
        console.log(`⚠️ Commande déjà existante ou erreur: ${error.message}`);
      }

      // Créer la configuration Bar Connectée
      try {
        await setDoc(doc(db, `profiles/${userId}/barConnectee`, 'config'), {
          publicUrl: `https://nack.pro/commande/${userId}`,
          qrCodeGenerated: false,
          establishmentName: 'Mon Établissement',
          lastUpdated: Date.now()
        });
        console.log(`✅ Configuration Bar Connectée créée`);
      } catch (error) {
        console.log(`⚠️ Configuration déjà existante ou erreur: ${error.message}`);
      }
    }

    console.log('\n🎉 Initialisation terminée !');
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

initBarConnecteeCollections();
