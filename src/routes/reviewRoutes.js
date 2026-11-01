"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const reviewController_1 = require("../controllers/reviewController");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
// Public: Get all reviews
router.get('/', reviewController_1.getPublicReviews);
// Customer: Submit review for delivered order
router.post('/', auth_1.requireAuth, reviewController_1.createReview);
exports.default = router;
