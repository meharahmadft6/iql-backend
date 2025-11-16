// utils/paypalClient.js
const checkoutNodeJssdk = require("@paypal/checkout-server-sdk");

// Configure PayPal environment
const configureEnvironment = function () {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (process.env.NODE_ENV === "production") {
    return new checkoutNodeJssdk.core.LiveEnvironment(clientId, clientSecret);
  } else {
    return new checkoutNodeJssdk.core.SandboxEnvironment(
      clientId,
      clientSecret
    );
  }
};

const client = new checkoutNodeJssdk.core.PayPalHttpClient(
  configureEnvironment()
);

module.exports = client;
