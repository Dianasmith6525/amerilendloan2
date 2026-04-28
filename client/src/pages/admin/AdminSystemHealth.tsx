import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, ArrowLeft, Database, Server, HardDrive, RefreshCw,
  CheckCircle, XCircle, AlertTriangle, Download, Clock, Shield
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function AdminSystemHealth() {
  const [, setLocation] = useLocation();
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const { data: health, isLoading: healthLoading, refetch: refetchHealth } = trpc.system.getSystemHealth.useQuery(
    undefined,
    { refetchInterval: 30000 }
  );

  const { data: backupsData, isLoading: backupsLoading, refetch: refetchBackups } = trpc.system.listBackups.useQuery();

  const createBackupMutation = trpc.system.createBackup.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`Backup created: ${data.backupPath}`);
        refetchBackups();
        refetchHealth();
      } else {
        toast.error(data.message);
      }
      setIsCreatingBackup(false);
    },
    onError: (error) => {
      toast.error(`Backup failed: ${error.message}`);
      setIsCreatingBackup(false);
    },
  });

  const restoreBackupMutation = trpc.system.restoreBackup.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Backup restored successfully!");
      } else {
        toast.error(data.message);
      }
      setIsRestoring(false);
    },
    onError: (error) => {
      toast.error(`Restore failed: ${error.message}`);
      setIsRestoring(false);
    },
  });

  const handleCreateBackup = () => {
    setIsCreatingBackup(true);
    createBackupMutation.mutate();
  };

  const handleRestore = (filename: string) => {
    if (!window.confirm(`Are you sure you want to restore from ${filename}? This will overwrite existing data with backup data.`)) {
      return;
    }
    setIsRestoring(true);
    restoreBackupMutation.mutate({ filename });
  };

  const getTimeSince = (timestamp: string | null) => {
    if (!timestamp) return "Never";
    const then = new Date(timestamp);
    const nowMs = new Date().getTime();
    const diff = nowMs - then.getTime();
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h ago`;
    if (hours > 0) return `${hours}h ${mins}m ago`;
    return `${mins}m ago`;
  };

  if (healthLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2">Loading system health...</span>
      </div>
    );
  }

  const backupOverdue = health?.backup.lastBackupTime
    ? (new Date().getTime() - new Date(health.backup.lastBackupTime).getTime()) > 7 * 3600000
    : true;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/admin")}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">System Health & Backups</h1>
            <p className="text-sm text-muted-foreground">Monitor database, backups, and server health</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => { refetchHealth(); refetchBackups(); }}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Refresh
        </Button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Database Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Database className="h-4 w-4" />
              Database
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mb-2">
              {health?.database.connected ? (
                <Badge className="bg-green-100 text-green-800">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Badge className="bg-red-100 text-red-800">
                  <XCircle className="h-3 w-3 mr-1" />
                  Disconnected
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Response time: {health?.database.responseTimeMs || 0}ms
            </p>
          </CardContent>
        </Card>

        {/* Backup Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <HardDrive className="h-4 w-4" />
              Last Backup
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mb-2">
              {health?.backup.lastBackupSuccess && !backupOverdue ? (
                <Badge className="bg-green-100 text-green-800">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Healthy
                </Badge>
              ) : backupOverdue ? (
                <Badge className="bg-yellow-100 text-yellow-800">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Overdue
                </Badge>
              ) : (
                <Badge className="bg-red-100 text-red-800">
                  <XCircle className="h-3 w-3 mr-1" />
                  Failed
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {getTimeSince(health?.backup.lastBackupTime ?? null)} — {health?.backup.lastBackupTables || 0} tables, {health?.backup.lastBackupRecords || 0} records
            </p>
            {health?.backup.lastBackupError && (
              <p className="text-xs text-red-600 mt-1">Error: {health.backup.lastBackupError}</p>
            )}
          </CardContent>
        </Card>

        {/* Server Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Server className="h-4 w-4" />
              Server
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-green-100 text-green-800">
                <CheckCircle className="h-3 w-3 mr-1" />
                Running
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Uptime: {health?.server.uptimeFormatted || "N/A"} — Memory: {health?.server.memoryUsageMB || 0}MB / {health?.server.memoryTotalMB || 0}MB
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Protection Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Data Protection Status
          </CardTitle>
          <CardDescription>Active protections for your application data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { label: "Automated Backups", detail: `Every ${health?.backup.backupFrequencyHours || 6} hours`, ok: true },
              { label: "All Tables Backed Up", detail: `${health?.backup.lastBackupTables || 0} tables (dynamic discovery)`, ok: (health?.backup.lastBackupTables || 0) > 50 },
              { label: "Pre-Migration Backups", detail: "Auto-backup before schema changes", ok: true },
              { label: "Backup Verification", detail: "Integrity check after every backup", ok: true },
              { label: "Database Keep-Alive", detail: "Ping every 4 hours (prevents Supabase pause)", ok: true },
              { label: "Auto-Migration", detail: "Schema sync on every deploy + startup", ok: true },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 p-2 rounded border">
                {item.ok ? (
                  <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0" />
                )}
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Backup Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="h-5 w-5" />
                Backup Management
              </CardTitle>
              <CardDescription>Create, view, and restore database backups</CardDescription>
            </div>
            <Button
              onClick={handleCreateBackup}
              disabled={isCreatingBackup}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isCreatingBackup ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-1" />
              )}
              Create Backup Now
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {backupsLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : !backupsData?.backups?.length ? (
            <p className="text-center text-muted-foreground py-8">No backups found. Create your first backup above.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {backupsData.backups.map((backup: { filename: string; createdAt: string; size: number; sizeFormatted: string }) => (
                <div
                  key={backup.filename}
                  className="flex items-center justify-between p-3 rounded border hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <HardDrive className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium">
                        {backup.filename.includes("pre-migration") ? (
                          <Badge variant="outline" className="mr-2 text-xs">Pre-Migration</Badge>
                        ) : null}
                        {backup.filename}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <Clock className="h-3 w-3 inline mr-1" />
                        {backup.createdAt} — {backup.sizeFormatted}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRestore(backup.filename)}
                    disabled={isRestoring}
                    className="text-orange-600 hover:text-orange-700"
                  >
                    {isRestoring ? <Loader2 className="h-3 w-3 animate-spin" /> : "Restore"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
