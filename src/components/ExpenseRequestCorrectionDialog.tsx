import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface ExpenseRequestCorrectionDialogProps {
  expenseId: string;
  expenseDescription: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ExpenseRequestCorrectionDialog({
  expenseId,
  expenseDescription,
  open,
  onOpenChange,
  onSuccess
}: ExpenseRequestCorrectionDialogProps) {
  const [correctionReason, setCorrectionReason] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('expenses')
        .update({
          status: 'correction_pending',
          correction_reason: correctionReason,
          correction_requested_at: new Date().toISOString(),
        })
        .eq('id', expenseId);

      if (error) throw error;

      // Send notification to treasurer
      supabase.functions.invoke('send-expense-notification', {
        body: { expenseId, action: 'correction_requested' }
      }).then(() => console.log('Correction request email sent')).catch(err => console.error('Email failed:', err));

      toast({
        title: 'Correction requested',
        description: 'The treasurer will review your request',
      });

      setCorrectionReason('');
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: 'Error requesting correction',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Correction</DialogTitle>
          <DialogDescription>
            Explain why this approved expense needs to be corrected
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Expense</Label>
              <p className="mt-1 font-medium">{expenseDescription}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="correction-reason">Reason for Correction *</Label>
              <Textarea
                id="correction-reason"
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                placeholder="Explain what needs to be corrected and why..."
                rows={4}
                required
              />
              <p className="text-xs text-muted-foreground">
                Be specific about what needs to change (e.g., "Need to split GST from historical data", "Wrong amount entered")
              </p>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !correctionReason.trim()}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Requesting...
                </>
              ) : (
                'Submit Request'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
