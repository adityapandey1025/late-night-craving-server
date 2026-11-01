"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const productController_1 = require("../controllers/productController");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
// Public routes (No login required per Spec 1)
router.get('/', productController_1.getProducts);
router.get('/categories', productController_1.getCategories);
router.get('/:id', productController_1.getProductById);
// Admin routes
router.post('/', auth_1.requireAdmin, productController_1.createProduct);
router.put('/:id', auth_1.requireAdmin, productController_1.updateProduct);
router.patch('/:id/availability', auth_1.requireAdmin, productController_1.toggleProductAvailability);
router.delete('/:id', auth_1.requireAdmin, productController_1.deleteProduct);
router.post('/categories', auth_1.requireAdmin, productController_1.createCategory);
exports.default = router;
