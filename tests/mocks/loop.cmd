@echo off
rem The stub `loop` of the desktop suite (DESKTOP DK-15): see loop.ts beside it.
node --no-warnings --experimental-strip-types "%~dp0loop.ts" %*
