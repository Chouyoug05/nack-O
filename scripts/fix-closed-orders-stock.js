#!/usr/bin/env node

const https = require('https');

const FUNCTION_URL = 'https://nack.pro/.netlify/functions/fix-stock-for-closed-orders';
const INTERNAL_SECRET = process.env.NACK_INTERNAL_SECRET;

if (!INTERNAL_SECRET) {
  console.error('❌ Erreur: NACK_INTERNAL_SECRET doit être défini');
  console.error('   Exportez-le avec: export NACK_INTERNAL_SECRET="votre-secret"');
  process.exit(1);
}

function callFunction(dryRun) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ dryRun });
    
    const req = https.request(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'X-Nack-Internal-Secret': INTERNAL_SECRET
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          if (res.statusCode === 200) {
            resolve(result);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          }
        } catch (e) {
          reject(new Error(`Parse error: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run') || process.argv.includes('-d');
  
  console.log(`\n🔍 Mode: ${isDryRun ? 'SIMULATION (dry run)' : 'EXÉCUTION RÉELLE'}\n`);

  try {
    const result = await callFunction(isDryRun);
    
    console.log('✅ Résultat:\n');
    console.log(`   Profils traités: ${result.summary.totalProfiles}`);
    console.log(`   Commandes clôturées trouvées: ${result.summary.totalClosedOrders}`);
    console.log(`   Stocks mis à jour: ${result.summary.totalStockUpdated}`);
    console.log(`   Erreurs: ${result.summary.errorsCount}`);

    if (result.errors.length > 0) {
      console.log('\n❌ Erreurs:');
      result.errors.forEach(err => {
        console.log(`   - ${err.uid}: ${err.error}`);
      });
    }

    if (result.details.length > 0) {
      console.log('\n📋 Détails par établissement:\n');
      result.details.forEach(profile => {
        console.log(`   ${profile.establishmentName} (${profile.uid})`);
        profile.orders.forEach(order => {
          console.log(`     - Commande #${order.orderNumber} (${order.orderId})`);
          order.items.forEach(item => {
            console.log(`       • ${item.name}: ${item.quantity}x (stock ${item.oldStock} → ${item.newStock})`);
          });
          if (order.missingProducts.length > 0) {
            console.log(`       ⚠️  Produits manquants: ${order.missingProducts.join(', ')}`);
          }
        });
      });
    }

    if (isDryRun && result.summary.totalClosedOrders > 0) {
      console.log('\n💡 Pour exécuter réellement, relancez sans --dry-run:');
      console.log('   node scripts/fix-closed-orders-stock.js\n');
    }
  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    process.exit(1);
  }
}

main();
