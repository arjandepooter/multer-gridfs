lint:
	npm run lint
.PHONY: lint

test: lint
	NODE_ENV="test" npm test
.PHONY: test
