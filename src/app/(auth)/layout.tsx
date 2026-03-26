export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-surface/30">
      <div className="w-full max-w-md space-y-8 px-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gold">
            SOLIS AI
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Marketing Intelligence Dashboard
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
