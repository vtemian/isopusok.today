SHELL := /bin/bash
.DEFAULT_GOAL := help
.PHONY: help install dev start test test-watch typecheck migrate-local migrate-remote deploy clean reset

help:
	@printf "Targets:\n"
	@printf "  %-18s %s\n" "make dev"            "install deps, set up local DB, run wrangler dev"
	@printf "  %-18s %s\n" "make start"          "alias for make dev"
	@printf "  %-18s %s\n" "make install"        "install npm deps"
	@printf "  %-18s %s\n" "make test"           "run vitest once"
	@printf "  %-18s %s\n" "make test-watch"     "run vitest in watch mode"
	@printf "  %-18s %s\n" "make typecheck"      "tsc --noEmit"
	@printf "  %-18s %s\n" "make migrate-local"  "apply D1 migrations to the local SQLite"
	@printf "  %-18s %s\n" "make migrate-remote" "apply D1 migrations to production"
	@printf "  %-18s %s\n" "make deploy"         "wrangler deploy (runs tests first)"
	@printf "  %-18s %s\n" "make reset"          "wipe local D1 state but keep deps"
	@printf "  %-18s %s\n" "make clean"          "remove node_modules and build artifacts"

# Stamp file: only re-run npm install when package*.json changes.
node_modules/.install-stamp: package.json package-lock.json
	npm install
	@touch $@

install: node_modules/.install-stamp

# Created on first run from the example. Never overwritten.
.dev.vars:
	@cp .dev.vars.example $@
	@echo "Created $@ from .dev.vars.example"

dev: install .dev.vars migrate-local
	npx wrangler dev

start: dev

test: install
	npm test

test-watch: install
	npm run test:watch

typecheck: install
	npm run typecheck

migrate-local: install
	npx wrangler d1 migrations apply isopusok --local

migrate-remote: install
	npx wrangler d1 migrations apply isopusok --remote

deploy: install test
	npx wrangler deploy

reset:
	rm -rf .wrangler/state

clean:
	rm -rf node_modules .wrangler dist coverage
