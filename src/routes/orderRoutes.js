"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const orderController_1 = require("../controllers/orderController");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
// Pricing engine preview (no auth required for guest cart)
router.post('/preview', orderController_1.calculateCartPreview);
// Customer endpoints
router.post('/', auth_1.requireAuth, orderController_1.placeOrder);
router.get('/my', auth_1.requireAuth, orderController_1.getMyOrders);
router.get('/:id', auth_1.requireAuth, orderController_1.getOrderById);
// Admin order management endpoints
router.get('/', auth_1.requireAdmin, orderController_1.getAllOrders);
router.post('/:id/accept', auth_1.requireAdmin, orderController_1.acceptOrder);
router.post('/:id/reject', auth_1.requireAdmin, orderController_1.rejectOrder);
router.patch('/:id/status', auth_1.requireAdmin, orderController_1.updateOrderStatus);
router.patch('/:id/eta', auth_1.requireAdmin, orderController_1.setOrderETA);
exports.default = router;
