"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect } from "react";
import { Pending } from "@/component/extended-ui/pending";

export function SignOut() {
  const { signOut } = useAuth();

  useEffect(() => {
    signOut();
  }, [signOut]);

  return <Pending message="Signing out..." />;
}
