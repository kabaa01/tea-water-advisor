/* The only file you need to edit for basic setup — your PayPal.me link. */
window.TWA_CONFIG = {
  payPalLink: "https://paypal.me/kabaa01/5USD",
  priceLabel: "$5.00",

  /* Optional — only fill these in once you've deployed
     cloudflare-worker-source.js (see README "Setting up real payment
     verification"). Leave them as-is to keep using the manual
     click-then-confirm flow; the page detects which mode you're in
     automatically. */
  workerBase: "https://steepandstandard.kabaa01tea2026.workers.dev",
  paypalClientId: "Ae9JoVABSVv61XxZe_siOHmZn6HTJk6fHJZPM2Pd9KcrORkCr9bjj86FPYmglvJq__dLcCTMF56GMCfD",
};
