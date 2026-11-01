"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const adminController_1 = require("../controllers/adminController");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
// Store status
router.get('/availability', adminController_1.getStoreAvailability);
// Admin-only endpoints
router.post('/availability/toggle', auth_1.requireAdmin, adminController_1.toggleAdminAvailability);
router.put('/profile', auth_1.requireAdmin, adminController_1.updateAdminProfile);
router.get('/analytics', auth_1.requireAdmin, adminController_1.getDashboardAnalytics);
// Delivery location management
router.get('/locations', auth_1.requireAdmin, adminController_1.getAdminLocations);
router.post('/locations', auth_1.requireAdmin, adminController_1.createDeliveryLocation);
router.put('/locations/:id', auth_1.requireAdmin, adminController_1.updateDeliveryLocation);
router.delete('/locations/:id', auth_1.requireAdmin, adminController_1.deleteDeliveryLocation);
exports.default = router;
