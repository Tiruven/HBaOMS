"use client";

import React from "react";
import { formatDate } from "@/lib/utils";
import { AuditFields as AuditFieldsType } from "@/lib/types";
import { Clock, User } from "lucide-react";

interface AuditFieldsProps {
  data: AuditFieldsType;
}

export const AuditFieldsView: React.FC<AuditFieldsProps> = ({ data }) => {
  return (
    <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-md">
      <div>
        <span className="font-semibold text-navy-900 flex items-center gap-1 mb-0.5">
          <User className="h-3 w-3 text-gold-500" /> Created By
        </span>
        <p className="truncate">{data.created_by || "System"}</p>
        <span className="font-semibold text-navy-900 flex items-center gap-1 mt-1 mb-0.5">
          <Clock className="h-3 w-3 text-gold-500" /> Date Created
        </span>
        <p>{formatDate(data.date_created)}</p>
      </div>

      <div>
        <span className="font-semibold text-navy-900 flex items-center gap-1 mb-0.5">
          <User className="h-3 w-3 text-gold-500" /> Last Updated By
        </span>
        <p className="truncate">{data.updated_by_ || "N/A"}</p>
        <span className="font-semibold text-navy-900 flex items-center gap-1 mt-1 mb-0.5">
          <Clock className="h-3 w-3 text-gold-500" /> Date Updated
        </span>
        <p>{formatDate(data.date_updated)}</p>
      </div>
    </div>
  );
};
