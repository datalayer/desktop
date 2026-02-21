/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { esbuildCjsToEsm } from './scripts/vite-plugin-esbuild-cjs.mjs';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import importAsString from 'vite-plugin-string';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin({
        exclude: ['@datalayer/core'],
      }),
      {
        name: 'copy-static-files',
        closeBundle() {
          // Ensure dist/main directory exists
          try {
            mkdirSync(resolve(__dirname, 'dist/main'), { recursive: true });
            // Copy about.html to dist/main
            copyFileSync(
              resolve(__dirname, 'src/main/dialogs/about/about.html'),
              resolve(__dirname, 'dist/main/about.html')
            );
            // Copy about.css to dist/main
            copyFileSync(
              resolve(__dirname, 'src/main/dialogs/about/about.css'),
              resolve(__dirname, 'dist/main/about.css')
            );
            // Copy about.js to dist/main
            copyFileSync(
              resolve(__dirname, 'src/main/dialogs/about/about.js'),
              resolve(__dirname, 'dist/main/about.js')
            );
            // Ensure resources directory exists in dist
            mkdirSync(resolve(__dirname, 'dist/resources'), { recursive: true });
            // Copy icon.png to dist/resources
            if (existsSync(resolve(__dirname, 'resources/icon.png'))) {
              copyFileSync(
                resolve(__dirname, 'resources/icon.png'),
                resolve(__dirname, 'dist/resources/icon.png')
              );
            }
          } catch (err) {
            console.error('Failed to copy static files:', err);
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@datalayer/core': resolve(__dirname, '../core'),
      },
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
    },
    build: {
      outDir: 'dist/main',
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts'),
        },
      },
    },
  },
  preload: {
    plugins: [
      externalizeDepsPlugin({
        exclude: ['@datalayer/core'],
      }),
    ],
    resolve: {
      alias: {
        '@datalayer/core': resolve(__dirname, '../core'),
      },
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
    },
    build: {
      outDir: 'dist/preload',
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts'),
          about: resolve(__dirname, 'src/preload/about.js'),
        },
      },
    },
  },
  renderer: {
    root: 'src/renderer',
    define: {
      __webpack_public_path__: '""',
      'process.env.NODE_ENV': JSON.stringify(
        process.env.NODE_ENV || 'production'
      ),
      global: 'globalThis',
      __dirname: '""',
    },
    esbuild: {
      // Ensure native globals are preserved
      keepNames: true,
    },
    publicDir: '../../resources',
    build: {
      outDir: 'dist/renderer',
      target: 'esnext', // Use modern JS to avoid polyfill conflicts
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
        },
        external: [
          'next/link',
          '@react-navigation/native',
          '@react-navigation/stack',
          '@jupyterlite/pyodide-kernel',
          '@jupyterlite/kernel',
          'prettier/parser-postcss',
          'prettier/parser-html',
          'prettier/parser-babel',
          'prettier/plugins/estree',
          'prettier/parser-markdown',
          'prettier/parser-typescript',
          'prettier/standalone',
          '@primer/react-brand/lib/css/main.css',
          /\.whl$/,
        ],
        plugins: [
          // Pre-bundle CJS packages to ESM BEFORE rollup sees them
          esbuildCjsToEsm({
            rootDir: resolve(__dirname, '../../..'),
            force: process.env.ESBUILD_CJS_FORCE === '1',
          }),
          // commonjs plugin REMOVED — esbuild-cjs-to-esm handles CJS→ESM conversion
          // The commonjs plugin's internal [commonjs--resolver] was conflicting
          // with esbuild-cjs-to-esm by re-resolving imports to filesystem paths
        ] as any,
        onwarn(warning, warn) {
          // Suppress "use of eval" warnings
          if (warning.message.includes('Use of eval')) return;
          warn(warning);
        },
      },
    },
    plugins: [
      // Pre-bundle problematic CJS packages into ESM using esbuild
      esbuildCjsToEsm({
        rootDir: resolve(__dirname, '../../..'),
        force: process.env.ESBUILD_CJS_FORCE === '1',
      }) as any,
      {
        name: 'fix-sanitize-html-postcss',
        enforce: 'pre',
        resolveId(id: string) {
          // Intercept postcss and source-map-js to prevent externalization
          if (id === 'postcss' || id.startsWith('postcss/')) {
            return { id: '\0virtual:postcss-stub', external: false };
          }
          if (id === 'source-map-js') {
            return { id: '\0virtual:source-map-js-stub', external: false };
          }
          // Intercept Next.js imports for Electron compatibility
          if (id === 'next/navigation') {
            return { id: '\0virtual:next-navigation-stub', external: false };
          }
          if (id === 'next/router') {
            return { id: '\0virtual:next-router-stub', external: false };
          }
          // Intercept react-router-dom for Electron compatibility
          if (id === 'react-router-dom') {
            return { id: '\0virtual:react-router-dom-stub', external: false };
          }
          // Intercept typestyle for compatibility issues
          if (id === 'typestyle' || id.includes('typestyle/lib')) {
            return { id: '\0virtual:typestyle-stub', external: false };
          }
          // Intercept jsonpointer for compatibility issues
          if (id === 'jsonpointer') {
            return { id: '\0virtual:jsonpointer-stub', external: false };
          }
          return null;
        },
        load(id: string) {
          if (id === '\0virtual:postcss-stub') {
            // Provide a minimal postcss stub for sanitize-html
            return `
              export const parse = () => ({});
              export const stringify = () => '';
              export default { parse, stringify };
            `;
          }
          if (id === '\0virtual:source-map-js-stub') {
            // Provide a minimal source-map stub
            return `
              export class SourceMapConsumer {
                constructor() {}
                destroy() {}
              }
              export class SourceMapGenerator {
                constructor() {}
                addMapping() {}
                toString() { return ''; }
              }
              export default { SourceMapConsumer, SourceMapGenerator };
            `;
          }
          if (id === '\0virtual:next-navigation-stub') {
            // Provide Next.js navigation stubs for Electron compatibility
            return `
              // Mock Next.js navigation hooks for Electron
              export function useRouter() {
                return {
                  push: (path) => console.warn('[Electron] useRouter.push() called with:', path),
                  replace: (path) => console.warn('[Electron] useRouter.replace() called with:', path),
                  back: () => console.warn('[Electron] useRouter.back() called'),
                  forward: () => console.warn('[Electron] useRouter.forward() called'),
                  refresh: () => console.warn('[Electron] useRouter.refresh() called'),
                  pathname: '/',
                  query: {},
                  asPath: '/',
                };
              }

              export function usePathname() {
                return '/';
              }

              export function useSearchParams() {
                return new URLSearchParams();
              }

              export function redirect(path) {
                console.warn('[Electron] redirect() called with:', path);
              }

              export function notFound() {
                console.warn('[Electron] notFound() called');
              }
            `;
          }
          if (id === '\0virtual:next-router-stub') {
            // Provide Next.js router stubs for Electron compatibility
            return `
              // Mock Next.js Router for Electron
              export default {
                push: (path) => console.warn('[Electron] Router.push() called with:', path),
                replace: (path) => console.warn('[Electron] Router.replace() called with:', path),
                back: () => console.warn('[Electron] Router.back() called'),
                forward: () => console.warn('[Electron] Router.forward() called'),
                reload: () => console.warn('[Electron] Router.reload() called'),
                pathname: '/',
                query: {},
                asPath: '/',
                events: {
                  on: () => {},
                  off: () => {},
                  emit: () => {},
                },
              };

              export function withRouter(Component) {
                return Component;
              }
            `;
          }
          if (id === '\0virtual:react-router-dom-stub') {
            // Provide react-router-dom stubs for Electron compatibility
            return `
              // Mock react-router-dom for Electron
              export function BrowserRouter({ children }) {
                return children;
              }

              export function Routes({ children }) {
                return children;
              }

              export function Route({ children, element }) {
                return element || children;
              }

              export function Link({ to, children, ...props }) {
                return React.createElement('a', { href: to, ...props }, children);
              }

              export function NavLink({ to, children, ...props }) {
                return React.createElement('a', { href: to, ...props }, children);
              }

              export function Navigate({ to }) {
                console.warn('[Electron] Navigate called with:', to);
                return null;
              }

              export function Outlet() {
                return null;
              }

              export function useNavigate() {
                return (path) => console.warn('[Electron] useNavigate() called with:', path);
              }

              export function useParams() {
                return {};
              }

              export function useLocation() {
                return {
                  pathname: '/',
                  search: '',
                  hash: '',
                  state: null,
                  key: 'default'
                };
              }

              export function useSearchParams() {
                return [new URLSearchParams(), () => {}];
              }

              export function createBrowserRouter(routes) {
                return { routes };
              }

              export function RouterProvider({ router }) {
                return null;
              }

              // Legacy router compatibility
              export function Router({ children }) {
                return children;
              }

              export function Switch({ children }) {
                return children;
              }

              export function Redirect({ to }) {
                console.warn('[Electron] Redirect called with:', to);
                return null;
              }

              export function useHistory() {
                return {
                  push: (path) => console.warn('[Electron] history.push() called with:', path),
                  replace: (path) => console.warn('[Electron] history.replace() called with:', path),
                  go: (n) => console.warn('[Electron] history.go() called with:', n),
                  goBack: () => console.warn('[Electron] history.goBack() called'),
                  goForward: () => console.warn('[Electron] history.goForward() called'),
                  location: { pathname: '/', search: '', hash: '', state: null },
                };
              }

              export function useRouteMatch() {
                return {
                  params: {},
                  isExact: true,
                  path: '/',
                  url: '/'
                };
              }
            `;
          }
          if (id === '\0virtual:typestyle-stub') {
            // Provide typestyle stubs for compatibility
            return `
              // Mock typestyle for compatibility
              export function style(...args) {
                // Simple CSS class name generator
                const hash = Math.random().toString(36).substr(2, 9);
                return 'css-' + hash;
              }

              export function classes(...args) {
                return args.filter(Boolean).join(' ');
              }

              export function media(query, ...styles) {
                return {};
              }

              export function keyframes(frames) {
                const hash = Math.random().toString(36).substr(2, 9);
                return 'keyframes-' + hash;
              }

              export function cssRule(selector, ...styles) {
                return {};
              }

              export function forceRenderStyles() {
                // No-op in Electron
              }

              export function getStyles() {
                return '';
              }

              export function reinit() {
                // No-op in Electron
              }

              // Legacy/compatibility exports
              export const stylesheet = {
                style,
                classes,
                media,
                keyframes,
                cssRule
              };

              export default {
                style,
                classes,
                media,
                keyframes,
                cssRule,
                forceRenderStyles,
                getStyles,
                reinit
              };
            `;
          }
          if (id === '\0virtual:jsonpointer-stub') {
            // Provide jsonpointer stubs for compatibility
            return `
              // Mock jsonpointer for compatibility
              export function get(obj, pointer) {
                if (!pointer || pointer === '') return obj;
                const parts = pointer.split('/').slice(1);
                let result = obj;
                for (const part of parts) {
                  if (result == null) return undefined;
                  result = result[part];
                }
                return result;
              }

              export function set(obj, pointer, value) {
                if (!pointer || pointer === '') return obj;
                const parts = pointer.split('/').slice(1);
                let current = obj;
                for (let i = 0; i < parts.length - 1; i++) {
                  const part = parts[i];
                  if (!(part in current)) current[part] = {};
                  current = current[part];
                }
                current[parts[parts.length - 1]] = value;
                return obj;
              }

              export function has(obj, pointer) {
                return get(obj, pointer) !== undefined;
              }

              export function remove(obj, pointer) {
                if (!pointer || pointer === '') return obj;
                const parts = pointer.split('/').slice(1);
                let current = obj;
                for (let i = 0; i < parts.length - 1; i++) {
                  const part = parts[i];
                  if (!(part in current)) return obj;
                  current = current[part];
                }
                delete current[parts[parts.length - 1]];
                return obj;
              }

              // Default export for compatibility
              const jsonpointer = { get, set, has, remove };
              export default jsonpointer;
            `;
          }
          return null;
        },
      },
      {
        name: 'fix-prism-extend-calls',
        transform(code: string, id: string) {
          // Fix Prism extend calls in all files that contain them
          if (
            code.includes('extend: function(id, redef)') &&
            code.includes('_.util.clone(_.languages[id])')
          ) {
            console.log(`[Vite Plugin] Fixing Prism extend calls in ${id}`);

            const fixedCode = code.replace(
              /extend: function\(id, redef\) {\s*var lang2 = _\.util\.clone\(_\.languages\[id\]\);\s*for \(var key in redef\) {\s*lang2\[key\] = redef\[key\];\s*}\s*return lang2;\s*}/g,
              `extend: function(id, redef) {
            // Extending Prism language definition
            var baseLang = _.languages[id];
            if (!baseLang) {
              // Base language not found, creating empty base
              baseLang = {};
            }
            var lang2 = _.util.clone(baseLang);
            for (var key in redef) {
              if (redef.hasOwnProperty(key)) {
                // Setting language property
                lang2[key] = redef[key];
              }
            }
            // Language extension completed
            return lang2;
          }`
            );

            if (fixedCode !== code) {
              console.log(
                `[Vite Plugin] Successfully fixed Prism extend calls in ${id}`
              );
              return fixedCode;
            }
          }
          return null;
        },
      },
      {
        name: 'node-builtins-polyfill',
        enforce: 'pre',
        resolveId(id: string) {
          const builtins = [
            'path',
            'fs',
            'os',
            'util',
            'crypto',
            'stream',
            'events',
            'buffer',
          ];
          if (builtins.includes(id)) {
            return {
              id: `\0node-builtin:${id}`,
              external: false,
              moduleSideEffects: false,
            };
          }
          return null;
        },
        load(id: string) {
          if (id.startsWith('\0node-builtin:')) {
            const name = id.slice(14);

            if (name === 'path') {
              return `
                const pathModule = {
                  join: function(...parts) {
                    if (!parts || parts.length === 0) return '.';
                    return parts.filter(p => p != null && p !== '').join('/').replace(/\\/+/g, '/');
                  },
                  dirname: function(p) {
                    if (!p) return '.';
                    const i = p.lastIndexOf('/');
                    return i === -1 ? '.' : p.substring(0, i) || '/';
                  },
                  basename: function(p, ext) {
                    if (!p) return '';
                    const n = p.substring(p.lastIndexOf('/') + 1);
                    return ext && n.endsWith(ext) ? n.slice(0, -ext.length) : n;
                  },
                  extname: function(p) {
                    if (!p) return '';
                    const d = p.lastIndexOf('.');
                    const s = p.lastIndexOf('/');
                    return d > s ? p.substring(d) : '';
                  },
                  resolve: function(...paths) {
                    return '/' + paths.filter(p => p).join('/').replace(/\\/+/g, '/');
                  },
                  relative: function(from, to) { return to; },
                  normalize: function(path) {
                    if (!path || path === '') return '.';
                    const isAbsolute = path[0] === '/';
                    const parts = path.split('/').filter(p => p && p !== '.');
                    const result = [];
                    for (let i = 0; i < parts.length; i++) {
                      if (parts[i] === '..') {
                        if (result.length > 0 && result[result.length - 1] !== '..') {
                          result.pop();
                        } else if (!isAbsolute) {
                          result.push('..');
                        }
                      } else {
                        result.push(parts[i]);
                      }
                    }
                    let normalized = result.join('/');
                    if (isAbsolute) normalized = '/' + normalized;
                    else if (normalized === '') normalized = '.';
                    return normalized;
                  },
                  sep: '/',
                  delimiter: ':',
                  parse: function(p) {
                    return {
                      root: '',
                      dir: this.dirname(p),
                      base: this.basename(p),
                      ext: this.extname(p),
                      name: this.basename(p, this.extname(p))
                    };
                  },
                  posix: null
                };
                // Add self-reference for posix
                pathModule.posix = pathModule;

                // Ensure global availability
                if (typeof globalThis !== 'undefined' && !globalThis.path) {
                  globalThis.path = pathModule;
                }
                if (typeof window !== 'undefined' && !window.path) {
                  window.path = pathModule;
                }

                export default pathModule;
                export const { join, dirname, basename, extname, resolve, relative, normalize, sep, delimiter, parse, posix } = pathModule;
              `;
            }

            if (name === 'fs') {
              return `
                const fs = {
                  existsSync: () => false,
                  readFileSync: () => '',
                  writeFileSync: () => {},
                  mkdirSync: () => {},
                  readdirSync: () => [],
                  statSync: () => ({ isFile: () => false, isDirectory: () => false }),
                  unlinkSync: () => {},
                  rmSync: () => {},
                  promises: {
                    readFile: async () => '',
                    writeFile: async () => {},
                    mkdir: async () => {},
                    readdir: async () => [],
                    stat: async () => ({ isFile: () => false, isDirectory: () => false }),
                    unlink: async () => {},
                    rm: async () => {}
                  }
                };
                export default fs;
                export const { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, unlinkSync, rmSync, promises } = fs;
              `;
            }

            if (name === 'os') {
              return `
                const os = {
                  platform: () => 'darwin',
                  arch: () => 'arm64',
                  release: () => '1.0.0',
                  type: () => 'Darwin',
                  tmpdir: () => '/tmp',
                  homedir: () => '/home',
                  hostname: () => 'localhost',
                  endianness: () => 'LE'
                };
                export default os;
                export const { platform, arch, release, type, tmpdir, homedir, hostname, endianness } = os;
              `;
            }

            // Return empty stub for other modules
            return `
              const stub = {};
              export default stub;
            `;
          }
          return null;
        },
      },
      {
        // Slim version: Only keeps PrismJS extend/freeze protections.
        // TDZ polyfills, constructor replacements, ListCache, Uint8Array etc. are no longer
        // needed because esbuild pre-bundles CJS deps without the TDZ issues rollup introduced.
        name: 'fix-prismjs-frozen-objects',
        renderChunk(code: string, chunk: { fileName: string }) {
          if (chunk.fileName.includes('index') && code.length > 1000000) {
            let modified = code;

            // Inject runtime protections at the beginning of the bundle
            const runtimeProtections = `
// === Runtime protections for PrismJS frozen objects & extend property ===
(function() {
  // Bulletproof extend function for PrismJS compatibility
  function bulletproofExtend(object) {
    var sources = Array.prototype.slice.call(arguments, 1);
    var target = (object && typeof object === 'object') ? object : {};
    sources.forEach(function(source) {
      if (source != null && typeof source === 'object') {
        for (var key in source) {
          if (source.hasOwnProperty(key)) {
            var finalKey = key === 'class-name' ? 'className' : key;
            target[finalKey] = source[key];
          }
        }
      }
    });
    return target;
  }
  globalThis.safeExtend = bulletproofExtend;
  globalThis.extend = bulletproofExtend;
  for (var i = 1; i <= 10; i++) {
    globalThis['extend$' + i] = bulletproofExtend;
  }

  // Override Object.freeze/seal/preventExtensions to keep objects extensible
  // (PrismJS freezes language definitions, then plugins try to add .extend property)
  var origFreeze = Object.freeze;
  var origSeal = Object.seal;
  var origPreventExtensions = Object.preventExtensions;
  Object.freeze = function(obj) { return obj; };
  Object.seal = function(obj) { return obj; };
  Object.preventExtensions = function(obj) { return obj; };

  // Surgical defineProperty override: only intercept 'extend' property errors
  var origDefineProperty = Object.defineProperty;
  Object.defineProperty = function(obj, prop, descriptor) {
    if (prop === 'extend') {
      try {
        return origDefineProperty.call(this, obj, prop, descriptor);
      } catch(e) {
        if (e.message && (e.message.includes('not extensible') || e.message.includes('Cannot add property'))) {
          try {
            var proto = Object.getPrototypeOf(obj);
            if (proto && !proto.hasOwnProperty(prop) && descriptor && descriptor.value) {
              proto[prop] = descriptor.value;
            }
          } catch(e2) { /* ignore */ }
          return obj;
        }
        throw e;
      }
    }
    return origDefineProperty.call(this, obj, prop, descriptor);
  };

  // Global error handlers to suppress extend property errors
  var origOnerror = globalThis.onerror;
  globalThis.onerror = function(message, source, lineno, colno, error) {
    if (error && error.message &&
       (error.message.includes('Cannot add property extend') ||
        (error.message.includes('object is not extensible') && error.toString().includes('extend')))) {
      return true;
    }
    return origOnerror ? origOnerror(message, source, lineno, colno, error) : false;
  };
  var origUnhandled = globalThis.onunhandledrejection;
  globalThis.onunhandledrejection = function(event) {
    if (event.reason && event.reason.message &&
       (event.reason.message.includes('Cannot add property extend') ||
        (event.reason.message.includes('object is not extensible') && event.reason.toString().includes('extend')))) {
      event.preventDefault();
      return;
    }
    if (origUnhandled) return origUnhandled(event);
  };
})();
`;

            // Inject at bundle start
            if (modified.includes('const __vite__mapDeps=')) {
              const viteMapIndex = modified.indexOf('const __vite__mapDeps=');
              const lineEnd = modified.indexOf('\n', viteMapIndex);
              modified = modified.substring(0, lineEnd + 1) + runtimeProtections + modified.substring(lineEnd + 1);
            } else if (modified.includes("'use strict'")) {
              modified = modified.replace("'use strict';", "'use strict';" + runtimeProtections);
            } else {
              modified = runtimeProtections + '\n' + modified;
            }

            return modified !== code ? modified : null;
          }
          return null;
        },
      },
      {
        name: 'fix-jupyter-theme-class-name',
        enforce: 'pre',
        transform(code: string, id: string) {
          let modified = code;
          let hasChanges = false;

          // Fix the problematic 'class-name' property in any theme objects
          if (
            id.includes('Theme.js') ||
            id.includes('theme') ||
            code.includes('class-name')
          ) {
            // Replace 'class-name': with className: in theme objects
            modified = modified.replace(
              /'class-name':\s*(['"][^'"]*['"])/g,
              'className: $1'
            );

            // Also handle cases where it's set dynamically
            modified = modified.replace(/\['class-name'\]/g, "['className']");
            modified = modified.replace(/\["class-name"\]/g, '["className"]');

            // Handle extend operations that might be setting 'class-name'
            if (
              modified.includes('extend') &&
              (modified.includes('class-name') ||
                modified.includes("'class-name'"))
            ) {
              // Replace any remaining 'class-name' references with 'className'
              modified = modified.replace(/['"]class-name['"]/g, '"className"');
            }

            if (modified !== code) {
              hasChanges = true;
            }
          }

          // Removed broken extend call transformations - they were causing syntax errors

          if (hasChanges) {
            console.log(
              `Fixed extend calls and 'class-name' property in: ${id}`
            );
            return modified;
          }

          return null;
        },
      },
      react({
        jsxRuntime: 'automatic', // Use automatic JSX runtime to avoid CJS/ESM issues
      }),
      wasm(), // Add WASM support for loro-crdt
      topLevelAwait(), // Add top-level await support
      {
        name: 'fix-raw-css-imports',
        enforce: 'pre',
        transform(code: string, id: string) {
          // Fix the import in themesplugins.js
          if (id.includes('themesplugins.js')) {
            // Replace the problematic import with a dummy value
            return code.replace(
              "import scrollbarStyleText from '../style/scrollbar.raw.css';",
              "const scrollbarStyleText = '';"
            );
          }
          return null;
        },
      },
      importAsString({
        include: ['**/*.raw.css', '**/*.raw.css?*'],
      }),
      {
        name: 'handle-special-imports',
        transform(code: string, id: string) {
          if (id.endsWith('.whl')) {
            // Skip .whl files
            return '';
          }
          // Handle service-worker?text imports
          if (id.includes('service-worker') && id.includes('?text')) {
            return 'export default "";';
          }
        },
        resolveId(source: string) {
          // Handle service-worker?text imports
          if (source.includes('service-worker?text')) {
            return { id: source, external: false };
          }
        },
      },
    ] as any,
    resolve: {
      alias: [
        { find: '@', replacement: resolve(__dirname, 'src/renderer') },
        { find: '@primer/css', replacement: resolve(__dirname, 'node_modules/@primer/css') },
        { find: '@datalayer/core', replacement: resolve(__dirname, '../core') },
        { find: '~react-toastify', replacement: 'react-toastify' },
        // Alias underscore to lodash
        { find: 'underscore', replacement: 'lodash' },
        // Force @jupyterlite to use our root @jupyterlab/services
        { find: '@jupyterlite/server/node_modules/@jupyterlab/services', replacement: resolve(
          __dirname,
          'node_modules/@jupyterlab/services'
        ) },
      ],
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
    },
    optimizeDeps: {
      include: [
        'lodash-es',
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        '@jupyterlab/services',
        '@jupyterlab/services/lib/index.js',
        '@jupyterlab/services/lib/kernel/index.js',
        '@jupyterlab/services/lib/kernel/messages.js',
        '@jupyterlab/services/lib/session/index.js',
        '@jupyterlab/services/lib/contents/index.js',
        '@jupyterlab/services/lib/terminal/index.js',
        '@jupyterlab/services/lib/setting/index.js',
        '@jupyterlab/services/lib/workspace/index.js',
        '@jupyterlab/services/lib/event/index.js',
        '@jupyterlab/services/lib/nbconvert/index.js',
        '@jupyterlab/services/lib/kernelspec/index.js',
        '@jupyterlab/services/lib/user/index.js',
        '@jupyterlab/services/lib/kernel/restapi.js',
        '@jupyterlab/services/lib/kernel/kernel.js',
        '@jupyterlab/services/lib/kernelspec/restapi.js',
        '@jupyterlab/services/lib/tokens.js',
        '@jupyterlab/services/lib/manager.js',
        '@jupyterlab/services/lib/serverconnection.js',
        '@jupyterlab/services/lib/basemanager.js',
        '@jupyterlab/services/lib/connectionstatus.js',
        '@jupyterlab/statedb',
        'lodash.escape',
        'ajv',
        'yjs',
        '@jupyterlab/services/lib/kernel/messages',
        '@jupyterlab/services/lib/kernel/serialize',
        '@jupyterlab/services/lib/session',
        '@jupyterlab/services/lib/contents',
        '@jupyterlab/services/lib/config',
        '@jupyterlab/services/lib/kernelspec',
        '@jupyterlab/services/lib/setting',
        '@jupyterlab/services/lib/terminal',
        '@jupyterlab/services/lib/workspace',
        '@jupyterlab/services/lib/user',
        '@jupyterlab/services/lib/nbconvert',
        '@jupyterlab/services/lib/event',
        '@datalayer/jupyter-react',
        '@primer/react',
        'zustand',
        'ws',
        'form-data',
        'deepmerge',
        'electron-log/renderer',
        'prismjs',
        // Collaboration dependencies
        '@datalayer/lexical-loro',
      ],
      exclude: [
        'react-router-dom',
        'next/navigation',
        'next/router',
        'typestyle',
        'jsonpointer',
        '@react-navigation/native',
        '@jupyterlite/pyodide-kernel',
        '@jupyterlab/apputils-extension',
        // Exclude Node.js built-ins from optimization
        'path',
        'fs',
        'url',
        'source-map-js',
        'postcss',
        // Exclude WASM modules from optimization
        'loro-crdt',
      ],
      esbuildOptions: {
        loader: {
          '.js': 'jsx', // Help with React packages that use JSX in .js files
        },
        define: {
          // Ensure DataView and other globals are available
          'globalThis.DataView': 'DataView',
          'globalThis.Map': 'Map',
          'globalThis.Set': 'Set',
          'globalThis.WeakMap': 'WeakMap',
          'globalThis.Promise': 'Promise',
        },
      },
    },
    server: {
      port: 5173,
      fs: {
        strict: false,
        allow: ['..'],
      },
      proxy: {
        '/api': {
          target: 'https://prod1.datalayer.run',
          changeOrigin: true,
          secure: true,
        },
      },
    },
  },
});
