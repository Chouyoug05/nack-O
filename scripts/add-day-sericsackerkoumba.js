/**
 * Script à exécuter dans la console du navigateur (Admin Dashboard)
 * 
 * INSTRUCTIONS :
 * 1. Connectez-vous à votre compte admin
 * 2. Allez sur la page /admin (Admin Dashboard)
 * 3. Ouvrez la console du navigateur (F12)
 * 4. Copiez-collez tout ce code dans la console
 * 5. Appuyez sur Entrée
 */

(async function() {
  const email = "sericsackerkoumba@gmail.com";
  const days = 1;
  
  console.log(`🔍 Recherche de l'utilisateur: ${email}`);
  
  // Importer les fonctions Firebase nécessaires
  const { db } = await import('/src/lib/firebase.ts');
  const { collection, query, where, getDocs, doc, updateDoc } = await import('firebase/firestore');
  
  try {
    // Chercher l'utilisateur par email
    const profilesRef = collection(db, 'profiles');
    const emailQuery = query(profilesRef, where('email', '==', email));
    const snapshot = await getDocs(emailQuery);
    
    if (snapshot.empty) {
      console.error(`❌ Aucun utilisateur trouvé avec l'email: ${email}`);
      alert(`❌ Aucun utilisateur trouvé avec l'email: ${email}`);
      return;
    }
    
    const profileDoc = snapshot.docs[0];
    const profileData = profileDoc.data();
    const uid = profileDoc.id;
    
    console.log(`✅ Utilisateur trouvé:`, {
      uid,
      nom: profileData.establishmentName || profileData.ownerName,
      email: profileData.email,
      plan: profileData.plan
    });
    
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const daysToAddMs = days * oneDayMs;
    const currentEndDate = profileData.subscriptionEndsAt || now;
    const newEndDate = currentEndDate + daysToAddMs;
    const newDaysRemaining = (newEndDate - now) / oneDayMs;
    
    const currentDaysRemaining = Math.floor((currentEndDate - now) / oneDayMs);
    
    console.log(`📅 État actuel:`, {
      dateFin: new Date(currentEndDate).toLocaleString('fr-FR'),
      joursRestants: currentDaysRemaining
    });
    
    console.log(`🔄 Ajout de ${days} jour(s)...`);
    
    // Mettre à jour l'abonnement
    await updateDoc(doc(db, 'profiles', uid), {
      subscriptionEndsAt: newEndDate,
      plan: 'active',
      updatedAt: now,
    });
    
    console.log(`✅ ABONNEMENT PROLONGÉ:`, {
      nouvelleDateFin: new Date(newEndDate).toLocaleString('fr-FR'),
      nouveauxJoursRestants: Math.floor(newDaysRemaining),
      joursAjoutes: days
    });
    
    alert(`✅ Abonnement prolongé de ${days} jour(s) pour ${email}\n\n` +
          `Jours restants avant: ${currentDaysRemaining}\n` +
          `Jours restants après: ${Math.floor(newDaysRemaining)}\n` +
          `Nouvelle date de fin: ${new Date(newEndDate).toLocaleString('fr-FR')}`);
    
  } catch (error) {
    console.error('❌ ERREUR:', error);
    alert(`❌ Erreur: ${error.message}\n\nVérifiez la console pour plus de détails.`);
  }
})();

