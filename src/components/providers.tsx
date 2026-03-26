"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "react-hot-toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "hsl(229 23% 9.2%)",
            color: "hsl(210 20% 95%)",
            border: "1px solid hsl(228 15% 18%)",
          },
        }}
      />
    </SessionProvider>
  );
}
