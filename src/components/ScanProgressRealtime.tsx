import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle2, Upload, Search, Brain, FileCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ScanProgressRealtimeProps {
  scanId: string;
  onComplete: () => void;
}

const scanStages = [
  { id: "pending", label: "Uploading document", icon: Upload, progress: 0 },
  { id: "processing", label: "Checking sources", icon: Search, progress: 25 },
  { id: "analyzing", label: "Detecting AI content", icon: Brain, progress: 50 },
  { id: "generating", label: "Generating report", icon: FileCheck, progress: 75 },
  { id: "completed", label: "Complete", icon: CheckCircle2, progress: 100 },
];

const ScanProgressRealtime = ({ scanId, onComplete }: ScanProgressRealtimeProps) => {
  const [status, setStatus] = useState("pending");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Initial fetch
    const fetchScanStatus = async () => {
      const { data } = await supabase
        .from("scans")
        .select("status")
        .eq("id", scanId)
        .single();
      
      if (data) {
        setStatus(data.status);
        const stage = scanStages.find(s => s.id === data.status);
        setProgress(stage?.progress || 0);
        
        if (data.status === "completed") {
          onComplete();
        }
      }
    };

    fetchScanStatus();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`scan-${scanId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'scans',
          filter: `id=eq.${scanId}`,
        },
        (payload) => {
          const newStatus = payload.new.status;
          setStatus(newStatus);
          
          const stage = scanStages.find(s => s.id === newStatus);
          if (stage) {
            setProgress(stage.progress);
          }
          
          if (newStatus === "completed") {
            setProgress(100);
            onComplete();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [scanId, onComplete]);

  const currentStageIndex = scanStages.findIndex(s => s.id === status);

  return (
    <div className="space-y-6">
      {/* Overall Progress */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-foreground">Overall Progress</span>
          <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-3" />
      </div>

      {/* Stages */}
      <div className="space-y-4">
        {scanStages.slice(0, -1).map((stage, index) => {
          const isActive = index === currentStageIndex;
          const isComplete = index < currentStageIndex || status === "completed";
          const isPending = index > currentStageIndex;

          return (
            <div
              key={stage.id}
              className={`flex items-center gap-4 p-4 rounded-xl transition-all ${
                isActive 
                  ? "bg-accent/10 border border-accent/30" 
                  : isComplete 
                  ? "bg-success/10 border border-success/30" 
                  : "bg-muted/30 border border-transparent"
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isComplete 
                  ? "bg-success text-white" 
                  : isActive 
                  ? "bg-accent text-white" 
                  : "bg-muted text-muted-foreground"
              }`}>
                {isComplete ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : isActive ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <stage.icon className="w-5 h-5" />
                )}
              </div>
              <div className="flex-1">
                <p className={`font-medium ${
                  isComplete ? "text-success" : isActive ? "text-accent" : "text-muted-foreground"
                }`}>
                  {stage.label}
                </p>
              </div>
              {isComplete && (
                <span className="text-sm text-success">Complete</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ScanProgressRealtime;
