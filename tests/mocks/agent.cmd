@echo off
rem The stub `agent` of the desktop suite (DESKTOP DK-15): see agent.ts beside it.
node --no-warnings --experimental-strip-types "%~dp0agent.ts" %*
