const https = require('https');
const fs = require('fs');

const FUNCTION_URL = 'https://nack-o.netlify.app/.netlify/functions/recover-missing-stock';
const ADMIN_SECRET = process.env.ADMIN_FUNCTION_SECRET || '';

if (!ADMIN_SECRET) {
  console.error('❌ Erreur: ADMIN_FUNCTION_SECRET non défini');
  console.error('Usage: ADMIN_FUNCTION_SECRET="ton-secret" node scripts/recover-missing-stock.js [--execute]');
  process.exit(1);
}

const dryRun = !process.argv.includes('--execute');

console.log(`\n🔍 Mode: ${dryRun ? 'DRY RUN (simulation)' : 'EXÉCUTION RÉELLE'}\n`);

const postData = JSON.stringify({ dryRun });

const options = {
  hostname: 'nack-o.netlify.app',
  port: 443,
  path: '/.netlify/functions/recover-missing-stock',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'X-Admin-Secret': ADMIN_SECRET
  }
};

const req = https.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    if (res.statusCode === 200) {
      try {
        const result = JSON.parse(data);
        console.log('✅ Succès!\n');
        console.log('📊 Résumé:');
        console.log(`   Mode: ${result.summary.mode}`);
        console.log(`   Profils traités: ${result.summary.profilesProcessed}`);
        console.log(`   Ventes récupérées: ${result.summary.totalSalesRecovered}`);
        console.log(`   Stock décrémenté: ${result.summary.totalStockDecremented}`);
        console.log(`   Erreurs: ${result.summary.totalErrors}`);
        
        if (result.results.length > 0) {
          console.log('\n📋 Détails:');
          result.results.forEach(r => {
            console.log(`   Profil ${r.profileId}: ${r.salesProcessed} ventes, ${r.stockDecremented} items`);
            if (r.errors.length > 0) {
              r.errors.forEach(err => console.log(`      ❌ ${err}`));
            }
          });
        }
        
        if (dryRun) {
          console.log('\n💡 Pour exécuter réellement, relancez avec --execute');
        }
      } catch (e) {
        console.error('❌ Erreur de parsing:', e.message);
        console.error('Réponse:', data);
      }
    } else {
      console.error(`❌ Erreur HTTP ${res.statusCode}`);
      console.error('Réponse:', data);
    }
  });
});

req.on('error', (e) => {
  console.error(`❌ Erreur réseau: ${e.message}`);
});

req.write(postData);
req.end();
