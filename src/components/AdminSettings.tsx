import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Settings } from "lucide-react";

const AdminSettings = () => {
  const { settings, updateSetting, loading } = useAppSettings();
  const { toast } = useToast();
  const [appName, setAppName] = useState(settings.app_name);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSetting("app_name", appName);
      toast({
        title: "Settings saved",
        description: "App name has been updated successfully",
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "Error saving settings",
        description: "Failed to update app name",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl text-foreground">App Settings</h2>
        <p className="text-muted-foreground">Configure application-wide settings</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <Settings className="w-5 h-5 text-accent" />
          <h3 className="font-medium text-foreground">General Settings</h3>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="appName">Application Name</Label>
            <Input
              id="appName"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              placeholder="Enter app name"
              className="max-w-md"
            />
            <p className="text-sm text-muted-foreground">
              This name will be displayed across the entire application
            </p>
          </div>

          <Button onClick={handleSave} disabled={saving || appName === settings.app_name}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;
