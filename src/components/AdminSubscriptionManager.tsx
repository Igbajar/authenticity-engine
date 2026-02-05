 import { useState } from "react";
 import { Button } from "@/components/ui/button";
 import { 
   Dialog,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
 } from "@/components/ui/dialog";
 import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
 } from "@/components/ui/select";
 import { supabase } from "@/integrations/supabase/client";
 import { useToast } from "@/hooks/use-toast";
 import { Gift, Loader2, Calendar } from "lucide-react";
 
 interface User {
   id: string;
   user_id: string;
   email: string;
   full_name: string | null;
 }
 
 interface SubscriptionTier {
   id: string;
   name: string;
   price_monthly: number;
 }
 
 interface Props {
   user: User;
   tiers: SubscriptionTier[];
   onSuccess: () => void;
   open: boolean;
   onOpenChange: (open: boolean) => void;
 }
 
 const AdminSubscriptionManager = ({ user, tiers, onSuccess, open, onOpenChange }: Props) => {
   const { toast } = useToast();
   const [selectedTier, setSelectedTier] = useState<string>("");
   const [duration, setDuration] = useState<string>("30");
   const [isTrial, setIsTrial] = useState(false);
   const [loading, setLoading] = useState(false);
 
   const handleGrantSubscription = async () => {
     if (!selectedTier) {
       toast({
         title: "Select a tier",
         description: "Please select a subscription tier",
         variant: "destructive",
       });
       return;
     }
 
     setLoading(true);
     try {
       const endDate = new Date();
       endDate.setDate(endDate.getDate() + parseInt(duration));
 
       // Check if user already has a subscription
       const { data: existing } = await supabase
         .from("user_subscriptions")
         .select("id")
         .eq("user_id", user.user_id)
         .maybeSingle();
 
       if (existing) {
         // Update existing subscription
         const { error } = await supabase
           .from("user_subscriptions")
           .update({
             tier_id: selectedTier,
             status: "active",
             is_trial: isTrial,
             trial_ends_at: isTrial ? endDate.toISOString() : null,
             billing_period_start: new Date().toISOString(),
             billing_period_end: endDate.toISOString(),
             scans_used_this_month: 0,
           })
           .eq("id", existing.id);
 
         if (error) throw error;
       } else {
         // Create new subscription
         const { error } = await supabase
           .from("user_subscriptions")
           .insert({
             user_id: user.user_id,
             tier_id: selectedTier,
             status: "active",
             is_trial: isTrial,
             trial_ends_at: isTrial ? endDate.toISOString() : null,
             billing_period_start: new Date().toISOString(),
             billing_period_end: endDate.toISOString(),
           });
 
         if (error) throw error;
       }
 
       toast({
         title: "Subscription granted",
         description: `${user.email} now has ${isTrial ? "trial" : ""} access for ${duration} days`,
       });
 
       onOpenChange(false);
       onSuccess();
     } catch (error) {
       console.error("Error granting subscription:", error);
       toast({
         title: "Failed to grant subscription",
         description: "Could not update user subscription",
         variant: "destructive",
       });
     } finally {
       setLoading(false);
     }
   };
 
   return (
     <Dialog open={open} onOpenChange={onOpenChange}>
       <DialogContent>
         <DialogHeader>
           <DialogTitle className="flex items-center gap-2">
             <Gift className="w-5 h-5 text-accent" />
             Grant Subscription
           </DialogTitle>
           <DialogDescription>
             Manually grant a subscription to {user.email}
           </DialogDescription>
         </DialogHeader>
 
         <div className="space-y-4 py-4">
           {/* Tier Selection */}
           <div className="space-y-2">
             <label className="text-sm font-medium text-foreground">
               Subscription Tier
             </label>
             <Select value={selectedTier} onValueChange={setSelectedTier}>
               <SelectTrigger>
                 <SelectValue placeholder="Select a tier" />
               </SelectTrigger>
               <SelectContent>
                 {tiers.map((tier) => (
                   <SelectItem key={tier.id} value={tier.id}>
                     {tier.name} (${tier.price_monthly}/mo)
                   </SelectItem>
                 ))}
               </SelectContent>
             </Select>
           </div>
 
           {/* Duration Selection */}
           <div className="space-y-2">
             <label className="text-sm font-medium text-foreground">
               Duration
             </label>
             <Select value={duration} onValueChange={setDuration}>
               <SelectTrigger>
                 <SelectValue />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="7">7 days</SelectItem>
                 <SelectItem value="14">14 days</SelectItem>
                 <SelectItem value="30">30 days (1 month)</SelectItem>
                 <SelectItem value="90">90 days (3 months)</SelectItem>
                 <SelectItem value="180">180 days (6 months)</SelectItem>
                 <SelectItem value="365">365 days (1 year)</SelectItem>
               </SelectContent>
             </Select>
           </div>
 
           {/* Trial Toggle */}
           <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-muted/30">
             <div className="flex items-center gap-3">
               <Calendar className="w-5 h-5 text-muted-foreground" />
               <div>
                 <p className="text-sm font-medium text-foreground">Mark as Trial</p>
                 <p className="text-xs text-muted-foreground">User will see trial badge & countdown</p>
               </div>
             </div>
             <button
               type="button"
               onClick={() => setIsTrial(!isTrial)}
               className={`w-12 h-6 rounded-full transition-colors ${
                 isTrial ? "bg-accent" : "bg-muted"
               }`}
             >
               <span
                 className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${
                   isTrial ? "translate-x-6" : "translate-x-0.5"
                 }`}
               />
             </button>
           </div>
         </div>
 
         <DialogFooter>
           <Button variant="outline" onClick={() => onOpenChange(false)}>
             Cancel
           </Button>
           <Button variant="hero" onClick={handleGrantSubscription} disabled={loading}>
             {loading ? (
               <>
                 <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                 Granting...
               </>
             ) : (
               "Grant Access"
             )}
           </Button>
         </DialogFooter>
       </DialogContent>
     </Dialog>
   );
 };
 
 export default AdminSubscriptionManager;