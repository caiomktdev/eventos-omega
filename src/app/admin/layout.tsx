/**
 * Layout raiz da área /admin — pass-through.
 * Login fica fora do grupo (panel) e não herda a sidebar.
 */

interface AdminRootLayoutProps {
  children: React.ReactNode;
}

export default function AdminRootLayout({ children }: AdminRootLayoutProps) {
  return children;
}
