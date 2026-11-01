"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authController_1 = require("../controllers/authController");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
// Customer endpoints
router.post('/register', authController_1.registerCustomer);
router.post('/login', authController_1.loginCustomer);
// Admin login (Per Spec 13: Seeded accounts only, no public admin registration)
router.post('/admin/login', authController_1.loginAdmin);
// Profile
router.get('/me', auth_1.requireAuth, authController_1.getMe);
router.post('/addresses', auth_1.requireAuth, authController_1.addAddress);
router.delete('/addresses/:addressId', auth_1.requireAuth, authController_1.deleteAddress);
exports.default = router;
