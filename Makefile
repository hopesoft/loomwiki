.DEFAULT_GOAL := help

.PHONY: help install dev start build test typecheck check browser release-check

help:
	@printf '%s\n' 'LoomWiki development commands' '' '  make install    Install locked dependencies' '  make dev        Build and start the local Web demo' '  make start      Start the server using the existing build' '  make build      Build the Web application' '  make test       Run automated tests' '  make typecheck  Check TypeScript types' '  make check      Run type checks, tests, and build' '  make browser    Run isolated Chromium workflow checks' '  make release-check  Inspect publishable files'  '' 'Optional: PORT=4311 make dev'

install:
	pnpm install --frozen-lockfile

dev:
	pnpm dev

start:
	pnpm start

build:
	pnpm build

test:
	pnpm test

typecheck:
	pnpm typecheck

check:
	pnpm check

browser:
	pnpm test:browser

release-check:
	pnpm release:check
