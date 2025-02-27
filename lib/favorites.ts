"use client";

import { encrypt, decrypt } from "./crypto";

interface FavoriteServer {
  name: string;
  host: string;
  port: string;
  username: string;
  password?: string;
  identityFile?: string;
}

const STORAGE_KEY = "ssh-favorites";

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

export function addFavoriteServer(server: FavoriteServer) {
  const favorites = getFavoriteServers();
  const exists = favorites.some((f) => f.name === server.name);

  const serverToSave = {
    ...server,
    password: server.password ? encrypt(server.password) : undefined,
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

export function removeFavoriteServer(name: string) {
  const favorites = getFavoriteServers();
  const filtered = favorites.filter((f) => f.name !== name);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export function isFavoriteServer(name: string): boolean {
  const favorites = getFavoriteServers();
  return favorites.some((f) => f.name === name);
}
