// Script de test pour vérifier les permissions Firestore en mobile
// À exécuter dans la console du navigateur mobile

console.log('=== TEST PERMISSIONS FIRESTORE MOBILE ===');

// Test 1: Vérifier la connexion Firebase
console.log('1. Test connexion Firebase...');
console.log('Firebase app:', window.firebase || 'Non disponible');

// Test 2: Vérifier l'ID d'établissement depuis l'URL
console.log('2. Test extraction ID...');
const pathParts = window.location.pathname.split('/');
const establishmentId = pathParts[pathParts.length - 1];
console.log('Pathname:', window.location.pathname);
console.log('ID extrait:', establishmentId);

// Test 3: Vérifier les règles de sécurité (simulation)
console.log('3. Test règles de sécurité...');
console.log('User Agent:', navigator.userAgent);
console.log('Is Mobile:', /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));

// Test 4: Vérifier la configuration Firebase
console.log('4. Configuration Firebase...');
if (window.firebase && window.firebase.apps && window.firebase.apps[0]) {
  const app = window.firebase.apps[0];
  console.log('App name:', app.name);
  console.log('Project ID:', app.options.projectId);
} else {
  console.log('Firebase non initialisé');
}

// Test 5: Vérifier les collections Firestore
console.log('5. Test collections Firestore...');
console.log('Collections à vérifier:');
console.log('- profiles/' + establishmentId);
console.log('- profiles/' + establishmentId + '/products');
console.log('- profiles/' + establishmentId + '/tables');

console.log('=== FIN TEST ===');
