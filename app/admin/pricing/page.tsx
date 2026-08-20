import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function PricingPlaceholderPage() {
  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="p-3 rounded-lg bg-gold-100 text-gold-600">
            <DollarSign className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-navy-900">
              Pricing Rules & Seasonal Overrides
            </h1>
            <p className="text-sm text-slate-500">
              Configure room rate surcharges, holiday discounts, and pricing rules.
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Pricing Engine Schema</CardTitle>
            <Badge variant="gold">Phase 2 Operation</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-navy-50 rounded-lg border border-navy-100 flex items-start gap-3 text-slate-700">
            <Clock className="h-5 w-5 text-gold-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-navy-900 text-sm">
                Rate Override Constraints Defined
              </h4>
              <p className="text-xs text-slate-600 mt-1">
                PostgreSQL table <code className="bg-white px-1 py-0.5 rounded border border-slate-200 font-mono">pricing_rule</code> with date range enforcement (<code className="bg-white px-1 py-0.5 rounded border border-slate-200 font-mono">end_date &gt;= start_date</code>) is included in DDL.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
