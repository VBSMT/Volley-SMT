export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="app-header">
        <span className="brand">Volley SMT</span>
      </header>
      {children}
    </>
  );
}
