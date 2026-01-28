import { Refine } from "@refinedev/core";
import routerProvider from "@refinedev/react-router-v6";
import { Routes, Route, Navigate } from "react-router-dom";
import { supabaseDataProvider } from "@/providers/refine-data-provider";
import { supabaseAuthProvider } from "@/providers/refine-auth-provider";
import { Dashboard, EventsList, EventEdit, OrdersList, MenuItemsList } from "@/components/admin/refine";

const resources = [
  {
    name: "dashboard",
    list: "/admin",
  },
  {
    name: "events",
    list: "/admin/events",
    edit: "/admin/events/:id/edit",
    show: "/admin/events/:id",
  },
  {
    name: "orders",
    list: "/admin/orders",
    show: "/admin/orders/:id",
  },
  {
    name: "menu_items",
    list: "/admin/menu",
    create: "/admin/menu/create",
    edit: "/admin/menu/:id/edit",
  },
];

export const RefineAdminApp = () => {
  return (
    <Refine
      dataProvider={supabaseDataProvider}
      authProvider={supabaseAuthProvider}
      routerProvider={routerProvider}
      resources={resources}
      options={{
        syncWithLocation: true,
        warnWhenUnsavedChanges: true,
      }}
    >
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="events">
          <Route index element={<EventsList />} />
          <Route path=":id/edit" element={<EventEdit />} />
        </Route>
        <Route path="orders">
          <Route index element={<OrdersList />} />
        </Route>
        <Route path="menu">
          <Route index element={<MenuItemsList />} />
        </Route>
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </Refine>
  );
};
