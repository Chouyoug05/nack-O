(function (global) {
  var ui, api, establishment, menuConfig, products, cart, selectedTable, deliveryEnabled, deliveryPrice;
  var theme = "modern";
  var checkout = {
    step: "cart",        // cart | checkout | success
    delivery: false,
    phone: "",
    address: "",
    busy: false,
    error: "",
    orderId: null,
    reference: ""
  };

  var THEMES = ["modern", "elegant", "minimal", "boutique", "gastronomique"];

  var THEME_CSS = [
    /* ── Squelette commun ───────────────────────────────────────────────── */
    '.lgt-root{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}',
    '.lgt-root *{box-sizing:border-box}',
    '.lgt-wrap{max-width:480px;margin:0 auto;min-height:100vh;display:flex;flex-direction:column;background:var(--lgt-bg);color:var(--lgt-text)}',
    '.lgt-header{position:sticky;top:0;z-index:10;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;background:var(--lgt-header-bg);border-bottom:var(--lgt-header-border);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}',
    '.lgt-hname{font-size:22px;font-weight:800;line-height:1.15;color:var(--lgt-heading,var(--lgt-accent));margin:0;letter-spacing:-.02em}',
    '.lgt-htype{font-size:11px;color:var(--lgt-muted);margin-top:3px;text-transform:uppercase;letter-spacing:.08em;font-weight:500}',
    '.lgt-table-pill{display:inline-flex;align-items:center;gap:6px;margin-top:8px;background:var(--lgt-accent-soft);color:var(--lgt-accent-strong,var(--lgt-accent));border-radius:999px;padding:5px 14px;font-size:12px;font-weight:600;letter-spacing:.02em}',
    '.lgt-cartbtn{background:var(--lgt-accent);color:var(--lgt-accent-text);border:none;border-radius:999px;padding:10px 18px;font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:8px;transition:transform .15s,box-shadow .15s}',
    '.lgt-cartbtn:active{transform:scale(.95)}',
    '.lgt-count{background:rgba(255,255,255,.25);border-radius:999px;min-width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700}',
    '.lgt-main{flex:1;padding:20px 16px 100px}',
    '.lgt-section{margin-bottom:28px}',
    '.lgt-stitle{font-family:var(--lgt-serif,inherit);font-size:18px;font-weight:700;color:var(--lgt-heading,var(--lgt-text));margin:0 0 14px;letter-spacing:.01em}',
    '.lgt-items{display:grid;grid-template-columns:1fr;gap:12px}',
    '.lgt-card{display:flex;gap:14px;align-items:flex-start;background:var(--lgt-card-bg);border:var(--lgt-card-border);border-radius:var(--lgt-radius);padding:14px;box-shadow:var(--lgt-shadow);transition:transform .18s ease,box-shadow .18s ease}',
    '.lgt-card:active{transform:scale(.985)}',
    '.lgt-img{width:80px;height:80px;border-radius:var(--lgt-img-radius);object-fit:cover;flex-shrink:0}',
    '.lgt-imgph{width:80px;height:80px;border-radius:var(--lgt-img-radius);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:32px;background:var(--lgt-ph);color:var(--lgt-accent-strong,var(--lgt-accent))}',
    '.lgt-imginitial{font-family:var(--lgt-serif,inherit);font-size:28px;font-weight:800;color:var(--lgt-accent-strong,var(--lgt-accent))}',
    '.lgt-cbody{flex:1;min-width:0}',
    '.lgt-crow{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}',
    '.lgt-pname{font-family:var(--lgt-serif,inherit);font-weight:700;font-size:15px;color:var(--lgt-heading,var(--lgt-text));margin:0;line-height:1.3}',
    '.lgt-pdesc{font-size:12.5px;color:var(--lgt-muted);margin:4px 0 0;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
    '.lgt-price{color:var(--lgt-accent-strong,var(--lgt-accent));font-weight:800;font-size:15px;margin-top:8px}',
    '.lgt-badge{display:inline-block;border-radius:999px;padding:3px 10px;font-size:10px;font-weight:700;white-space:nowrap;flex-shrink:0;letter-spacing:.02em;text-transform:uppercase}',
    '.lgt-badge-day{background:#fee2e2;color:#dc2626}',
    '.lgt-badge-star{background:#fef3c7;color:#b45309}',
    '.lgt-badge-promo{background:#dbeafe;color:#2563eb}',
    '.lgt-actions{display:flex;align-items:center;gap:8px;flex-shrink:0;align-self:center}',
    '.lgt-qbtn{width:32px;height:32px;border-radius:50%;border:1.5px solid var(--lgt-accent);background:transparent;color:var(--lgt-accent-strong,var(--lgt-accent));font-size:18px;line-height:1;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;padding:0;transition:all .15s}',
    '.lgt-qbtn:hover{background:var(--lgt-accent);color:var(--lgt-accent-text)}',
    '.lgt-qty{min-width:24px;text-align:center;font-weight:700;font-size:15px}',
    '.lgt-add{background:var(--lgt-accent);color:var(--lgt-accent-text);border:none;border-radius:999px;padding:8px 18px;font-size:13px;font-weight:700;cursor:pointer;transition:transform .12s,opacity .12s}',
    '.lgt-add:hover{opacity:.9}',
    '.lgt-add:active{transform:scale(.93)}',
    '.lgt-cartbar{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:480px;z-index:50;background:var(--lgt-card-bg);border-top:var(--lgt-header-border);padding:14px 20px 18px;box-shadow:0 -8px 32px rgba(0,0,0,var(--lgt-barshadow));border-radius:var(--lgt-radius) var(--lgt-radius) 0 0}',
    '.lgt-cartrow{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px}',
    '.lgt-cartlbl{font-size:13px;color:var(--lgt-muted);font-weight:500}',
    '.lgt-carttotal{font-size:22px;font-weight:800;color:var(--lgt-accent-strong,var(--lgt-accent))}',
    '.lgt-checkout{width:100%;background:var(--lgt-accent);color:var(--lgt-accent-text);border:none;border-radius:var(--lgt-radius);padding:14px;font-size:15px;font-weight:700;cursor:pointer;transition:transform .12s}',
    '.lgt-checkout:active{transform:scale(.97)}',
    '.lgt-empty{text-align:center;padding:48px 24px;color:var(--lgt-muted);font-size:15px}',

    /* ── Checkout / facture ─────────────────────────────────────────────── */
    '.lgt-ck-title{font-family:var(--lgt-serif,inherit);font-size:18px;font-weight:800;margin:0 0 14px;color:var(--lgt-heading,var(--lgt-text))}',
    '.lgt-ck-sub{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--lgt-muted);margin:18px 0 10px}',
    '.lgt-opt{display:flex;align-items:flex-start;gap:12px;border:1.5px solid var(--lgt-card-border,transparent);background:var(--lgt-card-bg);border-radius:12px;padding:13px 14px;margin-bottom:8px;cursor:pointer;transition:border-color .15s,background .15s}',
    '.lgt-opt:hover{border-color:var(--lgt-accent)}',
    '.lgt-opt input{margin-top:3px;accent-color:var(--lgt-accent)}',
    '.lgt-opt-label{font-weight:700;font-size:14px;color:var(--lgt-heading,var(--lgt-text))}',
    '.lgt-opt-hint{font-size:12px;color:var(--lgt-muted);margin-top:2px}',
    '.lgt-field{margin-bottom:12px}',
    '.lgt-input{width:100%;border:1.5px solid var(--lgt-card-border,#ddd);background:var(--lgt-bg);color:var(--lgt-text);border-radius:10px;padding:11px 14px;font-size:14px;font-family:inherit;transition:border-color .15s}',
    '.lgt-input:focus{outline:none;border-color:var(--lgt-accent)}',
    '.lgt-inv{border:1.5px dashed var(--lgt-accent);border-radius:12px;padding:14px 16px;margin:16px 0}',
    '.lgt-inv-row{display:flex;justify-content:space-between;font-size:14px;padding:4px 0;color:var(--lgt-text)}',
    '.lgt-inv-row span:last-child{font-weight:600}',
    '.lgt-inv-total{border-top:1.5px solid var(--lgt-accent);margin-top:8px;padding-top:8px;font-size:17px;font-weight:800}',
    '.lgt-inv-total span:last-child{color:var(--lgt-accent-strong,var(--lgt-accent))}',
    '.lgt-paybtn{width:100%;border:none;border-radius:12px;padding:14px;font-size:15px;font-weight:700;cursor:pointer;margin-bottom:8px;transition:transform .12s}',
    '.lgt-paybtn:active{transform:scale(.97)}',
    '.lgt-pay-onsite{background:var(--lgt-accent);color:var(--lgt-accent-text)}',
    '.lgt-pay-airtel{background:linear-gradient(135deg,#e40000,#cc0000);color:#fff}',
    '.lgt-pay-moov{background:linear-gradient(135deg,#0066b3,#004d8c);color:#fff}',
    '.lgt-pay-online-lbl{text-align:center;font-size:12px;color:var(--lgt-muted);margin:12px 0 10px;font-weight:500}',
    '.lgt-ck-error{background:#fee2e2;color:#b91c1c;border-radius:10px;padding:10px 14px;font-size:13px;margin-bottom:12px;font-weight:500}',
    '.lgt-ck-back{background:transparent;border:none;color:var(--lgt-muted);font-size:13px;cursor:pointer;padding:6px 0;margin-bottom:6px}',
    '.lgt-success{text-align:center;padding:32px 16px}',
    '.lgt-success-ico{width:72px;height:72px;border-radius:50%;background:var(--lgt-accent-soft);color:var(--lgt-accent-strong,var(--lgt-accent));font-size:32px;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-weight:800}',
    '.lgt-success h3{font-family:var(--lgt-serif,inherit);margin:0 0 8px;color:var(--lgt-heading,var(--lgt-text));font-size:20px}',
    '.lgt-success p{font-size:14px;color:var(--lgt-muted);margin:0 0 6px}',
    '.lgt-success .lgt-ref{font-family:monospace;font-size:12px;color:var(--lgt-text);background:var(--lgt-accent-soft);padding:4px 10px;border-radius:6px;display:inline-block;margin-top:6px}',

    /* ══════════════════════════════════════════════════════════════════════
       MODERNE — Dark premium avec accents rose/or
       ══════════════════════════════════════════════════════════════════════ */
    '.lgt-modern{--lgt-bg:#0c1222;--lgt-header-bg:rgba(12,18,34,.88);--lgt-header-border:1px solid rgba(255,255,255,.06);--lgt-card-bg:rgba(255,255,255,.04);--lgt-card-border:1px solid rgba(255,255,255,.07);--lgt-text:#e8ecf1;--lgt-muted:#7e8ba0;--lgt-accent:#f43f5e;--lgt-accent-strong:#fb7185;--lgt-accent-text:#fff;--lgt-accent-soft:rgba(244,63,94,.12);--lgt-ph:rgba(255,255,255,.06);--lgt-radius:18px;--lgt-img-radius:14px;--lgt-shadow:0 4px 24px rgba(0,0,0,.3);--lgt-barshadow:.5;--lgt-heading:#ffffff}',
    '.lgt-modern .lgt-hname{background:linear-gradient(135deg,#fb7185 0%,#fbbf24 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}',
    '.lgt-modern .lgt-header{background:rgba(12,18,34,.95);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)}',
    '.lgt-modern .lgt-card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);backdrop-filter:blur(8px)}',
    '.lgt-modern .lgt-card:hover{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.1)}',
    '.lgt-modern .lgt-imgph{background:linear-gradient(135deg,rgba(244,63,94,.15),rgba(251,191,36,.1))}',
    '.lgt-modern .lgt-badge-day{background:rgba(244,63,94,.15);color:#fb7185}',
    '.lgt-modern .lgt-badge-star{background:rgba(251,191,36,.15);color:#fbbf24}',
    '.lgt-modern .lgt-badge-promo{background:rgba(99,102,241,.15);color:#a5b4fc}',
    '.lgt-modern .lgt-cartbar{background:rgba(12,18,34,.96);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)}',
    '.lgt-modern .lgt-qbtn{border-color:rgba(255,255,255,.15);color:var(--lgt-muted)}',
    '.lgt-modern .lgt-qbtn:hover{background:var(--lgt-accent);border-color:var(--lgt-accent);color:#fff}',
    '.lgt-modern .lgt-opt{background:rgba(255,255,255,.03);border-color:rgba(255,255,255,.06)}',
    '.lgt-modern .lgt-opt:hover{border-color:var(--lgt-accent);background:rgba(244,63,94,.05)}',
    '.lgt-modern .lgt-input{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.08);color:var(--lgt-text)}',
    '.lgt-modern .lgt-inv{border-color:rgba(244,63,94,.3);background:rgba(244,63,94,.04)}',

    /* ══════════════════════════════════════════════════════════════════════
       ÉLÉGANT — Chaleureux crème/or avec typographie serif raffinée
       ══════════════════════════════════════════════════════════════════════ */
    '.lgt-elegant{--lgt-bg:#faf6ef;--lgt-header-bg:rgba(250,246,239,.94);--lgt-header-border:1px solid #e8dece;--lgt-card-bg:#fffcf7;--lgt-card-border:1px solid #ebe3d5;--lgt-text:#3a3228;--lgt-muted:#9c8e7a;--lgt-accent:#b08840;--lgt-accent-strong:#96712e;--lgt-accent-text:#fffcf7;--lgt-accent-soft:#f0e6d0;--lgt-ph:#f0e8d8;--lgt-radius:12px;--lgt-img-radius:10px;--lgt-shadow:0 2px 12px rgba(0,0,0,.06);--lgt-barshadow:.06;--lgt-serif:Georgia,"Times New Roman",serif;--lgt-heading:#2e261c}',
    '.lgt-elegant .lgt-hname{letter-spacing:-.01em}',
    '.lgt-elegant .lgt-stitle{text-align:center;letter-spacing:.16em;text-transform:uppercase;font-size:13px;color:var(--lgt-muted);position:relative;padding-bottom:14px}',
    '.lgt-elegant .lgt-stitle::after{content:"";position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:40px;height:2px;background:linear-gradient(90deg,transparent,#c9a97e,transparent)}',
    '.lgt-elegant .lgt-card{border:1px solid #ebe3d5;padding:16px;gap:16px}',
    '.lgt-elegant .lgt-card:hover{box-shadow:0 4px 20px rgba(0,0,0,.08)}',
    '.lgt-elegant .lgt-pname{letter-spacing:.01em}',
    '.lgt-elegant .lgt-price{font-family:Georgia,serif;letter-spacing:.02em}',
    '.lgt-elegant .lgt-badge{border-radius:4px;font-size:9.5px;letter-spacing:.06em}',
    '.lgt-elegant .lgt-badge-day{background:#fdf0f0;color:#b84040}',
    '.lgt-elegant .lgt-badge-star{background:#fdf5e6;color:#a07020}',
    '.lgt-elegant .lgt-badge-promo{background:#edf4fc;color:#3070b0}',
    '.lgt-elegant .lgt-inv{border:1px dashed #c9a97e;background:rgba(201,169,126,.04)}',
    '.lgt-elegant .lgt-success-ico{box-shadow:0 0 0 6px rgba(176,136,64,.1)}',

    /* ══════════════════════════════════════════════════════════════════════
       MINIMAL — Ultra-clean, typographie forte, aucun superflu
       ══════════════════════════════════════════════════════════════════════ */
    '.lgt-minimal{--lgt-bg:#ffffff;--lgt-header-bg:rgba(255,255,255,.96);--lgt-header-border:1px solid #f0f0f0;--lgt-card-bg:#ffffff;--lgt-card-border:none;--lgt-text:#1a1a1a;--lgt-muted:#999999;--lgt-accent:#1a1a1a;--lgt-accent-strong:#000000;--lgt-accent-text:#ffffff;--lgt-accent-soft:#f5f5f5;--lgt-ph:#f5f5f5;--lgt-radius:0;--lgt-img-radius:0;--lgt-shadow:none;--lgt-barshadow:.06;--lgt-heading:#000000}',
    '.lgt-minimal .lgt-header{border-bottom:1px solid #f0f0f0}',
    '.lgt-minimal .lgt-hname{font-size:20px;letter-spacing:-.03em}',
    '.lgt-minimal .lgt-card{border-radius:0;border-bottom:1px solid #f0f0f0;padding:20px 4px;gap:16px}',
    '.lgt-minimal .lgt-card:hover{background:#fafafa}',
    '.lgt-minimal .lgt-img,.lgt-minimal .lgt-imgph{width:88px;height:88px}',
    '.lgt-minimal .lgt-pname{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;letter-spacing:-.01em}',
    '.lgt-minimal .lgt-pdesc{-webkit-line-clamp:1}',
    '.lgt-minimal .lgt-price{font-size:16px;letter-spacing:-.02em}',
    '.lgt-minimal .lgt-add{border-radius:6px;font-size:12px;padding:8px 14px}',
    '.lgt-minimal .lgt-qbtn{border-radius:6px;border-color:#ddd;color:#666}',
    '.lgt-minimal .lgt-qbtn:hover{background:#1a1a1a;border-color:#1a1a1a;color:#fff}',
    '.lgt-minimal .lgt-badge{border-radius:4px;font-size:9px;letter-spacing:.08em}',
    '.lgt-minimal .lgt-badge-day{background:#f5f5f5;color:#1a1a1a}',
    '.lgt-minimal .lgt-badge-star{background:#f5f5f5;color:#1a1a1a}',
    '.lgt-minimal .lgt-badge-promo{background:#f5f5f5;color:#1a1a1a}',
    '.lgt-minimal .lgt-cartbar{border-top:1px solid #f0f0f0;background:rgba(255,255,255,.98);backdrop-filter:blur(12px)}',
    '.lgt-minimal .lgt-inv{border:1px dashed #ddd;border-radius:0}',
    '.lgt-minimal .lgt-input{border-radius:0;border-color:#eee}',
    '.lgt-minimal .lgt-opt{border-radius:0;border-color:#eee}',
    '.lgt-minimal .lgt-opt:hover{border-color:#1a1a1a}',
    '.lgt-minimal .lgt-success-ico{border-radius:0}',
    '.lgt-minimal .lgt-success .lgt-ref{border-radius:0}',

    /* ══════════════════════════════════════════════════════════════════════
       BOUTIQUE — Grid e-commerce, cards empilées, layout produit
       ══════════════════════════════════════════════════════════════════════ */
    '.lgt-boutique{--lgt-bg:#f8fafc;--lgt-header-bg:rgba(248,250,252,.96);--lgt-header-border:1px solid #e2e8f0;--lgt-card-bg:#ffffff;--lgt-card-border:1px solid #e2e8f0;--lgt-text:#0f172a;--lgt-muted:#64748b;--lgt-accent:#2563eb;--lgt-accent-strong:#1d4ed8;--lgt-accent-text:#ffffff;--lgt-accent-soft:#eff6ff;--lgt-ph:#f1f5f9;--lgt-radius:14px;--lgt-img-radius:12px 12px 0 0;--lgt-shadow:0 1px 3px rgba(0,0,0,.06);--lgt-barshadow:.08;--lgt-heading:#0f172a}',
    '.lgt-boutique .lgt-stitle{font-size:16px;letter-spacing:-.01em}',
    '.lgt-boutique .lgt-items{grid-template-columns:1fr 1fr;gap:10px}',
    '.lgt-boutique .lgt-card{flex-direction:column;align-items:stretch;padding:0;overflow:hidden;gap:0;border-radius:14px;border:1px solid #e2e8f0}',
    '.lgt-boutique .lgt-card:hover{box-shadow:0 8px 24px rgba(0,0,0,.1);transform:translateY(-2px)}',
    '.lgt-boutique .lgt-img,.lgt-boutique .lgt-imgph{width:100%;height:130px;border-radius:0;object-fit:cover}',
    '.lgt-boutique .lgt-imgph{font-size:36px;border-radius:0}',
    '.lgt-boutique .lgt-cbody{padding:12px 14px 14px}',
    '.lgt-boutique .lgt-pname{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:13.5px;line-height:1.3}',
    '.lgt-boutique .lgt-pdesc{font-size:11.5px;margin-top:3px;-webkit-line-clamp:2}',
    '.lgt-boutique .lgt-price{display:inline-block;background:var(--lgt-accent-soft);color:var(--lgt-accent-strong);border-radius:6px;padding:3px 10px;font-size:12px;margin-top:10px;font-weight:700}',
    '.lgt-boutique .lgt-actions{padding:0 14px 14px}',
    '.lgt-boutique .lgt-add{width:100%;border-radius:8px;padding:9px;font-size:12.5px}',
    '.lgt-boutique .lgt-qbtn{border-color:#cbd5e1;color:#475569}',
    '.lgt-boutique .lgt-qbtn:hover{background:var(--lgt-accent);border-color:var(--lgt-accent);color:#fff}',
    '.lgt-boutique .lgt-badge{border-radius:6px;font-size:9.5px}',
    '.lgt-boutique .lgt-badge-day{background:#fef2f2;color:#dc2626}',
    '.lgt-boutique .lgt-badge-star{background:#fffbeb;color:#d97706}',
    '.lgt-boutique .lgt-badge-promo{background:#eff6ff;color:#2563eb}',
    '.lgt-boutique .lgt-cartbar{border-radius:16px 16px 0 0}',
    '.lgt-boutique .lgt-opt{border-radius:10px}',
    '.lgt-boutique .lgt-inv{border-radius:10px}',
    '.lgt-boutique .lgt-success-ico{box-shadow:0 0 0 6px rgba(37,99,235,.08)}',

    /* ══════════════════════════════════════════════════════════════════════
       GASTRONOMIQUE — Haute cuisine, chaleureux, décorations raffinées
       ══════════════════════════════════════════════════════════════════════ */
    '.lgt-gastronomique{--lgt-bg:#fdf8f0;--lgt-header-bg:rgba(253,248,240,.96);--lgt-header-border:1px solid #e8dccb;--lgt-card-bg:transparent;--lgt-card-border:none;--lgt-text:#30261c;--lgt-muted:#a09080;--lgt-accent:#8b4513;--lgt-accent-strong:#723a10;--lgt-accent-text:#fdf8f0;--lgt-accent-soft:#f5e6d0;--lgt-ph:#f0e4d2;--lgt-radius:0;--lgt-img-radius:50%;--lgt-shadow:none;--lgt-barshadow:.05;--lgt-serif:Georgia,"Times New Roman",serif;--lgt-heading:#3a2a1a}',
    '.lgt-gastronomique .lgt-hname{letter-spacing:.02em}',
    '.lgt-gastronomique .lgt-stitle{text-align:center;font-size:20px;font-style:italic;letter-spacing:.04em;color:var(--lgt-heading);position:relative;padding-bottom:16px}',
    '.lgt-gastronomique .lgt-stitle::before{content:"";position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:60px;height:1px;background:linear-gradient(90deg,transparent,#c4a882,transparent)}',
    '.lgt-gastronomique .lgt-card{border-radius:0;border-bottom:1px solid rgba(0,0,0,.06);padding:16px 4px;gap:16px}',
    '.lgt-gastronomique .lgt-card:hover{background:rgba(0,0,0,.015)}',
    '.lgt-gastronomique .lgt-img,.lgt-gastronomique .lgt-imgph{width:72px;height:72px;border:2px solid #e8dccb}',
    '.lgt-gastronomique .lgt-imgph{border:2px solid #e8dccb;background:var(--lgt-accent-soft)}',
    '.lgt-gastronomique .lgt-pname{letter-spacing:.02em}',
    '.lgt-gastronomique .lgt-pdesc{font-style:italic}',
    '.lgt-gastronomique .lgt-price{font-family:Georgia,serif;letter-spacing:.03em}',
    '.lgt-gastronomique .lgt-badge{border-radius:4px;font-size:9px;letter-spacing:.06em;font-style:italic}',
    '.lgt-gastronomique .lgt-badge-day{background:rgba(139,69,19,.08);color:#8b4513}',
    '.lgt-gastronomique .lgt-badge-star{background:rgba(180,140,60,.1);color:#967020}',
    '.lgt-gastronomique .lgt-badge-promo{background:rgba(100,120,140,.08);color:#4a6070}',
    '.lgt-gastronomique .lgt-inv{border-color:#d4c0a8;background:rgba(212,192,168,.06)}',
    '.lgt-gastronomique .lgt-success h3{font-style:italic}',
    '.lgt-gastronomique .lgt-success-ico{border:2px solid #e8dccb}'
  ].join("\n");

  function ensureThemeStyles() {
    if (!document.getElementById("lgt-style")) {
      var st = document.createElement("style");
      st.id = "lgt-style";
      st.textContent = THEME_CSS;
      document.head.appendChild(st);
    }
  }

  function normalizeTheme(id) {
    return THEMES.indexOf(id) !== -1 ? id : null;
  }

  function netlifyFn(name) {
    return "https://nack.pro/.netlify/functions/" + name;
  }

  function render(root, ctx) {
    ui = global.NACK_LIGHT.ui;
    api = global.NACK_LIGHT.api;
    var uid = ctx.uid;
    var tableToken = ctx.table || null;

    cart = [];
    checkout.step = "cart";
    checkout.delivery = false;
    checkout.phone = "";
    checkout.address = "";
    checkout.busy = false;
    checkout.error = "";
    checkout.orderId = null;
    checkout.reference = "";

    root.innerHTML = '<div class="lgt-empty">Chargement du menu…</div>';
    ensureThemeStyles();

    Promise.all([
      api.getPublicDoc("publicProfiles/" + uid),
      api.getPublicDoc("menuConfigs/" + uid),
      api.publicListDocs("profiles/" + uid + "/products", 200),
      api.publicListDocs("menuConfigs/" + uid + "/tables", 200)
    ]).then(function (results) {
      establishment = results[0];
      menuConfig = results[1];
      var allProducts = results[2];
      var tables = results[3] || [];

      if (!establishment) {
        root.innerHTML = '<div class="lg-empty">Établissement introuvable</div>';
        return;
      }

      if (!menuConfig || !menuConfig.enabled) {
        root.innerHTML = '<div class="lg-empty">Ce menu n\'est pas encore activé</div>';
        return;
      }

      theme = normalizeTheme(ctx.theme) || normalizeTheme(menuConfig.selectedDesign) || "modern";

      products = allProducts.filter(function (p) {
        var cat = (p.category || "").toLowerCase();
        var isPlat = cat === "plats" || cat.includes("plat");
        return p.price > 0 && (p.quantity > 0 || p.quantity === undefined || isPlat);
      });

      // Filtre jour : si le gérant a marqué des articles "Plat du jour",
      // n'afficher que ceux-ci + les articles vedettes.
      // Si aucun plat du jour n'est marqué, afficher tout (fallback).
      var hasDailySpecials = products.some(function (p) { return p.isDailySpecial === true; });
      if (hasDailySpecials) {
        products = products.filter(function (p) {
          return p.isDailySpecial === true || p.isFeatured === true;
        });
      }

      selectedTable = null;
      if (tableToken) {
        for (var i = 0; i < tables.length; i++) {
          if (tables[i].qrToken === tableToken) { selectedTable = tables[i]; break; }
        }
      }

      deliveryEnabled = establishment.deliveryEnabled === true;
      deliveryPrice = Number(establishment.deliveryPrice || 0);

      paint(root);
    }).catch(function (err) {
      root.innerHTML = '<div class="lg-empty">Erreur : ' + ui.escapeHtml(err.message || "Menu indisponible") + '</div>';
    });
  }

  function paint(root) {
    var dailySpecials = products.filter(function (p) { return p.isDailySpecial === true; });
    var featured = products.filter(function (p) { return p.isFeatured === true; });
    var regular = products.filter(function (p) { return !p.isDailySpecial && !p.isFeatured; });

    var body;
    if (products.length === 0) {
      body = '<div class="lgt-empty">Aucun article disponible pour le moment.</div>';
    } else {
      body =
        (dailySpecials.length > 0 ? section("Plat du jour", dailySpecials) : '') +
        (featured.length > 0 ? section("Nos coups de cœur", featured) : '') +
        categoriesHtml();
    }

    root.innerHTML =
      '<div class="lgt-root lgt-' + theme + '">' +
        '<div class="lgt-wrap">' +
          '<header class="lgt-header">' +
            '<div>' +
              '<h1 class="lgt-hname">' + ui.escapeHtml(establishment.establishmentName || "Établissement") + '</h1>' +
              '<div class="lgt-htype">' + ui.escapeHtml(establishment.establishmentType || "") + '</div>' +
              (selectedTable
                ? '<span class="lgt-table-pill">Table ' + ui.escapeHtml(String(selectedTable.number)) + '</span>'
                : '') +
            '</div>' +
            '<button class="lgt-cartbtn" type="button" onclick="toggleCart()">Panier <span class="lgt-count">' + cart.length + '</span></button>' +
          '</header>' +

          '<main class="lgt-main">' + body + '</main>' +

          (cart.length > 0 ?
            '<div class="lgt-cartbar">' +
              '<div class="lgt-cartrow">' +
                '<span class="lgt-cartlbl">Total (' + cart.length + ' article' + (cart.length > 1 ? 's' : '') + ')</span>' +
                '<span class="lgt-carttotal">' + ui.formatMoney(getCartSubtotal()) + '</span>' +
              '</div>' +
              '<button class="lgt-checkout" type="button" onclick="startCheckout()">Commander</button>' +
            '</div>'
          : '') +
        '</div>' +
        cartModal() +
      '</div>';
  }

  function section(title, items) {
    return '<section class="lgt-section">' +
      '<h2 class="lgt-stitle">' + ui.escapeHtml(title) + '</h2>' +
      '<div class="lgt-items">' + items.map(card).join('') + '</div>' +
    '</section>';
  }

  function categoriesHtml() {
    var groups = {};
    products.forEach(function (p) {
      if (p.isDailySpecial || p.isFeatured) return;
      var cat = p.category || "Autre";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(p);
    });
    var html = '';
    for (var cat in groups) {
      if (Object.prototype.hasOwnProperty.call(groups, cat)) {
        html += section(cat, groups[cat]);
      }
    }
    return html;
  }

  function card(p) {
    var badge = '';
    if (p.isDailySpecial) badge = '<span class="lgt-badge lgt-badge-day">Aujourd\'hui</span>';
    else if (p.isFeatured) badge = '<span class="lgt-badge lgt-badge-star">Vedette</span>';
    else if (p.isPromotional) badge = '<span class="lgt-badge lgt-badge-promo">Promo</span>';

    var image = p.imageUrl
      ? '<img class="lgt-img" src="' + ui.escapeHtml(p.imageUrl) + '" alt="">'
      : (p.icon
        ? '<div class="lgt-imgph">' + ui.escapeHtml(p.icon) + '</div>'
        : '<div class="lgt-imgph"><span class="lgt-imginitial">' + ui.escapeHtml((p.name || '?').charAt(0).toUpperCase()) + '</span></div>');

    var inCart = cart.find(function (c) { return c.id === p.id; });
    var qty = inCart ? inCart.qty : 0;

    var actions = qty > 0
      ? '<button class="lgt-qbtn" type="button" onclick="changeQty(\'' + p.id + '\', -1)">−</button>' +
        '<span class="lgt-qty">' + qty + '</span>' +
        '<button class="lgt-qbtn" type="button" onclick="changeQty(\'' + p.id + '\', 1)">+</button>'
      : '<button class="lgt-add" type="button" onclick="addToCart(\'' + p.id + '\')">Ajouter</button>';

    return '<div class="lgt-card">' +
      image +
      '<div class="lgt-cbody">' +
        '<div class="lgt-crow">' +
          '<p class="lgt-pname">' + ui.escapeHtml(p.name) + '</p>' +
          badge +
        '</div>' +
        (p.description ? '<p class="lgt-pdesc">' + ui.escapeHtml(p.description) + '</p>' : '') +
        '<div class="lgt-price">' + ui.formatMoney(p.price) + '</div>' +
      '</div>' +
      '<div class="lgt-actions">' + actions + '</div>' +
    '</div>';
  }

  // ─── Modal panier / checkout / succès ───────────────────────────────────

  function cartItemsHtml() {
    return cart.map(function (item) {
      var p = item.product;
      return '<div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">' +
        (p.imageUrl ? '<img src="' + ui.escapeHtml(p.imageUrl) + '" class="w-12 h-12 rounded-lg object-cover">' : '<div class="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center"><span class="text-xl">' + ui.escapeHtml((p.name || '?').charAt(0).toUpperCase()) + '</span></div>') +
        '<div class="flex-1 min-w-0">' +
          '<p class="font-medium">' + ui.escapeHtml(p.name) + '</p>' +
          '<p class="text-sm text-muted-foreground">' + ui.formatMoney(p.price) + ' × ' + item.qty + '</p>' +
        '</div>' +
        '<div class="flex items-center gap-2">' +
          '<button class="lg-btn lg-btn-outline lg-btn-sm" onclick="changeQty(\'' + p.id + '\', -1)">−</button>' +
          '<span class="w-8 text-center font-bold">' + item.qty + '</span>' +
          '<button class="lg-btn lg-btn-outline lg-btn-sm" onclick="changeQty(\'' + p.id + '\', 1)">+</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function invoiceHtml() {
    var subtotal = getCartSubtotal();
    var deliv = checkout.delivery ? deliveryPrice : 0;
    return '<div class="lgt-inv">' +
      '<div class="lgt-inv-row"><span>Produits (' + cart.length + ')</span><span>' + ui.formatMoney(subtotal) + '</span></div>' +
      '<div class="lgt-inv-row"><span>Livraison</span><span>' + (checkout.delivery ? ui.formatMoney(deliv) : '—') + '</span></div>' +
      '<div class="lgt-inv-row lgt-inv-total"><span>Total</span><span>' + ui.formatMoney(subtotal + deliv) + '</span></div>' +
    '</div>';
  }

  function deliveryOptionsHtml() {
    return '<div class="lgt-ck-sub">Mode de réception</div>' +
      '<label class="lgt-opt">' +
        '<input type="radio" name="lgt-deliv" ' + (!checkout.delivery ? 'checked' : '') + ' onchange="setDelivery(false)">' +
        '<span><span class="lgt-opt-label">Retrait sur place</span>' +
        '<span class="lgt-opt-hint" style="display:block">Vous venez chercher la commande</span></span>' +
      '</label>' +
      (deliveryEnabled
        ? '<label class="lgt-opt">' +
            '<input type="radio" name="lgt-deliv" ' + (checkout.delivery ? 'checked' : '') + ' onchange="setDelivery(true)">' +
            '<span><span class="lgt-opt-label">Livraison' + (deliveryPrice > 0 ? ' (+' + ui.formatMoney(deliveryPrice) + ')' : '') + '</span>' +
            '<span class="lgt-opt-hint" style="display:block">Un livreur vous la porte</span></span>' +
          '</label>'
        : '') +
      (checkout.delivery
        ? '<div class="lgt-field"><input class="lgt-input" type="tel" placeholder="Téléphone" value="' + ui.escapeHtml(checkout.phone) + '" oninput="setCheckoutField(\'phone\', this.value)"></div>' +
          '<div class="lgt-field"><input class="lgt-input" type="text" placeholder="Adresse de livraison" value="' + ui.escapeHtml(checkout.address) + '" oninput="setCheckoutField(\'address\', this.value)"></div>'
        : '');
  }

  function paymentOptionsHtml() {
    var onlineEnabled = establishment && establishment.paymentsEnabled === true;
    return '<div class="lgt-ck-sub">Moyen de paiement</div>' +
      (checkout.busy
        ? '<div class="lgt-empty" style="padding:18px">Traitement en cours…</div>'
        : '<button class="lgt-paybtn lgt-pay-onsite" type="button" onclick="payOnsite()">Commander — Payer sur place</button>' +
          (onlineEnabled
            ? '<div class="lgt-pay-online-lbl">ou payer en ligne via SingPay</div>' +
              '<button class="lgt-paybtn lgt-pay-airtel" type="button" onclick="payOnline(\'airtel-money\')">Airtel Money</button>' +
              '<button class="lgt-paybtn lgt-pay-moov" type="button" onclick="payOnline(\'moov-money\')">Moov Money</button>'
            : ''));
  }

  function cartModal() {
    if (cart.length === 0 && checkout.step !== "success") return '';
    var inner = '';

    if (checkout.step === "cart") {
      inner =
        '<div class="lg-modal-body" style="padding:16px">' +
          '<div class="space-y-3" id="cart-items">' + cartItemsHtml() + '</div>' +
          '<div class="mt-4 pt-4 border-t">' +
            '<div class="flex justify-between text-lg font-bold"><span>Total</span><span>' + ui.formatMoney(getCartSubtotal()) + '</span></div>' +
          '</div>' +
          '<div class="mt-4 flex gap-2">' +
            '<button class="lg-btn lg-btn-outline flex-1" onclick="closeCart()">Continuer les achats</button>' +
            '<button class="lg-btn lg-btn-nack flex-1" onclick="startCheckout()">Commander</button>' +
          '</div>' +
        '</div>';
    } else if (checkout.step === "checkout") {
      inner =
        '<div class="lg-modal-body" style="padding:16px">' +
          '<button class="lgt-ck-back" type="button" onclick="backToCart()">← Retour au panier</button>' +
          (checkout.error ? '<div class="lgt-ck-error">' + ui.escapeHtml(checkout.error) + '</div>' : '') +
          '<h3 class="lgt-ck-title">Votre commande</h3>' +
          deliveryOptionsHtml() +
          '<div class="lgt-ck-sub">Facture</div>' +
          invoiceHtml() +
          paymentOptionsHtml() +
        '</div>';
    } else if (checkout.step === "success") {
      inner =
        '<div class="lg-modal-body" style="padding:16px">' +
          '<div class="lgt-success">' +
            '<div class="lgt-success-ico">✓</div>' +
            '<h3>Commande enregistrée</h3>' +
            '<p>L\'établissement a été notifié. Vous réglez' + (checkout.delivery ? ' à la livraison' : ' sur place') + '.</p>' +
            (checkout.reference ? '<p class="lgt-ref">Réf : ' + ui.escapeHtml(checkout.reference) + '</p>' : '') +
            '<button class="lgt-paybtn lgt-pay-onsite" type="button" style="margin-top:14px" onclick="printOrderReceipt()">Télécharger le reçu</button>' +
            '<button class="lgt-paybtn" type="button" style="margin-top:8px;background:transparent;border:1.5px solid var(--lgt-accent);color:var(--lgt-accent)" onclick="closeCart()">Fermer</button>' +
          '</div>' +
        '</div>';
    }

    return '<div id="cart-modal" class="lg-modal-overlay" style="display:none">' +
      '<div class="lg-modal" style="max-width:92vw;max-height:85vh;overflow-y:auto;width:420px">' +
        '<div class="lg-modal-header" style="display:flex;justify-content:space-between;align-items:center;padding:16px;border-bottom:1px solid #e5e0d8">' +
          '<h3 class="font-bold">' + (checkout.step === "checkout" ? "Commande & paiement" : "Votre commande") + '</h3>' +
          '<button class="lg-btn lg-btn-ghost lg-btn-sm" onclick="closeCart()">✕</button>' +
        '</div>' +
        inner +
      '</div>' +
    '</div>';
  }

  // ─── Totaux ─────────────────────────────────────────────────────────────

  function getCartSubtotal() {
    return cart.reduce(function (sum, item) { return sum + item.product.price * item.qty; }, 0);
  }

  function getCartTotal() {
    return getCartSubtotal() + (checkout.delivery ? deliveryPrice : 0);
  }

  // ─── Panier ─────────────────────────────────────────────────────────────

  function addToCart(productId) {
    var p = products.find(function (x) { return x.id === productId; });
    if (!p) return;
    var existing = cart.find(function (c) { return c.id === productId; });
    if (existing) {
      existing.qty++;
    } else {
      cart.push({ id: productId, product: p, qty: 1 });
    }
    repaint();
  }

  function changeQty(productId, delta) {
    var idx = cart.findIndex(function (c) { return c.id === productId; });
    if (idx === -1) return;
    cart[idx].qty += delta;
    if (cart[idx].qty <= 0) cart.splice(idx, 1);
    if (cart.length === 0) { checkout.step = "cart"; }
    repaint();
  }

  function removeFromCart(productId) {
    cart = cart.filter(function (c) { return c.id !== productId; });
    repaint();
  }

  function repaint() {
    var root = document.querySelector('.lgt-root');
    if (root && root.parentNode) paint(root.parentNode);
  }

  function repaintModal() {
    var modal = document.getElementById('cart-modal');
    if (modal && modal.parentNode) {
      var wasOpen = modal.style.display !== 'none';
      modal.parentNode.innerHTML = cartModal();
      var fresh = document.getElementById('cart-modal');
      if (fresh && wasOpen) fresh.style.display = 'flex';
    }
  }

  function toggleCart() {
    var modal = document.getElementById('cart-modal');
    if (modal) modal.style.display = cart.length > 0 ? 'flex' : 'none';
  }

  function closeCart() {
    var modal = document.getElementById('cart-modal');
    if (modal) modal.style.display = 'none';
  }

  function startCheckout() {
    if (cart.length === 0) return;
    checkout.step = "checkout";
    checkout.error = "";
    repaintModal();
    var modal = document.getElementById('cart-modal');
    if (modal) modal.style.display = 'flex';
  }

  function backToCart() {
    checkout.step = "cart";
    checkout.error = "";
    repaintModal();
    var modal = document.getElementById('cart-modal');
    if (modal) modal.style.display = 'flex';
  }

  function setDelivery(v) {
    checkout.delivery = v === true;
    checkout.error = "";
    repaintModal();
    var modal = document.getElementById('cart-modal');
    if (modal) modal.style.display = 'flex';
  }

  function setCheckoutField(field, value) {
    checkout[field] = value;
  }

  function validateCheckout() {
    if (cart.length === 0) {
      checkout.error = "Votre panier est vide.";
      return false;
    }
    if (checkout.delivery) {
      if (!String(checkout.phone || "").trim() || !String(checkout.address || "").trim()) {
        checkout.error = "Renseignez votre téléphone et votre adresse pour la livraison.";
        return false;
      }
    }
    checkout.error = "";
    return true;
  }

  function buildOrderData(status, paymentMethod) {
    var reference = 'ORD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
    var orderNum = Math.floor(Date.now() / 1000) % 100000;
    checkout.reference = reference;
    return {
      establishmentId: establishment.uid,
      orderNumber: orderNum,
      tableId: selectedTable ? selectedTable.id : null,
      tableNumber: selectedTable ? selectedTable.number : null,
      items: cart.map(function (c) {
        return { id: c.id, name: c.product.name, price: c.product.price, quantity: c.qty, category: c.product.category };
      }),
      subtotal: getCartSubtotal(),
      deliveryMode: checkout.delivery ? 'delivery' : 'pickup',
      deliveryAddress: checkout.delivery ? String(checkout.address || "").trim() : "",
      deliveryPhone: checkout.delivery ? String(checkout.phone || "").trim() : "",
      deliveryEnabled: checkout.delivery,
      deliveryPrice: checkout.delivery ? deliveryPrice : 0,
      total: getCartTotal(),
      status: status,
      paymentStatus: 'unpaid',
      paymentMethod: paymentMethod,
      source: 'qr',
      agentCode: 'qr-client',
      paymentReference: reference,
      createdAt: Date.now()
    };
  }

  // ─── Payer sur place ────────────────────────────────────────────────────

  function payOnsite() {
    if (checkout.busy) return;
    if (!validateCheckout()) { repaintModal(); syncModalOpen(); return; }
    checkout.busy = true;
    checkout.error = "";
    repaintModal(); syncModalOpen();

    var orderData = buildOrderData('awaiting-validation', 'cash');
    api.publicCreateDoc('profiles/' + establishment.uid + '/orders', orderData).then(function (orderRef) {
      checkout.orderId = orderRef.id;
      checkout.lastOrderData = orderData;
      checkout.busy = false;
      checkout.step = "success";
      repaintModal(); syncModalOpen();

      // Notification push vers l'établissement (best effort, via fonction serveur)
      var itemsLabel = orderData.items.map(function (it) { return it.quantity + 'x ' + it.name; }).join(', ').slice(0, 120);
      fetch(netlifyFn('send-notification'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          establishmentId: establishment.uid,
          title: 'Nouvelle commande' + (checkout.delivery ? ' (livraison)' : ' (sur place)'),
          body: itemsLabel + ' — ' + ui.formatMoney(orderData.total) + ' XAF',
          data: { type: 'order', orderId: orderRef.id }
        })
      }).catch(function () {});
    }).catch(function (err) {
      checkout.busy = false;
      checkout.error = (err && err.message) || "Impossible d'enregistrer la commande";
      checkout.step = "checkout";
      repaintModal(); syncModalOpen();
    });
  }

  // ─── Payer en ligne (SingPay : Airtel Money / Moov Money) ───────────────

  function payOnline(method) {
    if (checkout.busy) return;
    if (!validateCheckout()) { repaintModal(); syncModalOpen(); return; }
    checkout.busy = true;
    checkout.error = "";
    repaintModal(); syncModalOpen();

    var total = getCartTotal();
    var establishmentId = establishment.uid;
    var logoUrl = establishment.logoUrl || 'https://nack.pro/logo.png';
    var orderData = buildOrderData('awaiting-payment', method);

    try {
      localStorage.setItem('nack_last_order_' + checkout.reference, JSON.stringify({
        orderData: orderData,
        establishmentName: establishment.establishmentName || '',
        createdAt: Date.now()
      }));
    } catch (e) {}

    var redirectSuccess = window.location.origin + '/light/index.html#/payment-result?success=1&ref=' + encodeURIComponent(checkout.reference) + '&uid=' + encodeURIComponent(establishmentId);
    var redirectError = window.location.origin + '/light/index.html#/payment-result?error=1&uid=' + encodeURIComponent(establishmentId);

    api.publicCreateDoc('profiles/' + establishmentId + '/orders', orderData).then(function (orderRef) {
      var paymentData = {
        establishmentId: establishmentId,
        orderId: orderRef.id,
        transactionId: checkout.reference,
        amount: total,
        status: 'pending',
        subscriptionType: 'order',
        reference: checkout.reference,
        method: method,
        items: orderData.items,
        deliveryEnabled: orderData.deliveryEnabled,
        deliveryPrice: orderData.deliveryPrice,
        createdAt: Date.now()
      };
      return api.publicCreateDoc('profiles/' + establishmentId + '/payments', paymentData).then(function () {
        // Le NIS bénéficiaire est résolu côté serveur à partir de l'establishmentId
        return fetch(netlifyFn('create-payment-link'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json;charset=UTF-8' },
          body: JSON.stringify({
            amount: total,
            reference: 'order-' + establishmentId + '-' + checkout.reference,
            redirectSuccess: redirectSuccess,
            redirectError: redirectError,
            logoURL: logoUrl,
            establishmentId: establishmentId
          })
        }).then(function (res) { return res.json(); });
      });
    }).then(function (data) {
      if (data && data.link) {
        window.location.href = data.link;
      } else {
        checkout.busy = false;
        checkout.error = (data && (data.error || data.detail)) || 'Erreur création du lien de paiement';
        repaintModal(); syncModalOpen();
      }
    }).catch(function (err) {
      console.error(err);
      checkout.busy = false;
      checkout.error = (err && err.message) || 'Erreur lors de la création du paiement';
      repaintModal(); syncModalOpen();
    });
  }

  function syncModalOpen() {
    var modal = document.getElementById('cart-modal');
    if (modal) modal.style.display = 'flex';
  }

  function proceedToPayment() {
    startCheckout();
  }

  function printOrderReceipt() {
    var order = checkout.lastOrderData;
    if (!order) {
      alert('Aucune commande à imprimer');
      return;
    }

    var estName = establishment ? establishment.establishmentName || 'Établissement' : 'Établissement';
    var itemsHtml = order.items.map(function(item) {
      var total = item.price * item.quantity;
      return '<tr><td>' + ui.escapeHtml(item.name) + '</td><td style="text-align:right">' + item.quantity + '</td><td style="text-align:right">' + ui.formatMoney(item.price) + ' XAF</td><td style="text-align:right">' + ui.formatMoney(total) + ' XAF</td></tr>';
    }).join('');

    var receiptHtml = 
      '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Reçu - Commande ' + ui.escapeHtml(String(order.orderNumber || '')) + '</title>' +
      '<style>' +
      'body{font-family:Arial,sans-serif;max-width:400px;margin:20px auto;padding:20px;font-size:14px}' +
      'h1{font-size:20px;text-align:center;margin-bottom:5px}' +
      'h2{font-size:16px;text-align:center;color:#666;margin-top:0}' +
      '.info{margin:15px 0;line-height:1.6}' +
      'table{width:100%;border-collapse:collapse;margin:15px 0}' +
      'th,td{padding:8px;text-align:left;border-bottom:1px solid #ddd}' +
      'th{background:#f5f5f5;font-weight:bold}' +
      '.total{font-size:18px;font-weight:bold;margin-top:15px;padding-top:15px;border-top:2px solid #333}' +
      '.footer{margin-top:30px;text-align:center;font-size:12px;color:#666}' +
      '@media print{body{margin:0}}' +
      '</style></head><body>' +
      '<h1>' + ui.escapeHtml(estName) + '</h1>' +
      '<h2>Reçu de commande</h2>' +
      '<div class="info">' +
      '<p><strong>Commande N°</strong> ' + ui.escapeHtml(String(order.orderNumber || '')) + '</p>' +
      (order.tableNumber ? '<p><strong>Table</strong> ' + ui.escapeHtml(String(order.tableNumber)) + '</p>' : '') +
      '<p><strong>Date</strong> ' + new Date(order.createdAt).toLocaleString('fr-FR') + '</p>' +
      '<p><strong>Référence</strong> ' + ui.escapeHtml(checkout.reference || '') + '</p>' +
      '<p><strong>Paiement</strong> ' + ui.escapeHtml(order.paymentMethod || 'cash') + '</p>' +
      '</div>' +
      '<table><thead><tr><th>Article</th><th>Qté</th><th>Prix</th><th>Total</th></tr></thead><tbody>' + itemsHtml + '</tbody></table>' +
      '<div class="info">' +
      '<p><strong>Sous-total</strong> ' + ui.formatMoney(order.subtotal) + ' XAF</p>' +
      (order.deliveryPrice > 0 ? '<p><strong>Livraison</strong> ' + ui.formatMoney(order.deliveryPrice) + ' XAF</p>' : '') +
      '</div>' +
      '<div class="total">TOTAL: ' + ui.formatMoney(order.total) + ' XAF</div>' +
      '<div class="footer"><p>Merci pour votre commande !</p></div>' +
      '</body></html>';

    var printWindow = window.open('', '_blank', 'width=500,height=600');
    if (printWindow) {
      printWindow.document.write(receiptHtml);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(function() {
        printWindow.print();
      }, 250);
    }
  }

  // ─── Expose to global for inline handlers ──────────────────────────────
  window.addToCart = addToCart;
  window.changeQty = changeQty;
  window.removeFromCart = removeFromCart;
  window.toggleCart = toggleCart;
  window.closeCart = closeCart;
  window.startCheckout = startCheckout;
  window.backToCart = backToCart;
  window.setDelivery = setDelivery;
  window.setCheckoutField = setCheckoutField;
  window.payOnsite = payOnsite;
  window.payOnline = payOnline;
  window.printOrderReceipt = printOrderReceipt;
  window.openCheckout = proceedToPayment;
  window.proceedToPayment = proceedToPayment;

  global.NACK_LIGHT.public = global.NACK_LIGHT.public || {};
  global.NACK_LIGHT.public.ordering = { render: render };
})(window);
