# Copyright (c) 2023-2025 Datalayer, Inc.
#
# Distributed under the terms of the Modified BSD License.

SHELL=/bin/bash

.PHONY: help dev start

help: ## display this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

default: help ## default target is help

dev: ## run the app in development (electron-vite dev, reloading on change)
	npm run dev

start: dev ## the same as dev
