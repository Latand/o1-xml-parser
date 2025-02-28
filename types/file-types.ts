export interface FileStats {
  lines: number;
  characters: number;
  tokens: number;
  files: number;
  fileStats: Array<{
    path: string;
    characters: number;
  }>;
}

export interface SSHConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  passphrase?: string;
  identityFile?: string;
}

export interface FileCache {
  [filePath: string]: {
    lines: number;
    characters: number;
    tokens: number;
  };
}
