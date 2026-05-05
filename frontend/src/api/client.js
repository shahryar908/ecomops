import axios from 'axios';

const TOKEN_KEY = 'shopsphere.token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

function makeClient(baseURL) {
  const instance = axios.create({ baseURL, timeout: 10000 });
  instance.interceptors.request.use((config) => {
    const token = getToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
  return instance;
}

export const userApi = makeClient(import.meta.env.VITE_USER_API);
export const productApi = makeClient(import.meta.env.VITE_PRODUCT_API);
export const cartApi = makeClient(import.meta.env.VITE_CART_API);
export const orderApi = makeClient(import.meta.env.VITE_ORDER_API);
