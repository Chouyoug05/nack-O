import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';
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

async function checkUserProducts() {
  try {
    // Connexion admin
    await signInWithEmailAndPassword(auth, 'admin@nack.pro', 'admin_password');
    console.log('✅ Connexion admin réussie');

    const userId = 'tMBumI36wQg0uHSel4saih0SepC3';
    console.log(`\n🔍 Vérification des produits pour l'utilisateur: ${userId}`);

    // Charger tous les produits
    const productsRef = collection(db, `profiles/${userId}/products`);
    const snapshot = await getDocs(productsRef);
    
    console.log(`📦 Nombre total de produits: ${snapshot.size}`);
    
    if (snapshot.empty) {
      console.log('⚠️ Aucun produit trouvé dans la collection');
      console.log('💡 Solution: Ajoutez des produits dans la section Stock de votre dashboard');
      return;
    }

    let productsWithStock = 0;
    let productsWithoutStock = 0;
    let productsFixed = 0;

    console.log('\n📋 Détails des produits:');
    snapshot.forEach((doc) => {
      const product = doc.data();
      console.log(`\n  🏷️  ${product.name || 'Sans nom'}`);
      console.log(`     - ID: ${doc.id}`);
      console.log(`     - Stock: ${product.stock !== undefined ? product.stock : 'undefined'}`);
      console.log(`     - Prix: ${product.price || 'undefined'}`);
      console.log(`     - Catégorie: ${product.category || 'undefined'}`);
      
      if (product.stock && product.stock > 0) {
        productsWithStock++;
        console.log(`     ✅ En stock`);
      } else {
        productsWithoutStock++;
        console.log(`     ❌ Pas de stock`);
        
        // Ajouter du stock par défaut
        if (product.stock === undefined || product.stock === null || product.stock === 0) {
          console.log(`     🔧 Ajout de stock par défaut (10 unités)`);
          updateDoc(doc.ref, { stock: 10 });
          productsFixed++;
        }
      }
    });

    console.log(`\n📊 Résumé:`);
    console.log(`   - Produits avec stock: ${productsWithStock}`);
    console.log(`   - Produits sans stock: ${productsWithoutStock}`);
    console.log(`   - Produits corrigés: ${productsFixed}`);

    if (productsFixed > 0) {
      console.log(`\n🎉 ${productsFixed} produits ont été corrigés avec du stock par défaut !`);
      console.log('💡 Rechargez la page Bar Connectée pour voir les changements.');
    }

    console.log('\n✅ Vérification terminée !');
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

checkUserProducts();
