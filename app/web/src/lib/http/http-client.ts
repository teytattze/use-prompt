import axios from "axios";

export const httpClient = axios.create({
  baseURL: "",
  timeout: 10 * 1000,
});
