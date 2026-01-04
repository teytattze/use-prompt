"use client";

import { useAuth } from "@/hook/auth/use-auth";
import { useListPrompts } from "@/hook/prompt/use-list-prompts";

export default function Page() {
  const auth = useAuth();
  const listPrompts = useListPrompts();

  return (
    <div>
      <div>{JSON.stringify(auth, null, 4)}</div>
      <br />
      <div>{JSON.stringify(listPrompts, null, 4)}</div>
    </div>
  );
}
