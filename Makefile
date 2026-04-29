.PHONY: install dev test typecheck migrate-local migrate-remote deploy clean

install:
	npm install

dev:
	npm run dev

test:
	npm test

typecheck:
	npm run typecheck

migrate-local:
	npm run migrate:local

migrate-remote:
	npm run migrate:remote

deploy:
	npm run deploy

clean:
	rm -rf node_modules .wrangler dist coverage
