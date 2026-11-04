import createClient from 'openapi-fetch';
import type { paths } from './schema';

const baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

/**
 * Cliente tipado da API. O refresh vem por cookie httpOnly, por isso toda
 * requisição vai com credentials: 'include'.
 */
export const api = createClient<paths>({
  baseUrl,
  credentials: 'include',
});

export const API_BASE_URL = baseUrl;
