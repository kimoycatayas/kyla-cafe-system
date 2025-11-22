import * as SecureStore from 'expo-secure-store';
import type { User } from './authClient';

/**
 * Secure storage utilities for tokens and user data
 */

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_KEY = 'user_data';

export const storage = {
  /**
   * Store access token securely
   */
  async setAccessToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
  },

  /**
   * Get access token
   */
  async getAccessToken(): Promise<string | null> {
    return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  },

  /**
   * Store refresh token securely
   */
  async setRefreshToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
  },

  /**
   * Get refresh token
   */
  async getRefreshToken(): Promise<string | null> {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  },

  /**
   * Remove access token
   */
  async removeAccessToken(): Promise<void> {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  },

  /**
   * Remove refresh token
   */
  async removeRefreshToken(): Promise<void> {
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  },

  /**
   * Clear all tokens (logout)
   */
  async clearTokens(): Promise<void> {
    await Promise.all([
      this.removeAccessToken(),
      this.removeRefreshToken(),
      this.removeUser(),
    ]);
  },

  /**
   * Store user data
   */
  async setUser(user: User): Promise<void> {
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
  },

  /**
   * Get user data
   */
  async getUser(): Promise<User | null> {
    const userData = await SecureStore.getItemAsync(USER_KEY);
    if (!userData) {
      return null;
    }
    try {
      return JSON.parse(userData) as User;
    } catch {
      return null;
    }
  },

  /**
   * Remove user data
   */
  async removeUser(): Promise<void> {
    await SecureStore.deleteItemAsync(USER_KEY);
  },
};

