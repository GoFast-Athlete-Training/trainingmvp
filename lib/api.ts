'use client';

import axios from 'axios';
import { auth } from './firebase';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || '/api',
});

// Add Firebase token to all requests
api.interceptors.request.use(
  async (config) => {
    // Always get a fresh token from Firebase (force refresh to avoid expired tokens)
    const user = auth.currentUser;
    if (user) {
      try {
        // Force refresh to get the latest token (prevents expired token errors)
        const token = await user.getIdToken(true);
        config.headers.Authorization = `Bearer ${token}`;
        // Optionally store for debugging, but don't rely on it
        localStorage.setItem('firebaseToken', token);
      } catch (error) {
        console.error('❌ API: Failed to get token in interceptor:', error);
        // Clear any stale token
        localStorage.removeItem('firebaseToken');
      }
    } else {
      // No user - clear any stale token
      localStorage.removeItem('firebaseToken');
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;

