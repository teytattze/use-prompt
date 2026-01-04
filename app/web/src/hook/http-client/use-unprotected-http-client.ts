import type { InternalAxiosRequestConfig } from "axios";
import axios from "axios";
import { useMemo } from "react";

export const useUnprotectedHttpClient = () => {
  return useMemo(() => {
    const instance = axios.create({
      baseURL: "http://localhost:3000/api",
      timeout: 10 * 1000,
    });

    instance.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        return config;
      },
      (error) => {
        return Promise.reject(error);
      },
    );

    return instance;
  }, []);
};
