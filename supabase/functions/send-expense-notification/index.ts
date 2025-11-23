import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  expenseId: string;
  action: 'submitted' | 'approved' | 'rejected';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { expenseId, action }: NotificationRequest = await req.json();

    // Create Supabase client with service role for admin access
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch expense details with related data
    const { data: expense, error: expenseError } = await supabase
      .from('expenses')
      .select(`
        id,
        amount,
        description,
        expense_date,
        status,
        updated_at,
        budget_master!expenses_budget_master_id_fkey (
          item_name,
          category
        ),
        accountant:profiles!expenses_claimed_by_fkey (
          full_name,
          email
        ),
        treasurer:profiles!expenses_approved_by_fkey (
          full_name,
          email
        )
      `)
      .eq('id', expenseId)
      .single();

    if (expenseError || !expense) {
      throw new Error(`Expense not found: ${expenseError?.message}`);
    }

    const budgetMaster = Array.isArray(expense.budget_master) ? expense.budget_master[0] : expense.budget_master;
    const accountant = Array.isArray(expense.accountant) ? expense.accountant[0] : expense.accountant;
    const treasurer = Array.isArray(expense.treasurer) ? expense.treasurer[0] : expense.treasurer;

    const appUrl = Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovable.app') || 'http://localhost:5173';

    if (action === 'submitted') {
      // Fetch all treasurers to notify
      const { data: treasurers, error: treasurerError } = await supabase
        .from('user_roles')
        .select('user_id, profiles!user_roles_user_id_fkey (full_name, email)')
        .eq('role', 'treasurer');

      if (treasurerError || !treasurers || treasurers.length === 0) {
        throw new Error('No treasurers found to notify');
      }

      // Send email to all treasurers
      for (const treasurer of treasurers) {
        const treasurerProfile = treasurer.profiles as any;

        const emailContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #333; font-size: 24px; text-align: center;">New Expense Submitted</h1>
            <p>Hi ${treasurerProfile.full_name || 'Treasurer'},</p>
            <p>A new expense has been submitted and requires your approval.</p>
            
            <div style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; margin: 24px 0;">
              <p style="color: #6b7280; font-size: 12px; font-weight: 500; text-transform: uppercase;">Budget Item:</p>
              <p style="color: #111827; font-size: 16px;">${budgetMaster?.item_name || 'N/A'}</p>
              
              <p style="color: #6b7280; font-size: 12px; font-weight: 500; text-transform: uppercase;">Category:</p>
              <p style="color: #111827; font-size: 16px;">${budgetMaster?.category || 'N/A'}</p>
              
              <p style="color: #6b7280; font-size: 12px; font-weight: 500; text-transform: uppercase;">Amount:</p>
              <p style="color: #2563eb; font-size: 20px; font-weight: bold;">₹${Number(expense.amount).toLocaleString('en-IN')}</p>
              
              <p style="color: #6b7280; font-size: 12px; font-weight: 500; text-transform: uppercase;">Description:</p>
              <p style="color: #111827; font-size: 16px;">${expense.description}</p>
              
              <p style="color: #6b7280; font-size: 12px; font-weight: 500; text-transform: uppercase;">Expense Date:</p>
              <p style="color: #111827; font-size: 16px;">${new Date(expense.expense_date).toLocaleDateString('en-IN')}</p>
              
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
              
              <p style="color: #6b7280; font-size: 12px; font-weight: 500; text-transform: uppercase;">Submitted By:</p>
              <p style="color: #111827; font-size: 16px;">${accountant?.full_name || 'Accountant'}</p>
              <p style="color: #666; font-size: 12px;">${accountant?.email || ''}</p>
            </div>

            <a href="${appUrl}/approvals" style="background: #2563eb; border-radius: 8px; color: #fff; font-size: 16px; font-weight: bold; text-decoration: none; text-align: center; display: block; padding: 14px 20px; margin: 24px 0;">
              Review & Approve
            </a>

            <p style="color: #8898aa; font-size: 12px; text-align: center; margin: 24px 0;">
              This is an automated notification from your Expense Management System.
            </p>
          </div>
        `;

        await resend.emails.send({
          from: 'Expense Manager <onboarding@resend.dev>',
          to: [treasurerProfile.email],
          subject: `New Expense: ₹${Number(expense.amount).toLocaleString('en-IN')} - ${budgetMaster?.item_name || 'Expense'}`,
          html: emailContent,
        });
      }

      console.log(`Sent submission notifications to ${treasurers.length} treasurer(s)`);
    } else if (action === 'approved') {
      // Send email to accountant who submitted
      const emailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #16a34a; font-size: 24px; text-align: center;">✓ Expense Approved</h1>
          <p>Hi ${accountant?.full_name || 'User'},</p>
          <p>Good news! Your expense has been approved by ${treasurer?.full_name || 'Treasurer'}.</p>
          
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 24px; margin: 24px 0;">
            <p style="color: #6b7280; font-size: 12px; font-weight: 500; text-transform: uppercase;">Budget Item:</p>
            <p style="color: #111827; font-size: 16px;">${budgetMaster?.item_name || 'N/A'}</p>
            
            <p style="color: #6b7280; font-size: 12px; font-weight: 500; text-transform: uppercase;">Category:</p>
            <p style="color: #111827; font-size: 16px;">${budgetMaster?.category || 'N/A'}</p>
            
            <p style="color: #6b7280; font-size: 12px; font-weight: 500; text-transform: uppercase;">Amount:</p>
            <p style="color: #16a34a; font-size: 20px; font-weight: bold;">₹${Number(expense.amount).toLocaleString('en-IN')}</p>
            
            <p style="color: #6b7280; font-size: 12px; font-weight: 500; text-transform: uppercase;">Description:</p>
            <p style="color: #111827; font-size: 16px;">${expense.description}</p>
            
            <p style="color: #6b7280; font-size: 12px; font-weight: 500; text-transform: uppercase;">Expense Date:</p>
            <p style="color: #111827; font-size: 16px;">${new Date(expense.expense_date).toLocaleDateString('en-IN')}</p>
            
            <hr style="border: none; border-top: 1px solid #bbf7d0; margin: 20px 0;" />
            
            <p style="color: #6b7280; font-size: 12px; font-weight: 500; text-transform: uppercase;">Approved By:</p>
            <p style="color: #111827; font-size: 16px;">${treasurer?.full_name || 'Treasurer'}</p>
            
            <p style="color: #6b7280; font-size: 12px; font-weight: 500; text-transform: uppercase;">Approved On:</p>
            <p style="color: #111827; font-size: 16px;">${new Date(expense.updated_at).toLocaleDateString('en-IN')} at ${new Date(expense.updated_at).toLocaleTimeString('en-IN')}</p>
          </div>

          <a href="${appUrl}/dashboard" style="background: #16a34a; border-radius: 8px; color: #fff; font-size: 16px; font-weight: bold; text-decoration: none; text-align: center; display: block; padding: 14px 20px; margin: 24px 0;">
            View Dashboard
          </a>

          <p style="color: #8898aa; font-size: 12px; text-align: center; margin: 24px 0;">
            This is an automated notification from your Expense Management System.
          </p>
        </div>
      `;

      await resend.emails.send({
        from: 'Expense Manager <onboarding@resend.dev>',
        to: [accountant?.email || ''],
        subject: `✓ Expense Approved: ₹${Number(expense.amount).toLocaleString('en-IN')}`,
        html: emailContent,
      });

      console.log(`Sent approval notification to ${accountant?.email}`);
    } else if (action === 'rejected') {
      // Send email to accountant who submitted
      const emailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #dc2626; font-size: 24px; text-align: center;">✕ Expense Rejected</h1>
          <p>Hi ${accountant?.full_name || 'User'},</p>
          <p>Your expense submission has been reviewed and rejected by ${treasurer?.full_name || 'Treasurer'}.</p>
          
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 24px; margin: 24px 0;">
            <p style="color: #6b7280; font-size: 12px; font-weight: 500; text-transform: uppercase;">Budget Item:</p>
            <p style="color: #111827; font-size: 16px;">${budgetMaster?.item_name || 'N/A'}</p>
            
            <p style="color: #6b7280; font-size: 12px; font-weight: 500; text-transform: uppercase;">Category:</p>
            <p style="color: #111827; font-size: 16px;">${budgetMaster?.category || 'N/A'}</p>
            
            <p style="color: #6b7280; font-size: 12px; font-weight: 500; text-transform: uppercase;">Amount:</p>
            <p style="color: #dc2626; font-size: 20px; font-weight: bold;">₹${Number(expense.amount).toLocaleString('en-IN')}</p>
            
            <p style="color: #6b7280; font-size: 12px; font-weight: 500; text-transform: uppercase;">Description:</p>
            <p style="color: #111827; font-size: 16px;">${expense.description}</p>
            
            <p style="color: #6b7280; font-size: 12px; font-weight: 500; text-transform: uppercase;">Expense Date:</p>
            <p style="color: #111827; font-size: 16px;">${new Date(expense.expense_date).toLocaleDateString('en-IN')}</p>
            
            <hr style="border: none; border-top: 1px solid #fecaca; margin: 20px 0;" />
            
            <p style="color: #6b7280; font-size: 12px; font-weight: 500; text-transform: uppercase;">Rejected By:</p>
            <p style="color: #111827; font-size: 16px;">${treasurer?.full_name || 'Treasurer'}</p>
            
            <p style="color: #6b7280; font-size: 12px; font-weight: 500; text-transform: uppercase;">Rejected On:</p>
            <p style="color: #111827; font-size: 16px;">${new Date(expense.updated_at).toLocaleDateString('en-IN')} at ${new Date(expense.updated_at).toLocaleTimeString('en-IN')}</p>
          </div>

          <p style="color: #111827; font-size: 14px; margin: 24px 0;">
            Please review the details and resubmit if necessary with any required corrections.
          </p>

          <a href="${appUrl}/expenses" style="background: #dc2626; border-radius: 8px; color: #fff; font-size: 16px; font-weight: bold; text-decoration: none; text-align: center; display: block; padding: 14px 20px; margin: 24px 0;">
            View Expenses
          </a>

          <p style="color: #8898aa; font-size: 12px; text-align: center; margin: 24px 0;">
            This is an automated notification from your Expense Management System.
          </p>
        </div>
      `;

      await resend.emails.send({
        from: 'Expense Manager <onboarding@resend.dev>',
        to: [accountant?.email || ''],
        subject: `✕ Expense Rejected: ₹${Number(expense.amount).toLocaleString('en-IN')}`,
        html: emailContent,
      });

      console.log(`Sent rejection notification to ${accountant?.email}`);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Notification sent' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error sending notification:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
