"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const paymentController_1 = require("../controllers/paymentController");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
// Customer endpoints
router.get('/order/:orderId/info', auth_1.requireAuth, paymentController_1.getOrderPaymentInfo);
router.post('/order/:orderId/submit-reference', auth_1.requireAuth, paymentController_1.submitPaymentReference);
router.get('/order/:orderId/whatsapp', auth_1.requireAuth, paymentController_1.getWhatsAppLocationLink);
// Shared / Ledger endpoint
router.get('/order/:orderId/ledger', auth_1.requireAuth, paymentController_1.getPaymentLedger);
// Admin endpoints
router.post('/order/:orderId/verify-advance', auth_1.requireAdmin, paymentController_1.verifyAdvancePayment);
router.post('/order/:orderId/record-collection', auth_1.requireAdmin, paymentController_1.recordDeliveryCollection);
exports.default = router;
