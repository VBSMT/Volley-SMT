export function ComingSoon({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="page stack">
      <h1>{title}</h1>
      <p className="notice">{children}</p>
    </main>
  );
}
