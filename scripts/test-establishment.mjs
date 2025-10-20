import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

// Configuration Firebase (utilisez vos vraies clés)
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

async function testEstablishmentData(establishmentId) {
  console.log('🔍 Test des données pour l\'établissement:', establishmentId);
  
  try {
    // Test 1: Vérifier le profil principal
    console.log('📋 Test 1: Profil principal');
    const profileDoc = await getDoc(doc(db, 'profiles', establishmentId));
    
    if (profileDoc.exists()) {
      const profileData = profileDoc.data();
      console.log('✅ Profil trouvé:', {
        id: profileDoc.id,
        establishmentName: profileData.establishmentName,
        hasLogo: !!profileData.logoUrl,
        plan: profileData.plan,
        createdAt: profileData.createdAt
      });
    } else {
      console.log('❌ Profil non trouvé');
      return;
    }
    
    // Test 2: Vérifier les produits
    console.log('📦 Test 2: Produits');
    const productsRef = collection(db, `profiles/${establishmentId}/products`);
    const productsSnapshot = await getDocs(productsRef);
    
    console.log('📊 Produits trouvés:', productsSnapshot.size);
    productsSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`  - ${data.name}: stock=${data.quantity || data.stock || 0}, disponible=${data.available !== false}`);
    });
    
    // Test 3: Vérifier les tables
    console.log('🪑 Test 3: Tables');
    const tablesRef = collection(db, `profiles/${establishmentId}/tables`);
    const tablesSnapshot = await getDocs(tablesRef);
    
    console.log('📊 Tables trouvées:', tablesSnapshot.size);
    tablesSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`  - ${data.name} (${data.type})`);
    });
    
  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
    console.error('Détails:', {
      code: error.code,
      message: error.message,
      establishmentId
    });
  }
}

// Utilisation
const establishmentId = 'tMBumI36wQg0uHSel4saih0SepC3';
testEstablishmentData(establishmentId);
