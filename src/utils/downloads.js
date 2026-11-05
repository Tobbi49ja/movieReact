import axios from 'axios';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.DEV ? 'http://localhost:3001' : 'https://moviereact-zzye.onrender.com');

export async function listDownloads() {
  const response = await axios.get(`${BACKEND_URL}/api/downloads`);
  return response.data;
}

export async function startDownload(payload) {
  const response = await axios.post(`${BACKEND_URL}/api/downloads/start`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });
  return response.data;
}

export async function deleteDownload(id) {
  const response = await axios.delete(`${BACKEND_URL}/api/downloads/${id}`);
  return response.data;
}

export async function clearDownloads() {
  const response = await axios.post(`${BACKEND_URL}/api/downloads/clear`);
  return response.data;
}
