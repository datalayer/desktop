/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Warning component displayed when user is not authenticated.
 *
 * @module renderer/components/environments/AuthWarning
 */

import React from 'react';
import { Flash } from '@primer/react';
import { AlertIcon } from '@primer/octicons-react';

/**
 * Authentication warning component.
 */
const AuthWarning: React.FC = () => {
  return (
    <Flash variant="warning" sx={{ mb: 3 }}>
      <AlertIcon /> Please login to view and select runtime environments
    </Flash>
  );
};

export default AuthWarning;
