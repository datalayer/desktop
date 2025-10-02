/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

import { ILifecycle } from './ILifecycle';
import { User } from '../../../shared/types';

/**
 * Authentication state.
 */
export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  runUrl: string;
}

/**
 * Authentication state change event.
 */
export interface AuthStateChange {
  previous: AuthState;
  current: AuthState;
}

/**
 * Authentication service interface.
 * Manages user authentication and session state.
 */
export interface IAuthService extends ILifecycle {
  /**
   * Get current authentication state.
   */
  getAuthState(): Promise<AuthState>;

  /**
   * Login user with provided credentials.
   */
  login(runUrl: string, token: string): Promise<User>;

  /**
   * Logout current user.
   */
  logout(): Promise<void>;

  /**
   * Check if user is authenticated.
   */
  isAuthenticated(): boolean;

  /**
   * Get current user.
   */
  getCurrentUser(): User | null;

  /**
   * Subscribe to authentication state changes.
   */
  onAuthStateChanged(callback: (change: AuthStateChange) => void): () => void;
}
