"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalAuth = exports.requireAdmin = exports.requireAuth = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const constants_1 = require("../config/constants");
const Admin_1 = require("../models/Admin");
const requireAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ success: false, message: 'Authentication required. Please log in.' });
            return;
        }
        const token = authHeader.split(' ')[1];
        const decoded = jsonwebtoken_1.default.verify(token, constants_1.CONFIG.JWT_SECRET);
        req.user = decoded;
        next();
    }
    catch (error) {
        res.status(401).json({ success: false, message: 'Invalid or expired session. Please log in again.' });
    }
};
exports.requireAuth = requireAuth;
const requireAdmin = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ success: false, message: 'Admin authentication required.' });
            return;
        }
        const token = authHeader.split(' ')[1];
        const decoded = jsonwebtoken_1.default.verify(token, constants_1.CONFIG.JWT_SECRET);
        if (decoded.role !== 'admin') {
            res.status(403).json({ success: false, message: 'Access denied: Administrator privileges required.' });
            return;
        }
        // Verify admin still exists and is active in database
        const admin = await Admin_1.Admin.findById(decoded.id);
        if (!admin || !admin.isActive) {
            res.status(403).json({ success: false, message: 'Admin account inactive or not found.' });
            return;
        }
        req.user = decoded;
        next();
    }
    catch (error) {
        res.status(401).json({ success: false, message: 'Invalid or expired administrator session.' });
    }
};
exports.requireAdmin = requireAdmin;
const optionalAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jsonwebtoken_1.default.verify(token, constants_1.CONFIG.JWT_SECRET);
            req.user = decoded;
        }
        catch {
            // Ignore invalid optional auth token
        }
    }
    next();
};
exports.optionalAuth = optionalAuth;
