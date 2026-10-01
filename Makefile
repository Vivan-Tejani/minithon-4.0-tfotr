.PHONY: dev test test-backend test-frontend install

dev:
	./run.sh

test: test-backend test-frontend

test-backend:
	cd backend && python3 -m pytest

test-frontend:
	@if [ -d "frontend" ] && [ -f "frontend/package.json" ]; then \
		cd frontend && npm run build; \
	else \
		echo "Frontend directory not present or tracked yet, skipping frontend build test."; \
	fi

install:
	cd backend && pip install -r requirements.txt
	@if [ -d "frontend" ] && [ -f "frontend/package.json" ]; then \
		cd frontend && npm install; \
	fi
