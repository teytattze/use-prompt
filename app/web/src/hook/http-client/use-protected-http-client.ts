import { useAuth } from "@clerk/nextjs";
import type { InternalAxiosRequestConfig } from "axios";
import axios from "axios";
import { useMemo } from "react";

export const useProtectedHttpClient = () => {
  const { getToken } = useAuth();

  return useMemo(() => {
    const instance = axios.create({
      baseURL: "http://localhost:3000/api",
      timeout: 10 * 1000,
    });

    instance.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        const token = await getToken({ template: "default" });
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      },
    );

    return instance;
  }, [getToken]);
};
