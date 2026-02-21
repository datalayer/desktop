#!/usr/bin/env node

/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Post-build script to fix issues in production bundles.
 * Currently handles:
 * - Removing problematic @primer/react-brand CSS imports
 *
 * NOTE: Symbol polyfills, lodash TDZ fixes, and base$X renaming were removed
 * because esbuild-cjs-to-esm now pre-bundles CJS packages cleanly, and
 * Electron's Chromium has full native Symbol support.
 */

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

console.log('🔧 Starting post-build bundle fixes...');

async function fixBundle() {
  try {
    const distPath = path.join(__dirname, '..', 'dist', 'renderer', 'assets');
    const jsFiles = await glob('*.js', { cwd: distPath });

    if (jsFiles.length === 0) {
      console.log('❌ No bundle files found');
      return false;
    }

    console.log(`🔍 Found ${jsFiles.length} JS files to check`);

    let fixedFiles = 0;

    for (const file of jsFiles) {
      const filePath = path.join(distPath, file);
      let content = fs.readFileSync(filePath, 'utf8');
      let modified = false;

      // Remove problematic @primer/react-brand CSS import
      if (content.includes('@primer/react-brand/lib/css/main.css')) {
        console.log(`🎯 Fixing CSS import in: ${file}`);
        content = content.replace(
          /import\s+['"]@primer\/react-brand\/lib\/css\/main\.css['"];?\s*/g,
          '// Removed problematic CSS import: @primer/react-brand/lib/css/main.css\n'
        );
        modified = true;
        fixedFiles++;
      }

      if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✅ Fixed: ${file}`);
      }
    }

    if (fixedFiles > 0) {
      console.log(`🎉 Fixed ${fixedFiles} files with CSS import issues`);
    } else {
      console.log('✅ No issues found');
    }

    console.log('🎉 Post-build fixes completed!');
    return true;
  } catch (error) {
    console.error('❌ Error fixing bundle:', error);
    return false;
  }
}

fixBundle().then(success => {
  process.exit(success ? 0 : 1);
});
