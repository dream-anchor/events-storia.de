import { Refine } from "@refinedev/core";
import routerProvider from "@refinedev/react-router";
import { Routes, Route, Navigate } from "react-router-dom";
import { supabaseDataProvider } from "@/providers/refine-data-provider";
import { supabaseAuthProvider } from "@/providers/refine-auth-provider";
import { Dashboard, EventsList, OrdersList, MenuItemsList, PackagesList, PackageEdit, LocationEdit, EventBookingsList, EventBookingEditor } from "@/components/admin/refine";
import { CateringOrderEditor } from "@/components/admin/refine/CateringOrderEditor";
import { SmartInquiryEditor } from "@/components/admin/refine/InquiryEditor";
import { AdminOfferCreate } from "@/components/admin/refine/OfferCreate";
import InboxPage from "@/pages/admin/InboxPage";

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
    name: "bookings",
    list: "/admin/bookings",
    edit: "/admin/bookings/:id/edit",
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
  {
    name: "packages",
    list: "/admin/packages",
    create: "/admin/packages/create",
    edit: "/admin/packages/:id/edit",
  },
  {
    name: "locations",
    list: "/admin/packages",
    create: "/admin/locations/create",
    edit: "/admin/locations/:id/edit",
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
        <Route path="inbox" element={<InboxPage />} />
        <Route path="inbox/:entityType/:id" element={<InboxPage />} />
        <Route path="events">
          <Route index element={<EventsList />} />
          <Route path="create" element={<AdminOfferCreate />} />
          <Route path=":id/edit" element={<SmartInquiryEditor />} />
        </Route>
        <Route path="bookings">
          <Route index element={<EventBookingsList />} />
          <Route path=":id/edit" element={<EventBookingEditor />} />
        </Route>
        <Route path="orders">
          <Route index element={<OrdersList />} />
          <Route path=":id/edit" element={<CateringOrderEditor />} />
        </Route>
        <Route path="menu">
          <Route index element={<MenuItemsList />} />
        </Route>
        <Route path="packages">
          <Route index element={<PackagesList />} />
          <Route path="create" element={<PackageEdit />} />
          <Route path=":id/edit" element={<PackageEdit />} />
        </Route>
        <Route path="locations">
          <Route path="create" element={<LocationEdit />} />
          <Route path=":id/edit" element={<LocationEdit />} />
        </Route>
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </Refine>
  );
};
