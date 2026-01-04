import { z } from "zod/v4";

export const jwtUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.email(),
  createdAt: z.date(),
});
export type JwtUser = z.infer<typeof jwtUserSchema>;
