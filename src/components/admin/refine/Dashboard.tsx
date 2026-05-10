import { AdminLayout } from "./AdminLayout";
import { Pinnwand } from "./dashboard/Pinnwand";

export const Dashboard = () => {
  return (
    <AdminLayout activeTab="dashboard" title="Maestro" showCreateButton={true} createButtonText="Neue Anfrage">
      <Pinnwand />
    </AdminLayout>
  );
};

export default Dashboard;
