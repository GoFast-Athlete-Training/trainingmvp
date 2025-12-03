'use client';

import axios from 'axios';
import { auth } from './firebase';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || '/api',
});

// Add Firebase token to all requests
api.interceptors.request.use(
  async (config) => {
    // First check localStorage for token (from main app or previous session)
    const storedToken = localStorage.getItem('firebaseToken');
    
    if (storedToken) {
      config.headers.Authorization = `Bearer ${storedToken}`;
      return config;
    }
    
    // Fall back to Firebase auth currentUser
    const user = auth.currentUser;
    if (user) {
      try {
        const token = await user.getIdToken();
        // Store token for future requests
        localStorage.setItem('firebaseToken', token);
        config.headers.Authorization = `Bearer ${token}`;
      } catch (error) {
        console.error('Error getting Firebase token:', error);
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;

