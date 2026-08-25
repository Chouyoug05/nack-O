const https = require('https');

const ADMIN_SECRET = process.env.ADMIN_FUNCTION_SECRET || '';

if (!ADMIN_SECRET) {
  console.error('ADMIN_FUNCTION_SECRET non defini');
  console.error('Usage: ADMIN_FUNCTION_SECRET="ton-secret" node scripts/recover-missing-stock.cjs [--execute]');
  process.exit(1);
}

const dryRun = !process.argv.includes('--execute');

console.log(`\nMode: ${dryRun ? 'DRY RUN (simulation)' : 'EXECUTION REELLE'}\n`);

const postData = JSON.stringify({ dryRun });

const options = {
  hostname: 'nack.pro',
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
        console.log('Succes!\n');
        console.log('Resume:');
        console.log(`   Mode: ${result.mode}`);
        console.log(`   Profils traites: ${result.summary.profilesProcessed}`);
        console.log(`   Profils avec ventes: ${result.summary.profilesWithSales}`);
        console.log(`   Ventes recuperees: ${result.summary.totalSalesRecovered}`);
        console.log(`   Stock decremente: ${result.summary.totalStockDecremented}`);
        console.log(`   Erreurs: ${result.summary.errorsCount}`);

        if (result.details && result.details.length > 0) {
          console.log('\nDetails:');
          result.details.forEach(r => {
            console.log(`   Profil ${r.profileId}: ${r.salesProcessed} ventes, ${r.stockDecremented} items`);
            if (r.errors && r.errors.length > 0) {
              r.errors.forEach(err => console.log(`      Erreur: ${err}`));
            }
          });
        }

        if (result.errors && result.errors.length > 0) {
          console.log('\nErreurs globales:');
          result.errors.forEach(err => console.log(`   ${err}`));
        }

        if (dryRun) {
          console.log('\nPour executer reellement, relancez avec --execute');
        }
      } catch (e) {
        console.error('Erreur de parsing:', e.message);
        console.error('Reponse:', data);
      }
    } else {
      console.error(`Erreur HTTP ${res.statusCode}`);
      console.error('Reponse:', data);
    }
  });
});

req.on('error', (e) => {
  console.error(`Erreur reseau: ${e.message}`);
});

req.write(postData);
req.end();
