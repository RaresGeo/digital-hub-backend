import { connect, Redis } from "../deps.ts";
import { createLogger } from "../utils/logger.ts";

const logger = createLogger("cache");

export const VERIFIER_PREFIX = "oauth_verifier:";
export const REDIRECT_TO_PREFIX = "redirect_to:";
export const VERIFIER_TTL = 600;

export interface CacheOptions {
  host: string;
  port: number;
  password?: string;
  ttl?: number; // Default TTL in seconds
}

export class CacheClient {
  private client: Redis | null = null;
  private defaultTTL: number;
  private isConnected = false;

  constructor(private options: CacheOptions) {
    this.defaultTTL = options.ttl || 600; // Default 10 minutes
  }

  async connect(): Promise<void> {
    try {
      this.client = await connect({
        hostname: this.options.host,
        port: this.options.port,
        password: this.options.password,
      });
      this.isConnected = true;
      logger.info("Connected to KeyDB cache");
    } catch (error) {
      logger.error("Failed to connect to KeyDB cache", { error });
      throw error;
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      const expiry = ttl || this.defaultTTL;
      await this.client!.set(key, value, { ex: expiry });
      logger.debug("Stored value in cache", { key, ttl: expiry });
    } catch (error) {
      logger.error("Failed to store value in cache", { key, error });
      throw error;
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      const value = await this.client!.get(key);
      logger.debug("Retrieved value from cache", { key, found: !!value });
      return value;
    } catch (error) {
      logger.error("Failed to retrieve value from cache", { key, error });
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      await this.client!.del(key);
      logger.debug("Deleted value from cache", { key });
    } catch (error) {
      logger.error("Failed to delete value from cache", { key, error });
      throw error;
    }
  }

  disconnect(): void {
    if (this.isConnected && this.client) {
      this.client.close();
      this.isConnected = false;
      logger.info("Disconnected from KeyDB cache");
    }
  }
}

// Create a singleton instance
let cacheClient: CacheClient | null = null;

export function getCache(options?: CacheOptions): CacheClient {
  if (!cacheClient) {
    const defaultOptions: CacheOptions = {
      host: Deno.env.get("KEYDB_HOST") || "localhost",
      port: parseInt(Deno.env.get("KEYDB_PORT") || "6379"),
      password: Deno.env.get("KEYDB_PASSWORD"),
      ttl: parseInt(Deno.env.get("KEYDB_DEFAULT_TTL") || "600"),
    };

    cacheClient = new CacheClient(options || defaultOptions);
  }

  return cacheClient;
}
