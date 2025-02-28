"use client";

// Generate a more secure encryption key based on browser fingerprinting
function generateSecureKey(): string {
  if (typeof window === "undefined") return "default-key";

  // Combine various browser properties to create a unique fingerprint
  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.colorDepth,
    screen.width,
    screen.height,
    new Date().getTimezoneOffset(),
    "o1-xml-parser-secure-salt", // Add a fixed salt
  ].join("|");

  // Create a hash of the fingerprint
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  // Convert hash to hex string and use as key
  return Math.abs(hash).toString(16).padStart(8, "0") + "-xml-parser-key";
}

// Get or create the encryption key
const getEncryptionKey = (): string => {
  if (typeof window === "undefined") return "default-key";

  const storageKey = "xml-parser-encryption-key";
  let key = localStorage.getItem(storageKey);

  if (!key) {
    key = generateSecureKey();
    localStorage.setItem(storageKey, key);
  }

  return key;
};

export function encrypt(text: string): string {
  if (!text) return "";

  const ENCRYPTION_KEY = getEncryptionKey();

  // Helper functions for encryption
  const textToChars = (text: string) =>
    text.split("").map((c) => c.charCodeAt(0));
  const byteHex = (n: number) => ("0" + Number(n).toString(16)).substr(-2);

  // Apply XOR with the encryption key
  const applySaltToChar = (char: number) => {
    const key = textToChars(ENCRYPTION_KEY);
    return key.reduce((a, b) => a ^ b, char);
  };

  // Map each character to its encrypted hex representation
  return text
    .split("")
    .map((c) => textToChars(c)[0]) // Get charCode for each character
    .map(applySaltToChar) // Apply XOR encryption with key
    .map(byteHex) // Convert to hex
    .join(""); // Join into a string
}

export function decrypt(encoded: string): string {
  if (!encoded) return "";

  const ENCRYPTION_KEY = getEncryptionKey();

  // Helper functions for decryption
  const textToChars = (text: string) =>
    text.split("").map((c) => c.charCodeAt(0));

  // Apply XOR with the encryption key (same as for encryption)
  const applySaltToChar = (char: number) => {
    const key = textToChars(ENCRYPTION_KEY);
    return key.reduce((a, b) => a ^ b, char);
  };

  // Process the hex string back to characters
  const hexChars = encoded.match(/.{1,2}/g) || [];
  return hexChars
    .map((hex) => parseInt(hex, 16)) // Convert from hex to number
    .map(applySaltToChar) // Apply XOR decryption with key
    .map((charCode) => String.fromCharCode(charCode)) // Convert back to character
    .join(""); // Join into a string
}
