import Image from "next/image";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="app-header">
        <Image src="/logo.png" alt="" width={40} height={40} priority />
        <span className="brand">Volley SMT</span>
      </header>
      {children}
    </>
  );
}
