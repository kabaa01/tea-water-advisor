/* Single place to set your deployment details. Everything else (index.html,
   admin.html) reads from here — you only ever edit this one file. */
window.TWA_CONFIG = {
  workerBase: "https://tea-water-advisor.YOUR-SUBDOMAIN.workers.dev",
  // Public PayPal Client ID from your REST API app at developer.paypal.com.
  // This value is not sensitive — it is designed to be visible in page source.
  paypalClientId: "YOUR_PAYPAL_CLIENT_ID",
};
