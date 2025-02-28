"use client";

import { FavoriteServer } from "./favorites";

// Session storage keys
const SESSION_KEY = "app-session";
const SELECTED_FILES_KEY = "selected-files";
const ROOT_DIR_KEY = "root-dir";
const ACTIVE_TAB_KEY = "active-tab";
const BROWSER_TAB_KEY = "browser-tab";
const SSH_CONFIG_KEY = "ssh-config";
const PROJECT_DIR_KEY = "project-dir";
const TASK_PROMPT_KEY = "task-prompt";
const IS_CONNECTED_KEY = "is-connected";

// Session interfaces
export interface SSHConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  passphrase?: string;
  identityFile?: string;
  privateKey?: string;
}

export interface SessionState {
  selectedFiles: string[];
  rootDir: string | null;
  activeTab: string;
  browserTab: "local" | "remote";
  sshConfig: SSHConfig | null;
  projectDirectory: string;
  taskPrompt: string;
  isConnected: boolean;
}

// Default session state
const defaultSessionState: SessionState = {
  selectedFiles: [],
  rootDir: null,
  activeTab: "browser",
  browserTab: "local",
  sshConfig: null,
  projectDirectory: "",
  taskPrompt: "",
  isConnected: false,
};

// Save the entire session state
export function saveSessionState(state: SessionState): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("Failed to save session state:", error);
  }
}

// Load the entire session state
export function loadSessionState(): SessionState {
  if (typeof window === "undefined") return { ...defaultSessionState };

  try {
    const stored = localStorage.getItem(SESSION_KEY);
    if (!stored) return { ...defaultSessionState };

    return JSON.parse(stored) as SessionState;
  } catch (error) {
    console.error("Failed to load session state:", error);
    return { ...defaultSessionState };
  }
}

// Individual state setters and getters
export function saveSelectedFiles(files: string[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SELECTED_FILES_KEY, JSON.stringify(files));

    // Also update the full session
    const session = loadSessionState();
    saveSessionState({
      ...session,
      selectedFiles: files,
    });
  } catch (error) {
    console.error("Failed to save selected files:", error);
  }
}

export function loadSelectedFiles(): string[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(SELECTED_FILES_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as string[];
  } catch (error) {
    console.error("Failed to load selected files:", error);
    return [];
  }
}

export function saveRootDir(rootDir: string | null): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(ROOT_DIR_KEY, rootDir || "");

    // Also update the full session
    const session = loadSessionState();
    saveSessionState({
      ...session,
      rootDir,
    });
  } catch (error) {
    console.error("Failed to save root directory:", error);
  }
}

export function loadRootDir(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = localStorage.getItem(ROOT_DIR_KEY);
    if (!stored) return null;
    return stored || null;
  } catch (error) {
    console.error("Failed to load root directory:", error);
    return null;
  }
}

export function saveActiveTab(tab: string): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(ACTIVE_TAB_KEY, tab);

    // Also update the full session
    const session = loadSessionState();
    saveSessionState({
      ...session,
      activeTab: tab,
    });
  } catch (error) {
    console.error("Failed to save active tab:", error);
  }
}

export function loadActiveTab(): string {
  if (typeof window === "undefined") return defaultSessionState.activeTab;

  try {
    const stored = localStorage.getItem(ACTIVE_TAB_KEY);
    if (!stored) return defaultSessionState.activeTab;
    return stored;
  } catch (error) {
    console.error("Failed to load active tab:", error);
    return defaultSessionState.activeTab;
  }
}

export function saveBrowserTab(tab: "local" | "remote"): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(BROWSER_TAB_KEY, tab);

    // Also update the full session
    const session = loadSessionState();
    saveSessionState({
      ...session,
      browserTab: tab,
    });
  } catch (error) {
    console.error("Failed to save browser tab:", error);
  }
}

export function loadBrowserTab(): "local" | "remote" {
  if (typeof window === "undefined") return defaultSessionState.browserTab;

  try {
    const stored = localStorage.getItem(BROWSER_TAB_KEY) as "local" | "remote";
    if (!stored) return defaultSessionState.browserTab;
    return stored;
  } catch (error) {
    console.error("Failed to load browser tab:", error);
    return defaultSessionState.browserTab;
  }
}

export function saveSSHConfig(config: SSHConfig | null): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(SSH_CONFIG_KEY, config ? JSON.stringify(config) : "");

    // Also update the full session
    const session = loadSessionState();
    saveSessionState({
      ...session,
      sshConfig: config,
    });
  } catch (error) {
    console.error("Failed to save SSH config:", error);
  }
}

export function loadSSHConfig(): SSHConfig | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = localStorage.getItem(SSH_CONFIG_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as SSHConfig;
  } catch (error) {
    console.error("Failed to load SSH config:", error);
    return null;
  }
}

export function saveProjectDirectory(dir: string): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(PROJECT_DIR_KEY, dir);

    // Also update the full session
    const session = loadSessionState();
    saveSessionState({
      ...session,
      projectDirectory: dir,
    });
  } catch (error) {
    console.error("Failed to save project directory:", error);
  }
}

export function loadProjectDirectory(): string {
  if (typeof window === "undefined") return "";

  try {
    const stored = localStorage.getItem(PROJECT_DIR_KEY);
    if (!stored) return "";
    return stored;
  } catch (error) {
    console.error("Failed to load project directory:", error);
    return "";
  }
}

export function saveTaskPrompt(prompt: string): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(TASK_PROMPT_KEY, prompt);

    // Also update the full session
    const session = loadSessionState();
    saveSessionState({
      ...session,
      taskPrompt: prompt,
    });
  } catch (error) {
    console.error("Failed to save task prompt:", error);
  }
}

export function loadTaskPrompt(): string {
  if (typeof window === "undefined") return "";

  try {
    const stored = localStorage.getItem(TASK_PROMPT_KEY);
    if (!stored) return "";
    return stored;
  } catch (error) {
    console.error("Failed to load task prompt:", error);
    return "";
  }
}

export function saveConnectionStatus(isConnected: boolean): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(IS_CONNECTED_KEY, isConnected ? "true" : "false");

    // Also update the full session
    const session = loadSessionState();
    saveSessionState({
      ...session,
      isConnected,
    });
  } catch (error) {
    console.error("Failed to save connection status:", error);
  }
}

export function loadConnectionStatus(): boolean {
  if (typeof window === "undefined") return false;

  try {
    const stored = localStorage.getItem(IS_CONNECTED_KEY);
    if (!stored) return false;
    return stored === "true";
  } catch (error) {
    console.error("Failed to load connection status:", error);
    return false;
  }
}

// Clear all session data
export function clearSessionState(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SELECTED_FILES_KEY);
    localStorage.removeItem(ROOT_DIR_KEY);
    localStorage.removeItem(ACTIVE_TAB_KEY);
    localStorage.removeItem(BROWSER_TAB_KEY);
    localStorage.removeItem(SSH_CONFIG_KEY);
    localStorage.removeItem(PROJECT_DIR_KEY);
    localStorage.removeItem(TASK_PROMPT_KEY);
    localStorage.removeItem(IS_CONNECTED_KEY);
  } catch (error) {
    console.error("Failed to clear session state:", error);
  }
}
