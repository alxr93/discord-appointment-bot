const CryptoJS = require('crypto-js');
require('dotenv').config();

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY) {
  throw new Error('ENCRYPTION_KEY environment variable is required');
}

function encrypt(text) {
  if (!text) return null;
  
  try {
    const encrypted = CryptoJS.AES.encrypt(JSON.stringify(text), ENCRYPTION_KEY).toString();
    return encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

function decrypt(encryptedText) {
  if (!encryptedText) return null;
  
  try {
    const decrypted = CryptoJS.AES.decrypt(encryptedText, ENCRYPTION_KEY);
    const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);
    return JSON.parse(decryptedString);
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

module.exports = {
  encrypt,
  decrypt
};