export const getBackendBaseUrl = () => {
  return import.meta.env.VITE_BACKEND_URL || "https://isolarchecking-backend.onrender.com";
};
