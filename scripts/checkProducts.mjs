import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

// Configuration Firebase
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

async function checkAndFixProducts() {
  try {
    // Connexion admin
    await signInWithEmailAndPassword(auth, 'admin@nack.pro', 'admin_password');
    console.log('✅ Connexion admin réussie');

    // Récupérer tous les utilisateurs
    const users = [
      'tMBumI36wQg0uHSel4saih0SepC3' // Remplacez par l'UID de l'utilisateur
    ];

    for (const userId of users) {
      console.log(`\n🔍 Vérification des produits pour l'utilisateur: ${userId}`);

      try {
        // Charger tous les produits
        const productsRef = collection(db, `profiles/${userId}/products`);
        const snapshot = await getDocs(productsRef);
        
        console.log(`📦 Nombre total de produits: ${snapshot.size}`);
        
        if (snapshot.empty) {
          console.log('⚠️ Aucun produit trouvé dans la collection');
          continue;
        }

        let productsWithStock = 0;
        let productsWithoutStock = 0;

        snapshot.forEach((doc) => {
          const product = doc.data();
          console.log(`\n📋 Produit: ${product.name}`);
          console.log(`   - Stock: ${product.stock || 'undefined'}`);
          console.log(`   - Prix: ${product.price || 'undefined'}`);
          console.log(`   - Catégorie: ${product.category || 'undefined'}`);
          
          if (product.stock && product.stock > 0) {
            productsWithStock++;
          } else {
            productsWithoutStock++;
            
            // Optionnel: Ajouter du stock aux produits qui n'en ont pas
            if (product.stock === undefined || product.stock === null) {
              console.log(`   🔧 Ajout de stock par défaut (10 unités)`);
              updateDoc(doc.ref, { stock: 10 });
            }
          }
        });

        console.log(`\n📊 Résumé:`);
        console.log(`   - Produits avec stock: ${productsWithStock}`);
        console.log(`   - Produits sans stock: ${productsWithoutStock}`);

        // Vérifier avec une requête filtrée
        const stockQuery = query(productsRef, where('stock', '>', 0));
        const stockSnapshot = await getDocs(stockQuery);
        console.log(`   - Produits trouvés par requête stock > 0: ${stockSnapshot.size}`);

      } catch (error) {
        console.error(`❌ Erreur pour l'utilisateur ${userId}:`, error);
      }
    }

    console.log('\n🎉 Vérification terminée !');
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

checkAndFixProducts();
