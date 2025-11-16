// controllers/paymentController.js
const Wallet = require("../models/Wallet");
const Payment = require("../models/Payment");
const User = require("../models/User");
const paypalClient = require("../utils/paypalClient");
const checkoutNodeJssdk = require("@paypal/checkout-server-sdk");

// Updated Coin pricing configuration - 100 coins for $0.1 USD
const COIN_RATES = {
  USD: 1000, // 1000 coins per 1 USD (since 0.1 USD = 100 coins)
};

// Calculate coins based on amount
const calculateCoins = (amount, currency = "USD") => {
  const rate = COIN_RATES[currency] || COIN_RATES.USD;
  return Math.floor(amount * rate);
};

// Calculate USD amount based on coins (for predefined packages)
const calculateAmountFromCoins = (coins) => {
  return (coins / COIN_RATES.USD).toFixed(2);
};

// Create PayPal order
exports.createPayment = async (req, res, next) => {
  try {
    const { amount, currency = "USD" } = req.body;
    const userId = req.user.id;

    // Validate amount - minimum $0.1 for 100 coins
    if (!amount || amount < 0.1) {
      return res.status(400).json({
        success: false,
        message: "Minimum purchase amount is $0.1 for 100 coins",
      });
    }

    const coins = calculateCoins(amount, currency);

    // Create payment record
    const payment = await Payment.create({
      user: userId,
      amount,
      currency,
      coins,
      status: "pending",
    });

    // Create PayPal order
    const request = new checkoutNodeJssdk.orders.OrdersCreateRequest();
    request.prefer("return=representation");
    request.requestBody({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: currency,
            value: amount.toString(),
          },
          description: `Purchase of ${coins} coins`,
          custom_id: payment._id.toString(),
        },
      ],
      application_context: {
        brand_name: "Your App Name",
        landing_page: "BILLING",
        user_action: "PAY_NOW",
        return_url: `${process.env.FRONTEND_URL}/payment/success`,
        cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
      },
    });

    const order = await paypalClient.execute(request);

    // Update payment with PayPal order ID
    payment.paypalOrderId = order.result.id;
    await payment.save();

    res.status(200).json({
      success: true,
      orderID: order.result.id,
      paymentId: payment._id,
      coins: coins,
      amount: amount,
    });
  } catch (error) {
    console.error("PayPal order error:", error);
    next(error);
  }
};

// Alternative method to create payment by coin amount
exports.createPaymentByCoins = async (req, res, next) => {
  try {
    const { coins, currency = "USD" } = req.body;
    const userId = req.user.id;

    // Validate coins - minimum 100 coins
    if (!coins || coins < 100) {
      return res.status(400).json({
        success: false,
        message: "Minimum purchase is 100 coins",
      });
    }

    // Calculate amount based on coins
    const amount = (coins / COIN_RATES.USD).toFixed(2);

    // Create payment record
    const payment = await Payment.create({
      user: userId,
      amount: parseFloat(amount),
      currency,
      coins,
      status: "pending",
    });

    // Create PayPal order
    const request = new checkoutNodeJssdk.orders.OrdersCreateRequest();
    request.prefer("return=representation");
    request.requestBody({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: currency,
            value: amount,
          },
          description: `Purchase of ${coins} coins`,
          custom_id: payment._id.toString(),
        },
      ],
      application_context: {
        brand_name: "Your App Name",
        landing_page: "BILLING",
        user_action: "PAY_NOW",
        return_url: `${process.env.FRONTEND_URL}/payment/success`,
        cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
      },
    });

    const order = await paypalClient.execute(request);

    // Update payment with PayPal order ID
    payment.paypalOrderId = order.result.id;
    await payment.save();

    res.status(200).json({
      success: true,
      orderID: order.result.id,
      paymentId: payment._id,
      coins: coins,
      amount: amount,
    });
  } catch (error) {
    console.error("PayPal order error:", error);
    next(error);
  }
};

// Capture PayPal payment
exports.capturePayment = async (req, res, next) => {
  try {
    const { orderID } = req.body;
    const userId = req.user.id;

    // Capture payment with PayPal
    const request = new checkoutNodeJssdk.orders.OrdersCaptureRequest(orderID);
    request.requestBody({});

    const capture = await paypalClient.execute(request);

    if (capture.result.status !== "COMPLETED") {
      return res.status(400).json({
        success: false,
        message: "Payment not completed",
      });
    }

    // Find payment record
    const payment = await Payment.findOne({
      paypalOrderId: orderID,
      user: userId,
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    // Update payment status
    payment.status = "completed";
    payment.paymentId = capture.result.id;
    payment.payerId = capture.result.payer.payer_id;
    await payment.save();

    // Find or create wallet
    let wallet = await Wallet.findOne({ user: userId });

    if (!wallet) {
      wallet = await Wallet.create({ user: userId });
    }

    // Add coins to wallet
    wallet.balance += payment.coins;

    // Add transaction record
    wallet.transactions.push({
      type: "purchase",
      amount: payment.coins,
      description: `Coin purchase via PayPal - $${payment.amount} for ${payment.coins} coins`,
      reference: payment._id,
      transactionModel: "Payment",
      payment: payment._id,
    });

    await wallet.save();

    res.status(200).json({
      success: true,
      message: "Payment completed successfully",
      data: {
        coinsAdded: payment.coins,
        newBalance: wallet.balance,
        paymentId: payment._id,
        amount: payment.amount,
      },
    });
  } catch (error) {
    console.error("Payment capture error:", error);
    next(error);
  }
};

// Get payment history
exports.getPaymentHistory = async (req, res, next) => {
  try {
    const payments = await Payment.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .select("amount coins currency status createdAt");

    res.status(200).json({
      success: true,
      count: payments.length,
      data: payments,
    });
  } catch (error) {
    next(error);
  }
};

// Get coin packages (updated for new pricing)
exports.getCoinPackages = async (req, res, next) => {
  try {
    const packages = [
      { amount: 0.1, coins: 100, currency: "USD", label: "100 Coins" },
      { amount: 0.5, coins: 500, currency: "USD", label: "500 Coins" },
      { amount: 1, coins: 1000, currency: "USD", label: "1,000 Coins" },
      { amount: 5, coins: 5000, currency: "USD", label: "5,000 Coins" },
      { amount: 10, coins: 10000, currency: "USD", label: "10,000 Coins" },
      { amount: 20, coins: 20000, currency: "USD", label: "20,000 Coins" },
    ];

    res.status(200).json({
      success: true,
      data: packages,
      rate: "100 coins = $0.1 USD",
    });
  } catch (error) {
    next(error);
  }
};

// Get coin rate information
exports.getCoinRate = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        rate: "100 coins = $0.1 USD",
        coinsPerUSD: COIN_RATES.USD,
        minimumPurchase: {
          amount: 0.1,
          coins: 100,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
exports.cancelPendingPayments = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Find and delete pending payments older than 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const result = await Payment.deleteMany({
      user: userId,
      status: "pending",
      createdAt: { $lt: oneHourAgo },
    });

    res.status(200).json({
      success: true,
      message: `Deleted ${result.deletedCount} abandoned pending payments`,
    });
  } catch (error) {
    console.error("Error deleting pending payments:", error);
    next(error);
  }
};

// Add cleanup function for old pending payments (optional)
exports.cleanupPendingPayments = async (req, res, next) => {
  try {
    // Clean up payments that are pending for more than 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const result = await Payment.updateMany(
      {
        status: "pending",
        createdAt: { $lt: twentyFourHoursAgo },
      },
      {
        status: "expired",
        updatedAt: new Date(),
      }
    );

    res.status(200).json({
      success: true,
      message: `Cleaned up ${result.modifiedCount} expired pending payments`,
    });
  } catch (error) {
    next(error);
  }
};
