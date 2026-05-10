import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { DemoProvider } from "@/components/DemoDialog";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DemoProvider>
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </DemoProvider>
  );
}
