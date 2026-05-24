import AdminSections from "../components/AdminSections";
import type { AuthUser } from "../api";

type PageSuperuserProps = {
  currentUser: AuthUser | null;
};

export default function PageSuperuser({ currentUser }: PageSuperuserProps) {
  return <AdminSections currentUser={currentUser} panel="superuser" />;
}
