# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: test-order.spec.ts >> debug paiement raw
- Location: test-order.spec.ts:3:1

# Error details

```
Error: response.text: Protocol error (Network.getResponseBody): No resource with given identifier found
Response body is not available for a response that was navigated away from. Read response.body() before triggering any navigation.
```

```
Error: page.waitForTimeout: Test ended.
```

# Page snapshot

```yaml
- generic [active] [ref=f1e1]:
  - main [ref=f1e2]:
    - generic [ref=f1e3]:
      - generic [ref=f1e4]:
        - generic [ref=f1e5]:
          - img "kj268"
        - text: kj268
      - navigation [ref=f1e6]:
        - generic [ref=f1e7]: 5000 XAF Référence N°order-ULOsgIQsinZT7XuRelYnRLW6OqT2-ORD-1787601967884-i9ik82
    - generic [ref=f1e8]:
      - paragraph [ref=f1e9]: Choisissez un moyen de paiement
      - generic [ref=f1e10]:
        - generic [ref=f1e11]: Airtel Money
        - generic [ref=f1e12]: Moov Money
        - generic [ref=f1e13]: Cartes bancaires
      - generic [ref=f1e14]:
        - generic [ref=f1e15]:
          - img "SINGPAY AIRTEL"
          - paragraph [ref=f1e16]: Entrez votre numéro de téléphone Airtel Money
          - generic [ref=f1e17]:
            - textbox [ref=f1e18]
            - textbox [ref=f1e19]
            - textbox [ref=f1e20]
            - textbox [ref=f1e21]
            - textbox [ref=f1e22]
            - textbox [ref=f1e23]
            - textbox [ref=f1e24]
            - textbox [ref=f1e25]
            - textbox [ref=f1e26]
          - button "Confirmer le paiement" [ref=f1e27]
        - generic [ref=f1e28]:
          - img "SINGPAY MOOV"
          - paragraph [ref=f1e29]: Entrez votre numéro de téléphone Moov Money
          - generic [ref=f1e30]:
            - textbox [ref=f1e31]
            - textbox [ref=f1e32]
            - textbox [ref=f1e33]
            - textbox [ref=f1e34]
            - textbox [ref=f1e35]
            - textbox [ref=f1e36]
            - textbox [ref=f1e37]
            - textbox [ref=f1e38]
            - textbox [ref=f1e39]
          - button "Confirmer le paiement" [ref=f1e40]
        - generic [ref=f1e41]:
          - paragraph [ref=f1e42]: Payez par carte bancaire VISA / Master Card en passant par PayPal
          - generic [ref=f1e43]:
            - generic [ref=f1e44]:
              - text: paypal-description
              - textbox "paypal-description" [ref=f1e45]: order-ULOsgIQsinZT7XuRelYnRLW6OqT2-ORD-1787601967884-i9ik82
            - generic [ref=f1e46]:
              - text: paypal-amount
              - spinbutton "paypal-amount" [ref=f1e47]: "8.28"
              - text: USD
        - paragraph [ref=f1e48]:
          - img "SingPay"
          - text: Transaction sécurisée via
          - link "SingPay" [ref=f1e49] [cursor=pointer]:
            - /url: https://singpay.ga
  - generic [ref=f1e51]:
    - generic [ref=f1e53]:
      - img "SingPay"
      - text: Paiement en cours de traitement...
    - list [ref=f1e56]:
      - listitem [ref=f1e57]: Vous allez recevoir une demande de mot de passe sur le téléphone contenant la SIM
      - listitem [ref=f1e58]: Veuillez rensigner votre PIN mobile money pour terminer l'opération
      - listitem [ref=f1e59]: Juste après votre validation, vous serez redirigé sur le site du marchand...
```

# Test source

```ts
  1  | ﻿import { test } from '@playwright/test';
  2  | 
  3  | test('debug paiement raw', async ({ page }) => {
  4  |   page.on('response', async res => {
  5  |     if (res.url().includes('create-payment-link')) {
  6  |       console.log('RES STATUS:', res.status());
  7  |       const text = await res.text();
  8  |       console.log('RES BODY:', text.substring(0, 500));
  9  |     }
  10 |   });
  11 | 
  12 |   await page.goto('http://localhost:8081/light/index.html#/menu/ULOsgIQsinZT7XuRelYnRLW6OqT2');
  13 |   await page.waitForTimeout(5000);
  14 |   await page.click('.lgt-add');
  15 |   await page.click('.lgt-checkout');
> 16 |   await page.waitForTimeout(12000);
     |              ^ Error: page.waitForTimeout: Test ended.
  17 |   console.log('FINAL URL:', page.url().substring(0, 100));
  18 | });
  19 | 
```