import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';

// Configuration Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBvQZ8QZ8QZ8QZ8QZ8QZ8QZ8QZ8QZ8QZ8",
  authDomain: "nack-8c299.firebaseapp.com",
  projectId: "nack-8c299",
  storageBucket: "nack-8c299.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdefghijklmnop"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkAndCreateProfile(establishmentId) {
  console.log('🔍 Vérification du profil:', establishmentId);
  
  try {
    // Vérifier si le profil existe
    const profileDoc = await getDoc(doc(db, 'profiles', establishmentId));
    
    if (profileDoc.exists()) {
      console.log('✅ Profil existe déjà');
      const data = profileDoc.data();
      console.log('📋 Données:', {
        establishmentName: data.establishmentName,
        plan: data.plan,
        createdAt: data.createdAt
      });
      return;
    }
    
    console.log('❌ Profil non trouvé, création...');
    
    // Créer un profil de base
    const profileData = {
      establishmentName: 'Bar Test',
      establishmentType: 'bar',
      plan: 'trial',
      trialEndsAt: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 jours
      createdAt: Date.now(),
      whatsapp: '+241XXXXXXXX',
      tutorialCompleted: false,
      tutorialStep: 'stock'
    };
    
    await setDoc(doc(db, 'profiles', establishmentId), profileData);
    console.log('✅ Profil créé avec succès');
    
    // Créer quelques produits de test
    console.log('📦 Création de produits de test...');
    const products = [
      {
        name: 'Regab',
        price: 700,
        quantity: 10,
        available: true,
        category: 'boisson',
        createdAt: Date.now()
      },
      {
        name: 'Brochette',
        price: 500,
        quantity: 5,
        available: true,
        category: 'nourriture',
        createdAt: Date.now()
      }
    ];
    
    for (const product of products) {
      await setDoc(doc(db, `profiles/${establishmentId}/products`, product.name.toLowerCase().replace(/\s+/g, '_')), product);
    }
    
    console.log('✅ Produits créés');
    
    // Créer quelques tables de test
    console.log('🪑 Création de tables de test...');
    const tables = [
      {
        name: 'Table 1',
        type: 'table',
        capacity: 4,
        description: 'Près de la fenêtre',
        createdAt: Date.now()
      },
      {
        name: 'Comptoir',
        type: 'zone',
        capacity: 2,
        description: 'Devant le bar',
        createdAt: Date.now()
      }
    ];
    
    for (const table of tables) {
      await setDoc(doc(db, `profiles/${establishmentId}/tables`, table.name.toLowerCase().replace(/\s+/g, '_')), table);
    }
    
    console.log('✅ Tables créées');
    console.log('🎉 Configuration complète terminée !');
    
  } catch (error) {
    console.error('❌ Erreur:', error);
    console.error('Code:', error.code);
    console.error('Message:', error.message);
  }
}

// Utilisation
const establishmentId = 'tMBumI36wQg0uHSel4saih0SepC3';
checkAndCreateProfile(establishmentId);
