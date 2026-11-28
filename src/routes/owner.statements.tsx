import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Eye } from "lucide-react";
import { fetchOwnerStatements, formatQAR, type OwnerStatementData } from "@/lib/portal-api";

export const Route = createFileRoute("/owner/statements")({
  component: OwnerStatements,
});

function OwnerStatements() {
  const [data, setData] = useState<OwnerStatementData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOwnerStatements()
      .then((res) => setData(res))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const totals = data?.totals ?? { gross_revenue: 0, expenses: 0, net_payable: 0 };
  const statements = data?.statements ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Owner Statements</h1>
          <p className="text-sm text-muted-foreground mt-1">Monthly revenue, distributions and charges</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Gross Revenue (YTD)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatQAR(totals.gross_revenue)}</p>
            <p className="text-xs text-muted-foreground">{data?.property_count ?? 0} active properties</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Expenses (YTD)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatQAR(totals.expenses)}</p>
            <p className="text-xs text-muted-foreground">posted operational &amp; maintenance expenses</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Net Payable</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{formatQAR(totals.net_payable)}</p>
            <p className="text-xs text-muted-foreground">net posted distribution</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Monthly Statements</CardTitle>
          <CardDescription>Download or view detailed statements for each period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {loading && <p className="text-sm text-muted-foreground py-4 text-center">Loading statements...</p>}
            {!loading && statements.length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">No posted financial periods found yet.</p>
            )}
            {statements.map((stmt) => (
              <div key={stmt.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                <div className="flex-1">
                  <p className="font-medium">{stmt.period}</p>
                  <p className="text-sm text-muted-foreground">
                    Gross: {formatQAR(stmt.gross_revenue)} • Expenses: {formatQAR(stmt.expenses)} • Net: {formatQAR(stmt.net_payable)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="gap-2">
                    <Eye className="h-4 w-4" />
                    View
                  </Button>
                  <Button size="sm" variant="outline" className="gap-2">
                    <Download className="h-4 w-4" />
                    PDF
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
