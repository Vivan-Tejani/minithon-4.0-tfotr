.PHONY: dev test test-backend test-frontend install

dev:
	./run.sh

test: test-backend test-frontend

test-backend:
	cd backend && python3 -m pytest

test-frontend:
	cd frontend && npm run build

install:
	cd backend && pip install -r requirements.txt
	cd frontend && npm install
