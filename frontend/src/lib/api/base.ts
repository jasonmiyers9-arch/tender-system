export function resolveApiBase(): string {
    const configured = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
    if (!configured) return '/api';
    if (configured === 'http://localhost:8000' || configured === 'http://127.0.0.1:8000') {
        return '/api';
    }
    return configured;
}

