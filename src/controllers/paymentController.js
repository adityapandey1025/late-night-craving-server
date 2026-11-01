"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWhatsAppLocationLink = exports.getPaymentLedger = exports.recordDeliveryCollection = exports.verifyAdvancePayment = exports.submitPaymentReference = exports.getOrderPaymentInfo = void 0;
const alertService_1 = require("../services/alertService");
const Order_1 = require("../models/Order");
const Payment_1 = require("../models/Payment");
const PaymentTransaction_1 = require("../models/PaymentTransaction");
const Admin_1 = require("../models/Admin");
const BusinessSettings_1 = require("../models/BusinessSettings");
const qrHelper_1 = require("../utils/qrHelper");
const socketService_1 = require("../services/socketService");
// Customer: Get payment QR code and details for accepted order
const getOrderPaymentInfo = async (req, res) => {
    try {
        const { orderId } = req.params;
        const order = await Order_1.Order.findById(orderId);
        if (!order) {
            res.status(404).json({ success: false, message: 'Order not found' });
            return;
        }
        if (!order.assignedAdminId) {
            res.status(400).json({
                success: false,
                message: 'Order has not been accepted by an administrator yet.',
            });
            return;
        }
        const admin = await Admin_1.Admin.findById(order.assignedAdminId);
        if (!admin) {
            res.status(404).json({ success: false, message: 'Assigned administrator not found' });
            return;
        }
        const payment = await Payment_1.Payment.findOne({ orderId: order._id });
        // Generate UPI Link and QR code
        const upiDetails = {
            upiId: admin.upiId,
            name: admin.upiName || admin.name,
            amountPaise: order.pricing.onlineAdvanceRequired,
            orderNumber: order.orderNumber,
        };
        const upiIntentUrl = (0, qrHelper_1.generateUPIUrl)(upiDetails);
        const qrDataUrl = await (0, qrHelper_1.generateUPIQRCodeDataUrl)(upiDetails);
        res.json({
            success: true,
            orderNumber: order.orderNumber,
            orderStatus: order.status,
            assignedAdmin: {
                id: admin._id,
                name: admin.name,
                phone: admin.phone,
                upiId: admin.upiId,
                upiName: admin.upiName,
            },
            pricing: {
                productSubtotal: order.pricing.productSubtotal,
                deliveryFee: order.pricing.deliveryFee,
                fastFoodSurcharge: order.pricing.fastFoodSurcharge,
                orderTotal: order.pricing.orderTotal,
                onlineAdvanceRequired: order.pricing.onlineAdvanceRequired,
                remainingBalance: order.pricing.remainingBalance,
            },
            payment: {
                advanceStatus: payment?.advanceStatus || 'PENDING',
                customerPaymentReference: payment?.customerPaymentReference || '',
                verifiedAmount: payment?.verifiedAmount || 0,
                isSettled: payment?.isSettled || false,
            },
            upiIntentUrl,
            qrDataUrl,
        });
    }
    catch (error) {
        console.error('Payment info error:', error);
        res.status(500).json({ success: false, message: 'Failed to retrieve payment information' });
    }
};
exports.getOrderPaymentInfo = getOrderPaymentInfo;
// Customer: Submit payment reference / UTR
const submitPaymentReference = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { reference } = req.body;
        const order = await Order_1.Order.findById(orderId);
        if (!order) {
            res.status(404).json({ success: false, message: 'Order not found' });
            return;
        }
        if (order.customerId.toString() !== req.user?.id) {
            res.status(403).json({ success: false, message: 'You are not allowed to update this order payment.' });
            return;
        }
        let payment = await Payment_1.Payment.findOne({ orderId: order._id });
        if (!payment) {
            res.status(404).json({ success: false, message: 'Payment record not found' });
            return;
        }
        if (payment.advanceStatus === 'VERIFIED') {
            res.status(409).json({ success: false, message: 'This payment has already been verified.' });
            return;
        }
        payment.customerPaymentReference = (reference || '').trim();
        payment.customerSubmittedAt = new Date();
        payment.advanceStatus = 'SUBMITTED';
        await payment.save();
        // Notify admins via socket
        socketService_1.socketEvents.notifyOrderStatusUpdate(order._id.toString(), {
            orderId: order._id,
            status: order.status,
            paymentStatus: 'SUBMITTED',
            reference: payment.customerPaymentReference,
            note: 'Customer marked payment completed. Admin notified; awaiting manual bank verification.',
            orderNumber: order.orderNumber,
            customerName: order.customerSnapshot?.name || 'Customer',
            expectedAmount: order.pricing?.onlineAdvanceRequired || 0,
        });
        // Best-effort WhatsApp/voice alerts; payment submission remains successful if Twilio is unavailable.
        (0, alertService_1.sendPaymentAlert)({
            orderNumber: order.orderNumber,
            customerName: order.customerSnapshot?.name || 'Customer',
            amount: order.pricing?.onlineAdvanceRequired || 0,
            reference: payment.customerPaymentReference,
        }).catch((err) => console.error('Twilio payment alert failed:', err.message));
        res.json({
            success: true,
            message: 'Payment marked completed. Admin notified; verification is pending.',
            payment,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to submit payment reference' });
    }
};
exports.submitPaymentReference = submitPaymentReference;
// Admin: Manual Payment Verification
const verifyAdvancePayment = async (req, res) => {
    try {
        const { orderId } = req.params;
        const adminId = req.user?.id;
        const { verifiedAmountPaise, paymentMethod, note, reference } = req.body;
        const admin = await Admin_1.Admin.findById(adminId);
        if (!admin) {
            res.status(404).json({ success: false, message: 'Admin not found' });
            return;
        }
        const order = await Order_1.Order.findById(orderId);
        if (!order) {
            res.status(404).json({ success: false, message: 'Order not found' });
            return;
        }
        let payment = await Payment_1.Payment.findOne({ orderId: order._id });
        if (!payment) {
            res.status(404).json({ success: false, message: 'Payment record not found' });
            return;
        }
        const amountVerified = Number(verifiedAmountPaise ?? order.pricing.onlineAdvanceRequired);
        // Update payment record
        payment.advanceStatus = 'VERIFIED';
        payment.verifiedAmount = amountVerified;
        payment.verifyingAdminId = admin._id;
        payment.verifyingAdminName = admin.name;
        payment.verifiedAt = new Date();
        payment.verificationNote = note || `Verified by ${admin.name}`;
        if (reference) {
            payment.customerPaymentReference = reference;
        }
        // Check if fully settled (e.g. if advance was 100% of order)
        if (amountVerified >= order.pricing.orderTotal) {
            payment.isSettled = true;
            payment.settledAt = new Date();
            payment.remainingCollectionStatus = 'FULLY_COLLECTED';
        }
        await payment.save();
        // Create PaymentTransaction audit entry
        await PaymentTransaction_1.PaymentTransaction.create({
            orderId: order._id,
            paymentId: payment._id,
            transactionType: 'ONLINE_ADVANCE',
            amount: amountVerified,
            paymentMethod: paymentMethod || 'UPI',
            collectedByAdminId: admin._id,
            adminName: admin.name,
            reference: payment.customerPaymentReference || 'ADMIN_VERIFIED',
            status: 'SUCCESS',
            notes: payment.verificationNote,
            timestamp: new Date(),
        });
        // Update order status to PAYMENT_CONFIRMED & unlock WhatsApp location sharing
        order.status = 'PAYMENT_CONFIRMED';
        order.whatsappSharingUnlocked = true;
        order.statusHistory.push({
            status: 'PAYMENT_CONFIRMED',
            changedBy: admin._id,
            changedByRole: 'admin',
            actorName: admin.name,
            timestamp: new Date(),
            note: `Payment of ₹${(amountVerified / 100).toFixed(2)} manually verified by ${admin.name}. WhatsApp location sharing unlocked.`,
        });
        await order.save();
        // Fetch business settings for WhatsApp prefilled link
        const settings = await BusinessSettings_1.BusinessSettings.findOne();
        const phone = settings?.whatsappNumber || '919876543210';
        const whatsappText = encodeURIComponent(`Hi lateNightCraving! Here is my delivery location for Order #${order.orderNumber}`);
        const whatsappUrl = `https://wa.me/${phone}?text=${whatsappText}`;
        // Emit real-time event
        socketService_1.socketEvents.notifyPaymentConfirmed(order._id.toString(), {
            orderId: order._id,
            status: 'PAYMENT_CONFIRMED',
            whatsappSharingUnlocked: true,
            whatsappUrl,
            verifiedAmount: amountVerified,
            verifyingAdmin: admin.name,
        });
        res.json({
            success: true,
            message: `Advance payment verified by ${admin.name}. WhatsApp location sharing enabled.`,
            order,
            payment,
            whatsappUrl,
        });
    }
    catch (error) {
        console.error('Payment verification error:', error);
        res.status(500).json({ success: false, message: 'Failed to verify payment' });
    }
};
exports.verifyAdvancePayment = verifyAdvancePayment;
// Admin: Record remaining payment collection at delivery
const recordDeliveryCollection = async (req, res) => {
    try {
        const { orderId } = req.params;
        const adminId = req.user?.id;
        const { amountPaise, paymentMethod, notes, reference } = req.body;
        const collectedAmount = Number(amountPaise);
        if (!collectedAmount || collectedAmount <= 0) {
            res.status(400).json({ success: false, message: 'Invalid collection amount.' });
            return;
        }
        const admin = await Admin_1.Admin.findById(adminId);
        if (!admin) {
            res.status(404).json({ success: false, message: 'Admin not found' });
            return;
        }
        const order = await Order_1.Order.findById(orderId);
        if (!order) {
            res.status(404).json({ success: false, message: 'Order not found' });
            return;
        }
        const payment = await Payment_1.Payment.findOne({ orderId: order._id });
        if (!payment) {
            res.status(404).json({ success: false, message: 'Payment record not found' });
            return;
        }
        // Update remaining collected
        payment.remainingAmountCollected = (payment.remainingAmountCollected || 0) + collectedAmount;
        if (payment.remainingAmountCollected >= payment.remainingAmountExpected) {
            payment.remainingCollectionStatus = 'FULLY_COLLECTED';
            payment.isSettled = true;
            payment.settledAt = new Date();
        }
        else {
            payment.remainingCollectionStatus = 'PARTIALLY_COLLECTED';
        }
        await payment.save();
        // Create transaction ledger record
        const transaction = await PaymentTransaction_1.PaymentTransaction.create({
            orderId: order._id,
            paymentId: payment._id,
            transactionType: 'DELIVERY_COLLECTION',
            amount: collectedAmount,
            paymentMethod: paymentMethod === 'CASH' ? 'CASH' : 'UPI',
            collectedByAdminId: admin._id,
            adminName: admin.name,
            reference: reference || 'ON_DELIVERY',
            status: 'SUCCESS',
            notes: notes || `Collected ₹${(collectedAmount / 100).toFixed(2)} on delivery by ${admin.name}`,
            timestamp: new Date(),
        });
        order.statusHistory.push({
            status: order.status,
            changedBy: admin._id,
            changedByRole: 'admin',
            actorName: admin.name,
            timestamp: new Date(),
            note: `Delivery collection recorded: ₹${(collectedAmount / 100).toFixed(2)} via ${paymentMethod} by ${admin.name}. Outstanding remaining: ₹${Math.max(0, (payment.remainingAmountExpected - payment.remainingAmountCollected) / 100).toFixed(2)}`,
        });
        await order.save();
        socketService_1.socketEvents.notifyOrderStatusUpdate(order._id.toString(), {
            orderId: order._id,
            paymentSettled: payment.isSettled,
            remainingAmountCollected: payment.remainingAmountCollected,
            remainingAmountExpected: payment.remainingAmountExpected,
            note: `Payment collected at delivery`,
        });
        res.json({
            success: true,
            message: `Recorded collection of ₹${(collectedAmount / 100).toFixed(2)}`,
            payment,
            transaction,
        });
    }
    catch (error) {
        console.error('Delivery collection error:', error);
        res.status(500).json({ success: false, message: 'Failed to record collection' });
    }
};
exports.recordDeliveryCollection = recordDeliveryCollection;
// Customer / Admin: Get Payment Transactions Ledger
const getPaymentLedger = async (req, res) => {
    try {
        const { orderId } = req.params;
        const transactions = await PaymentTransaction_1.PaymentTransaction.find({ orderId }).sort({ timestamp: -1 });
        const payment = await Payment_1.Payment.findOne({ orderId });
        res.json({
            success: true,
            payment,
            transactions,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to retrieve payment ledger' });
    }
};
exports.getPaymentLedger = getPaymentLedger;
// Customer: Get WhatsApp location sharing link
const getWhatsAppLocationLink = async (req, res) => {
    try {
        const { orderId } = req.params;
        const order = await Order_1.Order.findById(orderId);
        if (!order) {
            res.status(404).json({ success: false, message: 'Order not found' });
            return;
        }
        if (!order.whatsappSharingUnlocked) {
            res.status(403).json({
                success: false,
                message: 'WhatsApp location sharing is only unlocked after payment confirmation.',
            });
            return;
        }
        const settings = await BusinessSettings_1.BusinessSettings.findOne();
        const phone = settings?.whatsappNumber || '919876543210';
        const whatsappText = encodeURIComponent(`Hi lateNightCraving! Here is my delivery location for Order #${order.orderNumber}`);
        const whatsappUrl = `https://wa.me/${phone}?text=${whatsappText}`;
        res.json({
            success: true,
            whatsappUrl,
            whatsappNumber: phone,
            orderNumber: order.orderNumber,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to generate WhatsApp link' });
    }
};
exports.getWhatsAppLocationLink = getWhatsAppLocationLink;
