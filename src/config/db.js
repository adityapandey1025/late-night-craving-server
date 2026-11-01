"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = connectDB;
exports.disconnectDB = disconnectDB;
const mongoose_1 = __importDefault(require("mongoose"));
const fs_1 = __importDefault(require("fs"));
async function connectDB() {
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lateNightCraving';
    if (uri) {
        try {
            console.log(`Connecting to configured MongoDB URI: ${uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@')}`);
            await mongoose_1.default.connect(uri, {
                serverSelectionTimeoutMS: 5000,
            });
            console.log('MongoDB connected successfully via MONGODB_URI');
            return;
        }
        catch (err) {
            console.warn(`MongoDB connection failed: ${err.message}.`);
        }
    }
    throw new Error('MongoDB connection failed. Check MONGODB_URI and make sure MongoDB is running.');
}
async function disconnectDB() {
    await mongoose_1.default.disconnect();
}
