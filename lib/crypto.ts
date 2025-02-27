"use client";

// Simple encryption key - in a real app, this should be more secure
const ENCRYPTION_KEY = "xml-parser-app-key";

export function encrypt(text: string): string {
  if (!text) return "";

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
