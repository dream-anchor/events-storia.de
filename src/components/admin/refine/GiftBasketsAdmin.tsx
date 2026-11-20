import { Gift } from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GiftStockAdmin } from "../gift/GiftStockAdmin";
import { GiftOrdersAdmin } from "../gift/GiftOrdersAdmin";
import { GiftSettingsAdmin } from "../gift/GiftSettingsAdmin";

/** Admin „Geschenkkörbe“: Bestellungen, Körbe/Bestand/Pflichtangaben, Sperrtage + Einstellungen. */
export function GiftBasketsAdmin() {
  return (
    <AdminLayout activeTab="geschenkkoerbe" title="Geschenkkörbe" showSearch={false} showCreateButton={false}>
      <div className="mx-auto max-w-5xl space-y-6 p-6 md:p-8">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-neutral-900 text-white"><Gift className="h-5 w-5" /></div>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Geschenkkörbe</h1>
            <p className="text-sm text-neutral-500">Bestellungen, Bestand je Weinvariante, Sperrtage, Einstellungen</p>
          </div>
        </div>
        <Tabs defaultValue="orders">
          <TabsList>
            <TabsTrigger value="orders">Bestellungen</TabsTrigger>
            <TabsTrigger value="stock">Körbe &amp; Bestand</TabsTrigger>
            <TabsTrigger value="settings">Sperrtage &amp; Einstellungen</TabsTrigger>
          </TabsList>
          <TabsContent value="orders" className="mt-4"><GiftOrdersAdmin /></TabsContent>
          <TabsContent value="stock" className="mt-4"><GiftStockAdmin /></TabsContent>
          <TabsContent value="settings" className="mt-4"><GiftSettingsAdmin /></TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
