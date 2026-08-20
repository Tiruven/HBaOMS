import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserCheck, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function CustomersPlaceholderPage() {
  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="p-3 rounded-lg bg-gold-100 text-gold-600">
            <UserCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-navy-900">
              Customer Profiles Directory
            </h1>
            <p className="text-sm text-slate-500">
              Registered guests, contact info, passport details, and history.
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Customer Schema Ready</CardTitle>
            <Badge variant="gold">Phase 2 Operation</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-navy-50 rounded-lg border border-navy-100 flex items-start gap-3 text-slate-700">
            <Clock className="h-5 w-5 text-gold-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-navy-900 text-sm">
                Registered Guest Database Standardized
              </h4>
              <p className="text-xs text-slate-600 mt-1">
                PostgreSQL schema for <code className="bg-white px-1 py-0.5 rounded border border-slate-200 font-mono">customer</code> with unique email, gender check constraints, and contact validation is generated and included in DDL.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
