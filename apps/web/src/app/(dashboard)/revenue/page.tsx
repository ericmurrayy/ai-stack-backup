import { Metadata } from 'next';
import { RevenueStats } from '@/components/revenue/RevenueStats';
import { InvoiceList } from '@/components/revenue/InvoiceList';
import { ReviewRequests } from '@/components/revenue/ReviewRequests';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';

export const metadata: Metadata = {
  title: 'Revenue | Murray\'s FSM',
  description: 'Track revenue, invoices, and review requests',
};

export default function RevenuePage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Revenue Dashboard</h1>
        <p className="text-gray-500 mt-1">
          Track your income, invoices, and customer reviews
        </p>
      </div>

      {/* Stats */}
      <RevenueStats />

      {/* Tabs */}
      <Tabs defaultValue="invoices" className="space-y-4">
        <TabsList>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices">
          <InvoiceList />
        </TabsContent>

        <TabsContent value="reviews">
          <ReviewRequests />
        </TabsContent>
      </Tabs>
    </div>
  );
}
