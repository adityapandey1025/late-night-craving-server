"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONFIG = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
exports.CONFIG = {
    PORT: process.env.PORT || 5000,
    NODE_ENV: process.env.NODE_ENV || 'development',
    MONGODB_URI: process.env.MONGODB_URI,
    JWT_SECRET: process.env.JWT_SECRET || 'late_night_craving_jwt_secret_token_key_2026',
    JWT_EXPIRES_IN: '7d',
    CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
    ADMIN_SEEDS: [
        {
            name: 'Aditya',
            email: 'aditya@latenightcraving.com',
            phone: '+919876543210',
            password: process.env.ADMIN_ADITYA_PASSWORD || 'Admin@123',
            upiId: 'aditya@okhdfcbank',
            upiName: 'Aditya (lateNightCraving)',
        },
        {
            name: 'Amlesh',
            email: 'amlesh@latenightcraving.com',
            phone: '+919876543211',
            password: process.env.ADMIN_AMLESH_PASSWORD || 'Admin@123',
            upiId: 'amlesh@oksbi',
            upiName: 'Amlesh (lateNightCraving)',
        },
    ],
};
