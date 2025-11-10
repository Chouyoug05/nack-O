/**
 * Script à exécuter dans la console du navigateur (Admin Dashboard)
 * Copiez-collez ce code dans la console du navigateur quand vous êtes sur l'Admin Dashboard
 */

(async function() {
  const email = "sericsackerkoumba@gmail.com";
  const days = 1;
  
  // Vérifier que nous sommes sur l'Admin Dashboard
  if (!window.location.pathname.includes('admin')) {
    console.error('❌ Vous devez être sur la page Admin Dashboard');
    return;
  }
  
  console.log(`🔍 Recherche de l'utilisateur: ${email}`);
  
  // Utiliser Firebase depuis la page
  const { db } = await import('/src/lib/firebase.ts');
  const { collection, query, where, getDocs, doc, updateDoc } = await import('firebase/firestore');
  
  try {
    // Chercher l'utilisateur
    const profilesRef = collection(db, 'profiles');
    const emailQuery = query(profilesRef, where('email', '==', email));
    const snapshot = await getDocs(emailQuery);
    
    if (snapshot.empty) {
      console.error(`❌ Aucun utilisateur trouvé avec l'email: ${email}`);
      return;
    }
    
    const profileDoc = snapshot.docs[0];
    const profileData = profileDoc.data();
    const uid = profileDoc.id;
    
    console.log(`✅ Utilisateur trouvé:`, profileData);
    
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const daysToAddMs = days * oneDayMs;
    const currentEndDate = profileData.subscriptionEndsAt || now;
    const newEndDate = currentEndDate + daysToAddMs;
    const newDaysRemaining = (newEndDate - now) / oneDayMs;
    
    console.log(`📅 État actuel:`, {
      dateFin: new Date(currentEndDate).toISOString(),
      joursRestants: Math.floor((currentEndDate - now) / oneDayMs)
    });
    
    // Mettre à jour
    await updateDoc(doc(db, 'profiles', uid), {
      subscriptionEndsAt: newEndDate,
      plan: 'active',
      updatedAt: now,
    });
    
    console.log(`✅ ABONNEMENT PROLONGÉ:`, {
      nouvelleDateFin: new Date(newEndDate).toISOString(),
      nouveauxJoursRestants: Math.floor(newDaysRemaining),
      joursAjoutes: days
    });
    
    alert(`✅ Abonnement prolongé de ${days} jour(s) pour ${email}\nNouveaux jours restants: ${Math.floor(newDaysRemaining)}`);
  } catch (error) {
    console.error('❌ ERREUR:', error);
    alert(`❌ Erreur: ${error.message}`);
  }
})();

