/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * WebSocket message types for Jupyter kernel communication.
 * Provides proper typing for WebSocket events and data.
 *
 * @module types/websocket
 */

/**
 * WebSocket message data types.
 * Can be string, binary data, or Node.js Buffer serialized format.
 */
export type WebSocketData =
  | string
  | ArrayBuffer
  | Uint8Array
  | {
      type: 'Buffer';
      data: number[];
    };

/**
 * WebSocket event types.
 */
export type WebSocketEventType = 'open' | 'message' | 'error' | 'close';

/**
 * WebSocket event from main process.
 */
export interface WebSocketEvent {
  id: string;
  type: WebSocketEventType;
  data?: WebSocketData;
  error?: string;
  code?: number;
  reason?: string;
}

/**
 * WebSocket send options.
 */
export interface WebSocketSendOptions {
  id: string;
  data: WebSocketData;
}

/**
 * WebSocket close options.
 */
export interface WebSocketCloseOptions {
  id: string;
  code?: number;
  reason?: string;
}

/**
 * Type guard to check if data is a Buffer-like object.
 */
export function isBufferLike(
  data: unknown
): data is { type: 'Buffer'; data: number[] } {
  return (
    typeof data === 'object' &&
    data !== null &&
    'type' in data &&
    data.type === 'Buffer' &&
    'data' in data &&
    Array.isArray(data.data)
  );
}

/**
 * Type guard to check if data is an ArrayBuffer-like object.
 */
export function isArrayBufferLike(
  data: unknown
): data is { type: 'ArrayBuffer'; data: number[] } {
  return (
    typeof data === 'object' &&
    data !== null &&
    'type' in data &&
    data.type === 'ArrayBuffer' &&
    'data' in data &&
    Array.isArray(data.data)
  );
}

/**
 * Convert WebSocket data to appropriate format for transmission.
 */
export function normalizeWebSocketData(data: WebSocketData): WebSocketData {
  if (isBufferLike(data)) {
    // Convert Buffer-like to Uint8Array
    return new Uint8Array(data.data);
  }
  return data;
}
