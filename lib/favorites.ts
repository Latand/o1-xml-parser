"use client";

import { encrypt, decrypt } from "./crypto";

export interface FavoriteServer {
  name: string;
  host: string;
  port: string;
  username: string;
  password?: string;
  identityFile?: string;
  lastUsed?: number; // Timestamp of last use
  lastDirectory?: string; // Last accessed directory
  lastRootDirectory?: string; // Last selected root directory
}

const STORAGE_KEY = "ssh-favorites";

// Get all favorite servers
export function getFavoriteServers(): FavoriteServer[] {
  if (typeof window === "undefined") return [];

  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];

  try {
    const servers = JSON.parse(stored) as FavoriteServer[];
    return servers.map((server) => ({
      ...server,
      password: server.password ? decrypt(server.password) : undefined,
    }));
  } catch {
    return [];
  }
}

// Get favorite servers sorted by last used (most recent first)
export function getRecentFavoriteServers(): FavoriteServer[] {
  const servers = getFavoriteServers();
  return servers.sort((a, b) => {
    const aTime = a.lastUsed || 0;
    const bTime = b.lastUsed || 0;
    return bTime - aTime;
  });
}

// Add or update a favorite server
export function addFavoriteServer(server: FavoriteServer) {
  const favorites = getFavoriteServers();
  const exists = favorites.some((f) => f.name === server.name);

  const serverToSave = {
    ...server,
    password: server.password ? encrypt(server.password) : undefined,
    lastUsed: Date.now(),
  };

  if (!exists) {
    favorites.push(serverToSave);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  } else {
    // Update existing server
    const updated = favorites.map((f) =>
      f.name === server.name ? serverToSave : f
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }
}

// Update the last used timestamp for a server
export function updateServerLastUsed(name: string) {
  const favorites = getFavoriteServers();
  const updated = favorites.map((f) => {
    if (f.name === name) {
      return {
        ...f,
        lastUsed: Date.now(),
        password: f.password ? encrypt(f.password) : undefined,
      };
    }
    return {
      ...f,
      password: f.password ? encrypt(f.password) : undefined,
    };
  });

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

// Update the last accessed directory for a server
export function updateServerLastDirectory(name: string, directory: string) {
  const favorites = getFavoriteServers();
  const updated = favorites.map((f) => {
    if (f.name === name) {
      return {
        ...f,
        lastDirectory: directory,
        lastUsed: Date.now(),
        password: f.password ? encrypt(f.password) : undefined,
      };
    }
    return {
      ...f,
      password: f.password ? encrypt(f.password) : undefined,
    };
  });

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

// Get the last accessed directory for a server
export function getServerLastDirectory(name: string): string | undefined {
  const favorites = getFavoriteServers();
  const server = favorites.find((f) => f.name === name);
  return server?.lastDirectory;
}

// Remove a favorite server
export function removeFavoriteServer(name: string) {
  const favorites = getFavoriteServers();
  const filtered = favorites.filter((f) => f.name !== name);

  // Re-encrypt passwords before saving
  const toSave = filtered.map((f) => ({
    ...f,
    password: f.password ? encrypt(f.password) : undefined,
  }));

  localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
}

// Check if a server is in favorites
export function isFavoriteServer(name: string): boolean {
  const favorites = getFavoriteServers();
  return favorites.some((f) => f.name === name);
}

// Rename a favorite server
export function renameFavoriteServer(
  oldName: string,
  newName: string
): boolean {
  if (oldName === newName) return true;

  const favorites = getFavoriteServers();

  // Check if new name already exists
  if (favorites.some((f) => f.name === newName)) {
    return false;
  }

  const updated = favorites.map((f) => {
    if (f.name === oldName) {
      return {
        ...f,
        name: newName,
        password: f.password ? encrypt(f.password) : undefined,
      };
    }
    return {
      ...f,
      password: f.password ? encrypt(f.password) : undefined,
    };
  });

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return true;
}

// Update the last root directory for a server
export function updateServerLastRootDirectory(
  name: string,
  rootDirectory: string | null
) {
  const favorites = getFavoriteServers();
  const updated = favorites.map((f) => {
    if (f.name === name) {
      return {
        ...f,
        lastRootDirectory: rootDirectory || undefined,
        lastUsed: Date.now(),
        password: f.password ? encrypt(f.password) : undefined,
      };
    }
    return {
      ...f,
      password: f.password ? encrypt(f.password) : undefined,
    };
  });

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

// Get the last root directory for a server
export function getServerLastRootDirectory(name: string): string | undefined {
  const favorites = getFavoriteServers();
  const server = favorites.find((f) => f.name === name);
  return server?.lastRootDirectory;
}
