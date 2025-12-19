// utils/fetchJSON.ts
export async function fetchJSON<T = unknown>(url: string, init?: RequestInit): Promise<T> {
	const res = await fetch(url, {
		...init,
		headers: {
			'Content-Type': 'application/json',
			...(init?.headers || {}),
		},
	});

	const ct = res.headers.get('content-type') || '';
	const text = await res.text();

	// If server returned HTML (e.g., <!DOCTYPE ...>), surface that clearly.
	if (!ct.includes('application/json')) {
		throw new Error(`HTTP ${res.status} from ${url}. Expected JSON but got: ${text.slice(0, 180)}`);
	}

	const data = JSON.parse(text);
	if (!res.ok) {
		const msg = (data && typeof data === 'object' && 'error' in data) ? (data as any).error : `HTTP ${res.status}`;
		throw new Error(msg);
	}
	return data as T;
}
