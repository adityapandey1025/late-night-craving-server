"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAddress = exports.addAddress = exports.getMe = exports.loginAdmin = exports.loginCustomer = exports.registerCustomer = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = require("../models/User");
const Admin_1 = require("../models/Admin");
const DeliveryLocation_1 = require("../models/DeliveryLocation");
const constants_1 = require("../config/constants");
// Helper to sign JWT
const signToken = (payload) => {
    return jsonwebtoken_1.default.sign(payload, constants_1.CONFIG.JWT_SECRET, { expiresIn: '7d' });
};
// Customer Registration
const registerCustomer = async (req, res) => {
    try {
        const { name, phone, email, password } = req.body;
        if (!name || !phone || !password) {
            res.status(400).json({ success: false, message: 'Name, phone number, and password are required.' });
            return;
        }
        const trimmedPhone = phone.trim();
        const existing = await User_1.User.findOne({ phone: trimmedPhone });
        if (existing) {
            res.status(400).json({ success: false, message: 'An account with this phone number already exists. Please log in.' });
            return;
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const user = await User_1.User.create({
            name: name.trim(),
            phone: trimmedPhone,
            email: email ? email.trim().toLowerCase() : undefined,
            password: hashedPassword,
            role: 'customer',
            addresses: [],
        });
        const token = signToken({ id: user._id.toString(), role: 'customer', name: user.name });
        res.status(201).json({
            success: true,
            message: 'Account registered successfully.',
            token,
            user: {
                id: user._id,
                name: user.name,
                phone: user.phone,
                email: user.email,
                role: user.role,
                addresses: user.addresses,
            },
        });
    }
    catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, message: error.message || 'Server error during registration' });
    }
};
exports.registerCustomer = registerCustomer;
// Customer Login
const loginCustomer = async (req, res) => {
    try {
        const { phoneOrEmail, password } = req.body;
        if (!phoneOrEmail || !password) {
            res.status(400).json({ success: false, message: 'Please provide phone number or email, and password.' });
            return;
        }
        const identifier = phoneOrEmail.trim();
        const user = await User_1.User.findOne({
            $or: [{ phone: identifier }, { email: identifier.toLowerCase() }],
        });
        if (!user) {
            res.status(401).json({ success: false, message: 'Invalid credentials. User not found.' });
            return;
        }
        const isMatch = await bcryptjs_1.default.compare(password, user.password || '');
        if (!isMatch) {
            res.status(401).json({ success: false, message: 'Invalid credentials. Incorrect password.' });
            return;
        }
        const token = signToken({ id: user._id.toString(), role: 'customer', name: user.name });
        res.json({
            success: true,
            message: 'Logged in successfully.',
            token,
            user: {
                id: user._id,
                name: user.name,
                phone: user.phone,
                email: user.email,
                role: user.role,
                addresses: user.addresses,
            },
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Server error during login' });
    }
};
exports.loginCustomer = loginCustomer;
// Admin Login
const loginAdmin = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ success: false, message: 'Please provide admin email and password.' });
            return;
        }
        const admin = await Admin_1.Admin.findOne({ email: email.trim().toLowerCase() });
        if (!admin) {
            res.status(401).json({ success: false, message: 'Invalid administrator credentials.' });
            return;
        }
        if (!admin.isActive) {
            res.status(403).json({ success: false, message: 'Administrator account is deactivated.' });
            return;
        }
        const isMatch = await bcryptjs_1.default.compare(password, admin.password);
        if (!isMatch) {
            res.status(401).json({ success: false, message: 'Invalid administrator credentials.' });
            return;
        }
        const token = signToken({ id: admin._id.toString(), role: 'admin', name: admin.name });
        res.json({
            success: true,
            message: `Welcome back, ${admin.name}!`,
            token,
            admin: {
                id: admin._id,
                name: admin.name,
                email: admin.email,
                phone: admin.phone,
                role: admin.role,
                upiId: admin.upiId,
                upiName: admin.upiName,
                qrCodeUrl: admin.qrCodeUrl,
                availabilityStatus: admin.availabilityStatus,
            },
        });
    }
    catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ success: false, message: 'Server error during administrator login' });
    }
};
exports.loginAdmin = loginAdmin;
// Get current profile
const getMe = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Not authenticated' });
            return;
        }
        if (req.user.role === 'admin') {
            const admin = await Admin_1.Admin.findById(req.user.id).select('-password');
            if (!admin) {
                res.status(404).json({ success: false, message: 'Admin not found' });
                return;
            }
            res.json({ success: true, user: admin });
            return;
        }
        const user = await User_1.User.findById(req.user.id).select('-password');
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found' });
            return;
        }
        res.json({ success: true, user });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch current user' });
    }
};
exports.getMe = getMe;
// Add delivery address for customer
const addAddress = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { label, fullAddress, landmark, locationId } = req.body;
        if (!fullAddress || !locationId) {
            res.status(400).json({ success: false, message: 'Address and delivery area location are required.' });
            return;
        }
        const location = await DeliveryLocation_1.DeliveryLocation.findById(locationId);
        if (!location || !location.isActive) {
            res.status(400).json({ success: false, message: 'Selected delivery location is inactive or invalid.' });
            return;
        }
        const user = await User_1.User.findById(userId);
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found.' });
            return;
        }
        const isFirstAddress = user.addresses.length === 0;
        user.addresses.push({
            label: label || 'Home',
            fullAddress,
            landmark: landmark || '',
            locationId: location._id,
            locationName: location.name,
            isDefault: isFirstAddress,
        });
        await user.save();
        res.status(201).json({
            success: true,
            message: 'Address added successfully.',
            addresses: user.addresses,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message || 'Failed to add address' });
    }
};
exports.addAddress = addAddress;
// Delete address
const deleteAddress = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { addressId } = req.params;
        const user = await User_1.User.findById(userId);
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found.' });
            return;
        }
        user.addresses = user.addresses.filter((addr) => addr._id?.toString() !== addressId);
        await user.save();
        res.json({
            success: true,
            message: 'Address removed successfully.',
            addresses: user.addresses,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to remove address' });
    }
};
exports.deleteAddress = deleteAddress;
