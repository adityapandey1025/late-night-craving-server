"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setOrderETA = exports.updateOrderStatus = exports.rejectOrder = exports.acceptOrder = exports.getAllOrders = exports.getOrderById = exports.getMyOrders = exports.placeOrder = exports.calculateCartPreview = void 0;
exports.isStoreOpenForOrders = isStoreOpenForOrders;
const mongoose_1 = __importDefault(require("mongoose"));
const Order_1 = require("../models/Order");
const Product_1 = require("../models/Product");
const User_1 = require("../models/User");
const Admin_1 = require("../models/Admin");
const DeliveryLocation_1 = require("../models/DeliveryLocation");
const Payment_1 = require("../models/Payment");
const pricingEngine_1 = require("../services/pricingEngine");
const socketService_1 = require("../services/socketService");
const alertService_1 = require("../services/alertService");
// Helper to check if ordering is enabled (at least one admin is OPEN)
async function isStoreOpenForOrders() {
    const openAdmins = await Admin_1.Admin.countDocuments({
        isActive: true,
        availabilityStatus: 'OPEN',
    });
    return openAdmins > 0;
}
// Generate unique readable order number: LNC-YYYYMMDD-XXXX
function generateOrderNumber() {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomStr = Math.floor(1000 + Math.random() * 9000).toString();
    return `LNC-${dateStr}-${randomStr}`;
}
// Customer / Guest: Calculate bill dynamically for cart items
const calculateCartPreview = async (req, res) => {
    try {
        const { items } = req.body;
        if (!Array.isArray(items) || items.length === 0) {
            res.status(400).json({ success: false, message: 'Cart items are required' });
            return;
        }
        const productIds = items.map((i) => i.productId);
        const dbProducts = await Product_1.Product.find({ _id: { $in: productIds }, isActive: true });
        const productMap = new Map(dbProducts.map((p) => [p._id.toString(), p]));
        const rawItems = [];
        for (const item of items) {
            const dbProd = productMap.get(item.productId);
            if (!dbProd)
                continue;
            rawItems.push({
                productId: dbProd._id.toString(),
                name: dbProd.name,
                price: dbProd.sellingPrice,
                quantity: Math.max(1, Number(item.quantity) || 1),
                productType: dbProd.productType,
                paymentPolicy: dbProd.paymentPolicy,
                partialPaymentPercentage: dbProd.partialPaymentPercentage,
            });
        }
        const calculated = (0, pricingEngine_1.calculateOrderBill)(rawItems);
        res.json({ success: true, bill: calculated });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to calculate bill' });
    }
};
exports.calculateCartPreview = calculateCartPreview;
// Customer: Place an order
const placeOrder = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { items, deliveryAddress, deliveryInstructions, recipientName, recipientPhone } = req.body;
        if (!userId) {
            res.status(401).json({ success: false, message: 'Please log in to place an order.' });
            return;
        }
        const profile = await User_1.User.findById(userId).select('name phone email');
        if (!profile) {
            res.status(404).json({ success: false, message: 'Customer profile not found. Please log in again.' });
            return;
        }
        const snapshotName = typeof recipientName === 'string' && recipientName.trim()
            ? recipientName.trim()
            : profile.name;
        const snapshotPhone = typeof recipientPhone === 'string' && recipientPhone.trim()
            ? recipientPhone.trim()
            : profile.phone;
        const normalizedPhone = snapshotPhone.replace(/[\s()-]/g, '');
        if (!snapshotName || snapshotName.length < 2) {
            res.status(400).json({ success: false, message: 'Please provide a valid recipient name.' });
            return;
        }
        if (!/^\+?[1-9]\d{9,14}$/.test(normalizedPhone)) {
            res.status(400).json({ success: false, message: 'Please provide a valid recipient phone number.' });
            return;
        }
        // 1. Verify store availability
        const isOpen = await isStoreOpenForOrders();
        if (!isOpen) {
            res.status(403).json({
                success: false,
                message: 'We are currently closed for late-night delivery as our administrators are offline. Please check back soon!',
                isClosed: true,
            });
            return;
        }
        // 2. Validate items
        if (!Array.isArray(items) || items.length === 0) {
            res.status(400).json({ success: false, message: 'Your cart is empty.' });
            return;
        }
        // 3. Validate delivery location
        if (!deliveryAddress?.locationId || !deliveryAddress?.fullAddress) {
            res.status(400).json({ success: false, message: 'Please select a valid delivery address.' });
            return;
        }
        const location = await DeliveryLocation_1.DeliveryLocation.findById(deliveryAddress.locationId);
        if (!location || !location.isActive) {
            res.status(400).json({ success: false, message: 'Selected delivery location is currently inactive or not serviced.' });
            return;
        }
        // 4. Fetch products from database to ensure immutable snapshots and correct pricing
        const productIds = items.map((i) => i.productId);
        const dbProducts = await Product_1.Product.find({ _id: { $in: productIds }, isActive: true });
        const productMap = new Map(dbProducts.map((p) => [p._id.toString(), p]));
        const rawItems = [];
        for (const item of items) {
            const dbProd = productMap.get(item.productId);
            if (!dbProd) {
                res.status(400).json({ success: false, message: `Product ${item.name || item.productId} is no longer available.` });
                return;
            }
            if (!dbProd.availability) {
                res.status(400).json({ success: false, message: `${dbProd.name} is currently out of stock.` });
                return;
            }
            rawItems.push({
                productId: dbProd._id.toString(),
                name: dbProd.name,
                price: dbProd.sellingPrice,
                quantity: Math.max(1, Number(item.quantity) || 1),
                productType: dbProd.productType,
                paymentPolicy: dbProd.paymentPolicy,
                partialPaymentPercentage: dbProd.partialPaymentPercentage,
            });
        }
        // Initial bill calculation with 0 surcharge (surcharge will be chosen by accepting admin)
        const bill = (0, pricingEngine_1.calculateOrderBill)(rawItems, 0);
        const orderNumber = generateOrderNumber();
        const orderItems = bill.items.map((i) => ({
            productId: new mongoose_1.default.Types.ObjectId(i.productId),
            name: i.name,
            price: i.price,
            quantity: i.quantity,
            productType: i.productType,
            paymentPolicy: i.paymentPolicy,
            itemTotal: i.itemTotal,
            advanceRequired: i.advanceRequired,
        }));
        const order = await Order_1.Order.create({
            orderNumber,
            customerId: userId,
            customerSnapshot: {
                name: snapshotName,
                phone: normalizedPhone,
                email: profile.email || '',
            },
            deliveryAddress: {
                fullAddress: deliveryAddress.fullAddress,
                landmark: deliveryAddress.landmark || '',
                locationId: location._id,
                locationName: location.name,
            },
            deliveryInstructions: deliveryInstructions || '',
            items: orderItems,
            pricing: {
                productSubtotal: bill.productSubtotal,
                deliveryFee: bill.deliveryFee,
                fastFoodSurcharge: 0,
                orderTotal: bill.orderTotal,
                onlineAdvanceRequired: bill.onlineAdvanceRequired,
                remainingBalance: bill.remainingBalance,
                isSurchargeAcknowledged: true,
            },
            status: 'PENDING_ADMIN_ACCEPTANCE',
            statusHistory: [
                {
                    status: 'PENDING_ADMIN_ACCEPTANCE',
                    changedBy: new mongoose_1.default.Types.ObjectId(userId),
                    changedByRole: 'customer',
                    actorName: snapshotName,
                    timestamp: new Date(),
                    note: 'Order submitted by customer, awaiting administrator acceptance',
                },
            ],
            whatsappSharingUnlocked: false,
        });
        // Notify administrators in real-time
        socketService_1.socketEvents.notifyNewOrder(order);
        (0, alertService_1.sendNewOrderAlert)({
            orderNumber: order.orderNumber,
            customerName: order.customerSnapshot.name,
            customerPhone: order.customerSnapshot.phone,
            amount: order.pricing.orderTotal,
        }).catch((error) => console.error('Twilio new order alert failed:', error.message));
        res.status(201).json({
            success: true,
            message: 'Order placed successfully! Awaiting administrator acceptance.',
            order,
        });
    }
    catch (error) {
        console.error('Order placement error:', error);
        res.status(500).json({ success: false, message: error.message || 'Failed to place order' });
    }
};
exports.placeOrder = placeOrder;
// Customer: Get my orders
const getMyOrders = async (req, res) => {
    try {
        const userId = req.user?.id;
        const orders = await Order_1.Order.find({ customerId: userId }).sort({ createdAt: -1 });
        res.json({ success: true, orders });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch your orders' });
    }
};
exports.getMyOrders = getMyOrders;
// Customer / Admin: Get order by ID
const getOrderById = async (req, res) => {
    try {
        const { id } = req.params;
        const order = await Order_1.Order.findById(id);
        if (!order) {
            res.status(404).json({ success: false, message: 'Order not found' });
            return;
        }
        // Check authorization: customer must own the order, or user must be admin
        if (req.user?.role !== 'admin' && order.customerId.toString() !== req.user?.id) {
            res.status(403).json({ success: false, message: 'Access denied to this order.' });
            return;
        }
        const payment = await Payment_1.Payment.findOne({ orderId: order._id });
        res.json({
            success: true,
            order,
            payment,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to retrieve order' });
    }
};
exports.getOrderById = getOrderById;
// Admin: Get all orders with filtering
const getAllOrders = async (req, res) => {
    try {
        const { status, adminId, date } = req.query;
        const filter = {};
        if (status && typeof status === 'string') {
            filter.status = status;
        }
        if (adminId && typeof adminId === 'string') {
            filter.assignedAdminId = adminId;
        }
        if (date && typeof date === 'string') {
            const start = new Date(date);
            start.setHours(0, 0, 0, 0);
            const end = new Date(date);
            end.setHours(23, 59, 59, 999);
            filter.createdAt = { $gte: start, $lte: end };
        }
        const orders = await Order_1.Order.find(filter).sort({ createdAt: -1 });
        res.json({ success: true, count: orders.length, orders });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch admin orders' });
    }
};
exports.getAllOrders = getAllOrders;
// Admin: Accept Order (Assigns accepting admin, sets fast-food surcharge)
const acceptOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.user?.id;
        const admin = await Admin_1.Admin.findById(adminId);
        if (!admin) {
            res.status(404).json({ success: false, message: 'Administrator not found' });
            return;
        }
        const order = await Order_1.Order.findById(id);
        if (!order) {
            res.status(404).json({ success: false, message: 'Order not found' });
            return;
        }
        if (order.status !== 'PENDING_ADMIN_ACCEPTANCE') {
            res.status(400).json({
                success: false,
                message: `Order cannot be accepted because it is currently in '${order.status}' status.`,
            });
            return;
        }
        // Recompute bill using automatic quantity pricing
        const rawItems = order.items.map((item) => ({
            productId: item.productId.toString(),
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            productType: item.productType,
            paymentPolicy: item.paymentPolicy,
        }));
        const recalculatedBill = (0, pricingEngine_1.calculateOrderBill)(rawItems);
        // Assign accepting administrator and update pricing
        order.assignedAdminId = admin._id;
        order.assignedAdminSnapshot = {
            name: admin.name,
            phone: admin.phone,
            upiId: admin.upiId,
            upiName: admin.upiName,
            qrCodeUrl: admin.qrCodeUrl,
        };
        order.pricing.fastFoodSurcharge = recalculatedBill.fastFoodSurcharge;
        order.pricing.orderTotal = recalculatedBill.orderTotal;
        order.pricing.onlineAdvanceRequired = recalculatedBill.onlineAdvanceRequired;
        order.pricing.remainingBalance = recalculatedBill.remainingBalance;
        order.pricing.isSurchargeAcknowledged = true;
        order.status = 'AWAITING_PAYMENT';
        order.statusHistory.push({
            status: 'AWAITING_PAYMENT',
            changedBy: admin._id,
            changedByRole: 'admin',
            actorName: admin.name,
            timestamp: new Date(),
            note: `Accepted by ${admin.name}. Automatic quantity pricing applied. UPI QR generated for payment.`,
        });
        await order.save();
        // Create or update Payment record
        let payment = await Payment_1.Payment.findOne({ orderId: order._id });
        if (!payment) {
            payment = await Payment_1.Payment.create({
                orderId: order._id,
                customerId: order.customerId,
                assignedAdminId: admin._id,
                advanceAmountExpected: order.pricing.onlineAdvanceRequired,
                advanceStatus: 'PENDING',
                remainingAmountExpected: order.pricing.remainingBalance,
                remainingAmountCollected: 0,
                remainingCollectionStatus: 'PENDING',
                isSettled: false,
            });
        }
        else {
            payment.assignedAdminId = admin._id;
            payment.advanceAmountExpected = order.pricing.onlineAdvanceRequired;
            payment.remainingAmountExpected = order.pricing.remainingBalance;
            await payment.save();
        }
        // Real-time socket notification
        socketService_1.socketEvents.notifyOrderStatusUpdate(order._id.toString(), {
            orderId: order._id,
            status: order.status,
            assignedAdmin: order.assignedAdminSnapshot,
            pricing: order.pricing,
            note: `Order accepted by ${admin.name}`,
        });
        res.json({
            success: true,
            message: `Order accepted by ${admin.name}. Awaiting payment.`,
            order,
            payment,
        });
    }
    catch (error) {
        console.error('Accept order error:', error);
        res.status(500).json({ success: false, message: 'Failed to accept order' });
    }
};
exports.acceptOrder = acceptOrder;
// Admin: Reject Order
const rejectOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.user?.id;
        const { reason } = req.body;
        const admin = await Admin_1.Admin.findById(adminId);
        const order = await Order_1.Order.findById(id);
        if (!order) {
            res.status(404).json({ success: false, message: 'Order not found' });
            return;
        }
        if (order.status !== 'PENDING_ADMIN_ACCEPTANCE') {
            res.status(400).json({
                success: false,
                message: `Order cannot be rejected from '${order.status}' status.`,
            });
            return;
        }
        order.status = 'REJECTED';
        order.rejectionReason = reason || 'Delivery unavailable at this moment.';
        order.statusHistory.push({
            status: 'REJECTED',
            changedBy: admin?._id || new mongoose_1.default.Types.ObjectId(adminId),
            changedByRole: 'admin',
            actorName: admin?.name || 'Admin',
            timestamp: new Date(),
            note: `Rejected by ${admin?.name || 'Admin'}: ${order.rejectionReason}`,
        });
        await order.save();
        socketService_1.socketEvents.notifyOrderStatusUpdate(order._id.toString(), {
            orderId: order._id,
            status: 'REJECTED',
            reason: order.rejectionReason,
        });
        res.json({ success: true, message: 'Order rejected', order });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to reject order' });
    }
};
exports.rejectOrder = rejectOrder;
// Admin: Update order status along lifecycle state machine
const updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.user?.id;
        const { nextStatus, note } = req.body;
        const validStatuses = [
            'PREPARING',
            'READY_FOR_DELIVERY',
            'OUT_FOR_DELIVERY',
            'DELIVERED',
            'CANCELLED',
        ];
        if (!validStatuses.includes(nextStatus)) {
            res.status(400).json({ success: false, message: 'Invalid next status transition' });
            return;
        }
        const admin = await Admin_1.Admin.findById(adminId);
        const order = await Order_1.Order.findById(id);
        if (!order) {
            res.status(404).json({ success: false, message: 'Order not found' });
            return;
        }
        // State machine check:
        // DELIVERED requires that payment is settled or cash collected
        if (nextStatus === 'DELIVERED') {
            const payment = await Payment_1.Payment.findOne({ orderId: order._id });
            if (payment && !payment.isSettled && payment.remainingAmountExpected > payment.remainingAmountCollected) {
                // Warning: Outstanding balance
                // We allow admin to record collection in settlement step
            }
        }
        order.status = nextStatus;
        order.statusHistory.push({
            status: nextStatus,
            changedBy: admin?._id || new mongoose_1.default.Types.ObjectId(adminId),
            changedByRole: 'admin',
            actorName: admin?.name || 'Admin',
            timestamp: new Date(),
            note: note || `Order updated to ${nextStatus} by ${admin?.name}`,
        });
        await order.save();
        socketService_1.socketEvents.notifyOrderStatusUpdate(order._id.toString(), {
            orderId: order._id,
            status: nextStatus,
            note: note || `Order status updated to ${nextStatus}`,
        });
        res.json({ success: true, message: `Status updated to ${nextStatus}`, order });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update order status' });
    }
};
exports.updateOrderStatus = updateOrderStatus;
// Admin: Set or update Delivery ETA
const setOrderETA = async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.user?.id;
        const { minutes, customTimestamp } = req.body;
        const admin = await Admin_1.Admin.findById(adminId);
        const order = await Order_1.Order.findById(id);
        if (!order) {
            res.status(404).json({ success: false, message: 'Order not found' });
            return;
        }
        let etaDate;
        if (customTimestamp) {
            etaDate = new Date(customTimestamp);
        }
        else if (minutes) {
            etaDate = new Date(Date.now() + Number(minutes) * 60 * 1000);
        }
        else {
            res.status(400).json({ success: false, message: 'Please provide ETA minutes or timestamp' });
            return;
        }
        order.estimatedDeliveryTime = etaDate;
        order.statusHistory.push({
            status: order.status,
            changedBy: admin?._id || new mongoose_1.default.Types.ObjectId(adminId),
            changedByRole: 'admin',
            actorName: admin?.name || 'Admin',
            timestamp: new Date(),
            note: `Delivery ETA set to ${etaDate.toLocaleTimeString()} by ${admin?.name}`,
        });
        await order.save();
        socketService_1.socketEvents.notifyOrderETA(order._id.toString(), {
            estimatedDeliveryTime: etaDate,
        });
        res.json({
            success: true,
            message: 'Estimated delivery time updated',
            estimatedDeliveryTime: etaDate,
            order,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update ETA' });
    }
};
exports.setOrderETA = setOrderETA;
