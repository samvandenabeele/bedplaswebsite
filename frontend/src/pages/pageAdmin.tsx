import AdminSections from "../components/AdminSections";
import type { AuthUser } from "../api";

type PageAdminProps = {
  currentUser: AuthUser | null;
};

export default function PageAdmin({ currentUser }: PageAdminProps) {
  return <AdminSections currentUser={currentUser} panel="admin" />;
}
