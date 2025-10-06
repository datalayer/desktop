/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * @module contexts/ServiceContext
 *
 * React context for dependency injection.
 * Provides ServiceContainer to all components.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  IServiceContainer,
  ServiceContainer,
} from '../services/core/ServiceContainer';

/**
 * Service context for dependency injection.
 */
const ServiceContext = createContext<IServiceContainer | null>(null);

/**
 * Props for ServiceProvider.
 */
interface ServiceProviderProps {
  children: React.ReactNode;
}

/**
 * Service provider component.
 * Initializes and provides ServiceContainer to all child components.
 *
 * @example
 * ```tsx
 * <ServiceProvider>
 *   <App />
 * </ServiceProvider>
 * ```
 */
export const ServiceProvider: React.FC<ServiceProviderProps> = ({
  children,
}) => {
  const [container, setContainer] = useState<IServiceContainer | null>(null);
  const [_isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initializeServices = async (): Promise<void> => {
      // Wait for window.datalayerClient to be available (set by main process SDK bridge)
      if (
        !(window.datalayerClient as unknown as import('@datalayer/core/lib/client').DatalayerClient)
      ) {
        console.warn('ServiceProvider: SDK not available yet, waiting...');
        // Retry in a moment
        setTimeout(initializeServices, 100);
        return;
      }

      try {
        // Create and initialize service container
        const serviceContainer = new ServiceContainer(
          window.datalayerClient as unknown as import('@datalayer/core/lib/client').DatalayerClient
        );
        await serviceContainer.initialize();

        setContainer(serviceContainer);
        setIsInitialized(true);

        console.log('ServiceProvider: Services initialized successfully');
      } catch (error) {
        console.error('ServiceProvider: Failed to initialize services', error);
      }
    };

    initializeServices();

    // Cleanup on unmount
    return () => {
      if (container) {
        container.dispose().catch(error => {
          console.error('ServiceProvider: Error disposing services', error);
        });
      }
    };
  }, []); // Run once on mount

  // Always render children - let components handle when services aren't ready
  // This allows the login screen to render before services are initialized
  return (
    <ServiceContext.Provider value={container}>
      {children}
    </ServiceContext.Provider>
  );
};

/**
 * Hook to access services from any component.
 *
 * @example
 * ```tsx
 * const MyComponent: React.FC = () => {
 *   const services = useServices();
 *
 *   const handleLogin = async () => {
 *     await services.authService.login(runUrl, token);
 *   };
 *
 *   return <button onClick={handleLogin}>Login</button>;
 * };
 * ```
 */
export const useServices = (): IServiceContainer | null => {
  const context = useContext(ServiceContext);
  return context;
};

/**
 * Hook to access a specific service with automatic initialization.
 *
 * @example
 * ```tsx
 * const MyComponent: React.FC = () => {
 *   const authService = useService('authService');
 *
 *   useEffect(() => {
 *     authService.initialize();
 *   }, [authService]);
 *
 *   return <div>...</div>;
 * };
 * ```
 */
export const useService = <K extends keyof IServiceContainer>(
  serviceName: K
): IServiceContainer[K] | null => {
  const services = useServices();
  return services ? services[serviceName] : null;
};
