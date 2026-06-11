"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GeneralSettings } from "./general-settings";
import { PaymentSettings } from "./payment-settings";
import { FulfillmentSettings } from "./fulfillment-settings";

interface SettingsPageProps {
  church: {
    name: string;
    timezone: string;
    contactEmail: string | null;
  };
  payments: {
    stripeMode: string;
    hasStripeKey: boolean;
    hasWebhookSecret: boolean;
    webhookUrl: string;
  };
  fulfillment: {
    pickupEnabled: boolean;
    deliveryEnabled: boolean;
    dineInEnabled: boolean;
    deliveryRadiusMiles: number | null;
    pickupInstructions: string | null;
  };
}

export function SettingsPage({ church, payments, fulfillment }: SettingsPageProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Manage your church profile, payments, and fulfillment preferences.
        </p>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="fulfillment">Fulfillment</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="pt-6">
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <div className="mb-5">
              <h2 className="text-base font-semibold text-slate-900">General</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Basic information about your church.
              </p>
            </div>
            <GeneralSettings
              churchName={church.name}
              contactEmail={church.contactEmail}
              timezone={church.timezone}
            />
          </div>
        </TabsContent>

        <TabsContent value="payments" className="pt-6">
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <div className="mb-5">
              <h2 className="text-base font-semibold text-slate-900">Payments</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Configure Stripe to accept card payments.
              </p>
            </div>
            <PaymentSettings
              stripeMode={payments.stripeMode}
              hasStripeKey={payments.hasStripeKey}
              hasWebhookSecret={payments.hasWebhookSecret}
              webhookUrl={payments.webhookUrl}
            />
          </div>
        </TabsContent>

        <TabsContent value="fulfillment" className="pt-6">
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <div className="mb-5">
              <h2 className="text-base font-semibold text-slate-900">Fulfillment</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Control which order types are available to customers.
              </p>
            </div>
            <FulfillmentSettings
              pickupEnabled={fulfillment.pickupEnabled}
              deliveryEnabled={fulfillment.deliveryEnabled}
              dineInEnabled={fulfillment.dineInEnabled}
              deliveryRadiusMiles={fulfillment.deliveryRadiusMiles}
              pickupInstructions={fulfillment.pickupInstructions}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
